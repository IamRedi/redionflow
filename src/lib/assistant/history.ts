/** Durable PRIVATE admin transcripts. Never put this content in application logs. */
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { withTenantContext } from '@/lib/db/tenant-context';
import { logger } from '@/lib/observability/logger';
import type { RequesterContext } from './requester';

export type AssistantRunStatus = 'running' | 'completed' | 'partial' | 'error' | 'cancelled' | 'rejected';
export type AssistantTerminalStatus = Exclude<AssistantRunStatus, 'running'>;
export class AssistantHistoryError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); this.name = 'AssistantHistoryError'; }
}
export const HISTORY_MAX_ANSWER_CHARS = 128 * 1024;
export const HISTORY_MAX_TRACE_BYTES = 256 * 1024;
export const HISTORY_MAX_TRACES = 128;
const STALE_RUN_MS = 90_000;
const sensitiveKey = /(?:password|passwordhash|logincode|logincodehash|apikey|secret|authorization|cookie|sessiontoken|accesstoken|refreshtoken|fcmtoken|credential|privatekey|connectionstring|headers|stack|rawrequest|rawresponse|provideroptions|providermetadata)$/i;
const safeCodes = new Set(['INVALID_REQUEST', 'INVALID_DATE', 'AMBIGUOUS_PERSON', 'KEY_MISSING', 'RATE_LIMITED', 'QUOTA_REJECTED', 'QUOTA_UNAVAILABLE', 'PROVIDER_ERROR', 'MODEL_ERROR', 'MODEL_LIMIT', 'STREAM_ERROR', 'EMPTY_RESPONSE', 'OUTPUT_LIMIT', 'CANCELLED', 'INTERRUPTED', 'READ_UNAVAILABLE', 'HISTORY_UNAVAILABLE', 'UNKNOWN_ERROR',
  'MISSING_KEY', 'PROVIDER_AUTH', 'PROVIDER_QUOTA', 'RATE', 'INPUT_PAYLOAD', 'STEP_LIMIT', 'TIMEOUT', 'CANCEL', 'DB', 'TOOL_UNKNOWN', 'TOOL_INPUT', 'TOOL_FAILURE', 'PROVIDER_REQUEST', 'PROVIDER_UNAVAILABLE', 'EMPTY_ANSWER', 'INCOMPLETE_ANSWER', 'INTERNAL']);
const finishReasons = new Set(['stop', 'length', 'tool-calls', 'content-filter', 'error', 'other', 'unknown', 'abort']);
type Json = Prisma.InputJsonValue;
type Tx = Prisma.TransactionClient;
type Owner = { companyProfileId: string; adminId: string };

