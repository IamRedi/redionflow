import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  worker: { findMany: vi.fn(), findFirst: vi.fn() },
  workSession: { findMany: vi.fn() },
  treeItem: { findMany: vi.fn() },
  inventoryMovement: { findMany: vi.fn() },
  machineConeMovement: { findMany: vi.fn() },
  baustelle: { findMany: vi.fn(), count: vi.fn() },
  companyKnowledge: { findMany: vi.fn(), count: vi.fn() },
  vacationRequest: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
}));
vi.mock('@/lib/db/prisma', () => ({ prisma: db }));
vi.mock('@/lib/workzone/reporting', async () => ({ ...(await import('@/lib/workzone/date-utils')), getAdminDailyReport: vi.fn(), getWorkerDailyReport: vi.fn(), getWorkerMonthlyReport: vi.fn(), baustelleStandort: vi.fn(), coneActivity: vi.fn(), groupDailyWorkByBaustelle: vi.fn(), inventoryActivity: vi.fn(), monthlySessionRows: vi.fn(), parseReportMessages: vi.fn(), treeAction: vi.fn(), treeExtra: vi.fn(), treeHaltverbot: vi.fn(), treeWorkerNote: vi.fn() }));
import { getCompanyBaustellenDirectory, getKnowledge, getMyHoursSummary } from './operations';
import { adminGetTeamDailyReport, getWorkerPrivateSummary } from './reports';
import { adminListVacationRequests, getMyVacationSummary, getWorkerHrProfile } from './hr';
import type { RequesterContext } from '../requester';

const admin: RequesterContext = { kind: 'admin', adminId: 'admin-demo', companyId: 'company-a', displayName: 'Admin Demo', preferredLanguage: 'SQ', timeZone: 'Europe/Tirane' };
const worker: RequesterContext = { kind: 'worker', workerId: 'worker-demo', companyId: 'company-a', displayName: 'Mira Demo', preferredLanguage: 'SQ', timeZone: 'Europe/Tirane' };
const session = { workerId: 'worker-demo', startTime: new Date('2026-11-05T08:00Z'), endTime: new Date('2026-11-05T09:00Z'), totalHours: 1, breakMinutes: 0, baustelle: null };
beforeEach(() => {
  vi.clearAllMocks();
  for (const table of [db.worker, db.workSession, db.treeItem, db.inventoryMovement, db.machineConeMovement, db.baustelle, db.companyKnowledge]) table.findMany.mockResolvedValue([]);
});

