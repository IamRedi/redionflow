import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { seedSecurityTenants, removeSecurityTenants } from '../../../tests/security/fixtures';
import { assistantHoursData } from './hours-data';
import type { RequesterContext } from './requester';

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>> = [];
const from = new Date('2026-11-01T00:00:00Z');
const to = new Date('2026-11-02T00:00:00Z');
const now = new Date('2026-11-01T12:00:00Z');

function assertDisposableDatabase() {
  // Support the repository's disposable Docker integration runner and owned
  // loopback E2E PostgreSQL fixture. Never use inherited hosted/real databases.
  const urls = [process.env.DATABASE_URL, process.env.DIRECT_URL ?? process.env.DATABASE_URL];
  for (const raw of urls) {
    let url: URL;
    try { url = new URL(raw ?? ''); } catch { throw new Error('Disposable loopback integration database required.'); }
    const identity = `${url.pathname}/${url.username}`;
    const query = [...url.searchParams];
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        !['/baumkalk_integration/int', '/baumkalk_e2e/e2e', '/baumkalk_ci/postgres'].includes(identity) || url.hash ||
        !(query.length === 0 || query.length === 1 && query[0][0] === 'schema' && query[0][1] === 'public')) {
      throw new Error('Disposable loopback integration database required.');
    }
  }
  if (process.env.TENANT_DATABASE_URL) {
    let tenant: URL, system: URL;
    try { tenant = new URL(process.env.TENANT_DATABASE_URL); system = new URL(process.env.DATABASE_URL!); }
    catch { throw new Error('Disposable tenant runtime database required.'); }
    const options = [...tenant.searchParams];
    if (!['postgres:', 'postgresql:'].includes(tenant.protocol) || tenant.hostname !== system.hostname || tenant.port !== system.port || tenant.pathname !== system.pathname || tenant.username !== 'bk_saas_pilot_runtime' || tenant.hash ||
        !(options.length === 0 || options.length === 1 && options[0][0] === 'schema' && options[0][1] === 'public')) throw new Error('Disposable tenant runtime database required.');
  }
}

const admin = (): RequesterContext => ({ kind: 'admin', companyId: tenants[0].company.id, adminId: tenants[0].admin.id, displayName: 'Synthetic admin', preferredLanguage: 'SQ', timeZone: 'Europe/Tirane' });

beforeEach(async () => {
  assertDisposableDatabase();
  tenants = await seedSecurityTenants();
});
afterEach(async () => {
  if (tenants.length) await removeSecurityTenants(tenants.map(t => t.company.id));
  tenants = [];
});

describe('uncapped company assistant hours', () => {
  it('aggregates more than 5000 closed sessions without dropping rows, foreign workers or half-open boundaries', async () => {
    const own = tenants[0], foreign = tenants[1], count = 5301;
    await prisma.workSession.createMany({ data: Array.from({ length: count }, (_, i) => ({
      workerId: own.worker.id, baustelleId: own.site.id,
      startTime: i === 0 ? from : new Date('2026-11-01T08:00:00Z'),
      endTime: i === 0 ? new Date('2026-11-01T01:15:00Z') : new Date('2026-11-01T09:15:00Z'),
      totalHours: 1.25, breakMinutes: 0, isLive: false,
    })) });
    await prisma.workSession.createMany({ data: [
      { workerId: foreign.worker.id, baustelleId: foreign.site.id, startTime: new Date('2026-11-01T08:00:00Z'), endTime: new Date('2026-11-01T09:00:00Z'), totalHours: 999, breakMinutes: 0 },
      { workerId: own.worker.id, baustelleId: own.site.id, startTime: to, endTime: new Date('2026-11-02T01:00:00Z'), totalHours: 777, breakMinutes: 0 },
      { workerId: own.worker.id, baustelleId: own.site.id, startTime: new Date(from.getTime() - 60_000), endTime: new Date(from.getTime() + 60_000), totalHours: 888, breakMinutes: 0 },
    ] });
    const result = await assistantHoursData(admin(), { from, to, now });
    expect(result).toMatchObject({ complete: true, sessionRows: count, totalHours: count * 1.25, asOf: now.toISOString(), timeZone: 'Europe/Tirane',
      workers: [{ workerId: own.worker.id, hours: count * 1.25, sessionRows: count }] });
    expect(result?.workers).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain(foreign.worker.id);
    expect(JSON.stringify(result)).not.toContain(foreign.marker);
  });

  it('combines persisted closed hours with live hours calculated once at the requested now and groups workers correctly', async () => {
    const own = tenants[0];
    const second = await prisma.worker.create({ data: { companyProfileId: own.company.id, firstName: 'Second', lastName: 'Synthetic' } });
    await prisma.workSession.createMany({ data: [
      { workerId: own.worker.id, baustelleId: own.site.id, startTime: new Date('2026-11-01T06:00:00Z'), endTime: new Date('2026-11-01T08:00:00Z'), totalHours: 1.25, breakMinutes: 0, isLive: false },
      { workerId: own.worker.id, baustelleId: own.site.id, startTime: new Date('2026-11-01T09:00:00Z'), endTime: null, totalHours: 9999, breakMinutes: 30, isLive: true },
      { workerId: second.id, baustelleId: own.site.id, startTime: new Date('2026-11-01T08:00:00Z'), endTime: new Date('2026-11-01T11:00:00Z'), totalHours: 2.5, breakMinutes: 30, isLive: false },
    ] });
    const result = await assistantHoursData(admin(), { from, to, now });
    expect(result).toMatchObject({ complete: true, sessionRows: 3, totalHours: 6.25, asOf: now.toISOString(), timeZone: 'Europe/Tirane' });
    expect(result?.workers).toEqual(expect.arrayContaining([
      expect.objectContaining({ workerId: own.worker.id, hours: 3.75, sessionRows: 2 }),
      expect.objectContaining({ workerId: second.id, worker: 'Second Synthetic', hours: 2.5, sessionRows: 1 }),
    ]));
    const later = await assistantHoursData(admin(), { from, to, now: new Date(now.getTime() + 30 * 60_000) });
    expect(later?.totalHours).toBe(6.75);
    expect(later?.asOf).toBe('2026-11-01T12:30:00.000Z');
  });

  it('denies non-admin identities and rejects invalid or reversed bounds rather than silently substituting a period', async () => {
    const worker: RequesterContext = { kind: 'worker', workerId: tenants[0].worker.id, companyId: tenants[0].company.id, displayName: 'Synthetic worker', preferredLanguage: 'SQ' };
    const anonymous: RequesterContext = { kind: 'anonymous', companyId: tenants[0].company.id, displayName: 'Guest', preferredLanguage: 'SQ' };
    expect(await assistantHoursData(worker, { from, to, now })).toBeNull();
    expect(await assistantHoursData(anonymous, { from, to, now })).toBeNull();
    expect(await assistantHoursData(admin(), { from: new Date('invalid'), to, now })).toBeNull();
    expect(await assistantHoursData(admin(), { from, to: from, now })).toBeNull();
    expect(await assistantHoursData(admin(), { from: to, to: from, now })).toBeNull();
    expect(await assistantHoursData({ ...admin(), companyId: tenants[1].company.id }, { from, to, now })).toBeNull();
    await prisma.user.update({ where: { id: tenants[0].admin.id }, data: { isActive: false } });
    expect(await assistantHoursData(admin(), { from, to, now })).toBeNull();
    await prisma.user.update({ where: { id: tenants[0].admin.id }, data: { isActive: true, role: 'STAFF' } });
    expect(await assistantHoursData(admin(), { from, to, now })).toBeNull();
  });
});
