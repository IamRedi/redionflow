import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  tx: {
    companyProfile: { findFirst: vi.fn() }, baustelle: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    worker: { findMany: vi.fn() }, siteElement: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    siteElementWork: { findMany: vi.fn(), count: vi.fn() },
  },
}));
vi.mock('@/lib/db/tenant-context', () => ({ withTenantContext: vi.fn(async (_company: string, fn: (tx: typeof state.tx) => unknown) => fn(state.tx)) }));
vi.mock('@/lib/dashboard/steel-data', () => ({ steelDashboardData: vi.fn() }));
import { adminGetSteelElement, adminGetSteelProductionEvidence, adminGetSteelProductionSummary, adminSearchSteelProjects } from './steel-tools';
import type { RequesterContext } from './requester';
import { steelDashboardData } from '@/lib/dashboard/steel-data';
import { emptyMetric, emptyMetrics } from '@/lib/dashboard/steel-metrics';
const admin: RequesterContext = { kind: 'admin', adminId: 'admin-demo', companyId: 'company-demo', displayName: 'Synthetic', preferredLanguage: 'SQ' };
beforeEach(() => {
  vi.clearAllMocks();
  for (const model of Object.values(state.tx)) for (const query of Object.values(model)) query.mockReset();
  state.tx.companyProfile.findFirst.mockResolvedValue({ id: 'company-demo', displayName: 'Steel Demo', country: 'AL' });
  state.tx.baustelle.findFirst.mockResolvedValue({ id: 'steel-project' });
});
it('rejects worker access without querying private company data', async () => {
  expect(await adminSearchSteelProjects({ kind: 'worker', workerId: 'demo', companyId: 'company-demo', displayName: 'Synthetic', preferredLanguage: 'SQ' })).toMatchObject({ ok: false, code: 'ADMIN_REQUIRED' });
  expect(state.tx.companyProfile.findFirst).not.toHaveBeenCalled();
});
it('requires current admin membership in the requested company and fails closed', async () => {
  state.tx.companyProfile.findFirst.mockResolvedValue(null);
  expect(await adminSearchSteelProjects(admin)).toMatchObject({ ok: false, code: 'ACCESS_DENIED' });
  expect(state.tx.companyProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'company-demo', mode: 'bau', users: { some: { id: 'admin-demo', role: 'ADMIN', isActive: true } } } }));
  expect(state.tx.baustelle.findFirst).not.toHaveBeenCalled();
});
it.each([{ date: '2026-02-30' }, { month: '2026-13' }, { date: '2026-11-01', month: '2026-10' }])('rejects invalid or conflicting periods instead of silently using today: %j', async input => {
  expect(await adminGetSteelProductionSummary(admin, input)).toMatchObject({ ok: false });
  expect(state.tx.siteElementWork.findMany).not.toHaveBeenCalled();
});
it('does not choose arbitrarily when the same drawing mark occurs in different projects', async () => {
  state.tx.siteElement.findMany.mockResolvedValue([
    { id: 'element-a', list: 'assembly', mark: 'B/12', baustelle: { name: 'Project A' } },
    { id: 'element-b', list: 'assembly', mark: 'B/12', baustelle: { name: 'Project B' } },
  ]);
  expect(await adminGetSteelElement(admin, { mark: 'B/12' })).toMatchObject({ ok: false, code: 'AMBIGUOUS_ELEMENT', candidates: [{ id: 'element-a' }, { id: 'element-b' }] });
});
it('does not attribute production to one of several workers with the same name', async () => {
  state.tx.worker.findMany.mockResolvedValue([{ id: 'a', firstName: 'Demo', lastName: 'One' }, { id: 'b', firstName: 'Demo', lastName: 'Two' }]);
  expect(await adminGetSteelProductionEvidence(admin, { workerName: 'Demo', date: '2026-11-01' })).toMatchObject({ ok: false, code: 'AMBIGUOUS_WORKER' });
  expect(state.tx.siteElementWork.findMany).not.toHaveBeenCalled();
});
it('uses captured weights, marks legacy and missing weights, and keeps distinct process aggregates', async () => {
  const element = { id: 'element', baustelleId: 'project', list: 'assembly', mark: 'NEW-MARK', quantity: 8, weightKg: 999, baustelle: { id: 'project', name: 'Project' } };
  const base = { stage: 'cutting', pieces: 2, checkedAt: new Date('2026-10-31T23:30:00Z'), workerIds: ['operator-a', 'operator-b'], workerNames: 'Operator team', checkedByName: 'Engineer', checkedByWorkerId: 'engineer', checkedByUserId: null, element };
  state.tx.siteElementWork.findMany.mockResolvedValue([
    { ...base, id: 'captured', productionSnapshot: { v: 1, list: 'assembly', mark: 'ORIGINAL', quantity: 4, unitWeightKg: 125 } },
    { ...base, id: 'legacy', stage: 'assembly', productionSnapshot: null },
    { ...base, id: 'unknown', stage: 'welding', productionSnapshot: { v: 1, list: 'assembly', mark: 'ORIGINAL', quantity: 4, unitWeightKg: null } },
  ]);
  const result = await adminGetSteelProductionEvidence(admin, { date: '2026-11-01', limit: 1 });
  expect(result).toMatchObject({ ok: true, totalMatchingConfirmations: 3, pageComplete: false, nextCursor: 'captured', aggregates: [
    { stage: 'cutting', metric: { kg: 250, pieces: 2, legacyPieces: 0 } },
    { stage: 'assembly', metric: { kg: 1998, pieces: 2, legacyPieces: 2 } },
    { stage: 'welding', metric: { kg: 0, pieces: 2, missingPieces: 2 } },
  ], confirmations: [{ id: 'captured', mark: 'ORIGINAL', kg: 250, legacy: false, creditedWorkerIds: ['operator-a', 'operator-b'], checkedByWorkerId: 'engineer' }] });
  expect(state.tx.siteElementWork.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyProfileId: 'company-demo', checkedAt: { gte: new Date('2026-10-31T23:00:00Z'), lt: new Date('2026-11-01T23:00:00Z') } }) }));
});
it('preserves storage failures rather than falsely reporting no production', async () => {
  state.tx.siteElementWork.findMany.mockRejectedValue(new Error('Synthetic database failure'));
  await expect(adminGetSteelProductionEvidence(admin, { date: '2026-11-01' })).rejects.toThrow('Synthetic database failure');
});
it('exposes selected-day project metrics only for the existing project page without substituting monthly or page totals', async () => {
  const metric = (kg: number) => ({ ...emptyMetric(), kg, checks: 1, pieces: 1 });
  const progress = { kg: 0, totalPieces: 0, readyKg: 0, readyPieces: 0, mountedKg: 0, missingPieces: 0, stages: {} };
  const month = { ...emptyMetrics(), assembled: metric(60) };
  vi.mocked(steelDashboardData).mockResolvedValue({ month: '2026-11', day: '2026-11-03', totalProgress: progress, totals: month,
    days: [{ key: '2026-11-03', checks: 3, metrics: { ...emptyMetrics(), assembled: metric(6) } }, { key: '2026-11-04', checks: 3, metrics: { ...emptyMetrics(), assembled: metric(54) } }],
    projectRows: [
      { id: 'a', name: 'Demo A', status: 'active', progress, month: { ...emptyMetrics(), assembled: metric(10) } },
      { id: 'b', name: 'Demo B', status: 'active', progress, month: { ...emptyMetrics(), assembled: metric(20) } },
      { id: 'c', name: 'Demo C', status: 'active', progress, month: { ...emptyMetrics(), assembled: metric(30) } },
    ], dayProjects: [
      { id: 'a', name: 'Demo A', metrics: { ...emptyMetrics(), assembled: metric(1) }, checks: 1, operations: [{ stage: 'welding' }] },
      { id: 'b', name: 'Demo B', metrics: { ...emptyMetrics(), assembled: metric(2) }, checks: 1, operations: [] },
      { id: 'c', name: 'Demo C', metrics: { ...emptyMetrics(), assembled: metric(3) }, checks: 1, operations: [] },
      { id: 'not-in-page-set', name: 'Not a selected project', metrics: { ...emptyMetrics(), assembled: metric(9999) }, checks: 1, operations: [] },
    ],
  } as unknown as Awaited<ReturnType<typeof steelDashboardData>>);
  const first = await adminGetSteelProductionSummary(admin, { date: '2026-11-03', limit: 1 });
  expect(first).toMatchObject({ ok: true, selectedDate: '2026-11-03', projectCount: 3, projectPageComplete: false, selectedDayProjectsPageComplete: false, nextProjectCursor: 'a',
    monthlyProduction: { assembled: { kg: 60 } }, projects: [{ id: 'a', monthlyProduction: { assembled: { kg: 10 } } }],
    selectedDayProjects: [{ id: 'a', name: 'Demo A', checks: 1, metrics: { assembled: { kg: 1 } } }] });
  if (!first.ok) throw new Error('Expected first summary page');
  expect(first.selectedDayProjects).toHaveLength(1);
  expect(first.selectedDayProjects[0]).not.toHaveProperty('operations');
  const last = await adminGetSteelProductionSummary(admin, { date: '2026-11-03', limit: 1, projectCursor: 'b' });
  expect(last).toMatchObject({ ok: true, projectCount: 3, projectPageComplete: true, selectedDayProjectsPageComplete: true, nextProjectCursor: null,
    monthlyProduction: { assembled: { kg: 60 } }, selectedDayProjects: [{ id: 'c', metrics: { assembled: { kg: 3 } } }] });
  expect(JSON.stringify(last)).not.toContain('Not a selected project');
});
