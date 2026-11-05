import { describe, expect, it } from 'vitest';
import { AssistantGenerationError, categorizeAssistantFailure, createAssistantRunDiagnostics, type AssistantFailureCode } from './diagnostics';

describe('safe failure classification', () => {
  it.each([
    [{ name: 'AI_LoadAPIKeyError' }, 'missing_key'],
    [{ statusCode: 401, data: { error: { code: 'invalid_api_key' } } }, 'provider_auth'],
    [{ statusCode: 403 }, 'provider_auth'],
    [{ statusCode: 429, data: { error: { code: 'insufficient_quota' } } }, 'provider_quota'],
    [{ statusCode: 429, data: { error: { code: 'rate_limit_exceeded' } } }, 'rate'],
    [{ statusCode: 400, data: { error: { code: 'context_length_exceeded' } } }, 'input_payload'],
    [{ statusCode: 400, data: { error: { code: 'invalid_request_error' } } }, 'provider_request'],
    [{ statusCode: 503 }, 'provider_unavailable'],
    [{ name: 'TimeoutError' }, 'timeout'],
    [{ name: 'AbortError' }, 'cancel'],
    [{ name: 'PrismaClientKnownRequestError', code: 'P2024' }, 'db'],
    [{ name: 'AI_NoSuchToolError' }, 'tool_unknown'],
    [{ name: 'AI_InvalidToolInputError' }, 'tool_input'],
  ] as const)('classifies structured error metadata as %s -> %s', (error, code) => {
    expect(categorizeAssistantFailure(error).code).toBe(code);
  });
  it('distinguishes aborted requests from elapsed server timeouts', () => {
    expect(categorizeAssistantFailure(Error('private'), { cancelled: true }).code).toBe('cancel');
    expect(categorizeAssistantFailure(Error('private'), { timedOut: true }).code).toBe('timeout');
  });
  it('retains only allowlisted provider codes and no free-text exception fields', () => {
    const diagnostic = categorizeAssistantFailure({ statusCode: 429, message: 'sk-private customer text', url: 'https://private/?token=secret', responseBody: 'invoice 9988', data: { error: { code: 'insufficient_quota', message: 'private prompt' } } });
    expect(diagnostic).toEqual({ code: 'provider_quota', retryable: false, httpStatus: 429, providerCode: 'insufficient_quota' });
    expect(JSON.stringify(diagnostic)).not.toMatch(/sk-private|customer|invoice|private prompt|token/);
    expect(categorizeAssistantFailure({ statusCode: 400, code: 'sk-private' })).toEqual({ code: 'provider_request', retryable: false, httpStatus: 400 });
  });
  it('retains only bounded numeric details for local generation limits', () => {
    expect(categorizeAssistantFailure(new AssistantGenerationError('input_payload', { step: 2, inputBytes: 70_000 }))).toEqual({ code: 'input_payload', retryable: false, step: 2, inputBytes: 70_000 });
    expect(categorizeAssistantFailure(new AssistantGenerationError('step_limit', { step: Infinity, inputBytes: -1 }))).toEqual({ code: 'step_limit', retryable: false });
  });
  it('retains public missing-column and adapter codes without SQL, schema names or query arguments', () => {
    const error = { name: 'PrismaClientKnownRequestError', code: 'P2022', message: 'SELECT private_field FROM private_table', meta: { column: 'NEVER_SAVE_COLUMN', modelName: 'NEVER_SAVE_MODEL', driverAdapterError: { cause: { originalCode: '42703', originalMessage: 'NEVER_SAVE_SQL' } } } };
    expect(categorizeAssistantFailure(error)).toEqual({ code: 'db', retryable: false, dbCode: 'P2022', sqlState: '42703', dbReason: 'missing_column' });
    expect(JSON.stringify(categorizeAssistantFailure(error))).not.toMatch(/SELECT|private|NEVER_SAVE/);
  });
  it.each([
    ['P2021', 'missing_table'], ['P2024', 'pool_timeout'], ['P2028', 'transaction_error'],
  ] as const)('retains allowlisted database code %s and its bounded cause', (dbCode, dbReason) => {
    expect(categorizeAssistantFailure({ name: 'PrismaClientKnownRequestError', code: dbCode })).toMatchObject({ code: 'db', dbCode, dbReason });
  });
  it('rejects arbitrary database-code strings and traverses cause wrappers safely', () => {
    expect(categorizeAssistantFailure({ name: 'PrismaClientKnownRequestError', code: 'SECRET_CODE' })).toEqual({ code: 'db', retryable: true, dbReason: 'unknown' });
    expect(categorizeAssistantFailure({ cause: { name: 'PrismaClientKnownRequestError', code: 'P2024' } })).toMatchObject({ code: 'db', dbCode: 'P2024', dbReason: 'pool_timeout' });
  });
  it('does not misclassify a history-store failure as an OpenAI outage', () => {
    expect(categorizeAssistantFailure({ name: 'AssistantHistoryError', code: 'HISTORY_UNAVAILABLE', status: 503, message: 'NEVER_SAVE' })).toMatchObject({ code: 'db', dbReason: 'archive', retryable: true });
  });
  it('does not echo arbitrary strings and safely classifies nested provider failures', () => {
    expect(categorizeAssistantFailure('sk-secret raw exception')).toEqual({ code: 'internal', retryable: false });
    expect(categorizeAssistantFailure({ cause: { statusCode: 401, data: { error: { code: 'invalid_api_key' } } } })).toMatchObject({ code: 'provider_auth', httpStatus: 401 });
  });
});

