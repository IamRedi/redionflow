import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ companyId: '', requester: null as unknown }));
vi.mock('@/lib/db/tenant', async original => ({ ...await original<typeof import('@/lib/db/tenant')>(), getCurrentCompanyId: async () => auth.companyId || null }));
vi.mock('@/lib/assistant/requester', () => ({ getRequesterContext: async () => auth.requester }));
import { prisma } from '@/lib/db/prisma';
import { assertAssistantTestDatabase } from '../../../tests/fixtures/assistant-database';
import { seedSecurityTenants, removeSecurityTenants } from '../../../tests/security/fixtures';
import type { RequesterContext } from '@/lib/assistant/requester';
import { reserveSteelImageQuota } from './image-quota';

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
const now = new Date('2026-11-05T12:00:00Z');
function identity(index = 0, kind: 'admin' | 'worker' = 'worker'): RequesterContext {
  const tenant = tenants[index];
  return { companyId: tenant.company.id, displayName: 'Fictional image operator', preferredLanguage: 'SQ', ...(kind === 'admin' ? { kind, adminId: tenant.admin.id } : { kind, workerId: tenant.worker.id }) };
}
function authenticate(actor = identity()) { auth.companyId = actor.companyId; auth.requester = actor; return actor; }
beforeEach(async () => { assertAssistantTestDatabase(); tenants = await seedSecurityTenants(); authenticate(); });
afterEach(async () => { if (tenants) await removeSecurityTenants(tenants.map(tenant => tenant.company.id)); });

it('serializes concurrent requests and charges only one actor reservation, never text tokens', async () => {
  await prisma.assistantQuotaBucket.create({ data: { companyProfileId: auth.companyId, actorKey: 'company', window: 'day', windowStart: new Date('2026-11-05T00:00:00Z'), requests: 7, tokens: 123 } });
  const results = await Promise.all(Array.from({ length: 12 }, () => reserveSteelImageQuota(identity(), now)));
  expect(results.filter(result => result.ok)).toHaveLength(1);
  expect(results.filter(result => !result.ok).every(result => !result.ok && result.reason === 'rate')).toBe(true);
  const images = await prisma.assistantQuotaBucket.findMany({ where: { companyProfileId: auth.companyId, window: { startsWith: 'image-' } } });
  expect(images).toHaveLength(4);
  expect(images.every(row => row.requests === 1 && row.tokens === 0)).toBe(true);
  expect(await prisma.assistantQuotaBucket.findFirst({ where: { companyProfileId: auth.companyId, window: 'day' } })).toMatchObject({ requests: 7, tokens: 123 });
});

it('shares company burst capacity across actors while another tenant stays independent', async () => {
  expect(await reserveSteelImageQuota(authenticate(identity()), now)).toEqual({ ok: true });
  expect(await reserveSteelImageQuota(authenticate(identity(0, 'admin')), now)).toEqual({ ok: true });
  const extra = await prisma.worker.create({ data: { companyProfileId: tenants[0].company.id, firstName: 'Fictional', lastName: 'Additional', loginCodeHash: 'synthetic-unused-image-test-hash' } });
  const actor = { ...identity(), kind: 'worker' as const, workerId: extra.id };
  expect(await reserveSteelImageQuota(authenticate(actor), now)).toMatchObject({ ok: false, reason: 'rate' });
  expect(await prisma.assistantQuotaBucket.count({ where: { companyProfileId: tenants[0].company.id, actorKey: `worker:${extra.id}` } })).toBe(0);
  expect(await reserveSteelImageQuota(authenticate(identity(1)), now)).toEqual({ ok: true });
});

it('keeps failed-call reservations consumed, stops at five actor requests and resets at UTC midnight', async () => {
  for (let index = 0; index < 5; index += 1) expect(await reserveSteelImageQuota(identity(), new Date(now.getTime() + index * 600_000))).toEqual({ ok: true });
  const sixth = new Date(now.getTime() + 5 * 600_000);
  expect(await reserveSteelImageQuota(identity(), sixth)).toMatchObject({ ok: false, reason: 'budget' });
  expect(await prisma.assistantQuotaBucket.count({ where: { companyProfileId: auth.companyId, window: 'image-burst', windowStart: sixth } })).toBe(0);
  expect(await prisma.assistantQuotaBucket.findFirst({ where: { companyProfileId: auth.companyId, actorKey: 'company', window: 'image-day' } })).toMatchObject({ requests: 5, tokens: 0 });
  expect(await reserveSteelImageQuota(identity(), new Date('2026-11-06T00:00:00Z'))).toEqual({ ok: true });
});

it('stops the whole company at ten image calls without charging a fresh actor or burst window', async () => {
  for (let index = 0; index < 5; index += 1) {
    const at = new Date(now.getTime() + index * 600_000);
    expect(await reserveSteelImageQuota(authenticate(identity()), at)).toEqual({ ok: true });
    expect(await reserveSteelImageQuota(authenticate(identity(0, 'admin')), at)).toEqual({ ok: true });
  }
  const extra = await prisma.worker.create({ data: { companyProfileId: tenants[0].company.id, firstName: 'Fictional', lastName: 'Fresh', loginCodeHash: 'synthetic-unused-image-test-hash' } });
  const actor = { ...identity(), kind: 'worker' as const, workerId: extra.id };
  const at = new Date(now.getTime() + 5 * 600_000);
  expect(await reserveSteelImageQuota(authenticate(actor), at)).toMatchObject({ ok: false, reason: 'budget' });
  expect(await prisma.assistantQuotaBucket.count({ where: { companyProfileId: auth.companyId, window: 'image-burst', windowStart: at } })).toBe(0);
  expect(await prisma.assistantQuotaBucket.findFirst({ where: { companyProfileId: auth.companyId, actorKey: 'company', window: 'image-day' } })).toMatchObject({ requests: 10, tokens: 0 });
});

it('rejects forged actor or company context before creating any durable bucket', async () => {
  expect(await reserveSteelImageQuota(identity(1), now)).toMatchObject({ ok: false, status: 403 });
  expect(await reserveSteelImageQuota(identity(0, 'admin'), now)).toMatchObject({ ok: false, status: 403 });
  expect(await prisma.assistantQuotaBucket.count({ where: { companyProfileId: { in: tenants.map(tenant => tenant.company.id) } } })).toBe(0);
});
