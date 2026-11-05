import { afterEach, beforeEach, expect, it } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { assertAssistantTestDatabase } from '../../../tests/fixtures/assistant-database';
import { seedSecurityTenants, removeSecurityTenants } from '../../../tests/security/fixtures';
import type { RequesterContext } from './requester';
import { adminGetSteelElement, adminGetSteelProductionEvidence, adminGetSteelProductionSummary, adminGetSteelProjectBatches, adminSearchSteelElements, adminSearchSteelProjects } from './steel-tools';
let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
function admin(index = 0): RequesterContext { const t = tenants[index]; return { kind: 'admin', adminId: t.admin.id, companyId: t.company.id, displayName: 'Synthetic', preferredLanguage: 'SQ' }; }
beforeEach(async () => {
  assertAssistantTestDatabase();
  tenants = await seedSecurityTenants();
  for (const t of tenants) {
    await prisma.companyProfile.update({ where: { id: t.company.id }, data: { mode: 'bau', country: 'AL' } });
    await prisma.baustelle.update({ where: { id: t.site.id }, data: { type: 'STEEL_ASSEMBLY' } });
  }
});
afterEach(async () => { if (tenants) await removeSecurityTenants(tenants.map(t => t.company.id)); });
async function element(index = 0, data: { mark?: string; list?: string; weightKg?: number; quantity?: number } = {}) {
  return prisma.siteElement.create({ data: { companyProfileId: tenants[index].company.id, baustelleId: tenants[index].site.id, list: 'assembly', mark: 'B/12', quantity: 4, weightKg: 125, ...data } });
}
it('keeps searches, exact elements and aggregate scopes inside the authenticated admin company', async () => {
  const own = await element(), foreign = await element(1);
  const projects = await adminSearchSteelProjects(admin());
  expect(projects).toMatchObject({ ok: true, totalMatches: 1, projects: [{ id: tenants[0].site.id }] });
  expect(JSON.stringify(projects)).not.toContain(tenants[1].marker);
  expect(await adminGetSteelElement(admin(), { elementId: foreign.id })).toMatchObject({ ok: false, code: 'ELEMENT_NOT_FOUND' });
  expect(await adminGetSteelProductionSummary(admin(), { projectId: tenants[1].site.id })).toMatchObject({ ok: false, code: 'PROJECT_NOT_FOUND' });
  expect(await adminGetSteelElement({ ...admin(), companyId: tenants[1].company.id }, { elementId: foreign.id })).toMatchObject({ ok: false, code: 'ACCESS_DENIED' });
  expect(await adminGetSteelElement(admin(), { elementId: own.id })).toMatchObject({ ok: true, element: { id: own.id } });
});
it('rejects ambiguous project names and marks until an exact ID is selected', async () => {
  await prisma.baustelle.update({ where: { id: tenants[0].site.id }, data: { name: 'Repeated Project' } });
  const other = await prisma.baustelle.create({ data: { companyProfileId: tenants[0].company.id, name: 'Repeated Project', type: 'STEEL_ASSEMBLY' } });
  const own = await element();
  await prisma.siteElement.create({ data: { companyProfileId: tenants[0].company.id, baustelleId: other.id, list: 'assembly', mark: own.mark } });
  expect(await adminGetSteelProductionSummary(admin(), { projectName: 'Repeated Project' })).toMatchObject({ ok: false, code: 'AMBIGUOUS_PROJECT' });
  expect(await adminGetSteelElement(admin(), { mark: own.mark })).toMatchObject({ ok: false, code: 'AMBIGUOUS_ELEMENT' });
  expect(await adminGetSteelElement(admin(), { projectId: other.id, mark: own.mark })).toMatchObject({ ok: true, element: { project: { id: other.id } } });
});
it('paginates all matching marks and confirms the engineer-closed route without inventing missing stages', async () => {
  const own = await element();
  await element(0, { mark: 'B/13' }); await element(0, { mark: 'B/14', list: 'part' });
  await prisma.siteElement.update({ where: { id: own.id }, data: { factoryDoneAt: new Date('2026-11-01T12:00:00Z') } });
  await prisma.siteElementWork.create({ data: { companyProfileId: tenants[0].company.id, elementId: own.id, stage: 'cutting', pieces: 2, workerIds: [tenants[0].worker.id], checkedByName: 'Synthetic engineer' } });
  const first = await adminSearchSteelElements(admin(), { limit: 2 });
  expect(first).toMatchObject({ ok: true, totalMatches: 3, pageComplete: false });
  if (!first.ok) throw new Error('Expected first page');
  const second = await adminSearchSteelElements(admin(), { limit: 2, cursor: first.nextCursor! });
  expect(second).toMatchObject({ ok: true, totalMatches: 3, pageComplete: true, elements: [expect.anything()] });
  if (!second.ok) throw new Error('Expected second page');
  expect(new Set([...first.elements, ...second.elements].map(e => e.id)).size).toBe(3);
  expect(await adminGetSteelElement(admin(), { elementId: own.id })).toMatchObject({ ok: true, element: { factory: { finishedPieces: 2 } } });
  expect(await adminSearchSteelElements(admin(), { cursor: 'foreign-cursor' })).toMatchObject({ ok: false, code: 'INVALID_CURSOR' });
});
it('uses company midnight and immutable weights for complete daily/monthly totals, separately by process', async () => {
  const assembly = await element(), part = await element(0, { mark: 'P/1', list: 'part', weightKg: 10 });
  await prisma.siteElementWork.createMany({ data: [
    { companyProfileId: tenants[0].company.id, elementId: assembly.id, stage: 'assembly', pieces: 2, workerIds: [], checkedByName: 'Synthetic engineer', checkedAt: new Date('2026-10-31T23:30:00Z'), productionSnapshot: { v: 1, list: 'assembly', mark: assembly.mark, quantity: 4, unitWeightKg: 125 } },
    { companyProfileId: tenants[0].company.id, elementId: part.id, stage: 'cutting', pieces: 3, workerIds: [], checkedByName: 'Synthetic engineer', checkedAt: new Date('2026-10-31T23:30:00Z'), productionSnapshot: { v: 1, list: 'part', mark: part.mark, quantity: 4, unitWeightKg: 10 } },
    { companyProfileId: tenants[0].company.id, elementId: assembly.id, stage: 'cutting', pieces: 1, workerIds: [], checkedByName: 'Synthetic engineer', checkedAt: new Date('2026-11-01T23:30:00Z') },
  ] });
  await prisma.siteElement.update({ where: { id: assembly.id }, data: { weightKg: 999 } });
  const summary = await adminGetSteelProductionSummary(admin(), { date: '2026-11-01' });
  expect(summary).toMatchObject({ ok: true, month: '2026-11', monthlyProduction: { cutParts: { kg: 30 }, cutAssemblies: { kg: 999, legacyPieces: 1 }, assembled: { kg: 250 } }, dailyProduction: [expect.objectContaining({ key: '2026-11-01', metrics: expect.objectContaining({ assembled: expect.objectContaining({ kg: 250 }) }) }), expect.anything()] });
  const evidence = await adminGetSteelProductionEvidence(admin(), { date: '2026-11-01', limit: 1 });
  expect(evidence).toMatchObject({ ok: true, totalMatchingConfirmations: 2, pageComplete: false });
  if (!evidence.ok) throw new Error('Expected evidence');
  expect(evidence.aggregates.find(a => a.stage === 'assembly')!.metric.kg).toBe(250);
  const next = await adminGetSteelProductionEvidence(admin(), { date: '2026-11-01', cursor: evidence.nextCursor!, limit: 1 });
  expect(next).toMatchObject({ ok: true, totalMatchingConfirmations: 2, pageComplete: true, aggregates: evidence.aggregates });
  await prisma.siteElementWork.deleteMany({ where: { elementId: assembly.id, stage: 'assembly' } });
  expect(await adminGetSteelProductionSummary(admin(), { date: '2026-11-01' })).toMatchObject({ ok: true, monthlyProduction: { assembled: { kg: 0, checks: 0 } } });
});
it('distinguishes credited teammates from the checker, excludes unlinked history, and exposes worker ambiguity', async () => {
  const own = await element(), peer = await prisma.worker.create({ data: { companyProfileId: tenants[0].company.id, firstName: tenants[0].worker.firstName, lastName: 'Other demo' } });
  await prisma.siteElementWork.createMany({ data: [
    { companyProfileId: tenants[0].company.id, elementId: own.id, stage: 'assembly', pieces: 2, workerIds: [tenants[0].worker.id, peer.id], workerNames: 'Team Demo', checkedByName: 'Office checker', checkedByUserId: tenants[0].admin.id, checkedAt: new Date('2026-11-01T12:00Z') },
    { companyProfileId: tenants[0].company.id, elementId: own.id, stage: 'cutting', pieces: 1, workerIds: [], workerNames: tenants[0].worker.firstName, checkedByName: 'Office checker', checkedAt: new Date('2026-11-01T13:00Z') },
  ] });
  expect(await adminGetSteelProductionEvidence(admin(), { workerName: peer.firstName, date: '2026-11-01' })).toMatchObject({ ok: false, code: 'AMBIGUOUS_WORKER' });
  expect(await adminGetSteelProductionEvidence(admin(), { workerId: peer.id, date: '2026-11-01' })).toMatchObject({ ok: true, totalMatchingConfirmations: 1, unlinkedConfirmationsInScope: 1, confirmations: [{ creditedWorkerIds: [tenants[0].worker.id, peer.id], checkedByUserId: tenants[0].admin.id, kg: 250 }] });
});
it('returns legacy production groups separately without converting unknown units or summing them into steel kg', async () => {
  await prisma.productionBatch.create({ data: { companyProfileId: tenants[0].company.id, baustelleId: tenants[0].site.id, title: 'Order group demo', quantity: 4, unit: 't', steps: [{ key: 'cutting', status: 'blocked', note: 'Awaiting material', by: 'Synthetic', at: '2026-11-01T12:00Z' }] } });
  expect(await adminGetSteelProjectBatches(admin(), { projectId: tenants[0].site.id })).toMatchObject({ ok: true, totalMatches: 1, batches: [{ quantity: 4, unit: 't', state: 'blocked', steps: [{ note: 'Awaiting material' }] }] });
});
