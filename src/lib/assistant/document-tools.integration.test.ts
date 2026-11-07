import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const identity = vi.hoisted(() => ({ actor: vi.fn() }));
vi.mock('@/lib/site-phase-documents/access', () => ({ documentActor: identity.actor }));
import { prisma } from '@/lib/db/prisma';
import { assertAssistantTestDatabase } from '../../../tests/fixtures/assistant-database';
import { adminGetSitePhaseDocuments, adminGetSitePhaseDocumentReceipts } from './document-tools';
import type { RequesterContext } from './requester';
assertAssistantTestDatabase();
let companies: string[] = [], companyId: string, siteId: string, foreignSite: string, adminId: string, requester: RequesterContext;
let crew: { id: string; firstName: string; lastName: string; crewRole: string | null; level: string; status: string }[];
beforeEach(async () => {
  companies = []; identity.actor.mockReset();
  const company = await prisma.companyProfile.create({ data: { legalName: 'Synthetic document company', displayName: 'Synthetic document company', country: 'AL', mode: 'bau' } });
  const other = await prisma.companyProfile.create({ data: { legalName: 'FOREIGN_COMPANY_DO_NOT_EXPORT', displayName: 'FOREIGN_COMPANY_DO_NOT_EXPORT' } });
  companies.push(company.id, other.id); companyId = company.id;
  const admin = await prisma.user.create({ data: { companyProfileId: companyId, email: `documents-${randomUUID()}@example.test`, name: 'Synthetic chief', role: 'ADMIN' } }); adminId = admin.id;
  const site = await prisma.baustelle.create({ data: { companyProfileId: companyId, name: 'Synthetic site', type: 'STEEL_ASSEMBLY', documents: ['GENERAL_FILE_DO_NOT_MIX'] } }); siteId = site.id;
  foreignSite = (await prisma.baustelle.create({ data: { companyProfileId: other.id, name: 'FOREIGN_SITE_DO_NOT_EXPORT', type: 'STEEL_ASSEMBLY' } })).id;
  crew = await Promise.all([
    { crewRole: 'OFFICE' }, { crewRole: 'FIELD_ENGINEER' }, { crewRole: 'FACTORY_ENGINEER' }, { crewRole: null, level: 'MEISTER' as const },
    { crewRole: 'MECHANIC', level: 'MEISTER' as const }, { crewRole: 'FIELD_WORKER', level: 'MEISTER' as const },
    { crewRole: 'OFFICE', status: 'inactive' as const }, { crewRole: 'UNRECOGNIZED', level: 'VORARBEITER' as const },
  ].map((role, i) => prisma.worker.create({ data: { companyProfileId: companyId, firstName: `Synthetic ${i}`, lastName: 'Person', nationalId: 'PRIVATE_NATIONAL_ID', loginCodeHash: 'PRIVATE_LOGIN_HASH', ...role } })));
  requester = { kind: 'admin', adminId, companyId, preferredLanguage: 'SQ', displayName: 'Synthetic chief' };
  identity.actor.mockResolvedValue({ companyId, userId: adminId, workerId: null, name: 'Synthetic chief', office: true });
});
afterEach(async () => {
  const where = { companyProfileId: { in: companies } };
  await prisma.sitePhaseDocumentReceipt.deleteMany({ where }); await prisma.sitePhaseDocument.deleteMany({ where });
  await prisma.user.deleteMany({ where }); await prisma.companyProfile.deleteMany({ where: { id: { in: companies } } });
});
async function document(data: { title?: string; phase?: string; archivedAt?: Date; supersedesId?: string } = {}) {
  const bytes = Buffer.from('PRIVATE_DOCUMENT_BYTES');
  return prisma.sitePhaseDocument.create({ data: { id: randomUUID(), companyProfileId: companyId, baustelleId: siteId, phase: 'projektim', title: 'Synthetic drawing',
    fileName: 'drawing.pdf', mime: 'application/pdf', size: bytes.length, dataBytes: bytes, sha256: '0'.repeat(64),
    createdByName: 'Synthetic chief', createdByKey: `user:${adminId}`, createdByUserId: adminId, ...data,
    ...(data.archivedAt ? { archivedByKey: `user:${adminId}` } : {}),
  } });
}
async function receive(documentId: string, workerId?: string, name = 'Original receipt name') {
  return prisma.sitePhaseDocumentReceipt.create({ data: { companyProfileId: companyId, documentId, actorKey: workerId ? `worker:${workerId}` : `user:${adminId}`,
    actorName: name, workerId: workerId ?? null, userId: workerId ? null : adminId, receivedAt: new Date('2026-11-06T10:12:00Z') } });
}
async function list(input: Parameters<typeof adminGetSitePhaseDocuments>[1] = { projectId: siteId }) {
  const r = await adminGetSitePhaseDocuments(requester, input); if (!r.ok) throw Error(`Synthetic document read failed: ${r.code}`); return r;
}
async function people(documentId: string, input: Omit<Parameters<typeof adminGetSitePhaseDocumentReceipts>[1], 'documentId'> = {}) {
  const r = await adminGetSitePhaseDocumentReceipts(requester, { documentId, ...input }); if (!r.ok) throw Error(`Synthetic receipt read failed: ${r.code}`); return r;
}
it('lists only owned current versions with exact phase/filter counts and no bytes, HR data or general files', async () => {
  const own = await document(); await receive(own.id, crew[0].id);
  await document({ phase: 'piketim', title: 'Synthetic survey' }); await document({ title: 'Old version', archivedAt: new Date() });
  const foreignAdmin = await prisma.user.create({ data: { companyProfileId: companies[1], email: `foreign-doc-${randomUUID()}@example.test`, role: 'ADMIN' } });
  await prisma.sitePhaseDocument.create({ data: { companyProfileId: companies[1], baustelleId: foreignSite, phase: 'porosi', title: 'FOREIGN_DOCUMENT', fileName: 'foreign.pdf', mime: 'application/pdf', size: 6, dataBytes: Buffer.from('secret'), sha256: '0'.repeat(64), createdByName: 'Foreign', createdByKey: `user:${foreignAdmin.id}`, createdByUserId: foreignAdmin.id } });
  const result = await list(); expect(result).toMatchObject({ totalMatching: 2, complete: true, phaseCounts: expect.arrayContaining([{ phase: 'projektim', count: 1 }, { phase: 'piketim', count: 1 }]) });
  expect(result.documents.find(d => d.id === own.id)).toMatchObject({ receiptCount: 1, archivedAt: null });
  expect(await list({ projectName: 'Synthetic site', phase: 'projektim', query: 'drawing' })).toMatchObject({ totalMatching: 1 });
  expect(await list({ projectId: siteId, includeArchived: true })).toMatchObject({ totalMatching: 3 });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|FOREIGN_|GENERAL_FILE|dataBytes|sha256|loginCode|nationalId/);
});
it('defines unconfirmed from actual role eligibility, not all workers or assigned recipients', async () => {
  const doc = await document(); await receive(doc.id, crew[0].id); await receive(doc.id);
  const result = await people(doc.id, { status: 'unconfirmed', limit: 20 });
  const eligible = crew.filter(w => w.status === 'active');
  expect(result.summary).toEqual({ received: 2, currentlyEligible: eligible.length + 1, currentlyEligibleConfirmed: 2, currentlyEligibleUnconfirmed: eligible.length - 1 });
  expect(result.people.map(p => p.id).sort()).toEqual(eligible.filter(w => w.id !== crew[0].id).map(w => w.id).sort());
  expect(result.people.every(p => p.hasAccessNow && !p.confirmed && p.receivedAt === null)).toBe(true);
  expect(result).toMatchObject({ recipientAssignmentsTracked: false, openedOrReadTracked: false, complete: true });
});
it('retains historical receipt names/times after role/name changes and separates replacement versions', async () => {
  const old = await document(); await receive(old.id, crew[1].id, 'Original engineer');
  await prisma.worker.update({ where: { id: crew[1].id }, data: { firstName: 'Renamed', crewRole: 'FIELD_WORKER', status: 'inactive' } });
  await prisma.sitePhaseDocument.update({ where: { id: old.id }, data: { archivedAt: new Date(), archivedByKey: `user:${adminId}` } });
  const replacement = await document({ supersedesId: old.id });
  expect(await people(old.id, { status: 'received' })).toMatchObject({ summary: { received: 1 }, document: { archivedAt: expect.any(String) }, people: [{ name: 'Original engineer', currentName: 'Renamed Person', hasAccessNow: false, confirmed: true, receivedAt: '2026-11-06T10:12:00.000Z' }] });
  expect(await people(replacement.id, { status: 'received' })).toMatchObject({ summary: { received: 0 }, people: [], complete: true });
});
it('does not merge accounts with the same name or erase revoked admin receipts', async () => {
  const doc = await document(); await receive(doc.id, undefined, 'Same name');
  await prisma.worker.update({ where: { id: crew[0].id }, data: { firstName: 'Same', lastName: 'name' } });
  const result = await people(doc.id, { limit: 20 });
  expect(result.people.filter(p => p.name === 'Same name')).toHaveLength(2);
  await prisma.user.update({ where: { id: adminId }, data: { role: 'STAFF' } });
  expect(await adminGetSitePhaseDocumentReceipts(requester, { documentId: doc.id })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
});
it('paginates document and people results without lost/duplicated rows or page-as-total claims', async () => {
  const docs = await Promise.all(Array.from({ length: 4 }, (_, i) => document({ title: `Drawing ${i}` })));
  const first = await list({ projectId: siteId, limit: 2 }); expect(first).toMatchObject({ totalMatching: 4, complete: false, pageComplete: false });
  const second = await list({ projectId: siteId, limit: 2, cursor: first.nextCursor! }); expect(second).toMatchObject({ totalMatching: 4, complete: false, pageComplete: true });
  expect(new Set([...first.documents, ...second.documents].map(d => d.id)).size).toBe(4);
  await receive(docs[0].id, crew[0].id); await receive(docs[0].id, crew[6].id);
  const seen: string[] = []; let cursor: string | undefined; let count = 0;
  do { const page = await people(docs[0].id, { limit: 2, cursor }); count = page.totalMatching; seen.push(...page.people.map(p => `${p.kind}:${p.id}`)); cursor = page.nextCursor ?? undefined; } while (cursor);
  expect(seen).toHaveLength(count); expect(new Set(seen).size).toBe(count);
});
it('denies foreign sites, documents, stale roles and cursors from another query', async () => {
  const doc = await document();
  expect(await adminGetSitePhaseDocuments(requester, { projectId: foreignSite })).toMatchObject({ ok: false, code: 'PROJECT_NOT_FOUND' });
  const otherAdmin = await prisma.user.create({ data: { companyProfileId: companies[1], email: `other-${randomUUID()}@example.test`, role: 'ADMIN' } });
  const foreignDoc = await prisma.sitePhaseDocument.create({ data: { companyProfileId: companies[1], baustelleId: foreignSite, phase: 'porosi', title: 'Foreign', fileName: 'f.pdf', mime: 'application/pdf', size: 1, dataBytes: Buffer.from('x'), sha256: '0'.repeat(64), createdByName: 'Foreign', createdByKey: `user:${otherAdmin.id}`, createdByUserId: otherAdmin.id } });
  expect(await adminGetSitePhaseDocumentReceipts(requester, { documentId: foreignDoc.id })).toMatchObject({ ok: false, code: 'DOCUMENT_NOT_FOUND' });
  expect(await adminGetSitePhaseDocumentReceipts(requester, { documentId: doc.id, cursor: 'worker:missing-person', status: 'unconfirmed' })).toMatchObject({ ok: false, code: 'INVALID_CURSOR' });
  expect(await adminGetSitePhaseDocuments(requester, { projectId: siteId, cursor: foreignDoc.id })).toMatchObject({ ok: false, code: 'INVALID_CURSOR' });
  await prisma.user.update({ where: { id: adminId }, data: { isActive: false } });
  expect(await adminGetSitePhaseDocuments(requester, { projectId: siteId })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
});
it('requires selection for duplicate/partial names and never writes receipt/business records', async () => {
  const doc = await document();
  await prisma.baustelle.create({ data: { companyProfileId: companyId, name: 'Synthetic site', type: 'STEEL_ASSEMBLY' } });
  expect(await adminGetSitePhaseDocuments(requester, { projectName: 'Synthetic site' })).toMatchObject({ ok: false, code: 'AMBIGUOUS_PROJECT' });
  expect(await adminGetSitePhaseDocuments(requester, { projectName: 'Synthetic' })).toMatchObject({ ok: false, code: 'PROJECT_NOT_FOUND' });
  const before = await prisma.sitePhaseDocumentReceipt.count({ where: { companyProfileId: companyId } });
  await list(); await people(doc.id); await people(doc.id, { status: 'unconfirmed' });
  expect(await prisma.sitePhaseDocumentReceipt.count({ where: { companyProfileId: companyId } })).toBe(before);
  expect(await prisma.sitePhaseDocument.count({ where: { companyProfileId: companyId } })).toBe(1);
});
