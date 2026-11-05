/** Read-only, tenant-scoped steel facts. Never infer missing work or individual output. */
import type { Prisma } from '@/generated/prisma/client';
import { withTenantContext } from '@/lib/db/tenant-context';
import { steelDashboardData } from '@/lib/dashboard/steel-data';
import { addMetric, dayKey, emptyMetric, measure, midnight, monthDays, nextDay, shiftMonth, STEEL_TYPES, type Metric } from '@/lib/dashboard/steel-metrics';
import { ALL_STAGES, doneQty, stagePieces, stagesFor, type ElementState } from '@/lib/elements/stages';
import { batchState, readFactorySteps } from '@/lib/factory/production';
import { fuelTimeZone } from '@/lib/fleet/fuel/time';
import type { RequesterContext } from './requester';

type Tx = Prisma.TransactionClient;
type Company = { id: string; displayName: string; country: string };
type Candidate = { id: string; name: string };
type Failure = { ok: false; code: string; message: string; candidates?: Candidate[]; candidatesComplete?: boolean };
type ProjectFilter = { projectId?: string; projectName?: string };
type PageInput = { cursor?: string; limit?: number };
class FactError extends Error {
  constructor(readonly result: Failure) { super(result.message); }
}
function fail(code: string, message: string, candidates?: Candidate[], candidatesComplete?: boolean): never {
  throw new FactError({ ok: false, code, message, ...(candidates ? { candidates, candidatesComplete } : {}) });
}
function limitOf(input: number | undefined, fallback = 10) {
  if (input !== undefined && (!Number.isInteger(input) || input < 1 || input > 30)) fail('INVALID_LIMIT', 'Choose a page size between 1 and 30.');
  return input ?? fallback;
}
function clean(value: string | undefined) { return value?.trim().replace(/\s+/g, ' ') || undefined; }
function source(company: Company, tables: string[], now: Date) {
  return { retrievedAt: now.toISOString(), timeZone: fuelTimeZone(company.country), tables, readOnly: true, freshness: 'database-at-query-time' };
}
async function run<T>(requester: RequesterContext, operation: (company: Company, now: Date) => Promise<T>): Promise<T | Failure> {
  if (requester.kind !== 'admin') return { ok: false, code: 'ADMIN_REQUIRED', message: 'Only an authenticated company administrator may read these records.' };
  try {
    const company = await withTenantContext(requester.companyId, tx => tx.companyProfile.findFirst({
      where: { id: requester.companyId, mode: 'bau', users: { some: { id: requester.adminId, role: 'ADMIN', isActive: true } } },
      select: { id: true, displayName: true, country: true },
    }));
    if (!company) return { ok: false, code: 'ACCESS_DENIED', message: 'No authorized steel company was found for this administrator.' };
    const steel = await withTenantContext(company.id, tx => tx.baustelle.findFirst({ where: { companyProfileId: company.id, type: { in: [...STEEL_TYPES] } }, select: { id: true } }));
    if (!steel) return { ok: false, code: 'STEEL_NOT_CONFIGURED', message: 'No steel production project or workshop is configured for this company.' };
    return await operation(company, new Date());
  } catch (error) {
    if (error instanceof FactError) return error.result;
    throw error;
  }
}
const projectScope = (companyId: string): Prisma.BaustelleWhereInput => ({ companyProfileId: companyId, type: 'STEEL_ASSEMBLY' });
async function projectFor(tx: Tx, companyId: string, input: ProjectFilter) {
  const id = clean(input.projectId), name = clean(input.projectName);
  if (!id && !name) return null;
  const rows = await tx.baustelle.findMany({
    where: { ...projectScope(companyId), ...(id ? { id } : {}), ...(name ? { name: { equals: name, mode: 'insensitive' } } : {}) },
    select: { id: true, name: true }, orderBy: { id: 'asc' }, take: 9,
  });
  if (rows.length === 1) return rows[0];
  if (rows.length > 1) fail('AMBIGUOUS_PROJECT', 'Several projects have that name. Ask which project ID is intended.', rows.slice(0, 8), rows.length <= 8);
  if (!id && name) {
    const suggestions = await tx.baustelle.findMany({ where: { ...projectScope(companyId), name: { contains: name, mode: 'insensitive' } }, select: { id: true, name: true }, orderBy: { id: 'asc' }, take: 9 });
    if (suggestions.length) fail('PROJECT_SELECTION_REQUIRED', 'The exact project name was not found. Select an ID from these matches; do not guess.', suggestions.slice(0, 8), suggestions.length <= 8);
  }
  fail('PROJECT_NOT_FOUND', 'No matching steel project exists in this company.');
}
function period(input: { date?: string; month?: string }, company: Company, now: Date) {
  const today = dayKey(now, fuelTimeZone(company.country));
  const rawDate = clean(input.date), rawMonth = clean(input.month);
  if (rawMonth && !/^20\d{2}-(0[1-9]|1[0-2])$/.test(rawMonth)) fail('INVALID_MONTH', 'Use a valid calendar month YYYY-MM.');
  if (rawDate && (!/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(rawDate) || !monthDays(rawDate.slice(0, 7)).includes(rawDate))) fail('INVALID_DATE', 'Use a valid calendar date YYYY-MM-DD.');
  if (rawMonth && rawDate && !rawDate.startsWith(`${rawMonth}-`)) fail('PERIOD_MISMATCH', 'The requested date must belong to the requested month.');
  const month = rawMonth ?? rawDate?.slice(0, 7) ?? today.slice(0, 7);
  const date = rawDate ?? (today.startsWith(month) ? today : `${month}-01`);
  const zone = fuelTimeZone(company.country);
  return { date, month, zone, from: midnight(rawDate ?? (rawMonth ? `${month}-01` : today), zone), to: midnight(rawDate ? nextDay(rawDate) : rawMonth ? `${shiftMonth(month, 1)}-01` : nextDay(today), zone) };
}
const elementSelect = {
  id: true, baustelleId: true, list: true, mark: true, kind: true, profile: true, material: true, quantity: true, lengthMm: true, weightKg: true, areaM2: true,
  sourceFile: true, factoryDoneAt: true, factoryDoneBy: true, fieldDoneAt: true, fieldDoneBy: true, updatedAt: true,
  baustelle: { select: { id: true, name: true } },
  work: { select: { stage: true, pieces: true } },
} satisfies Prisma.SiteElementSelect;
type ElementRow = Prisma.SiteElementGetPayload<{ select: typeof elementSelect }>;
function elementPayload(row: ElementRow) {
  const state = { ...row, list: row.list === 'part' ? 'part' : 'assembly' } satisfies ElementState;
  const unitWeightKg = row.weightKg !== null && Number.isFinite(row.weightKg) && row.weightKg >= 0 ? row.weightKg : null;
  return {
    id: row.id, project: row.baustelle, list: row.list, mark: row.mark, kind: row.kind, profile: row.profile, material: row.material,
    quantity: row.quantity, lengthMm: row.lengthMm, unitWeightKg, totalKnownWeightKg: unitWeightKg === null ? null : unitWeightKg * row.quantity, areaM2: row.areaM2,
    sourceFile: row.sourceFile, updatedAt: row.updatedAt.toISOString(),
    factory: { finishedPieces: doneQty(state, 'factory'), routeClosedAt: row.factoryDoneAt?.toISOString() ?? null, closedBy: row.factoryDoneBy },
    field: { finishedPieces: doneQty(state, 'field'), routeClosedAt: row.fieldDoneAt?.toISOString() ?? null, closedBy: row.fieldDoneBy },
    stages: [...stagesFor('factory', state.list), ...stagesFor('field', state.list)].map(stage => ({ stage, completedPieces: stagePieces(state, stage) })),
    confirmationCount: row.work.length,
  };
}

