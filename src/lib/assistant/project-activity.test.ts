import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@/generated/prisma/client';
import type { RequesterContext } from './requester';
const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock('@/lib/db/prisma', () => ({ prisma: { $transaction: mocks.transaction } }));
import { adminGetStartedSteelProjects } from './project-activity';

const now = new Date('2026-11-05T12:00:00Z');
const requester: RequesterContext = { kind: 'admin', adminId: 'admin-a', companyId: 'tenant-a', displayName: 'Demo', preferredLanguage: 'SQ' };
const tx = { $executeRaw: vi.fn(), companyProfile: { findFirst: vi.fn() }, baustelle: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  steelWorkDefinition: { findMany: vi.fn() },
  siteElementWork: { aggregate: vi.fn() }, workSession: { aggregate: vi.fn(), fields: { startTime: 'synthetic-field-reference' } }, productionEvent: { aggregate: vi.fn() } };
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
  mocks.transaction.mockImplementation((fn: (client: Prisma.TransactionClient) => Promise<unknown>) => fn(tx as unknown as Prisma.TransactionClient));
  tx.companyProfile.findFirst.mockResolvedValue({ country: 'AL' }); tx.baustelle.count.mockResolvedValue(0); tx.baustelle.findMany.mockResolvedValue([]); tx.baustelle.findFirst.mockResolvedValue(null);
  tx.steelWorkDefinition.findMany.mockResolvedValue([]);
  tx.siteElementWork.aggregate.mockResolvedValue({ _min: { checkedAt: null }, _max: { checkedAt: null } });
  tx.workSession.aggregate.mockResolvedValue({ _min: { startTime: null }, _max: { startTime: null } });
  tx.productionEvent.aggregate.mockResolvedValue({ _min: { createdAt: null }, _max: { createdAt: null } });
});
afterEach(() => vi.useRealTimers());

