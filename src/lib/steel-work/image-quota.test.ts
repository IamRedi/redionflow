import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ company: vi.fn(), requester: vi.fn(), tenant: vi.fn(), tx: { $executeRaw: vi.fn(), assistantQuotaBucket: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() } } }));
vi.mock('@/lib/db/tenant', () => ({ getCurrentCompanyId: mocks.company }));
vi.mock('@/lib/assistant/requester', () => ({ getRequesterContext: mocks.requester }));
vi.mock('@/lib/db/tenant-context', () => ({ withTenantContext: mocks.tenant }));
import { reserveSteelImageQuota } from './image-quota';
const actor = { kind: 'worker' as const, workerId: 'worker-fixture', companyId: 'company-fixture', displayName: 'Fictional worker', preferredLanguage: 'SQ' as const };
const now = new Date('2026-11-05T12:00:00Z');
beforeEach(() => {
  vi.resetAllMocks();
  mocks.company.mockResolvedValue(actor.companyId); mocks.requester.mockResolvedValue(actor);
  mocks.tenant.mockImplementation(async (_id: string, work: (tx: typeof mocks.tx) => unknown) => work(mocks.tx));
  mocks.tx.assistantQuotaBucket.findUnique.mockResolvedValue(null);
});
afterEach(() => { vi.unstubAllEnvs(); });

it('requires the current authenticated company and actor, not caller-supplied identity alone', async () => {
  expect(await reserveSteelImageQuota({ ...actor, companyId: 'foreign-company' }, now)).toMatchObject({ ok: false, status: 403 });
  expect(await reserveSteelImageQuota({ ...actor, workerId: 'foreign-worker' }, now)).toMatchObject({ ok: false, status: 403 });
  expect(await reserveSteelImageQuota({ ...actor, kind: 'anonymous' }, now)).toMatchObject({ ok: false, status: 403 });
  expect(mocks.tenant).not.toHaveBeenCalled();
});

it.each([
  ['company', 'image-burst', 2, 'rate'], ['worker:worker-fixture', 'image-burst', 1, 'rate'],
  ['company', 'image-day', 20, 'budget'], ['worker:worker-fixture', 'image-day', 20, 'budget'],
])('enforces the fixed %s %s ceiling without partially charging other scopes', async (key, window, requests, reason) => {
  vi.stubEnv('ASSISTANT_COMPANY_DAILY_REQUESTS', '100000');
  mocks.tx.assistantQuotaBucket.findUnique.mockImplementation(async ({ where }) => {
    const scope = where.companyProfileId_actorKey_window_windowStart;
    return scope.actorKey === key && scope.window === window ? { requests } : null;
  });
  expect(await reserveSteelImageQuota(actor, now)).toMatchObject({ ok: false, status: 429, reason });
  expect(mocks.tx.assistantQuotaBucket.upsert).not.toHaveBeenCalled();
});

it('consumes four namespaced request counters with zero token accounting and no refund API', async () => {
  expect(await reserveSteelImageQuota(actor, now)).toEqual({ ok: true });
  expect(mocks.tx.assistantQuotaBucket.upsert).toHaveBeenCalledTimes(4);
  for (const [query] of mocks.tx.assistantQuotaBucket.upsert.mock.calls) {
    expect(query.create).toMatchObject({ companyProfileId: actor.companyId, requests: 1, tokens: 0 });
    expect(query.create.window).toMatch(/^image-(burst|day)$/);
    expect(query.update).toEqual({ requests: { increment: 1 }, tokens: 0 });
  }
});

it('fails closed when authentication or the durable quota store is unavailable', async () => {
  mocks.company.mockRejectedValueOnce(new Error('PRIVATE_AUTH_ERROR'));
  expect(await reserveSteelImageQuota(actor, now)).toEqual({ ok: false, status: 503, reason: 'unavailable', retryAfterSeconds: 60 });
  mocks.tenant.mockRejectedValueOnce(new Error('PRIVATE_DATABASE_ERROR'));
  expect(await reserveSteelImageQuota(actor, now)).toEqual({ ok: false, status: 503, reason: 'unavailable', retryAfterSeconds: 60 });
});

it('allows request twenty while preserving the company-wide cap across actors', async () => {
  mocks.tx.assistantQuotaBucket.findUnique.mockImplementation(async ({where}) => where.companyProfileId_actorKey_window_windowStart.window === 'image-day' ? {requests:19} : null);
  expect(await reserveSteelImageQuota(actor, now)).toEqual({ok:true});
  expect(mocks.tx.assistantQuotaBucket.upsert).toHaveBeenCalledTimes(4);
});
