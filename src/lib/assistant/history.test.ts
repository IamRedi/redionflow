import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  unavailable: false,
  tx: {
    $executeRaw: vi.fn(), user: { findFirst: vi.fn() },
    assistantConversation: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    assistantRun: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    assistantToolTrace: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  },
  warning: vi.fn(),
}));
vi.mock('@/lib/db/tenant-context', () => ({ withTenantContext: async (_tenant: string, fn: (tx: typeof state.tx) => unknown) => {
  if (state.unavailable) throw new Error('postgresql://synthetic:private-password@private-host/secret');
  return fn(state.tx);
} }));
vi.mock('@/lib/observability/logger', () => ({ logger: { warn: (...args: unknown[]) => state.warning(...args) } }));
import { appendTrace, finishRun, getConversation, listConversations, sanitizeHistoryText, sanitizeHistoryValue, startRun } from './history';
import type { RequesterContext } from './requester';
const admin: RequesterContext = { kind: 'admin', companyId: 'tenant-demo', adminId: 'admin-demo', displayName: 'Synthetic', preferredLanguage: 'SQ' };
beforeEach(() => {
  vi.clearAllMocks(); state.unavailable = false;
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
  for (const model of Object.values(state.tx)) if (typeof model === 'object') for (const query of Object.values(model)) query.mockReset();
  state.tx.$executeRaw.mockReset(); state.tx.$executeRaw.mockResolvedValue(1);
  state.tx.user.findFirst.mockResolvedValue({ id: 'admin-demo' });
  state.tx.assistantConversation.create.mockImplementation(async ({ data }) => ({ ...data, id: 'conversation-demo' }));
  state.tx.assistantConversation.updateMany.mockResolvedValue({ count: 1 });
  state.tx.assistantRun.create.mockImplementation(async ({ data }) => ({ ...data, id: 'run-demo' }));
  state.tx.assistantRun.updateMany.mockResolvedValue({ count: 1 });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
it('redacts keys, free-text credentials, configured secrets, headers and raw Error objects while preserving business facts', () => {
  vi.stubEnv('OPENAI_API_KEY', 'configured-synthetic-provider-key');
  const value = sanitizeHistoryValue({ OPENAI_API_KEY: 'configured-synthetic-provider-key', headers: { authorization: 'Bearer hidden-token' }, text: 'kg250; configured-synthetic-provider-key; sk-proj-SyntheticSecret12345678; password=hidden; postgresql://demo:secret@host/db', error: new Error('private SQL detail'), kg: 250, pieces: 2 }); // gitleaks:allow -- intentionally fake redaction fixtures
  const stored = JSON.stringify(value.value);
  expect(value.redacted).toBe(true); expect(value.value).toMatchObject({ kg: 250, pieces: 2, error: { error: 'REDACTED_ERROR' } });
  for (const expectedRedacted of ['configured-synthetic-provider-key', 'SyntheticSecret12345678', 'hidden-token', 'password=hidden', 'demo:secret', 'private SQL detail']) expect(stored).not.toContain(expectedRedacted); // gitleaks:allow -- negative assertions over the fake fixtures above
});
it('redacts secrets in object keys, handles cycles and declares size truncation', () => {
  const cyclic: Record<string, unknown> = { 'sk-proj-SyntheticSecret12345678': 'value' }; cyclic.self = cyclic;
  const safe = sanitizeHistoryValue(cyclic);
  expect(JSON.stringify(safe.value)).not.toContain('SyntheticSecret12345678'); expect(safe.truncated).toBe(true);
  const huge = sanitizeHistoryValue({ rows: Array.from({ length: 150 }, () => 'x'.repeat(500)) }, 200);
  expect(huge.truncated).toBe(true); expect(huge.value).toMatchObject({ omitted: true, reason: 'SIZE_LIMIT' });
  expect(sanitizeHistoryText('answer'.repeat(10), 12)).toMatchObject({ truncated: true, text: 'answeranswer' });
});
it('denies worker history access without a database read', async () => {
  await expect(startRun({ kind: 'worker', workerId: 'worker-demo', companyId: 'tenant-demo', displayName: 'Synthetic', preferredLanguage: 'SQ' }, { question: 'hello' })).rejects.toMatchObject({ status: 403, code: 'ADMIN_REQUIRED' });
  expect(state.tx.user.findFirst).not.toHaveBeenCalled();
});
it('fails closed with a typed safe error when the question cannot be saved', async () => {
  state.unavailable = true;
  await expect(startRun(admin, { question: 'Sa kg sot?' })).rejects.toMatchObject({ status: 503, code: 'HISTORY_UNAVAILABLE', message: 'HISTORY_UNAVAILABLE' });
  expect(state.tx.assistantRun.create).not.toHaveBeenCalled();
});
it('stores only the new question and labels initial imported client messages unverified', async () => {
  expect(await startRun(admin, { question: 'New question', clientMessageId: 'message-demo', context: [{ role: 'user', content: 'Old question' }, { role: 'assistant', content: 'Unverified client answer' }, { role: 'user', content: 'New question' }] })).toMatchObject({ conversationId: 'conversation-demo', runId: 'run-demo', replayed: false });
  expect(state.tx.assistantRun.create).toHaveBeenCalledWith({ data: expect.objectContaining({ companyProfileId: 'tenant-demo', adminId: 'admin-demo', question: 'New question' }) });
  expect(state.tx.assistantConversation.create).toHaveBeenCalledWith({ data: expect.objectContaining({ contextUnverified: true, clientContext: { provenance: 'client-provided-unverified', messages: [{ role: 'user', content: 'Old question' }, { role: 'assistant', content: 'Unverified client answer' }] } }) });
});
it('replays an idempotent turn without appending a duplicate question', async () => {
  state.tx.assistantRun.findFirst.mockResolvedValue({ id: 'saved-run', conversationId: 'saved-conversation', status: 'completed', question: 'Question', answer: 'Saved answer', startedAt: new Date() });
  expect(await startRun(admin, { question: 'Question', clientMessageId: 'message-demo' })).toMatchObject({ runId: 'saved-run', replayed: true, answer: 'Saved answer' });
  expect(state.tx.assistantRun.create).not.toHaveBeenCalled(); expect(state.tx.assistantConversation.create).not.toHaveBeenCalled();
  await expect(startRun(admin, { question: 'Changed question', clientMessageId: 'message-demo' })).rejects.toMatchObject({ code: 'MESSAGE_CONFLICT', status: 409 });
});
it('closes a stale replay as interrupted without opening another run', async () => {
  state.tx.assistantRun.findFirst.mockResolvedValue({ id: 'saved-run', conversationId: 'saved-conversation', status: 'running', question: 'Question', answer: 'Partial text', startedAt: new Date(Date.now() - 91_000) });
  expect(await startRun(admin, { question: 'Question', clientMessageId: 'message-demo' })).toMatchObject({ replayed: true, status: 'partial', answer: 'Partial text' });
  expect(state.tx.assistantRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'partial', errorCode: 'INTERRUPTED' }) }));
  expect(state.tx.assistantRun.create).not.toHaveBeenCalled();
});
it('preserves exact visible partial/error text and sanitized diagnostic codes/usage on finalization', async () => {
  state.tx.assistantRun.findFirst.mockResolvedValue({ status: 'running' });
  expect(await finishRun(admin, { runId: 'run-demo', answer: 'Partial answer\n\nNuk arrita ta përfundoj.', status: 'partial', model: 'gpt-4o-mini', finishReason: 'length', errorCode: 'PROVIDER_AUTH', usage: { totalTokens: 321 }, diagnostics: { failure: { code: 'provider_auth', httpStatus: 401 }, headers: { authorization: 'hidden-token' } } })).toBe(true);
  expect(state.tx.assistantRun.updateMany).toHaveBeenCalledWith({ where: expect.objectContaining({ id: 'run-demo', status: 'running' }), data: expect.objectContaining({ answer: 'Partial answer\n\nNuk arrita ta përfundoj.', status: 'partial', errorCode: 'PROVIDER_AUTH', totalTokens: 321, diagnosticsRedacted: true }) });
  expect(JSON.stringify(state.tx.assistantRun.updateMany.mock.calls)).not.toContain('hidden-token');
});
it('does not overwrite a finalized run, and terminal storage failures remain explicit without logging content', async () => {
  state.tx.assistantRun.findFirst.mockResolvedValue({ status: 'completed' });
  expect(await finishRun(admin, { runId: 'run-demo', answer: 'replacement', status: 'error' })).toBe(true);
  expect(state.tx.assistantRun.updateMany).not.toHaveBeenCalled();
  state.unavailable = true;
  expect(await finishRun(admin, { runId: 'run-demo', answer: 'PRIVATE transcript', status: 'error' })).toBe(false);
  expect(JSON.stringify(state.warning.mock.calls)).not.toContain('PRIVATE');
});
it('deduplicates tool-call traces and does not copy the resubmitted transcript into diagnostics', async () => {
  state.tx.assistantRun.findFirst.mockResolvedValue({ id: 'run-demo', traceBytes: 0 });
  state.tx.assistantToolTrace.findFirst.mockResolvedValue({ id: 'trace-demo' });
  expect(await appendTrace(admin, { runId: 'run-demo', toolCallId: 'call-demo', toolName: 'adminGetSteelProductionSummary', result: { kg: 250 } })).toBe(true);
  expect(state.tx.assistantToolTrace.create).not.toHaveBeenCalled();
});
it('returns newest runs first and labels interrupted rows without claiming the stored status changed', async () => {
  state.tx.assistantConversation.findFirst.mockResolvedValue({ id: 'conversation-demo' });
  state.tx.assistantRun.findMany.mockResolvedValue([{ id: 'run-demo', status: 'running', startedAt: new Date(Date.now() - 91_000) }]);
  expect(await getConversation(admin, 'conversation-demo')).toMatchObject({ order: 'newest-first', runs: [{ status: 'partial', errorCode: 'INTERRUPTED', recordedStatus: 'running', interrupted: true }] });
  expect(state.tx.assistantRun.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ startedAt: 'desc' }, { id: 'desc' }] }));
  expect(state.tx.assistantRun.updateMany).not.toHaveBeenCalled();
});
it('keeps the snapshot conversation boundary even if the cursor row has since moved', async () => {
  const old = new Date('2026-11-05T11:00:00.000Z');
  const cursor = Buffer.from(JSON.stringify({ at: old.toISOString(), id: 'boundary-demo' })).toString('base64url');
  state.tx.assistantConversation.findFirst.mockResolvedValue({ id: 'boundary-demo', lastRunAt: new Date() });
  state.tx.assistantConversation.findMany.mockResolvedValue([]);
  await listConversations(admin, { cursor });
  expect(state.tx.assistantConversation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: [{ lastRunAt: { lt: old } }, { lastRunAt: old, id: { lt: 'boundary-demo' } }] }) }));
});
it.each([
  'plain-id',
  Buffer.from(JSON.stringify({ at: '2026-02-30T00:00:00.000Z', id: 'demo' })).toString('base64url'),
  Buffer.from(JSON.stringify({ at: '2026-11-05T00:00:00.000Z', id: 'demo', adminId: 'forged' })).toString('base64url'),
  'a'.repeat(301),
])('rejects a malformed opaque conversation cursor', async cursor => {
  await expect(listConversations(admin, { cursor })).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 400 });
  expect(state.tx.assistantConversation.findMany).not.toHaveBeenCalled();
});