it('does not label a clipped worker hours sample as a complete total', async () => {
  db.workSession.findMany.mockResolvedValue(Array.from({ length: 301 }, () => session));
  expect(await getMyHoursSummary(worker, { days: 7 })).toMatchObject({ ok: true, totalHours: null, returnedHours: 300, complete: false, truncated: true, totalSessions: null });
  expect(db.workSession.findMany.mock.calls[0][0].where).toMatchObject({ workerId: 'worker-demo', worker: { companyProfileId: 'company-a' } });
});
it('does not invent a private-summary total beyond its session bound', async () => {
  db.worker.findMany.mockResolvedValue([{ id: 'worker-demo', firstName: 'Mira', lastName: 'Demo', phone: null, emailAccount: null }]);
  db.workSession.findMany.mockResolvedValue(Array.from({ length: 251 }, () => session));
  expect(await getWorkerPrivateSummary(admin, { workerName: 'Mira Demo' })).toMatchObject({ ok: true, totalHours: null, returnedHours: 250, complete: false, truncated: true });
});
it('queries team activity using company midnight with an exclusive next-day end', async () => {
  expect(await adminGetTeamDailyReport(admin, { date: '2026-11-05' })).toMatchObject({ ok: true, complete: true, activeWorkerCount: 0 });
  expect(db.workSession.findMany.mock.calls[0][0].where).toEqual({ worker: { companyProfileId: 'company-a' }, startTime: { gte: new Date('2026-11-04T23:00Z'), lt: new Date('2026-11-05T23:00Z') } });
});
it('marks a bounded team report incomplete rather than claiming a definitive zero', async () => {
  db.workSession.findMany.mockResolvedValue(Array.from({ length: 3000 }, () => session));
  expect(await adminGetTeamDailyReport(admin, { date: '2026-11-05' })).toMatchObject({ ok: true, complete: false, truncated: true, activeWorkerCount: null });
});
it('distinguishes the full directory count from the returned subset', async () => {
  db.baustelle.findMany.mockResolvedValue(Array.from({ length: 120 }, (_, index) => ({ name: `Site ${index}`, type: 'STEEL_ASSEMBLY', address: null, description: '' })));
  db.baustelle.count.mockResolvedValue(121);
  expect(await getCompanyBaustellenDirectory(admin)).toMatchObject({ count: 121, returnedCount: 120, complete: false, truncated: true });
});
it('bounds knowledge text and reports omitted matches, without hiding truncation', async () => {
  db.companyKnowledge.findMany.mockResolvedValue([{ title: 'Guide DEMO', content: 'x'.repeat(3500), updatedAt: new Date('2026-11-05T08:00Z') }]);
  db.companyKnowledge.count.mockResolvedValue(4);
  const result = await getKnowledge(admin, { query: 'Guide' });
  expect(result).toMatchObject({ ok: true, totalMatches: 4, returnedCount: 1, complete: false, truncated: true });
  if (result.ok && 'content' in result) expect(result.content).toHaveLength(3000);
});
it('requests clarification before reading a private profile for an ambiguous name', async () => {
  db.worker.findMany.mockResolvedValue([{ id: 'one', firstName: 'Mira', lastName: 'Demo' }, { id: 'two', firstName: 'Mira', lastName: 'Other' }]);
  const result = await getWorkerHrProfile(admin, { workerName: 'Mira' });
  expect(result).toMatchObject({ ok: false, message: expect.stringContaining('Mira Demo / Mira Other') });
  expect(db.worker.findFirst).not.toHaveBeenCalled();
});
it('computes vacation balance before clipping request history', async () => {
  const request = { id: 'request-demo', startDate: new Date('2026-01-01T00:00Z'), endDate: new Date('2026-01-01T00:00Z'), requestedDays: 1, status: 'APPROVED', workerNote: null, adminMessage: null, reviewedAt: null, createdAt: new Date('2026-01-01T00:00Z') };
  db.worker.findFirst.mockResolvedValue({ id: 'worker-demo', firstName: 'Mira', lastName: 'Demo', vacationAllowanceDays: 50, vacationRequests: Array.from({ length: 30 }, () => request) });
  db.vacationRequest.groupBy.mockResolvedValue([{ status: 'APPROVED', _sum: { requestedDays: 40 }, _count: { _all: 40 } }, { status: 'PENDING', _sum: { requestedDays: 5 }, _count: { _all: 1 } }]);
  expect(await getMyVacationSummary(worker)).toMatchObject({ ok: true, approvedDays: 40, pendingDays: 5, remainingDays: 10, summaryComplete: true, totalRequests: 41, returnedCount: 30, historyComplete: false, truncated: true });
  expect(db.vacationRequest.groupBy.mock.calls[0][0].where).toEqual({ companyProfileId: 'company-a', workerId: 'worker-demo' });
});
it('returns a full vacation-request count separately from the requested sample', async () => {
  db.vacationRequest.findMany.mockResolvedValue([{ id: 'request-demo', worker: { firstName: 'Mira', lastName: 'Demo' }, startDate: new Date('2026-01-01T00:00Z'), endDate: new Date('2026-01-01T00:00Z'), requestedDays: 1, status: 'PENDING', workerNote: null, adminMessage: null, reviewedAt: null, reviewedByAdmin: null, createdAt: new Date('2026-01-01T00:00Z') }]);
  db.vacationRequest.count.mockResolvedValue(10);
  expect(await adminListVacationRequests(admin, { limit: 1 })).toMatchObject({ count: 10, returnedCount: 1, complete: false, truncated: true });
});
