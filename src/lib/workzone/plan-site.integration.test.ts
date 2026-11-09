import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { seedSecurityTenants, removeSecurityTenants } from '../../../tests/security/fixtures';
import { dayRange } from './date-utils';
import { plannedSiteId, plannedSiteNames } from './plan-site';
import { getWorkerMonthlyReport, monthlySessionRows } from './reporting';

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>> = [];
beforeEach(async () => { tenants = await seedSecurityTenants(); });
afterEach(async () => { if (tenants.length) await removeSecurityTenants(tenants.map(t => t.company.id)); tenants = []; });

describe('site from the daily plan', () => {
  it('gives the worker the planned site of that day, never another company\'s, and fills the timesheet', async () => {
    const [own, foreign] = tenants;
    const plan = await prisma.dailyWorkPlan.create({ data: { companyProfileId: own.company.id, planDate: dayRange('2026-11-09').start } });
    await prisma.dailyWorkPlanColumn.create({ data: { planId: plan.id, baustelleId: own.site.id, title: own.site.name, assignments: { create: { kind: 'WORKER', workerId: own.worker.id, labelSnapshot: 'w' } } } });

    expect(await plannedSiteId(own.company.id, own.worker.id, new Date('2026-11-09T06:30:00Z'))).toBe(own.site.id);
    expect(await plannedSiteId(own.company.id, own.worker.id, new Date('2026-11-10T06:30:00Z'))).toBeNull();
    expect(await plannedSiteId(foreign.company.id, own.worker.id, new Date('2026-11-09T06:30:00Z'))).toBeNull();
    expect([...(await plannedSiteNames(own.company.id, own.worker.id, '2026-11'))]).toEqual([['2026-11-09', own.site.name]]);

    await prisma.workSession.create({ data: { workerId: own.worker.id, startTime: new Date('2026-11-09T07:00:00Z'), endTime: new Date('2026-11-09T15:00:00Z'), totalHours: 7.5, breakMinutes: 30, isLive: false } });
    const rows = monthlySessionRows(await getWorkerMonthlyReport(own.worker.id, '2026-11'), '2026-11', 'sq');
    expect(rows).toHaveLength(30);
    expect(rows[0].dayOfMonth).toBe('01');
    expect(rows[8]).toMatchObject({ date: '2026-11-09', hasWork: true, locations: own.site.name });
  });
});
