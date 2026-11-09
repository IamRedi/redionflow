import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { assertAssistantTestDatabase } from '../../../tests/fixtures/assistant-database';
import { seedSecurityTenants, removeSecurityTenants } from '../../../tests/security/fixtures';
import type { RequesterContext } from './requester';
import { appendTrace, checkpointRun, deleteConversation, finishRun, getConversation, listConversations, listRunTraces, startRun } from './history';
let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
const role = 'assistant_history_probe';
function admin(index = 0): RequesterContext { const t = tenants[index]; return { kind: 'admin', companyId: t.company.id, adminId: t.admin.id, displayName: 'Synthetic', preferredLanguage: 'SQ' }; }
beforeAll(async () => {
  assertAssistantTestDatabase();
  await prisma.$executeRawUnsafe(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
  await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await prisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON "AssistantConversation","AssistantRun","AssistantToolTrace" TO ${role}`);
});
afterAll(async () => { await prisma.$executeRawUnsafe(`DROP OWNED BY ${role}`); await prisma.$executeRawUnsafe(`DROP ROLE ${role}`); });
beforeEach(async () => { assertAssistantTestDatabase(); tenants = await seedSecurityTenants(); });
afterEach(async () => { vi.unstubAllEnvs(); if (tenants) await removeSecurityTenants(tenants.map(t => t.company.id)); });
it('persists every new turn once, preserves complete emitted text and rejects a changed idempotency key payload', async () => {
  const started = await startRun(admin(), { question: 'Question one', clientMessageId: 'message-one' });
  expect(await finishRun(admin(), { runId: started.runId, answer: 'Complete answer\nwith preserved detail.', status: 'completed', model: 'gpt-4o-mini', finishReason: 'stop', usage: { totalTokens: 123 } })).toBe(true);
  const replay = await startRun(admin(), { question: 'Question one', clientMessageId: 'message-one' });
  expect(replay).toMatchObject({ replayed: true, runId: started.runId, answer: 'Complete answer\nwith preserved detail.' });
  await expect(startRun(admin(), { question: 'Different text', clientMessageId: 'message-one' })).rejects.toMatchObject({ status: 409, code: 'MESSAGE_CONFLICT' });
  expect(await prisma.assistantRun.count({ where: { conversationId: started.conversationId } })).toBe(1);
});
it('serializes concurrent sends to one conversation and parallel replay cannot duplicate a new question', async () => {
  const repeated = await Promise.all([1, 2].map(() => startRun(admin(), { question: 'Same send', clientMessageId: 'same-message' })));
  expect(new Set(repeated.map(r => r.runId)).size).toBe(1); expect(repeated.filter(r => r.replayed)).toHaveLength(1);
  const conversationId = repeated[0].conversationId;
  await expect(startRun(admin(), { conversationId, question: 'Another send', clientMessageId: 'second-message' })).rejects.toMatchObject({ status: 409, code: 'RUNNING' });
  await finishRun(admin(), { runId: repeated[0].runId, answer: 'First answer', status: 'completed' });
  const results = await Promise.allSettled([1, 2].map(i => startRun(admin(), { conversationId, question: `Next${i}`, clientMessageId: `next-${i}` })));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
  expect(await prisma.assistantRun.count({ where: { conversationId, status: 'running' } })).toBe(1);
});
it('keeps the same-company other admin, another tenant and workers outside an owner transcript', async () => {
  const started = await startRun(admin(), { question: 'Owner private question' });
  await finishRun(admin(), { runId: started.runId, answer: 'Owner private answer', status: 'completed' });
  const peer = await prisma.user.create({ data: { companyProfileId: tenants[0].company.id, name: 'Synthetic peer', email: `history-peer-${started.runId}@example.test`, role: 'ADMIN', passwordHash: tenants[0].admin.passwordHash } });
  const other: RequesterContext = { ...admin(), kind: 'admin', adminId: peer.id };
  expect((await listConversations(other)).conversations).toEqual([]);
  await expect(getConversation(other, started.conversationId)).rejects.toMatchObject({ code: 'HISTORY_NOT_FOUND' });
  await expect(getConversation(admin(1), started.conversationId)).rejects.toMatchObject({ code: 'HISTORY_NOT_FOUND' });
  await expect(startRun(other, { conversationId: started.conversationId, question: 'Forged append' })).rejects.toMatchObject({ code: 'HISTORY_NOT_FOUND' });
  await expect(listConversations({ kind: 'worker', companyId: tenants[0].company.id, workerId: tenants[0].worker.id, displayName: 'Synthetic', preferredLanguage: 'SQ' })).rejects.toMatchObject({ status: 403 });
});
it('pages latest-to-oldest turns without duplication and keeps separately paginated sanitized trace evidence', async () => {
  let conversationId = '';
  for (let i = 0; i < 3; i++) {
    const run = await startRun(admin(), { ...(conversationId ? { conversationId } : {}), question: `Question${i}`, clientMessageId: `message-${i}` });
    conversationId = run.conversationId;
    await prisma.assistantRun.update({ where: { id: run.runId }, data: { startedAt: new Date(2026, 10, 5, 12, i) } });
    if (i === 2) {
      vi.stubEnv('OPENAI_API_KEY', 'synthetic-configured-secret');
      for (let call = 0; call < 3; call++) await appendTrace(admin(), { runId: run.runId, toolCallId: `call-${call}`, toolName: 'adminGetSteelProductionSummary', input: { projectId: 'synthetic-project' }, result: { kg: 250, secret: 'synthetic-configured-secret' }, evidence: { retrievedAt: new Date().toISOString() }, status: 'ok' });
      const first = await listRunTraces(admin(), run.runId, { limit: 2 }), next = await listRunTraces(admin(), run.runId, { cursor: first.nextCursor!, limit: 2 });
      expect(first.hasMore).toBe(true); expect(next.hasMore).toBe(false); expect(first.traces.length + next.traces.length).toBe(3);
      expect(JSON.stringify(first.traces)).not.toContain('synthetic-configured-secret'); expect(first.traces[0].redacted).toBe(true);
    }
    await finishRun(admin(), { runId: run.runId, answer: `Answer${i}`, status: 'completed' });
  }
  const first = await getConversation(admin(), conversationId, { limit: 2 }), next = await getConversation(admin(), conversationId, { limit: 2, cursor: first.nextCursor! });
  expect(first.runs.map(r => r.question)).toEqual(['Question2', 'Question1']); expect(next.runs.map(r => r.question)).toEqual(['Question0']);
  expect(new Set([...first.runs, ...next.runs].map(r => r.id)).size).toBe(3);
});
it('retains checkpoints, interruptions, diagnostic categories and terminal answer immutability', async () => {
  const started = await startRun(admin(), { question: 'Question', clientMessageId: 'interrupted-message' });
  await checkpointRun(admin(), { runId: started.runId, answer: 'Partial visible answer' });
  await prisma.assistantRun.update({ where: { id: started.runId }, data: { startedAt: new Date(Date.now() - 91_000) } });
  expect((await getConversation(admin(), started.conversationId)).runs[0]).toMatchObject({ status: 'partial', errorCode: 'INTERRUPTED', interrupted: true });
  expect(await startRun(admin(), { question: 'Question', clientMessageId: 'interrupted-message' })).toMatchObject({ replayed: true, status: 'partial', answer: 'Partial visible answer' });
  expect(await finishRun(admin(), { runId: started.runId, answer: 'Overwrite', status: 'completed' })).toBe(true);
  expect((await prisma.assistantRun.findUniqueOrThrow({ where: { id: started.runId } })).answer).toBe('Partial visible answer');
  const next = await startRun(admin(), { conversationId: started.conversationId, question: 'New explicit request' });
  await finishRun(admin(), { runId: next.runId, answer: 'Localized failure reply', status: 'error', errorCode: 'PROVIDER_AUTH', httpStatus: 401, diagnostics: { failure: { code: 'provider_auth', providerCode: 'invalid_api_key' }, headers: { Authorization: 'hidden-secret' } } });
  const stored = await prisma.assistantRun.findUniqueOrThrow({ where: { id: next.runId } });
  expect(stored).toMatchObject({ status: 'error', errorCode: 'PROVIDER_AUTH', httpStatus: 401, answer: 'Localized failure reply', diagnosticsRedacted: true }); expect(JSON.stringify(stored.diagnostics)).not.toContain('hidden-secret');
});
it('loads older conversations without duplicates after the boundary conversation receives a new turn', async () => {
  const conversations: string[] = [], base = Date.now() - 60_000;
  for (let i = 0; i < 3; i++) {
    const created = await startRun(admin(), { question: `Conversation${i}` });
    await finishRun(admin(), { runId: created.runId, answer: 'Synthetic answer', status: 'completed' });
    await prisma.assistantConversation.update({ where: { id: created.conversationId }, data: { lastRunAt: new Date(base + (3 - i) * 1000) } });
    conversations.push(created.conversationId);
  }
  const first = await listConversations(admin(), { limit: 2 });
  expect(first.conversations.map(c => c.id)).toEqual(conversations.slice(0, 2));
  const resumed = await startRun(admin(), { conversationId: conversations[1], question: 'Continue the boundary conversation' });
  await finishRun(admin(), { runId: resumed.runId, answer: 'New answer', status: 'completed' });
  const next = await listConversations(admin(), { limit: 2, cursor: first.nextCursor! });
  expect(next.conversations.map(c => c.id)).toEqual([conversations[2]]);
  expect(new Set([...first.conversations, ...next.conversations].map(c => c.id)).size).toBe(3);
});
it('enforces tenant AND admin RLS even without the application where filter', async () => {
  const a = await startRun(admin(), { question: 'A private question' });
  await finishRun(admin(), { runId: a.runId, answer: 'A private answer', status: 'completed' });
  const peer = await prisma.user.create({ data: { companyProfileId: tenants[0].company.id, email: `rls-peer-${a.runId}@example.test`, role: 'ADMIN' } });
  const read = (companyId: string | null, adminId: string | null) => prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
    if (companyId) await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
    if (adminId) await tx.$executeRaw`SELECT set_config('app.assistant_admin_id', ${adminId}, true)`;
    return tx.assistantRun.findMany();
  });
  expect((await read(tenants[0].company.id, tenants[0].admin.id)).map(r => r.id)).toEqual([a.runId]);
  expect(await read(tenants[0].company.id, peer.id)).toEqual([]);
  expect(await read(tenants[1].company.id, tenants[0].admin.id)).toEqual([]);
  expect(await read(tenants[0].company.id, null)).toEqual([]);
  expect(await read(null, null)).toEqual([]);
  await expect(prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenants[0].company.id}, true)`;
    await tx.$executeRaw`SELECT set_config('app.assistant_admin_id', ${peer.id}, true)`;
    await tx.assistantRun.create({ data: { companyProfileId: tenants[0].company.id, adminId: peer.id, conversationId: a.conversationId, question: 'Forged parent' } });
  })).rejects.toThrow();
});

it('lets only the owner delete a finished conversation, with its runs and traces', async () => {
  const started = await startRun(admin(), { question: 'To delete', clientMessageId: 'delete-me' });
  await expect(deleteConversation(admin(), started.conversationId)).rejects.toMatchObject({ status: 409, code: 'HISTORY_BUSY' });
  await appendTrace(admin(), { runId: started.runId, toolCallId: 'call-1', toolName: 'adminGetSteelProductionSummary', input: {}, result: { ok: true }, evidence: {}, status: 'ok' });
  await finishRun(admin(), { runId: started.runId, answer: 'Done', status: 'completed' });
  await expect(deleteConversation(admin(1), started.conversationId)).rejects.toMatchObject({ code: 'HISTORY_NOT_FOUND' });
  expect(await deleteConversation(admin(), started.conversationId)).toEqual({ deleted: true });
  expect(await prisma.assistantConversation.count({ where: { id: started.conversationId } })).toBe(0);
  expect(await prisma.assistantRun.count({ where: { conversationId: started.conversationId } })).toBe(0);
  expect(await prisma.assistantToolTrace.count({ where: { runId: started.runId } })).toBe(0);
});
