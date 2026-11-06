/** Read-only phase-document metadata and version-specific receipt evidence. */
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { WorkerLevel } from '@/generated/prisma/enums';
import { prisma } from '@/lib/db/prisma';
import { documentActor } from '@/lib/site-phase-documents/access';
import { DOCUMENT_PHASES } from '@/lib/site-phase-documents/types';
import { CREW_ROLES, crewPermissions } from '@/lib/workzone/crew-roles';
import { fuelTimeZone } from '@/lib/fleet/fuel/time';
import { categorizeAssistantFailure } from './diagnostics';
import type { RequesterContext } from './requester';

const id = z.string().trim().regex(/^[a-z0-9_-]{1,120}$/i);
const limit = z.number().int().min(1).max(20).optional();
export const phaseDocumentListInput = z.object({
  projectId: id.optional(), projectName: z.string().trim().min(1).max(180).optional(),
  phase: z.enum(DOCUMENT_PHASES).optional(), query: z.string().trim().max(100).optional(),
  includeArchived: z.boolean().optional(), cursor: z.uuid().optional(), limit,
}).strict();
export const phaseDocumentReceiptInput = z.object({
  documentId: z.uuid(), status: z.enum(['all', 'received', 'unconfirmed']).optional(),
  cursor: z.string().regex(/^(user|worker):[a-z0-9_-]{1,120}$/i).optional(), limit,
}).strict();
type Tx = Prisma.TransactionClient;
type ListInput = z.infer<typeof phaseDocumentListInput>;
type ReceiptInput = z.infer<typeof phaseDocumentReceiptInput>;
const deny = () => ({ ok: false as const, code: 'FORBIDDEN', message: 'A current administrator of this steel company is required.' });
function fail(code: string, message: string) { return { ok: false as const, code, message }; }

/** Derive SQL eligibility from the same role rules used by documentActor.
 * Explicit worker/mechanic roles override legacy foreman/master levels. */
export function phaseDocumentEligibleWorkers(companyId: string): Prisma.WorkerWhereInput {
  const allowed = (crewRole: string | null, level?: string) => {
    const p = crewPermissions({ isAdmin: false, crewRole, level });
    return p.office || p.siteSteps || p.factorySteps;
  };
  return { companyProfileId: companyId, status: 'active', OR: [
    { crewRole: { in: CREW_ROLES.filter(role => allowed(role)) } },
    { level: { in: Object.values(WorkerLevel).filter(level => allowed(null, level)) },
      OR: [{ crewRole: null }, { crewRole: { notIn: [...CREW_ROLES] } }] },
  ] };
}