function redactText(input: string) {
  let text = input;
  for (const key of ['OPENAI_API_KEY', 'SESSION_SIGNING_SECRET', 'KIDRAHT_SETUP_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL', 'DIRECT_URL', 'TENANT_DATABASE_URL']) {
    const secret = process.env[key];
    if (secret && secret.length >= 8) text = text.split(secret).join('[REDACTED]');
  }
  text = text
    .replace(/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9_.~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:postgres(?:ql)?|mysql|redis):\/\/[^\s"'<>]+/gi, '[REDACTED_CONNECTION]')
    .replace(/\b(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_TOKEN]')
    .replace(/\b(OPENAI_API_KEY|API[_ -]?KEY|SESSION_SIGNING_SECRET|PASSWORD|LOGIN[_ -]?CODE|PIN|SECRET|TOKEN)\s*[:=]\s*["']?[^\s"',;]+/gi, '$1=[REDACTED]');
  return { text, redacted: text !== input };
}
export function sanitizeHistoryText(input: string, maxChars = HISTORY_MAX_ANSWER_CHARS) {
  const redacted = redactText(input), truncated = redacted.text.length > maxChars;
  return { text: redacted.text.slice(0, maxChars), redacted: redacted.redacted, truncated, originalChars: input.length };
}
/** Defense in depth: structured secrets, free-text credentials, Error objects and sizes. */
export function sanitizeHistoryValue(input: unknown, maxBytes = 24 * 1024) {
  let redacted = false, truncated = false;
  const seen = new WeakSet<object>();
  function visit(value: unknown, depth = 0): Json | null {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') { const safe = sanitizeHistoryText(value, 8000); redacted ||= safe.redacted; truncated ||= safe.truncated; return safe.text; }
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
    if (value instanceof Error) { redacted = true; return { error: 'REDACTED_ERROR' }; }
    if (typeof value !== 'object') return null;
    if (depth > 10 || seen.has(value)) { truncated = true; return '[OMITTED]'; }
    seen.add(value);
    if (Array.isArray(value)) { if (value.length > 100) truncated = true; return value.slice(0, 100).map(item => visit(item, depth + 1)); }
    const result: Record<string, Json | null> = Object.create(null), entries = Object.entries(value);
    if (entries.length > 100) truncated = true;
    for (const [key, child] of entries.slice(0, 100)) {
      const safeKey = sanitizeHistoryText(key, 200); redacted ||= safeKey.redacted; truncated ||= safeKey.truncated;
      if (sensitiveKey.test(key.replace(/[^a-z0-9]/gi, ''))) { redacted = true; result[safeKey.text] = '[REDACTED]'; }
      else result[safeKey.text] = visit(child, depth + 1);
    }
    return result;
  }
  let originalBytes = 0;
  try { originalBytes = Buffer.byteLength(JSON.stringify(input, (_key, value) => typeof value === 'bigint' ? value.toString() : value) ?? '', 'utf8'); } catch { truncated = true; }
  let value: Json | null = visit(input);
  let storedBytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  if (storedBytes > maxBytes) { truncated = true; value = { omitted: true, reason: 'SIZE_LIMIT', originalBytes }; storedBytes = Buffer.byteLength(JSON.stringify(value), 'utf8'); }
  return { value, redacted, truncated, originalBytes, storedBytes };
}
function id(value: string | undefined, required = false) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(value)) throw new AssistantHistoryError(400, 'INVALID_REQUEST');
  return value;
}
function pageSize(value?: number) {
  if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 50)) throw new AssistantHistoryError(400, 'INVALID_REQUEST');
  return value ?? 20;
}
function conversationCursor(value: string | undefined): { id: string; at: Date } | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,300}$/.test(value)) throw new AssistantHistoryError(400, 'INVALID_REQUEST');
  try {
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.toString('base64url') !== value) throw new Error();
    const parsed: unknown = JSON.parse(bytes.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).sort().join('|') !== 'at|id') throw new Error();
    const token = parsed as { id?: unknown; at?: unknown };
    if (typeof token.id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(token.id) || typeof token.at !== 'string') throw new Error();
    const at = new Date(token.at);
    if (!Number.isFinite(at.getTime()) || at.toISOString() !== token.at) throw new Error();
    return { id: token.id, at };
  } catch { throw new AssistantHistoryError(400, 'INVALID_REQUEST'); }
}
function nextConversationCursor(row: { id: string; lastRunAt: Date }) {
  return Buffer.from(JSON.stringify({ at: row.lastRunAt.toISOString(), id: row.id }), 'utf8').toString('base64url');
}
function json(value: Json | null): Json | undefined { return value === null ? undefined : value; }
function nonnegative(value: unknown) { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000 ? value : null; }
function owner(requester: RequesterContext): Owner {
  if (requester.kind !== 'admin' || !requester.companyId || !requester.adminId) throw new AssistantHistoryError(403, 'ADMIN_REQUIRED');
  return { companyProfileId: requester.companyId, adminId: requester.adminId };
}
async function historyTx<T>(requester: RequesterContext, fn: (tx: Tx, scope: Owner) => Promise<T>): Promise<T> {
  const scope = owner(requester);
  try {
    return await withTenantContext(scope.companyProfileId, async tx => {
      const admin = await tx.user.findFirst({ where: { id: scope.adminId, companyProfileId: scope.companyProfileId, role: 'ADMIN', isActive: true }, select: { id: true } });
      if (!admin) throw new AssistantHistoryError(403, 'ACCESS_DENIED');
      await tx.$executeRaw`SELECT set_config('app.assistant_admin_id', ${scope.adminId}, true)`;
      return fn(tx, scope);
    }, { timeout: 15000 });
  } catch (error) {
    if (error instanceof AssistantHistoryError) throw error;
    throw new AssistantHistoryError(503, 'HISTORY_UNAVAILABLE');
  }
}
async function lock(tx: Tx, key: string) { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`; }
function initialContext(context: Array<{ role: 'user' | 'assistant'; content: string }> | undefined, question: string) {
  const rows = [...(context ?? [])];
  if (rows.at(-1)?.role === 'user' && rows.at(-1)?.content.trim() === question.trim()) rows.pop();
  let remaining = 12000, truncated = rows.length > 16, redacted = false;
  const messages = rows.slice(-16).map(row => {
    if (!row || !['user', 'assistant'].includes(row.role) || typeof row.content !== 'string') throw new AssistantHistoryError(400, 'INVALID_REQUEST');
    const safe = sanitizeHistoryText(row.content, Math.min(4000, remaining));
    remaining -= safe.text.length; redacted ||= safe.redacted; truncated ||= safe.truncated;
    return { role: row.role, content: safe.text };
  }).filter(row => row.content);
  return { messages, truncated, redacted };
}
export type StartRunInput = { conversationId?: string; clientMessageId?: string; question: string; context?: Array<{ role: 'user' | 'assistant'; content: string }> };
export async function startRun(requester: RequesterContext, input: StartRunInput) {
  if (typeof input.question !== 'string' || !input.question.trim() || input.question.length > 4000) throw new AssistantHistoryError(400, 'INVALID_REQUEST');
  const conversationId = id(input.conversationId), clientMessageId = id(input.clientMessageId);
  const question = sanitizeHistoryText(input.question.trim(), 4000), context = initialContext(input.context, input.question);
  return historyTx(requester, async (tx, scope) => {
    if (clientMessageId) {
      await lock(tx, `assistant-message:${scope.companyProfileId}:${scope.adminId}:${clientMessageId}`);
      const existing = await tx.assistantRun.findFirst({ where: { ...scope, clientMessageId } });
      if (existing) {
        if ((conversationId && conversationId !== existing.conversationId) || existing.question !== question.text) throw new AssistantHistoryError(409, 'MESSAGE_CONFLICT');
        const interrupted = existing.status === 'running' && existing.startedAt.getTime() <= Date.now() - STALE_RUN_MS;
        if (interrupted) await tx.assistantRun.updateMany({ where: { ...scope, id: existing.id, status: 'running' }, data: { status: 'partial', errorCode: 'INTERRUPTED', finishedAt: new Date() } });
        return { conversationId: existing.conversationId, runId: existing.id, replayed: true, status: interrupted ? 'partial' as const : existing.status as AssistantRunStatus, answer: existing.answer };
      }
    }
    const now = new Date();
    const conversation = conversationId
      ? await tx.assistantConversation.findFirst({ where: { ...scope, id: conversationId } })
      : await tx.assistantConversation.create({ data: { ...scope, title: question.text.replace(/\s+/g, ' ').slice(0, 160), clientContext: context.messages.length ? { provenance: 'client-provided-unverified', messages: context.messages } : undefined, contextUnverified: context.messages.length > 0, contextRedacted: context.redacted, contextTruncated: context.truncated, lastRunAt: now } });
    if (!conversation) throw new AssistantHistoryError(404, 'HISTORY_NOT_FOUND');
    await lock(tx, `assistant-conversation:${conversation.id}`);
    const running = await tx.assistantRun.findFirst({ where: { ...scope, conversationId: conversation.id, status: 'running' }, orderBy: { startedAt: 'desc' } });
    if (running && running.startedAt.getTime() > now.getTime() - STALE_RUN_MS) throw new AssistantHistoryError(409, 'RUNNING');
    if (running) await tx.assistantRun.updateMany({ where: { ...scope, id: running.id, status: 'running' }, data: { status: 'partial', errorCode: 'INTERRUPTED', finishedAt: now } });
    const run = await tx.assistantRun.create({ data: { ...scope, conversationId: conversation.id, clientMessageId, question: question.text, questionRedacted: question.redacted, status: 'running', startedAt: now } });
    await tx.assistantConversation.updateMany({ where: { ...scope, id: conversation.id }, data: { lastRunAt: now } });
    return { conversationId: conversation.id, runId: run.id, replayed: false, status: 'running' as AssistantRunStatus, answer: '' };
  });
}

export type AppendTraceInput = { runId: string; toolCallId?: string; toolName: string; input?: unknown; result?: unknown; evidence?: unknown; status?: 'ok' | 'error' | 'rejected'; startedAt?: Date; durationMs?: number; step?: number };
export async function appendTrace(requester: RequesterContext, input: AppendTraceInput): Promise<boolean> {
  try {
    const runId = id(input.runId, true)!, toolCallId = id(input.toolCallId) ?? randomUUID();
    if (!/^[A-Za-z][A-Za-z0-9_]{0,99}$/.test(input.toolName)) return false;
    const args = sanitizeHistoryValue(input.input, 8000), result = sanitizeHistoryValue(input.result, 24 * 1024), evidence = sanitizeHistoryValue(input.evidence, 4000);
    return await historyTx(requester, async (tx, scope) => {
      await lock(tx, `assistant-run:${runId}`);
      const run = await tx.assistantRun.findFirst({ where: { ...scope, id: runId, status: 'running' }, select: { id: true, traceBytes: true } });
      if (!run) return false;
      const duplicate = await tx.assistantToolTrace.findFirst({ where: { ...scope, runId, toolCallId }, select: { id: true } });
      if (duplicate) return true;
      const count = await tx.assistantToolTrace.count({ where: { ...scope, runId } });
      if (count >= HISTORY_MAX_TRACES) { await tx.assistantRun.updateMany({ where: { ...scope, id: runId }, data: { traceTruncated: true } }); return false; }
      const bytes = args.storedBytes + result.storedBytes + evidence.storedBytes, budget = run.traceBytes + bytes > HISTORY_MAX_TRACE_BYTES;
      const data = { ...scope, runId, toolCallId, toolName: input.toolName, step: nonnegative(input.step), status: input.status ?? 'ok', input: budget ? { omitted: true, reason: 'RUN_TRACE_BUDGET' } : json(args.value), result: budget ? undefined : json(result.value), evidence: budget ? undefined : json(evidence.value), redacted: args.redacted || result.redacted || evidence.redacted, truncated: budget || args.truncated || result.truncated || evidence.truncated, originalBytes: args.originalBytes + result.originalBytes + evidence.originalBytes, storedBytes: budget ? 0 : bytes, startedAt: input.startedAt instanceof Date && Number.isFinite(input.startedAt.getTime()) ? input.startedAt : new Date(), durationMs: nonnegative(input.durationMs) };
      await tx.assistantToolTrace.create({ data });
      await tx.assistantRun.updateMany({ where: { ...scope, id: runId }, data: { traceBytes: { increment: data.storedBytes }, ...(data.truncated ? { traceTruncated: true } : {}) } });
      return true;
    });
  } catch { logger.warn({ event: 'assistant.history_trace_failed' }, 'Assistant trace could not be saved'); return false; }
}
export type FinishRunInput = { runId: string; answer: string; status: AssistantTerminalStatus; model?: string; finishReason?: string; errorCode?: string; httpStatus?: number; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | Record<string, unknown>; diagnostics?: unknown };
export async function finishRun(requester: RequesterContext, input: FinishRunInput): Promise<boolean> {
  try {
    const runId = id(input.runId, true)!, answer = sanitizeHistoryText(input.answer);
    if (!['completed', 'partial', 'error', 'cancelled', 'rejected'].includes(input.status)) return false;
    const model = input.model ? sanitizeHistoryText(input.model, 100).text : null;
    const diagnostics = sanitizeHistoryValue({ usage: input.usage ?? null, diagnostics: input.diagnostics ?? null }, 8000);
    return await historyTx(requester, async (tx, scope) => {
      const existing = await tx.assistantRun.findFirst({ where: { ...scope, id: runId }, select: { status: true } });
      if (!existing) return false;
      if (existing.status !== 'running') return true;
      await tx.assistantRun.updateMany({ where: { ...scope, id: runId, status: 'running' }, data: { answer: answer.text, answerRedacted: answer.redacted, answerTruncated: answer.truncated, status: input.status, model, finishReason: input.finishReason ? finishReasons.has(input.finishReason) ? input.finishReason : 'unknown' : null, errorCode: input.errorCode ? safeCodes.has(input.errorCode) ? input.errorCode : 'UNKNOWN_ERROR' : null, httpStatus: input.httpStatus && input.httpStatus >= 100 && input.httpStatus <= 599 ? Math.trunc(input.httpStatus) : null, inputTokens: nonnegative(input.usage?.inputTokens), outputTokens: nonnegative(input.usage?.outputTokens), totalTokens: nonnegative(input.usage?.totalTokens), diagnostics: json(diagnostics.value), diagnosticsRedacted: diagnostics.redacted, diagnosticsTruncated: diagnostics.truncated, finishedAt: new Date() } });
      return true;
    });
  } catch { logger.warn({ event: 'assistant.history_finish_failed' }, 'Assistant terminal state could not be saved'); return false; }
}
/** Optional throttled stream checkpoint; finalization still belongs to safeStream. */
export async function checkpointRun(requester: RequesterContext, input: { runId: string; answer: string }): Promise<boolean> {
  try {
    const runId = id(input.runId, true)!, answer = sanitizeHistoryText(input.answer);
    return await historyTx(requester, async (tx, scope) => (await tx.assistantRun.updateMany({ where: { ...scope, id: runId, status: 'running' }, data: { answer: answer.text, answerRedacted: answer.redacted, answerTruncated: answer.truncated } })).count === 1);
  } catch { logger.warn({ event: 'assistant.history_checkpoint_failed' }, 'Assistant partial state could not be saved'); return false; }
}

export async function listConversations(requester: RequesterContext, input: { cursor?: string; limit?: number } = {}) {
  const limit = pageSize(input.limit), cursor = conversationCursor(input.cursor);
  return historyTx(requester, async (tx, scope) => {
    if (cursor && !await tx.assistantConversation.findFirst({ where: { ...scope, id: cursor.id }, select: { id: true } })) throw new AssistantHistoryError(404, 'HISTORY_NOT_FOUND');
    // The boundary is the timestamp from the returned page, not the row's
    // possibly newer lastRunAt after somebody continued that conversation.
    const rows = await tx.assistantConversation.findMany({ where: { ...scope, ...(cursor ? { OR: [{ lastRunAt: { lt: cursor.at } }, { lastRunAt: cursor.at, id: { lt: cursor.id } }] } : {}) }, select: { id: true, title: true, createdAt: true, lastRunAt: true, contextUnverified: true, _count: { select: { runs: true } } }, orderBy: [{ lastRunAt: 'desc' }, { id: 'desc' }], take: limit + 1 });
    const page = rows.slice(0, limit), hasMore = rows.length > limit;
    return { conversations: page.map(row => ({ ...row, runCount: row._count.runs, _count: undefined })), hasMore, nextCursor: hasMore ? nextConversationCursor(page.at(-1)!) : null };
  });
}
export async function getConversation(requester: RequesterContext, conversationId: string, input: { cursor?: string; limit?: number } = {}) {
  const conversation = id(conversationId, true)!, cursor = id(input.cursor), limit = pageSize(input.limit);
  return historyTx(requester, async (tx, scope) => {
    const found = await tx.assistantConversation.findFirst({ where: { ...scope, id: conversation } });
    if (!found) throw new AssistantHistoryError(404, 'HISTORY_NOT_FOUND');
    const previous = cursor ? await tx.assistantRun.findFirst({ where: { ...scope, conversationId: conversation, id: cursor }, select: { id: true, startedAt: true } }) : null;
    if (cursor && !previous) throw new AssistantHistoryError(404, 'HISTORY_NOT_FOUND');
    const rows = await tx.assistantRun.findMany({ where: { ...scope, conversationId: conversation, ...(previous ? { OR: [{ startedAt: { lt: previous.startedAt } }, { startedAt: previous.startedAt, id: { lt: previous.id } }] } : {}) }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], take: limit + 1 });
    const page = rows.slice(0, limit), hasMore = rows.length > limit;
    return { conversation: found, runs: page.map(row => row.status === 'running' && row.startedAt.getTime() <= Date.now() - STALE_RUN_MS ? { ...row, status: 'partial', errorCode: 'INTERRUPTED', recordedStatus: 'running', interrupted: true } : { ...row, interrupted: false }), hasMore, nextCursor: hasMore ? page.at(-1)!.id : null, order: 'newest-first' as const };
  });
}
/** The owner deletes one of their own conversations (runs and traces cascade). Not while an answer is still being written. */
export async function deleteConversation(requester: RequesterContext, conversationId: string) {
  const conversation = id(conversationId, true)!;
  return historyTx(requester, async (tx, scope) => {
    await lock(tx, `assistant-conversation:${scope.companyProfileId}:${scope.adminId}:${conversation}`);
    const found = await tx.assistantConversation.findFirst({ where: { ...scope, id: conversation }, select: { id: true } });
    if (!found) throw new AssistantHistoryError(404, 'HISTORY_NOT_FOUND');
    const running = await tx.assistantRun.findFirst({ where: { ...scope, conversationId: conversation, status: 'running', startedAt: { gt: new Date(Date.now() - STALE_RUN_MS) } }, select: { id: true } });
    if (running) throw new AssistantHistoryError(409, 'HISTORY_BUSY');
    await tx.assistantConversation.deleteMany({ where: { ...scope, id: conversation } });
    return { deleted: true };
  });
}
export async function listRunTraces(requester: RequesterContext, runId: string, input: { cursor?: string; limit?: number } = {}) {
  const run = id(runId, true)!, cursor = id(input.cursor), limit = pageSize(input.limit);
  return historyTx(requester, async (tx, scope) => {
    if (!await tx.assistantRun.findFirst({ where: { ...scope, id: run }, select: { id: true } })) throw new AssistantHistoryError(404, 'HISTORY_NOT_FOUND');
    const previous = cursor ? await tx.assistantToolTrace.findFirst({ where: { ...scope, runId: run, id: cursor }, select: { id: true, createdAt: true } }) : null;
    if (cursor && !previous) throw new AssistantHistoryError(404, 'HISTORY_NOT_FOUND');
    const rows = await tx.assistantToolTrace.findMany({ where: { ...scope, runId: run, ...(previous ? { OR: [{ createdAt: { gt: previous.createdAt } }, { createdAt: previous.createdAt, id: { gt: previous.id } }] } : {}) }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: limit + 1 });
    const page = rows.slice(0, limit), hasMore = rows.length > limit;
    return { traces: page, hasMore, nextCursor: hasMore ? page.at(-1)!.id : null };
  });
}
