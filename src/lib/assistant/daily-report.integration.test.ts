import { afterEach, beforeEach, expect, it } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { assertAssistantTestDatabase } from '../../../tests/fixtures/assistant-database';
import { seedSecurityTenants, removeSecurityTenants } from '../../../tests/security/fixtures';
import { adminGetSteelDailyReport } from './daily-report';
import type { RequesterContext } from './requester';
let tenants: Awaited<ReturnType<typeof seedSecurityTenants>> = [];
const admin = (): RequesterContext => ({ kind: 'admin', companyId: tenants[0].company.id, adminId: tenants[0].admin.id, displayName: 'Demo', preferredLanguage: 'SQ', timeZone: 'Europe/Tirane' });
beforeEach(async () => {
  assertAssistantTestDatabase(); tenants = await seedSecurityTenants();
  for (const t of tenants) {
    await prisma.companyProfile.update({ where: { id: t.company.id }, data: { mode: 'bau', country: 'AL' } });
    await prisma.baustelle.update({ where: { id: t.site.id }, data: { type: 'STEEL_ASSEMBLY' } });
  }
});
afterEach(async () => { if (tenants.length) await removeSecurityTenants(tenants.map(t => t.company.id)); tenants = []; });
async function closed(index = 0, hours = 8) { const t = tenants[index]; return prisma.workSession.create({ data: { workerId: t.worker.id, baustelleId: t.site.id, startTime: new Date('2026-11-01T07:00Z'), endTime: new Date('2026-11-01T15:00Z'), breakMinutes: 0, totalHours: hours } }); }
it('separates complete company hours, real steel processes and enabled phase checks from legacy tree/checker output', async () => {
  await closed(); await closed(1, 99);
  const t = tenants[0], peer = await prisma.worker.create({ data: { companyProfileId: t.company.id, firstName: 'Second', lastName: 'Demo' } });
  await prisma.workSession.create({ data: { workerId: peer.id, startTime: new Date('2026-11-01T08:00Z'), endTime: new Date('2026-11-01T14:00Z'), totalHours: 6, breakMinutes: 0 } });
  const e = await prisma.siteElement.create({ data: { companyProfileId: t.company.id, baustelleId: t.site.id, list: 'assembly', mark: 'B/2', quantity: 2, weightKg: 999 } });
  await prisma.siteElementWork.createMany({ data: ['assembly','welding'].map(stage => ({ companyProfileId: t.company.id, elementId: e.id, stage, pieces: 2, workerIds: [peer.id], checkedByWorkerId: t.worker.id, checkedByName: 'Checker Demo', checkedAt: new Date('2026-10-31T23:30Z'), productionSnapshot: { v: 1, list: 'assembly', mark: 'B/2', quantity: 2, unitWeightKg: 50 } })) });
  const def = await prisma.steelWorkDefinition.create({ data: { companyProfileId: t.company.id, kind: 'site', key: 'demo-phase', label: 'Demo phase' } });
  await prisma.treeItem.update({ where: { id: t.tree.id }, data: { treeId: 'steel-columns', status: 'done', completedAt: new Date('2026-11-01T13:00Z'), completedByWorkerId: t.worker.id } });
  await prisma.workReportNote.create({ data: { workerId: t.worker.id, type: 'DAILY', periodKey: '2026-11-01', note: 'Synthetic workbook note' } });
  await prisma.steelSiteTask.create({ data: { companyProfileId: t.company.id, baustelleId: t.site.id, definitionId: def.id, treeItemId: t.tree.id, enabled: true } });
  const report = await adminGetSteelDailyReport(admin(), { date: '2026-11-01' });
  expect(report).toMatchObject({ ok: true, attendance: { recordedWorkers: 2, totalHours: 14, closedRows: 2 }, production: { checks: 2, projectCount: 1, processCount: 2, processes: [expect.objectContaining({ stage: 'assembly', metric: { kg: 100, pieces: 2, checks: 1, legacyPieces: 0, missingPieces: 0 } }), expect.objectContaining({ stage: 'welding', metric: expect.objectContaining({ kg: 100 }) })] }, selectedPhasesConfirmed: 1 });
  expect(JSON.stringify(report)).not.toMatch(/"trees":|treeCount|workersWithTrees|"totalHours":99/);
  expect(await adminGetSteelDailyReport(admin(), { date: '2026-11-01', workerId: t.worker.id })).toMatchObject({ ok: true, attendance: { totalHours: 8 }, production: { checks: 0 }, selectedPhasesConfirmed: null, workbook: { note: { text: 'Synthetic workbook note', truncated: false }, sessionsComplete: true, sessions: [expect.objectContaining({ breakMinutes: 0 })] } });
  expect(await adminGetSteelDailyReport(admin(), { date: '2026-11-01', workerId: peer.id })).toMatchObject({ ok: true, attendance: { totalHours: 6 }, production: { checks: 2 } });
  await prisma.steelWorkDefinition.update({ where: { id: def.id }, data: { archivedAt: new Date() } });
  expect(await adminGetSteelDailyReport(admin(), { date: '2026-11-01' })).toMatchObject({ ok: true, selectedPhasesConfirmed: 0 });
  await prisma.steelWorkDefinition.update({ where: { id: def.id }, data: { archivedAt: null } });
  await prisma.treeItem.update({ where: { id: t.tree.id }, data: { treeId: 'unrelated-tree' } });
  expect(await adminGetSteelDailyReport(admin(), { date: '2026-11-01' })).toMatchObject({ ok: true, selectedPhasesConfirmed: 0 });
  await prisma.treeItem.update({ where: { id: t.tree.id }, data: { treeId: 'steel-task-synthetic' } });
  expect(await adminGetSteelDailyReport(admin(), { date: '2026-11-01' })).toMatchObject({ ok: true, selectedPhasesConfirmed: 1 });
  await prisma.steelSiteTask.updateMany({ where: { companyProfileId: t.company.id }, data: { enabled: false } });
  expect(await adminGetSteelDailyReport(admin(), { date: '2026-11-01' })).toMatchObject({ ok: true, selectedPhasesConfirmed: 0 });
});
it('does not manufacture historical hours from a session left open', async () => {
  const t = tenants[0]; await prisma.workSession.create({ data: { workerId: t.worker.id, startTime: new Date('2026-11-01T07:00Z'), isLive: true } });
  expect(await adminGetSteelDailyReport(admin(), { date: '2026-11-01' })).toMatchObject({ ok: true, attendance: { complete: false, totalHours: null, openRows: 1, workers: [{ hours: null }] } });
});
it('fails closed for worker callers, foreign IDs, inactive admins, invalid dates and future reports', async () => {
  expect(await adminGetSteelDailyReport({ ...admin(), kind: 'worker' } as RequesterContext, { date: '2026-11-01' })).toMatchObject({ ok: false, code: 'ADMIN_REQUIRED' });
  expect(await adminGetSteelDailyReport(admin(), { date: '2026-11-01', workerId: tenants[1].worker.id })).toMatchObject({ ok: false, code: 'WORKER_NOT_FOUND' });
  expect(await adminGetSteelDailyReport(admin(), { date: '2026-02-30' })).toMatchObject({ ok: false });
  expect(await adminGetSteelDailyReport(admin(), { date: '2099-01-01' })).toMatchObject({ ok: false });
  await prisma.user.update({ where: { id: tenants[0].admin.id }, data: { isActive: false } });
  expect(await adminGetSteelDailyReport(admin(), { date: '2026-11-01' })).toMatchObject({ ok: false, code: 'ACCESS_DENIED' });
});
it('keeps exact worker counts and totals when details exceed one page', async () => {
  const t = tenants[0];
  for (let i = 0; i < 22; i++) {
    const w = await prisma.worker.create({ data: { companyProfileId: t.company.id, firstName: `Demo ${i}`, lastName: 'Synthetic' } });
    await prisma.workSession.create({ data: { workerId: w.id, startTime: new Date('2026-11-01T07:00Z'), endTime: new Date('2026-11-01T08:00Z'), totalHours: 1, breakMinutes: 0 } });
  }
  const r = await adminGetSteelDailyReport(admin(), { date: '2026-11-01' });
  expect(r).toMatchObject({ ok: true, attendance: { totalHours: 22, recordedWorkers: 22, workersComplete: false } });
  if (!r.ok) throw Error('Expected report'); expect(r.attendance.workers).toHaveLength(20);
});