async function read<T>(requester: RequesterContext, operation: (tx: Tx, companyId: string) => Promise<T>) {
  if (requester.kind !== 'admin' || !requester.companyId || !requester.adminId) return deny();
  try {
    const actor = await documentActor();
    if (actor.companyId !== requester.companyId || actor.userId !== requester.adminId || actor.workerId || !actor.office) return deny();
    return await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${actor.companyId}, true)`;
      const admin = await tx.user.findFirst({ where: { id: requester.adminId, companyProfileId: actor.companyId, role: 'ADMIN', isActive: true }, select: { id: true } });
      if (!admin) return deny();
      const company = await tx.companyProfile.findUnique({ where: { id: actor.companyId }, select: { country: true } });
      if (!company) return deny();
      const retrievedAt = new Date().toISOString();
      return { ...await operation(tx, actor.companyId), source: 'Site phase documents and version-specific personal receipts', retrievedAt,
        timeZone: fuelTimeZone(company.country), readOnly: true, consistency: 'One repeatable-read tenant snapshot; metadata only, no file contents or writes.' };
    }, { isolationLevel: 'RepeatableRead', timeout: 10000, maxWait: 3000 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'DENIED') return deny();
    return { ...fail('DATA_UNAVAILABLE', 'Document or receipt evidence is unavailable, not zero or proof that no one received it.'), diagnostic: categorizeAssistantFailure(error, { source: 'database' }) };
  }
}

const siteScope = (companyId: string): Prisma.BaustelleWhereInput => ({ companyProfileId: companyId, type: 'STEEL_ASSEMBLY' });
async function projectFor(tx: Tx, companyId: string, input: ListInput) {
  if (!input.projectId && !input.projectName) return fail('PROJECT_REQUIRED', 'Specify a site ID or exact site name; discover candidates with the steel project search.');
  const where = { ...siteScope(companyId), ...(input.projectId ? { id: input.projectId } : {}),
    ...(input.projectName ? { name: { equals: input.projectName, mode: 'insensitive' as const } } : {}) };
  const sites = await tx.baustelle.findMany({ where, select: { id: true, name: true }, orderBy: { id: 'asc' }, take: 9 });
  if (sites.length > 1) return { ...fail('AMBIGUOUS_PROJECT', 'Several sites share that name. Ask which site is intended.'), candidates: sites.slice(0, 8), candidatesComplete: sites.length <= 8 };
  if (!sites.length) return fail('PROJECT_NOT_FOUND', 'No exact site matches inside this company. Use project discovery; never guess a partial name.');
  return { ok: true as const, site: sites[0] };
}
const documentSelect = { id: true, phase: true, title: true, note: true, fileName: true, mime: true, size: true,
  createdByName: true, createdAt: true, archivedAt: true, supersedesId: true,
  _count: { select: { receipts: true } },
} satisfies Prisma.SitePhaseDocumentSelect;
function documentView(d: Prisma.SitePhaseDocumentGetPayload<{ select: typeof documentSelect }>) {
  return { id: d.id, phase: d.phase, title: d.title, note: d.note.slice(0, 300), noteTruncated: d.note.length > 300,
    fileName: d.fileName, mime: d.mime, sizeBytes: d.size, uploadedBy: d.createdByName, uploadedAt: d.createdAt.toISOString(),
    archivedAt: d.archivedAt?.toISOString() ?? null, supersedesId: d.supersedesId, receiptCount: d._count.receipts,
    downloadUrl: `/api/site-phase-documents/${d.id}` };
}

export async function adminGetSitePhaseDocuments(requester: RequesterContext, input: ListInput = {}) {
  const parsed = phaseDocumentListInput.safeParse(input);
  if (!parsed.success) return fail('INVALID_INPUT', 'Use a valid site, phase, version cursor and bounded page size.');
  return read(requester, async (tx, companyId) => {
    const p = await projectFor(tx, companyId, parsed.data); if (!p.ok) return p;
    const filter = parsed.data, take = filter.limit ?? 8;
    const where: Prisma.SitePhaseDocumentWhereInput = { companyProfileId: companyId, baustelleId: p.site.id,
      ...(filter.phase ? { phase: filter.phase } : {}), ...(filter.includeArchived ? {} : { archivedAt: null }),
      ...(filter.query ? { OR: [{ title: { contains: filter.query, mode: 'insensitive' } }, { fileName: { contains: filter.query, mode: 'insensitive' } }] } : {}),
    };
    if (filter.cursor && !await tx.sitePhaseDocument.findFirst({ where: { ...where, id: filter.cursor }, select: { id: true } })) return fail('INVALID_CURSOR', 'The document cursor does not belong to this site/filter.');
    const [totalMatching, phases, rows] = await Promise.all([
      tx.sitePhaseDocument.count({ where }),
      tx.sitePhaseDocument.groupBy({ by: ['phase'], where, _count: { _all: true } }),
      tx.sitePhaseDocument.findMany({ where, select: documentSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: take + 1,
        ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}) }),
    ]);
    const hasMore = rows.length > take, documents = rows.slice(0, take).map(documentView);
    return { ok: true as const, project: { ...p.site, url: `/workzone/baustellen/${p.site.id}` }, filters: { ...filter, cursor: filter.cursor ?? null },
      totalMatching, returnedCount: documents.length, complete: !filter.cursor && !hasMore, pageComplete: !hasMore,
      nextCursor: hasMore ? documents.at(-1)!.id : null,
      phaseCounts: DOCUMENT_PHASES.map(phase => ({ phase, count: phases.find(p => p.phase === phase)?._count._all ?? 0 })), order: 'uploaded_at_desc_then_id_desc', documents,
      semantics: 'Current unarchived versions by default; archive only when requested. Counts cover this filter, not general site files. Receipt count belongs only to each exact file version; use its ID for people. Files were not read.' };
  });
}

const personName = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName}`.trim();
export async function adminGetSitePhaseDocumentReceipts(requester: RequesterContext, input: ReceiptInput) {
  const parsed = phaseDocumentReceiptInput.safeParse(input);
  if (!parsed.success) return fail('INVALID_INPUT', 'Provide the document version UUID and a valid receipt status/cursor.');
  return read(requester, async (tx, companyId) => {
    const filter = parsed.data, take = filter.limit ?? 8, status = filter.status ?? 'all';
    const doc = await tx.sitePhaseDocument.findFirst({ where: { id: filter.documentId, companyProfileId: companyId, baustelle: siteScope(companyId) },
      select: { ...documentSelect, baustelle: { select: { id: true, name: true } } } });
    if (!doc) return fail('DOCUMENT_NOT_FOUND', 'No accessible site document version matches this ID.');
    const receiptScope = { companyProfileId: companyId, documentId: doc.id };
    const admins: Prisma.UserWhereInput = { companyProfileId: companyId, role: 'ADMIN', isActive: true };
    const workers = phaseDocumentEligibleWorkers(companyId);
    const missingAdmins: Prisma.UserWhereInput = { ...admins, phaseReceipts: { none: receiptScope } };
    const missingWorkers: Prisma.WorkerWhereInput = { ...workers, phaseReceipts: { none: receiptScope } };
    const userScope: Prisma.UserWhereInput = status === 'unconfirmed' ? missingAdmins : status === 'received'
      ? { companyProfileId: companyId, phaseReceipts: { some: receiptScope } }
      : { companyProfileId: companyId, OR: [admins, { phaseReceipts: { some: receiptScope } }] };
    const workerScope: Prisma.WorkerWhereInput = status === 'unconfirmed' ? missingWorkers : status === 'received'
      ? { companyProfileId: companyId, phaseReceipts: { some: receiptScope } }
      : { companyProfileId: companyId, OR: [workers, { phaseReceipts: { some: receiptScope } }] };
    if (filter.cursor) {
      const [kind, personId] = filter.cursor.split(':');
      const found = kind === 'user'
        ? await tx.user.findFirst({ where: { ...userScope, id: personId }, select: { id: true } })
        : await tx.worker.findFirst({ where: { ...workerScope, id: personId }, select: { id: true } });
      if (!found) return fail('INVALID_CURSOR', 'The person cursor does not belong to this document/status.');
    }
    const [eligibleAdmins, eligibleWorkers, unconfirmedAdmins, unconfirmedWorkers, receivedCount] = await Promise.all([
      tx.user.count({ where: admins }), tx.worker.count({ where: workers }), tx.user.count({ where: missingAdmins }),
      tx.worker.count({ where: missingWorkers }), tx.sitePhaseDocumentReceipt.count({ where: receiptScope }),
    ]);
    const [cursorKind, cursorId] = filter.cursor?.split(':') ?? [];
    const receiptSelect = { where: receiptScope, select: { actorName: true, receivedAt: true }, take: 1 };
    // Concatenate account kinds, retaining each database-ordered ID page. Do not
    // merge using JS collation, which can disagree with the database's collation.
    const [users, crew] = await Promise.all([
      cursorKind === 'worker' ? [] : tx.user.findMany({ where: { ...userScope, ...(cursorId ? { id: { gt: cursorId } } : {}) },
        select: { id: true, name: true, role: true, isActive: true, phaseReceipts: receiptSelect }, orderBy: { id: 'asc' }, take: take + 1 }),
      tx.worker.findMany({ where: { ...workerScope, ...(cursorKind === 'worker' ? { id: { gt: cursorId } } : {}) },
        select: { id: true, firstName: true, lastName: true, status: true, crewRole: true, level: true, phaseReceipts: receiptSelect }, orderBy: { id: 'asc' }, take: take + 1 }),
    ]);
    const candidates = [
      ...users.map(u => { const r = u.phaseReceipts[0]; return { key: `user:${u.id}`, kind: 'admin', id: u.id,
        name: r?.actorName ?? u.name ?? 'Administrator', currentName: u.name, hasAccessNow: u.isActive && u.role === 'ADMIN',
        confirmed: Boolean(r), receivedAt: r?.receivedAt.toISOString() ?? null }; }),
      ...crew.map(w => { const r = w.phaseReceipts[0], p = crewPermissions({ isAdmin: false, ...w }); return { key: `worker:${w.id}`, kind: 'worker', id: w.id,
        name: r?.actorName ?? personName(w), currentName: personName(w), hasAccessNow: w.status === 'active' && (p.office || p.factorySteps || p.siteSteps),
        confirmed: Boolean(r), receivedAt: r?.receivedAt.toISOString() ?? null }; }),
    ];
    const hasMore = candidates.length > take, page = candidates.slice(0, take), missing = unconfirmedAdmins + unconfirmedWorkers;
    return { ok: true as const, project: doc.baustelle, document: documentView(doc), status,
      summary: { received: receivedCount, currentlyEligible: eligibleAdmins + eligibleWorkers, currentlyEligibleConfirmed: eligibleAdmins + eligibleWorkers - missing, currentlyEligibleUnconfirmed: missing },
      totalMatching: status === 'received' ? receivedCount : status === 'unconfirmed' ? missing : receivedCount + missing,
      returnedCount: page.length, complete: !filter.cursor && !hasMore, pageComplete: !hasMore,
      nextCursor: hasMore ? page.at(-1)!.key : null, people: page.map(p => ({ kind: p.kind, id: p.id, name: p.name, currentName: p.currentName, hasAccessNow: p.hasAccessNow, confirmed: p.confirmed, receivedAt: p.receivedAt })),
      recipientAssignmentsTracked: false, openedOrReadTracked: false,
      semantics: 'Received means this account pressed E mora for this exact version, not proof it opened/read the file. Unconfirmed means active currently authorized admin/office/engineer accounts without that receipt, not assigned recipients or overdue people. Current access is not historical access. Account identities are not deduplicated by name; they may represent the same human. Historical receipts remain even after access changes. No inference across file versions.' };
  });
}
