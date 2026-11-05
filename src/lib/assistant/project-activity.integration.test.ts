import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { assertAssistantTestDatabase } from '../../../tests/fixtures/assistant-database';
import { seedSecurityTenants, removeSecurityTenants } from '../../../tests/security/fixtures';
import { initialFactorySteps } from '@/lib/factory/production';
import { adminGetStartedSteelProjects } from './project-activity';
import type { RequesterContext } from './requester';
let tenants: Awaited<ReturnType<typeof seedSecurityTenants>> = [];
const now = new Date('2026-11-05T12:00:00Z');
const past = new Date('2026-11-03T10:00:00Z');
const future = new Date('2026-11-06T10:00:00Z');
const admin = (): RequesterContext => ({ kind: 'admin', adminId: tenants[0].admin.id, companyId: tenants[0].company.id, preferredLanguage: 'SQ', displayName: 'Synthetic' });
beforeEach(async () => {
  assertAssistantTestDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
  tenants = await seedSecurityTenants();
  for (const t of tenants) {
    await prisma.companyProfile.update({ where: { id: t.company.id }, data: { mode: 'bau', country: 'AL' } });
    await prisma.baustelle.update({ where: { id: t.site.id }, data: { type: 'STEEL_ASSEMBLY' } });
  }
});
afterEach(async () => { if (tenants.length) await removeSecurityTenants(tenants.map(t => t.company.id)); tenants = []; vi.useRealTimers(); });
async function site(name: string, type: 'STEEL_ASSEMBLY' | 'STEEL_WORKSHOP' = 'STEEL_ASSEMBLY') { return prisma.baustelle.create({ data: { companyProfileId: tenants[0].company.id, type, name } }); }
async function confirmation(projectId: string, stage = 'cutting', checkedAt = past, companyIndex = 0, list = 'assembly') {
  const element = await prisma.siteElement.create({ data: { companyProfileId: tenants[companyIndex].company.id, baustelleId: projectId, list, mark: `DEMO-${projectId}`, quantity: 3 } });
  return prisma.siteElementWork.create({ data: { companyProfileId: tenants[companyIndex].company.id, elementId: element.id, stage, pieces: 1, checkedByName: 'Synthetic engineer', checkedAt } });
}

it('ignores active/imported-only projects, future work, workshops and another tenant', async () => {
  await prisma.siteElement.create({ data: { companyProfileId: tenants[0].company.id, baustelleId: tenants[0].site.id, list: 'assembly', mark: 'IMPORTED-ONLY' } });
  await confirmation((await site('Future project')).id, 'cutting', future);
  await confirmation((await site('Factory workshop', 'STEEL_WORKSHOP')).id);
  await confirmation(tenants[1].site.id, 'cutting', past, 1);
  const result = await adminGetStartedSteelProjects(admin());
  expect(result).toMatchObject({ ok: true, totalMatches: 0, projects: [], complete: true });
  expect(JSON.stringify(result)).not.toContain(tenants[1].marker);
});

it('distinguishes factory progress, field confirmations and actual project clock-ins', async () => {
  const factory = tenants[0].site, field = await site('Field activity'), clocked = await site('Clock-in activity');
  await confirmation(factory.id); await confirmation(field.id, 'mounted');
  await prisma.workSession.create({ data: { workerId: tenants[0].worker.id, baustelleId: clocked.id, startTime: new Date('2026-11-04T07:00:00Z'), endTime: null, isLive: true, breakMinutes: 0 } });
  const all = await adminGetStartedSteelProjects(admin());
  expect(all).toMatchObject({ ok: true, totalMatches: 3 });
  if (!all.ok) throw new Error('Expected activity');
  expect(all.projects.map(p => p.id).sort()).toEqual([factory.id, field.id, clocked.id].sort());
  expect(await adminGetStartedSteelProjects(admin(), { scope: 'factory' })).toMatchObject({ ok: true, totalMatches: 1, projects: [{ id: factory.id }] });
  const onsite = await adminGetStartedSteelProjects(admin(), { scope: 'site' });
  expect(onsite).toMatchObject({ ok: true, totalMatches: 2 });
  if (!onsite.ok) throw new Error('Expected site activity');
  expect(onsite.projects.find(p => p.id === clocked.id)).toMatchObject({ basis: ['site_clock_in'], firstRecordedAt: '2026-11-04T07:00:00.000Z' });
});