export async function adminSearchSteelProjects(requester: RequesterContext, input: PageInput & { query?: string } = {}) {
  return run(requester, (company, now) => withTenantContext(company.id, async tx => {
    const limit = limitOf(input.limit), query = clean(input.query);
    const where = { ...projectScope(company.id), ...(query ? { name: { contains: query, mode: 'insensitive' as const } } : {}) };
    if (input.cursor && !await tx.baustelle.findFirst({ where: { ...where, id: input.cursor }, select: { id: true } })) fail('INVALID_CURSOR', 'The project cursor does not belong to this query.');
    const totalMatches = await tx.baustelle.count({ where });
    const rows = await tx.baustelle.findMany({ where, select: { id: true, name: true, status: true, address: true, updatedAt: true, _count: { select: { siteElements: true, productionBatches: true, siteFiles: true } } }, orderBy: { id: 'asc' }, ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}), take: limit + 1 });
    const page = rows.slice(0, limit), hasMore = rows.length > limit;
    return { ok: true as const, source: source(company, ['Baustelle', 'SiteElement', 'ProductionBatch', 'SiteFile'], now), totalMatches, pageComplete: !hasMore, nextCursor: hasMore ? page.at(-1)!.id : null, projects: page.map(r => ({ id: r.id, name: r.name, status: r.status, address: r.address, updatedAt: r.updatedAt.toISOString(), elementMarks: r._count.siteElements, productionGroups: r._count.productionBatches, fileRecords: r._count.siteFiles, url: `/workzone/baustellen/${r.id}` })) };
  }));
}

