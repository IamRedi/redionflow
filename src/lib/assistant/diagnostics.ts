/** Safe operational diagnostics: no messages, prompts, inputs, URLs or raw errors. */
export type AssistantFailureCode =
  | 'missing_key' | 'provider_auth' | 'provider_quota' | 'rate'
  | 'input_payload' | 'step_limit' | 'timeout' | 'cancel'
  | 'db' | 'tool_unknown' | 'tool_input' | 'tool_failure'
  | 'provider_request' | 'provider_unavailable' | 'empty_answer'
  | 'incomplete_answer' | 'internal';
const failureCodes: readonly AssistantFailureCode[] = [
  'missing_key', 'provider_auth', 'provider_quota', 'rate', 'input_payload',
  'step_limit', 'timeout', 'cancel', 'db', 'tool_unknown', 'tool_input',
  'tool_failure', 'provider_request', 'provider_unavailable', 'empty_answer',
  'incomplete_answer', 'internal',
];

const providerCodes = [
  'invalid_api_key', 'insufficient_quota', 'rate_limit_exceeded',
  'context_length_exceeded', 'model_not_found', 'permission_denied',
  'billing_hard_limit_reached', 'organization_deactivated',
  'invalid_request_error', 'server_error',
] as const;
type ProviderCode = (typeof providerCodes)[number];
const dbCodes = ['P1000', 'P1001', 'P1002', 'P1008', 'P1017', 'P2002', 'P2021', 'P2022', 'P2024', 'P2028'] as const;
const sqlStates = ['42P01', '42703', '57014', '53300', '08000', '08003', '08006', '57P01', '55P03', '40001', '28P01'] as const;
const dbReasons = ['missing_column', 'missing_table', 'pool_timeout', 'transaction_error', 'query_timeout', 'connection', 'auth', 'archive', 'unknown'] as const;
type DbCode = (typeof dbCodes)[number];
type SqlState = (typeof sqlStates)[number];
type DbReason = (typeof dbReasons)[number];
export type AssistantFailure = {
  code: AssistantFailureCode;
  retryable: boolean;
  httpStatus?: number;
  providerCode?: ProviderCode;
  dbCode?: DbCode;
  sqlState?: SqlState;
  dbReason?: DbReason;
  step?: number;
  inputBytes?: number;
};
export type AssistantFailureContext = {
  source?: 'provider' | 'tool' | 'database' | 'request';
  cancelled?: boolean;
  timedOut?: boolean;
};

