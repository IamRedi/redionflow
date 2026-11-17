import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
const delivered = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: 0, failed: 0 }));
vi.mock('@/lib/notifications/sendNotification', () => ({ sendNotification: delivered }));
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { assertCompanyChatTestDatabase } from '../../../tests/fixtures/company-chat-database';
import { applyCompanyChatCommand, companyChatSnapshot } from './service';
import type { ChatIdentity } from './contract';
assertCompanyChatTestDatabase();
let a: ChatIdentity, b: ChatIdentity, foreign: ChatIdentity;
const role = 'company_chat_rls_probe';
const send = (actor: ChatIdentity, body: string, id = randomUUID()) => applyCompanyChatCommand(actor, { type: 'send', actorKey: actor.key, requestId: id, body });
beforeAll(async () => {
  const company = await prisma.companyProfile.create({ data: { displayName: 'Chat fixture', legalName: 'Fictional only' } });
  const other = await prisma.companyProfile.create({ data: { displayName: 'Foreign chat fixture', legalName: 'Fictional only' } });
  a = { companyId: company.id, key: 'admin:fixture-owner', name: 'Owner Demo', demo: false };
  b = { companyId: company.id, key: 'worker:fixture-crew', name: 'Crew Demo', demo: false };
  foreign = { companyId: other.id, key: 'worker:foreign', name: 'Other Demo', demo: false };
  await prisma.$executeRawUnsafe(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
  await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await prisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE ON "CompanyChatMessage","CompanyChatReader" TO ${role}`);
});
beforeEach(async () => { delivered.mockClear(); await prisma.companyChatReader.deleteMany({ where: { companyProfileId: { in: [a.companyId, foreign.companyId] } } }); await prisma.companyChatMessage.deleteMany({ where: { companyProfileId: { in: [a.companyId, foreign.companyId] } } }); });
it('shares immutable author/timestamp/history within one company and persists independent read state', async () => {
  await send(a, 'Synthetic first message');
  expect(await companyChatSnapshot(a)).toMatchObject({ unread: 0, latest: '1' });
  const seen = await companyChatSnapshot(b); expect(seen).toMatchObject({ unread: 1, messages: [{ authorName: 'Owner Demo', body: 'Synthetic first message' }] });
  await applyCompanyChatCommand(b, { type: 'read', actorKey: b.key, through: seen.latest });
  expect((await companyChatSnapshot(b)).unread).toBe(0);
  await send(b, 'Synthetic reply'); expect((await companyChatSnapshot(a)).unread).toBe(1);
  expect((await companyChatSnapshot(foreign)).messages).toEqual([]);
});
it('deduplicates concurrent retries and rejects token reuse with different content', async () => {
  const id = randomUUID(); const replies = await Promise.all([send(a, 'Once', id), send(a, 'Once', id)]);
  expect(replies.filter(r => r.created)).toHaveLength(1); expect((await companyChatSnapshot(b)).messages).toHaveLength(1); expect(delivered).toHaveBeenCalledTimes(1);
  await expect(send(a, 'Different', id)).rejects.toMatchObject({ status: 409 });
});
it('keeps later arrivals unread, never regresses read cursors and rejects foreign/future markers', async () => {
  await send(a, 'First'); const old = await companyChatSnapshot(b); await send(a, 'Second');
  await applyCompanyChatCommand(b, { type: 'read', actorKey: b.key, through: old.latest }); expect((await companyChatSnapshot(b)).unread).toBe(1);
  await applyCompanyChatCommand(b, { type: 'read', actorKey: b.key, through: '2' }); await applyCompanyChatCommand(b, { type: 'read', actorKey: b.key, through: '1' }); expect((await companyChatSnapshot(b)).unread).toBe(0);
  await expect(applyCompanyChatCommand(b, { type: 'read', actorKey: b.key, through: '999' })).rejects.toMatchObject({ status: 400 });
  await expect(applyCompanyChatCommand(b, { type: 'read', actorKey: a.key, through: '2' })).rejects.toMatchObject({ status: 409 });
});
it('serializes bounded sends and keeps message persistence when a provider fails', async () => {
  delivered.mockRejectedValueOnce(new Error('Synthetic provider failure'));
  await send(a, 'Saved independently of push'); expect((await companyChatSnapshot(b)).unread).toBe(1);
  for (let i = 0; i < 19; i++) await send(a, `Bounded message ${i}`);
  await expect(send(a, 'One too many')).rejects.toMatchObject({ status: 429 });
  await send(foreign, 'Separate company budget'); expect((await companyChatSnapshot(foreign)).latest).toBe('1');
});
it('pages history with stable company cursors and enforces tenant policy with a non-owner DB role', async () => {
  await withTenantContext(a.companyId, tx => tx.companyChatMessage.createMany({ data: Array.from({ length: 45 }, (_, n) => ({ companyProfileId: a.companyId, authorKey: a.key, authorName: a.name, requestId: randomUUID(), seq: BigInt(n + 1), body: `History ${n + 1}` })) }));
  await send(foreign, 'Foreign history'); const page = await companyChatSnapshot(b); expect(page.messages).toHaveLength(40); expect(page.older).toBe('6');
  expect((await companyChatSnapshot(b, { before: BigInt(page.older!) })).messages.map(m => m.seq)).toEqual(['1','2','3','4','5']);
  const visible = await prisma.$transaction(async tx => { await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`); await tx.$executeRaw`SELECT set_config('app.current_tenant_id',${a.companyId},true)`; return tx.$queryRaw<Array<{companyProfileId: string}>>`SELECT "companyProfileId" FROM "CompanyChatMessage"`; });
  expect(visible).toHaveLength(45); expect(visible.every(row => row.companyProfileId === a.companyId)).toBe(true);
});
it('bounds public demo storage without deleting history or breaking an existing receipt', async () => {
  const receipt = randomUUID();
  await withTenantContext(a.companyId, tx => tx.companyChatMessage.createMany({ data: Array.from({ length: 10000 }, (_, n) => ({ companyProfileId: a.companyId, authorKey: a.key, authorName: a.name, requestId: n === 0 ? receipt : randomUUID(), seq: BigInt(n + 1), body: `Retained ${n}`, createdAt: new Date('2020-01-01') })) }));
  await expect(send(a, 'Over capacity')).rejects.toMatchObject({ code: 'storage', status: 413 });
  expect(await send(a, 'Retained 0', receipt)).toMatchObject({ created: false });
  expect((await companyChatSnapshot(b)).unread).toBe(10000);
  expect(await prisma.companyChatMessage.count({ where: { companyProfileId: a.companyId } })).toBe(10000);
  await send(foreign, 'Separate storage allowance');
});
afterAll(async () => {
  if (a && foreign) await prisma.companyProfile.deleteMany({ where: { id: { in: [a.companyId, foreign.companyId] } } });
  await prisma.$executeRawUnsafe(`DROP OWNED BY ${role}`); await prisma.$executeRawUnsafe(`DROP ROLE ${role}`);
});