export async function adminSearchSteelElements(requester: RequesterContext, input: ProjectFilter & PageInput & { query?: string; list?: 'assembly' | 'part' } = {}) {
  return run(requester, (company, now) => withTenantContext(company.id, async tx => {
    const limit = limitOf(input.limit), project = await projectFor(tx, company.id, input), query = clean(input.query);
    const where: Prisma.SiteElementWhereInput = { companyProfileId: company.id, baustelle: projectScope(company.id), ...(project ? { baustelleId: project.id } : {}), list: input.list ?? { in: ['assembly', 'part'] }, ...(query ? { OR: ['mark', 'profile', 'material', 'kind'].map(field => ({ [field]: { contains: query, mode: 'insensitive' } })) } : {}) };
    if (input.cursor && !await tx.siteElement.findFirst({ where: { ...where, id: input.cursor }, select: { id: true } })) fail('INVALID_CURSOR', 'The element cursor does not belong to this query.');
    const totalMatches = await tx.siteElement.count({ where });
    const rows = await tx.siteElement.findMany({ where, select: { ...elementSelect, work: { ...elementSelect.work, where: { companyProfileId: company.id } } }, orderBy: { id: 'asc' }, ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}), take: limit + 1 });
    const page = rows.slice(0, limit), hasMore = rows.length > limit;
    return { ok: true as const, source: source(company, ['SiteElement', 'SiteElementWork'], now), totalMatches, pageComplete: !hasMore, nextCursor: hasMore ? page.at(-1)!.id : null, elements: page.map(elementPayload), interpretation: 'Current list values and current stage progress. Search rows are a page, never the complete production total.' };
  }));
}

export async function adminGetSteelElement(requester: RequesterContext, input: ProjectFilter & { elementId?: string; mark?: string; list?: 'assembly' | 'part' }) {
  return run(requester, (company, now) => withTenantContext(company.id, async tx => {
    const project = await projectFor(tx, company.id, input), id = clean(input.elementId), mark = clean(input.mark);
    if (!id && !mark) fail('ELEMENT_REQUIRED', 'Provide an element ID or a drawing mark.');
    const rows = await tx.siteElement.findMany({ where: { companyProfileId: company.id, baustelle: projectScope(company.id), ...(project ? { baustelleId: project.id } : {}), ...(id ? { id } : {}), ...(mark ? { mark: { equals: mark, mode: 'insensitive' } } : {}), list: input.list ?? { in: ['assembly', 'part'] } }, select: { ...elementSelect, work: { ...elementSelect.work, where: { companyProfileId: company.id } } }, orderBy: { id: 'asc' }, take: 9 });
    if (!rows.length) fail('ELEMENT_NOT_FOUND', 'No matching element exists in this company and project.');
    if (rows.length > 1) fail('AMBIGUOUS_ELEMENT', 'This mark occurs in several projects or lists. Ask which element ID is intended.', rows.slice(0, 8).map(r => ({ id: r.id, name: `${r.baustelle.name} / ${r.list} / ${r.mark}` })), rows.length <= 8);
    return { ok: true as const, source: source(company, ['SiteElement', 'SiteElementWork'], now), element: elementPayload(rows[0]), interpretation: 'Current imported element and confirmed route progress. A closed route may omit unnecessary stages; do not require every possible stage. Use production evidence for historical weights and credited workers.' };
  }));
}