type GenerationFailure = 'input_payload' | 'step_limit' | 'timeout' | 'cancel';
const generationMessages: Record<GenerationFailure, string> = {
  input_payload: 'Assistant input payload limit reached',
  step_limit: 'Assistant generation step limit reached',
  timeout: 'Assistant generation timed out',
  cancel: 'Assistant generation was cancelled',
};
export class AssistantGenerationError extends Error {
  readonly name = 'AssistantGenerationError';
  constructor(readonly code: GenerationFailure, readonly details: { step?: number; inputBytes?: number } = {}) {
    super(generationMessages[code]);
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}
function integer(value: unknown, max = 1_000_000_000) {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max ? value as number : undefined;
}
function failure(code: AssistantFailureCode, extra: Omit<AssistantFailure, 'code' | 'retryable'> = {}): AssistantFailure {
  if (!failureCodes.includes(code)) code = 'internal';
  return { code, retryable: ['rate', 'timeout', 'db', 'tool_failure', 'provider_unavailable'].includes(code), ...extra };
}

/** Classify structured error fields only; never return error.message/data/body. */
export function categorizeAssistantFailure(error: unknown, context: AssistantFailureContext = {}): AssistantFailure {
  if (context.cancelled) return failure('cancel');
  if (context.timedOut) return failure('timeout');
  if (error instanceof AssistantGenerationError) return failure(error.code, {
    ...(integer(error.details.step) === undefined ? {} : { step: integer(error.details.step) }),
    ...(integer(error.details.inputBytes) === undefined ? {} : { inputBytes: integer(error.details.inputBytes) }),
  });
  const pending: Array<{ value: Record<string, unknown> | null; depth: number }> = [{ value: record(error), depth: 0 }];
  const seen = new Set<object>();
  let status: number | undefined;
  let name: unknown;
  let code: ProviderCode | undefined;
  let dbCode: DbCode | undefined, sqlState: SqlState | undefined;
  let db = context.source === 'database', archive = false;
  while (pending.length && seen.size < 12) {
    const { value: current, depth } = pending.shift()!;
    if (!current || depth > 4 || seen.has(current)) continue;
    seen.add(current);
    const candidateStatus = integer(current.statusCode ?? current.status, 599);
    if (candidateStatus !== undefined && candidateStatus >= 400 && status === undefined) status = candidateStatus;
    name ??= current.name;
    db ||= typeof current.name === 'string' && current.name.startsWith('PrismaClient');
    if (current.name === 'AssistantHistoryError' && current.code === 'HISTORY_UNAVAILABLE') { archive = true; db = true; }
    const data = record(current.data), nested = record(data?.error) ?? record(current.error);
    const candidateCode = [current.code, current.type, nested?.code, nested?.type].find(value => typeof value === 'string' && providerCodes.includes(value as ProviderCode));
    if (typeof candidateCode === 'string' && providerCodes.includes(candidateCode as ProviderCode)) code ??= candidateCode as ProviderCode;
    for (const value of [current.code, current.originalCode, current.sqlState]) {
      if (typeof value === 'string' && dbCodes.includes(value as DbCode)) { dbCode ??= value as DbCode; db = true; }
      if (typeof value === 'string' && sqlStates.includes(value as SqlState)) { sqlState ??= value as SqlState; db = true; }
    }
    const meta = record(current.meta);
    for (const value of [current.cause, current.lastError, current.originalError, meta?.driverAdapterError, meta?.cause]) pending.push({ value: record(value), depth: depth + 1 });
  }
  const extra = { ...(status === undefined ? {} : { httpStatus: status }), ...(code ? { providerCode: code } : {}) };
  if (name === 'LoadAPIKeyError' || name === 'AI_LoadAPIKeyError') return failure('missing_key', extra);
  if (name === 'TimeoutError' || status === 408) return failure('timeout', extra);
  if (name === 'AbortError') return failure('cancel', extra);
  if (db) {
    const dbReason: DbReason = archive ? 'archive' : dbCode === 'P2022' || sqlState === '42703' ? 'missing_column'
      : dbCode === 'P2021' || sqlState === '42P01' ? 'missing_table'
      : dbCode === 'P2024' ? 'pool_timeout'
      : dbCode === 'P2028' ? 'transaction_error'
      : dbCode === 'P1008' || sqlState === '57014' ? 'query_timeout'
      : dbCode === 'P1000' || sqlState === '28P01' ? 'auth'
      : dbCode && ['P1001', 'P1002', 'P1017'].includes(dbCode) || sqlState?.startsWith('08') ? 'connection' : 'unknown';
    return { ...failure('db', { ...(dbCode ? { dbCode } : {}), ...(sqlState ? { sqlState } : {}), dbReason }), retryable: !['missing_column', 'missing_table', 'auth'].includes(dbReason) };
  }
  if (code === 'insufficient_quota' || code === 'billing_hard_limit_reached') return failure('provider_quota', extra);
  if (status === 401 || status === 403 || code === 'invalid_api_key' || code === 'permission_denied' || code === 'organization_deactivated') return failure('provider_auth', extra);
  if (status === 429 || code === 'rate_limit_exceeded') return failure('rate', extra);
  if (code === 'context_length_exceeded') return failure('input_payload', extra);
  if (name === 'NoSuchToolError' || name === 'AI_NoSuchToolError') return failure('tool_unknown');
  if (name === 'InvalidToolInputError' || name === 'AI_InvalidToolInputError') return failure('tool_input');
  if (context.source === 'tool') return failure('tool_failure');
  if (status !== undefined && status >= 500) return failure('provider_unavailable', extra);
  if (status !== undefined) return failure('provider_request', extra);
  return failure(context.source === 'provider' ? 'provider_unavailable' : 'internal');
}

/** Preserve only an already-classified public diagnostic from a tool result. */
export function sanitizeAssistantFailure(value: unknown): AssistantFailure | null {
  const input = record(value);
  if (!input || typeof input.code !== 'string' || !failureCodes.includes(input.code as AssistantFailureCode)) return null;
  const safe: AssistantFailure = { ...failure(input.code as AssistantFailureCode),
    ...(integer(input.httpStatus, 599) !== undefined && (input.httpStatus as number) >= 400 ? { httpStatus: input.httpStatus as number } : {}),
    ...(typeof input.providerCode === 'string' && providerCodes.includes(input.providerCode as ProviderCode) ? { providerCode: input.providerCode as ProviderCode } : {}),
    ...(typeof input.dbCode === 'string' && dbCodes.includes(input.dbCode as DbCode) ? { dbCode: input.dbCode as DbCode } : {}),
    ...(typeof input.sqlState === 'string' && sqlStates.includes(input.sqlState as SqlState) ? { sqlState: input.sqlState as SqlState } : {}),
    ...(typeof input.dbReason === 'string' && dbReasons.includes(input.dbReason as DbReason) ? { dbReason: input.dbReason as DbReason } : {}),
    ...(integer(input.step) !== undefined ? { step: input.step as number } : {}),
    ...(integer(input.inputBytes) !== undefined ? { inputBytes: input.inputBytes as number } : {}),
  };
  if (safe.code === 'db' && safe.dbReason && ['missing_column', 'missing_table', 'auth'].includes(safe.dbReason)) safe.retryable = false;
  return safe;
}

const finishReasons = ['stop', 'length', 'tool-calls', 'content-filter', 'error', 'other', 'unknown'] as const;
type FinishReason = (typeof finishReasons)[number];
function finishReason(value: unknown): FinishReason {
  return typeof value === 'string' && finishReasons.includes(value as FinishReason) ? value as FinishReason : 'unknown';
}

type Step = { text: number; meaningfulText: number; calls: number; reason: FinishReason | null };

/** Consume SDK fullStream parts; textStream alone can hide tool/provider errors. */
export function createAssistantRunDiagnostics() {
  let providerCalls = 0, inputBytesMax = 0, steps = 0, toolCalls = 0, toolResults = 0;
  let successfulToolResults = 0, failedToolResults = 0, textCharacters = 0, meaningfulCharacters = 0, provisionalCharacters = 0;
  let current: Step | null = null, last: Step | null = null, completed = false, ended = false;
  let reason: FinishReason | null = null, fatal: AssistantFailure | null = null, lastToolFailure: AssistantFailure | null = null;
  const ensureStep = () => current ??= { text: 0, meaningfulText: 0, calls: 0, reason: null };
  const saveFailure = (next: AssistantFailure) => {
    // An explicit abort reason is stronger than a generic stream/SDK wrapper.
    if (!fatal || fatal.code === 'cancel' && next.code === 'timeout' || ['internal', 'provider_unavailable'].includes(fatal.code) && !['internal', 'provider_unavailable'].includes(next.code)) fatal = next;
  };
  const fail = (error: unknown, context?: AssistantFailureContext) => { saveFailure(categorizeAssistantFailure(error, context)); };
  return {
    providerCall(input: { step: number; inputBytes: number }) {
      providerCalls += 1;
      inputBytesMax = Math.max(inputBytesMax, integer(input.inputBytes) ?? 0);
    },
    fail,
    /** Call after draining/cancelling the stream, including an unexpected EOF. */
    end() { ended = true; },
    /** Accept only already-sanitized diagnostics from the generation hooks. */
    failure(value: AssistantFailure) { saveFailure(sanitizeAssistantFailure(value) ?? failure('internal')); },
    observe(value: unknown) {
      const part = record(value);
      if (!part) return;
      if (part.type === 'start-step') { current = { text: 0, meaningfulText: 0, calls: 0, reason: null }; steps += 1; }
      if (part.type === 'text-delta' && typeof part.text === 'string') {
        const step = ensureStep(), meaningful = part.text.replace(/\s/gu, '').length;
        step.text += part.text.length; step.meaningfulText += meaningful; textCharacters += part.text.length; meaningfulCharacters += meaningful;
      }
      if (part.type === 'tool-call') { ensureStep().calls += 1; toolCalls += 1; }
      if (part.type === 'tool-result' || part.type === 'tool-error') {
        toolResults += 1;
        const output = record(part.output), result = record(output?.result) ?? output;
        if (part.type === 'tool-error') { failedToolResults += 1; lastToolFailure = categorizeAssistantFailure(part.error, { source: 'tool' }); }
        else if (result?.ok === false) { failedToolResults += 1; lastToolFailure = sanitizeAssistantFailure(result.diagnostic) ?? failure(result.code === 'INVALID_DATE' ? 'tool_input' : 'tool_failure'); }
        else if (result?.ok === true) successfulToolResults += 1;
      }
      if (part.type === 'finish-step') {
        const step = ensureStep(); step.reason = finishReason(part.finishReason); last = { ...step };
        if (step.calls > 0) provisionalCharacters += step.text;
        reason = step.reason; current = null;
      }
      if (part.type === 'error') fail(part.error, { source: 'provider' });
      if (part.type === 'abort') fail(null, { cancelled: true });
      if (part.type === 'finish') { completed = true; ended = true; reason = finishReason(part.finishReason); }
    },
    snapshot() {
      const final = last && last.calls === 0 ? last : null;
      const hasFinalAnswer = !!final && final.meaningfulText > 0 && final.reason === 'stop' && completed && reason === 'stop' && fatal === null;
      const inferred = fatal ?? (ended && !hasFinalAnswer ? failure(reason === 'length' || meaningfulCharacters > 0 ? 'incomplete_answer' : 'empty_answer') : null);
      return {
        version: 1 as const, providerCalls, inputBytesMax, steps, toolCalls, toolResults, successfulToolResults, failedToolResults,
        textCharacters, provisionalCharacters, finalCharacters: final?.text ?? 0,
        ended, completed, finishReason: reason, hasFinalAnswer, failure: inferred, lastToolFailure,
      };
    },
  };
}

export type AssistantRunDiagnostics = ReturnType<typeof createAssistantRunDiagnostics>;