it('does not count removed confirmations, non-live placeholders, invalid closed sessions or unsupported part field stages', async () => {
  const removed = await confirmation(tenants[0].site.id); await prisma.siteElementWork.delete({ where: { id: removed.id } });
  await confirmation((await site('Invalid part stage')).id, 'mounted', past, 0, 'part');
  await prisma.workSession.createMany({ data: [
    { workerId: tenants[0].worker.id, baustelleId: tenants[0].site.id, startTime: past, endTime: null, isLive: false },
    { workerId: tenants[0].worker.id, baustelleId: tenants[0].site.id, startTime: future, endTime: null, isLive: true },
    { workerId: tenants[0].worker.id, baustelleId: tenants[0].site.id, startTime: past, endTime: future, isLive: false },
    { workerId: tenants[0].worker.id, baustelleId: tenants[0].site.id, startTime: past, endTime: new Date(past.getTime() - 60_000), isLive: false },
  ] });
  expect(await adminGetStartedSteelProjects(admin())).toMatchObject({ ok: true, totalMatches: 0 });
});

it('counts genuine legacy start/done events but not import, note, block-only or future audit rows', async () => {
  const started = tenants[0].site, untouched = await site('Notes only');
  for (const project of [started, untouched]) {
    const batch = await prisma.productionBatch.create({ data: { companyProfileId: tenants[0].company.id, baustelleId: project.id, title: 'Demo order', steps: initialFactorySteps() } });
    await prisma.productionEvent.createMany({ data: [
      { companyProfileId: tenants[0].company.id, batchId: batch.id, action: project.id === started.id ? 'start' : 'note', stepKey: 'cutting', toStatus: project.id === started.id ? 'active' : 'todo', actorName: 'Synthetic', createdAt: past },
      { companyProfileId: tenants[0].company.id, batchId: batch.id, action: 'block', stepKey: 'cutting', toStatus: 'blocked', actorName: 'Synthetic', createdAt: past },
      { companyProfileId: tenants[0].company.id, batchId: batch.id, action: 'done', stepKey: 'cutting', toStatus: 'done', actorName: 'Synthetic', createdAt: future },
    ] });
  }
  expect(await adminGetStartedSteelProjects(admin(), { scope: 'factory' })).toMatchObject({ ok: true, totalMatches: 1, projects: [{ id: started.id, basis: ['legacy_factory_start_or_done'] }] });
});

it('paginates the complete matching set and requires explicit inclusion of inactive projects and actual admin membership', async () => {
  const second = await site('Second started'), inactive = await site('Inactive started');
  await confirmation(tenants[0].site.id); await confirmation(second.id); await confirmation(inactive.id);
  await prisma.baustelle.update({ where: { id: inactive.id }, data: { status: 'inactive' } });
  const first = await adminGetStartedSteelProjects(admin(), { limit: 1 });
  expect(first).toMatchObject({ ok: true, totalMatches: 2, complete: false, pageComplete: false });
  if (!first.ok) throw new Error('Expected first page');
  const next = await adminGetStartedSteelProjects(admin(), { limit: 1, cursor: first.nextCursor! });
  expect(next).toMatchObject({ ok: true, totalMatches: 2, complete: false, pageComplete: true });
  expect(await adminGetStartedSteelProjects(admin(), { includeInactive: true })).toMatchObject({ ok: true, totalMatches: 3 });
  expect(await adminGetStartedSteelProjects(admin(), { cursor: tenants[1].site.id })).toMatchObject({ ok: false, code: 'INVALID_CURSOR' });
  expect(await adminGetStartedSteelProjects({ ...admin(), companyId: tenants[1].company.id })).toMatchObject({ ok: false, code: 'ACCESS_DENIED' });
  await prisma.user.update({ where: { id: tenants[0].admin.id }, data: { isActive: false } });
  expect(await adminGetStartedSteelProjects(admin())).toMatchObject({ ok: false, code: 'ACCESS_DENIED' });
});