export async function adminGetSteelProductionSummary(requester: RequesterContext, input: ProjectFilter & { month?: string; date?: string; projectCursor?: string; limit?: number } = {}) {
  return run(requester, async (company, now) => {
    const range = period(input, company, now), limit = limitOf(input.limit);
    const project = await withTenantContext(company.id, tx => projectFor(tx, company.id, input));
    const data = await steelDashboardData(company, { month: range.month, day: range.date, project: project?.id }, true, now);
    const cursorIndex = input.projectCursor ? data.projectRows.findIndex(p => p.id === input.projectCursor) : -1;
    if (input.projectCursor && cursorIndex < 0) fail('INVALID_CURSOR', 'The project cursor does not belong to this summary.');
    const page = data.projectRows.slice(cursorIndex + 1, cursorIndex + 1 + limit), hasMore = data.projectRows.length > cursorIndex + 1 + limit;
    return { ok: true as const, source: source(company, ['SiteElement', 'SiteElementWork', 'Baustelle'], now), month: data.month, selectedDate: data.day, selectedProject: project, currentProgress: data.totalProgress,
      monthlyProduction: data.totals, dailyProduction: data.days.filter(d => d.checks > 0 || d.key === data.day),
      projectCount: data.projectRows.length, projectPageComplete: !hasMore, nextProjectCursor: hasMore ? page.at(-1)!.id : null,
      projects: page.map(p => ({ id: p.id, name: p.name, status: p.status, currentProgress: p.progress, monthlyProduction: p.month })),
      interpretation: { productionDate: 'confirmation time in the company timezone, not the actual work start/end', weight: 'immutable confirmation snapshot where present; legacyPieces use current-list weights and are approximate; missingPieces have unknown weight', stages: 'cutParts, cutAssemblies and assembled are separate processes, never add them into one steel total', currentProgress: 'current assembly-list progress, not the monthly throughput or a historical inventory snapshot', completeness: 'All matching confirmation rows contribute to the totals; project details are paginated separately.' },
    };
  });
}

async function workerFor(tx: Tx, companyId: string, input: { workerId?: string; workerName?: string }) {
  const id = clean(input.workerId), name = clean(input.workerName);
  if (!id && !name) return null;
  const [first, ...last] = (name ?? '').split(' ');
  const rows = await tx.worker.findMany({ where: { companyProfileId: companyId, ...(id ? { id } : {}), ...(name ? { OR: [{ firstName: { equals: name, mode: 'insensitive' } }, { lastName: { equals: name, mode: 'insensitive' } }, { firstName: { equals: first, mode: 'insensitive' }, lastName: { equals: last.join(' '), mode: 'insensitive' } }] } : {}) }, select: { id: true, firstName: true, lastName: true }, orderBy: { id: 'asc' }, take: 9 });
  if (!rows.length) fail('WORKER_NOT_FOUND', 'No matching worker was found in this company.');
  if (rows.length > 1) fail('AMBIGUOUS_WORKER', 'Several workers match that name. Ask which worker ID is intended.', rows.slice(0, 8).map(w => ({ id: w.id, name: `${w.firstName} ${w.lastName}`.trim() })), rows.length <= 8);
  return { id: rows[0].id, name: `${rows[0].firstName} ${rows[0].lastName}`.trim() };
}