describe('compact recorded project activity', () => {
  it('denies non-admin, revoked/foreign membership and malformed pages without returning business records', async () => {
    expect(await adminGetStartedSteelProjects({ kind: 'worker', workerId: 'worker-a', companyId: 'tenant-a', preferredLanguage: 'SQ', displayName: 'Demo' })).toMatchObject({ ok: false, code: 'ADMIN_REQUIRED' });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(await adminGetStartedSteelProjects(requester, { limit: 1000 })).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
    tx.companyProfile.findFirst.mockResolvedValue(null);
    expect(await adminGetStartedSteelProjects(requester)).toMatchObject({ ok: false, code: 'ACCESS_DENIED' });
    expect(tx.companyProfile.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'tenant-a', mode: 'bau', users: { some: { id: 'admin-a', isActive: true, role: 'ADMIN' } } });
    expect(tx.baustelle.findMany).not.toHaveBeenCalled();
  });

  it('does not count active/imported projects alone, scopes current evidence and excludes future/placeholder sessions', async () => {
    expect(await adminGetStartedSteelProjects(requester)).toMatchObject({ ok: true, totalMatches: 0, complete: true, projects: [] });
    const where = tx.baustelle.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ companyProfileId: 'tenant-a', type: 'STEEL_ASSEMBLY', status: 'active' });
    expect(where.OR).toHaveLength(3);
    expect(where.OR[0].siteElements.some.work.some).toMatchObject({ companyProfileId: 'tenant-a', checkedAt: { lte: now } });
    expect(where.OR[1].workSessions.some).toMatchObject({ startTime: { lte: now }, worker: { companyProfileId: 'tenant-a' }, OR: [{ endTime: null, isLive: true }, { endTime: { lte: now, gt: 'synthetic-field-reference' } }] });
    expect(where.OR[2].productionBatches.some.events.some).toMatchObject({ companyProfileId: 'tenant-a', createdAt: { lte: now }, OR: [{ action: 'start', toStatus: 'active' }, { action: 'done', toStatus: 'done' }] });
    expect(mocks.transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'RepeatableRead' });
  });

  it('returns exact matching count and a compact page while merging first/last dates from distinct evidence sources', async () => {
    tx.baustelle.count.mockResolvedValue(2); tx.baustelle.findMany.mockResolvedValue([{ id: 'project-a', name: 'Demo A', status: 'active' }, { id: 'project-b', name: 'Demo B', status: 'active' }]);
    tx.siteElementWork.aggregate.mockResolvedValue({ _min: { checkedAt: new Date('2026-11-03T10:00:00Z') }, _max: { checkedAt: new Date('2026-11-05T10:00:00Z') } });
    tx.workSession.aggregate.mockResolvedValue({ _min: { startTime: new Date('2026-11-02T07:00:00Z') }, _max: { startTime: new Date('2026-11-04T07:00:00Z') } });
    const result = await adminGetStartedSteelProjects(requester, { limit: 1 });
    expect(result).toMatchObject({ ok: true, retrievedAt: now.toISOString(), timeZone: 'Europe/Tirane', totalMatches: 2, returned: 1, complete: false, pageComplete: false, nextCursor: 'project-a',
      projects: [{ id: 'project-a', name: 'Demo A', firstRecordedAt: '2026-11-02T07:00:00.000Z', lastRecordedAt: '2026-11-05T10:00:00.000Z', basis: ['production_confirmation', 'site_clock_in'] }] });
    expect(JSON.stringify(result)).not.toContain('Demo B');
  });

  it('keeps factory and site criteria distinct and validates cursors inside the matching project set', async () => {
    await adminGetStartedSteelProjects(requester, { scope: 'factory', includeInactive: true });
    const factory = tx.baustelle.count.mock.calls[0][0].where;
    expect(factory).not.toHaveProperty('status'); expect(factory.OR).toHaveLength(2);
    expect(JSON.stringify(factory)).not.toContain('workSessions'); expect(JSON.stringify(factory)).not.toContain('mounted');
    await adminGetStartedSteelProjects(requester, { scope: 'site' });
    const site = tx.baustelle.count.mock.calls[1][0].where;
    expect(site.OR).toHaveLength(2); expect(JSON.stringify(site)).toContain('mounted'); expect(JSON.stringify(site)).not.toContain('productionBatches');
    expect(await adminGetStartedSteelProjects(requester, { cursor: 'foreign-id' })).toMatchObject({ ok: false, code: 'INVALID_CURSOR' });
  });

  it('returns a safe unavailable error rather than inventing zero when the read fails', async () => {
    tx.baustelle.count.mockRejectedValue(new Error('private-database-secret'));
    const result = await adminGetStartedSteelProjects(requester);
    expect(result).toMatchObject({ ok: false, code: 'READ_UNAVAILABLE' });
    expect(JSON.stringify(result)).not.toContain('private-database-secret');
  });

  it('recognizes registered custom factory/field history including archived definitions without crossing sides', async () => {
    const fp = `fp-${'a'.repeat(24)}`, sp = `sp-${'b'.repeat(24)}`, wrongSide = `sp-${'c'.repeat(24)}`;
    tx.steelWorkDefinition.findMany.mockResolvedValue([{ key: fp, kind: 'factory', archivedAt: now }, { key: sp, kind: 'field' }, { key: wrongSide, kind: 'factory' }]);
    await adminGetStartedSteelProjects(requester, { scope: 'factory' });
    expect(tx.steelWorkDefinition.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { companyProfileId: 'tenant-a', kind: { in: ['factory', 'field'] } } }));
    const factoryWork = tx.baustelle.count.mock.calls[0][0].where.OR[0].siteElements.some.work.some;
    expect(factoryWork.OR[0]).toMatchObject({ stage: { in: expect.arrayContaining([fp, 'cutting']) }, element: { list: { in: ['assembly', 'part'] } } });
    expect(JSON.stringify(factoryWork)).not.toContain(sp);
    expect(JSON.stringify(factoryWork)).not.toContain(wrongSide);
    await adminGetStartedSteelProjects(requester, { scope: 'site' });
    const fieldWork = tx.baustelle.count.mock.calls[1][0].where.OR[0].siteElements.some.work.some;
    expect(fieldWork.OR[0]).toMatchObject({ stage: { in: expect.arrayContaining([sp, 'mounted']) }, element: { list: 'assembly' } });
    expect(JSON.stringify(fieldWork)).not.toContain(fp);
  });
});