describe('final-answer diagnostics from SDK fullStream', () => {
  it('does not mistake an intro followed by a tool call for a final answer', () => {
    const run = createAssistantRunDiagnostics();
    run.providerCall({ step: 0, inputBytes: 30_000 });
    for (const part of [{ type: 'start-step' }, { type: 'text-delta', text: 'Po kontrolloj të dhënat.' }, { type: 'tool-call', toolName: 'read', input: { secret: 'NEVER_SAVE_INPUT' } }, { type: 'tool-result', output: { evidence: {}, result: { ok: true, customer: 'NEVER_SAVE_OUTPUT' } } }, { type: 'finish-step', finishReason: 'tool-calls' }, { type: 'finish', finishReason: 'tool-calls' }]) run.observe(part);
    expect(run.snapshot()).toMatchObject({ providerCalls: 1, steps: 1, toolCalls: 1, toolResults: 1, successfulToolResults: 1, finalCharacters: 0, hasFinalAnswer: false, failure: { code: 'incomplete_answer' } });
    expect(JSON.stringify(run.snapshot())).not.toMatch(/kontrolloj|NEVER_SAVE|read/);
  });
  it('records a provider error after introductory text even if textStream would hide it', () => {
    const run = createAssistantRunDiagnostics();
    for (const part of [{ type: 'start-step' }, { type: 'text-delta', text: 'Po kontrolloj.' }, { type: 'tool-call' }, { type: 'finish-step', finishReason: 'tool-calls' }, { type: 'start-step' }, { type: 'error', error: { statusCode: 429, data: { error: { code: 'insufficient_quota', message: 'NEVER_SAVE' } } } }, { type: 'finish', finishReason: 'error' }]) run.observe(part);
    expect(run.snapshot()).toMatchObject({ hasFinalAnswer: false, failure: { code: 'provider_quota' }, finalCharacters: 0 });
    expect(JSON.stringify(run.snapshot())).not.toContain('NEVER_SAVE');
  });
  it('recognizes completed final text only after the business lookup step finishes', () => {
    const run = createAssistantRunDiagnostics();
    for (const part of [{ type: 'start-step' }, { type: 'tool-call' }, { type: 'tool-result', output: { result: { ok: true } } }, { type: 'finish-step', finishReason: 'tool-calls' }, { type: 'start-step' }, { type: 'text-delta', text: 'U prenë 12 kg.' }, { type: 'finish-step', finishReason: 'stop' }]) run.observe(part);
    expect(run.snapshot().hasFinalAnswer).toBe(false);
    run.observe({ type: 'finish', finishReason: 'stop' });
    expect(run.snapshot()).toMatchObject({ completed: true, hasFinalAnswer: true, failure: null, finalCharacters: 14 });
  });
  it('allows an honest unavailable-data answer without turning a tool failure into a fatal provider error', () => {
    const run = createAssistantRunDiagnostics();
    for (const part of [{ type: 'start-step' }, { type: 'tool-call' }, { type: 'tool-result', output: { ok: false, code: 'READ_UNAVAILABLE', message: 'NEVER_SAVE' } }, { type: 'finish-step', finishReason: 'tool-calls' }, { type: 'start-step' }, { type: 'text-delta', text: 'Nuk mund të lexoja burimin.' }, { type: 'finish-step', finishReason: 'stop' }, { type: 'finish', finishReason: 'stop' }]) run.observe(part);
    expect(run.snapshot()).toMatchObject({ hasFinalAnswer: true, failedToolResults: 1, failure: null, lastToolFailure: { code: 'tool_failure' } });
  });
  it.each(['', '   \n'])('distinguishes an empty/whitespace answer (%j) from success', text => {
    const run = createAssistantRunDiagnostics();
    for (const part of [{ type: 'start-step' }, { type: 'text-delta', text }, { type: 'finish-step', finishReason: 'stop' }, { type: 'finish', finishReason: 'stop' }]) run.observe(part);
    expect(run.snapshot()).toMatchObject({ hasFinalAnswer: false, failure: { code: 'empty_answer' } });
  });
  it('marks length-limited final text incomplete instead of complete', () => {
    const run = createAssistantRunDiagnostics();
    for (const part of [{ type: 'start-step' }, { type: 'text-delta', text: 'Partial result' }, { type: 'finish-step', finishReason: 'length' }, { type: 'finish', finishReason: 'length' }]) run.observe(part);
    expect(run.snapshot()).toMatchObject({ hasFinalAnswer: false, finalCharacters: 14, failure: { code: 'incomplete_answer' } });
  });
  it('records an unexpected EOF without a finish part as incomplete rather than success', () => {
    const run = createAssistantRunDiagnostics();
    run.observe({ type: 'start-step' });
    run.observe({ type: 'text-delta', text: 'Po kontrolloj të dhënat.' });
    run.observe({ type: 'tool-call' });
    expect(run.snapshot().failure).toBeNull();
    run.end();
    expect(run.snapshot()).toMatchObject({ ended: true, completed: false, hasFinalAnswer: false, failure: { code: 'incomplete_answer' } });
  });
  it('does not persist extra properties from even a malformed diagnostic hook', () => {
    const run = createAssistantRunDiagnostics();
    run.failure({ code: 'sk-secret' as AssistantFailureCode, retryable: true, providerCode: 'raw-secret' as never, ...{ message: 'NEVER_SAVE' } });
    expect(run.snapshot().failure).toEqual({ code: 'internal', retryable: false });
  });
  it('retains safe database details through hooks and lets a known timeout override an unspecific abort', () => {
    const run = createAssistantRunDiagnostics();
    run.failure(categorizeAssistantFailure({ name: 'PrismaClientKnownRequestError', code: 'P2022' }));
    expect(run.snapshot().failure).toEqual({ code: 'db', retryable: false, dbCode: 'P2022', dbReason: 'missing_column' });
    const timedOut = createAssistantRunDiagnostics();
    timedOut.observe({ type: 'abort' });
    timedOut.failure(categorizeAssistantFailure(null, { timedOut: true }));
    expect(timedOut.snapshot().failure?.code).toBe('timeout');
  });
  it('preserves a sanitized database failure from a tool result without retaining extra error fields', () => {
    const run = createAssistantRunDiagnostics();
    run.observe({ type: 'tool-result', output: { result: { ok: false, diagnostic: { code: 'db', retryable: false, dbCode: 'P2022', dbReason: 'missing_column', message: 'NEVER_SAVE_SQL' } } } });
    expect(run.snapshot().lastToolFailure).toEqual({ code: 'db', retryable: false, dbCode: 'P2022', dbReason: 'missing_column' });
    expect(JSON.stringify(run.snapshot())).not.toContain('NEVER_SAVE');
  });
});