export async function adminGetSteelProductionEvidence(requester: RequesterContext, input: ProjectFilter & PageInput & { elementId?: string; workerId?: string; workerName?: string; stage?: string; date?: string; month?: string } = {}) {
  return run(requester, (company, now) => withTenantContext(company.id, async tx => {
    const range = period(input, company, now), limit = limitOf(input.limit), project = await projectFor(tx, company.id, input), worker = await workerFor(tx, company.id, input);
    if (input.stage && !ALL_STAGES.includes(input.stage)) fail('INVALID_STAGE', 'Use a supported factory or site stage.');
    if (input.elementId && !await tx.siteElement.findFirst({ where: { id: input.elementId, companyProfileId: company.id, baustelle: projectScope(company.id), ...(project ? { baustelleId: project.id } : {}) }, select: { id: true } })) fail('ELEMENT_NOT_FOUND', 'No matching element exists in this company and project.');
    const base: Prisma.SiteElementWorkWhereInput = { companyProfileId: company.id, element: { companyProfileId: company.id, baustelle: projectScope(company.id), ...(project ? { baustelleId: project.id } : {}), ...(input.elementId ? { id: input.elementId } : {}), list: { in: ['assembly', 'part'] } }, checkedAt: { gte: range.from, lt: range.to }, ...(input.stage ? { stage: input.stage } : {}) };
    // The complete bounded period is measured before pagination. No hidden take() on totals.
    const rows = await tx.siteElementWork.findMany({ where: { ...base, ...(worker ? { workerIds: { has: worker.id } } : {}) }, select: { id: true, stage: true, pieces: true, checkedAt: true, productionSnapshot: true, workerIds: true, workerNames: true, checkedByName: true, checkedByWorkerId: true, checkedByUserId: true, element: { select: { id: true, baustelleId: true, list: true, mark: true, quantity: true, weightKg: true, baustelle: { select: { id: true, name: true } } } } }, orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }] });
    const cursorIndex = input.cursor ? rows.findIndex(r => r.id === input.cursor) : -1;
    if (input.cursor && cursorIndex < 0) fail('INVALID_CURSOR', 'The confirmation cursor does not belong to this query.');
    const measured = rows.map(r => ({ row: r, value: measure({ ...r, elementId: r.element.id }, { ...r.element, work: [], factoryDoneAt: null, fieldDoneAt: null }) }));
    const aggregates = new Map<string, { list: string; stage: string; metric: Metric }>();
    for (const item of measured) {
      const key = `${item.value.list}:${item.row.stage}`, group = aggregates.get(key) ?? { list: item.value.list, stage: item.row.stage, metric: emptyMetric() };
      addMetric(group.metric, item.value); aggregates.set(key, group);
    }
    const page = measured.slice(cursorIndex + 1, cursorIndex + 1 + limit), hasMore = measured.length > cursorIndex + 1 + limit;
    const unlinkedConfirmations = worker ? await tx.siteElementWork.count({ where: { ...base, workerIds: { isEmpty: true } } }) : null;
    return { ok: true as const, source: source(company, ['SiteElementWork', 'SiteElement', 'Worker'], now), periodFrom: range.from.toISOString(), periodToExclusive: range.to.toISOString(), project, worker, totalMatchingConfirmations: rows.length, aggregates: [...aggregates.values()], pageComplete: !hasMore, nextCursor: hasMore ? page.at(-1)!.row.id : null, unlinkedConfirmationsInScope: unlinkedConfirmations,
      confirmations: page.map(({ row, value }) => ({ id: row.id, elementId: row.element.id, project: row.element.baustelle, stage: row.stage, checkedAt: row.checkedAt.toISOString(), ...value, creditedWorkerIds: row.workerIds, creditedWorkerNames: row.workerNames, checkedByName: row.checkedByName, checkedByWorkerId: row.checkedByWorkerId, checkedByUserId: row.checkedByUserId })),
      interpretation: { totals: 'Complete totals for the specified recorded-confirmation scope; list/stage aggregates must not be added into unique steel tonnage.', workerAttribution: 'workerIds are credited participants; checkedBy is the engineer/admin who confirmed. Team quantities are shared confirmation output, not individual productivity; do not divide or duplicate kg per worker.', unlinked: 'Legacy confirmations without linked worker IDs cannot be attributed reliably; worker-filtered results exclude them.', timing: 'checkedAt is the confirmation timestamp, not actual working time or proof of presence.', weights: 'legacy=true uses current-list values and is approximate; kg=null means unknown weight, not zero.' },
    };
  }, { timeout: 20000 }));
}

export async function adminGetSteelProjectBatches(requester: RequesterContext, input: ProjectFilter & PageInput & { query?: string } = {}) {
  return run(requester, (company, now) => withTenantContext(company.id, async tx => {
    const project = await projectFor(tx, company.id, input), limit = limitOf(input.limit), query = clean(input.query);
    const where: Prisma.ProductionBatchWhereInput = { companyProfileId: company.id, baustelle: projectScope(company.id), ...(project ? { baustelleId: project.id } : {}), ...(query ? { OR: [{ title: { contains: query, mode: 'insensitive' } }, { orderRef: { contains: query, mode: 'insensitive' } }] } : {}) };
    if (input.cursor && !await tx.productionBatch.findFirst({ where: { ...where, id: input.cursor }, select: { id: true } })) fail('INVALID_CURSOR', 'The production-group cursor does not belong to this query.');
    const totalMatches = await tx.productionBatch.count({ where });
    const rows = await tx.productionBatch.findMany({ where, select: { id: true, title: true, quantity: true, unit: true, steps: true, readyAt: true, orderRef: true, updatedAt: true, baustelle: { select: { id: true, name: true } } }, orderBy: { id: 'asc' }, ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}), take: limit + 1 });
    const page = rows.slice(0, limit), hasMore = rows.length > limit;
    return { ok: true as const, source: source(company, ['ProductionBatch'], now), totalMatches, pageComplete: !hasMore, nextCursor: hasMore ? page.at(-1)!.id : null, batches: page.map(row => { const steps = readFactorySteps(row.steps); return { id: row.id, project: row.baustelle, title: row.title, quantity: row.quantity, unit: row.unit, steps, state: batchState(steps), readyAt: row.readyAt?.toISOString() ?? null, orderRef: row.orderRef, updatedAt: row.updatedAt.toISOString() }; }), interpretation: 'Separate material/order production groups. Their quantities and units must not be added to element-list throughput or treated as individual assembled pieces.' };
  }));
}
