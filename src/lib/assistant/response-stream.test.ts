import { expect, it, vi } from 'vitest';
import { createAssistantRunDiagnostics } from './diagnostics';
import { assistantResponseStream, type AssistantResponseResult } from './response-stream';
import { createLegacyWeightQualifier } from './weight-qualifier';

async function* parts(values: unknown[]) { yield* values; }
const textPart = (text: string) => ({ type: 'text-delta', text });
const finishStep = (finishReason = 'stop') => ({ type: 'finish-step', finishReason });
const finish = (finishReason = 'stop') => ({ type: 'finish', finishReason });
function response(values: unknown[], overrides: Partial<Parameters<typeof assistantResponseStream>[1]> = {}) {
  const onComplete = vi.fn(async (_result: AssistantResponseResult) => {});
  const diagnostics = createAssistantRunDiagnostics();
  const result = assistantResponseStream(parts(values), { diagnostics, fallback: code => `Fallback:${code}`, storageFailure: 'Archive could not be verified.', onComplete, ...overrides });
  return { result, onComplete, diagnostics };
}

it('discards a tool-call introduction and emits only the completed final answer', async () => {
  const { result, onComplete } = response([
    { type: 'start-step' }, textPart('Po ju jap listën…'), { type: 'tool-call', input: { private: 'DO_NOT_EMIT' } }, { type: 'tool-result', output: { result: { ok: true } } }, finishStep('tool-calls'),
    { type: 'start-step' }, textPart('Janë dy projekte.'), finishStep(), finish(),
  ]);
  expect(await result.text()).toBe('Janë dy projekte.');
  expect(onComplete).toHaveBeenCalledOnce();
  expect(onComplete.mock.calls[0][0]).toMatchObject({ answer: 'Janë dy projekte.', status: 'completed', diagnostics: { hasFinalAnswer: true, provisionalCharacters: 17 } });
  expect(result.headers.get('cache-control')).toBe('no-store');
});
it('does not treat an introduction before a hidden SDK error as a completed answer', async () => {
  const { result, onComplete } = response([
    { type: 'start-step' }, textPart('Po kontrolloj…'), { type: 'tool-call' }, finishStep('tool-calls'),
    { type: 'start-step' }, { type: 'error', error: { statusCode: 429, data: { error: { code: 'insufficient_quota', message: 'NEVER_EMIT' } } } }, finish('error'),
  ]);
  expect(await result.text()).toBe('Fallback:provider_quota');
  expect(onComplete.mock.calls[0][0]).toMatchObject({ status: 'error', diagnostics: { failure: { code: 'provider_quota' } } });
});
it.each(['', '  \n'])('turns an empty/whitespace final body (%j) into a fallback', async text => {
  const { result, onComplete } = response([{ type: 'start-step' }, textPart(text), finishStep(), finish()]);
  expect(await result.text()).toBe('Fallback:empty_answer');
  expect(onComplete.mock.calls[0][0].status).toBe('error');
});
it('does not emit tool output or tool-only completion as an answer', async () => {
  const { result, onComplete } = response([{ type: 'start-step' }, { type: 'tool-call' }, { type: 'tool-result', output: { result: { ok: true, private: 'NEVER_EMIT' } } }, finishStep('tool-calls'), finish('tool-calls')]);
  expect(await result.text()).toBe('Fallback:empty_answer');
  expect(onComplete.mock.calls[0][0]).toMatchObject({ status: 'error', diagnostics: { hasFinalAnswer: false } });
});
it('retains an interrupted no-tool partial answer and appends a sanitized failure', async () => {
  const { result, onComplete } = response([{ type: 'start-step' }, textPart('Dy projekte: '), { type: 'error', error: { statusCode: 503, responseBody: 'NEVER_EMIT' } }]);
  expect(await result.text()).toBe('Dy projekte: \n\nFallback:provider_unavailable');
  expect(onComplete.mock.calls[0][0].status).toBe('partial');
});
it('marks token-limited text partial instead of silently reporting success', async () => {
  const { result, onComplete } = response([{ type: 'start-step' }, textPart('Partial data'), finishStep('length'), finish('length')]);
  expect(await result.text()).toBe('Partial data\n\nFallback:incomplete_answer');
  expect(onComplete.mock.calls[0][0].status).toBe('partial');
});
it('persists a server-stream exception safely without leaking its text', async () => {
  async function* failed() { yield { type: 'start-step' }; throw Error('sk-secret query/credentials'); }
  const onComplete = vi.fn(async (_result: AssistantResponseResult) => {});
  const result = assistantResponseStream(failed(), { diagnostics: createAssistantRunDiagnostics(), fallback: code => `Fallback:${code}`, storageFailure: 'Archive warning', onComplete });
  expect(await result.text()).toBe('Fallback:provider_unavailable');
  expect(onComplete.mock.calls[0][0].status).toBe('error');
});
it('awaits final persistence and reports its failure separately from the answer', async () => {
  const onComplete = vi.fn(async () => { throw Error('PRIVATE DATABASE ERROR'); });
  const { result } = response([{ type: 'start-step' }, textPart('Complete answer'), finishStep(), finish()], { onComplete });
  expect(await result.text()).toBe('Complete answer\n\nArchive could not be verified.');
  expect(onComplete).toHaveBeenCalledOnce();
});
it('still attempts final persistence when a checkpoint fails', async () => {
  const onCheckpoint = vi.fn(async () => { throw Error('PRIVATE CHECKPOINT ERROR'); });
  const { result, onComplete } = response([{ type: 'start-step' }, textPart('Complete answer'), finishStep(), finish()], { onCheckpoint });
  expect(await result.text()).toBe('Complete answer');
  expect(onCheckpoint).toHaveBeenCalledOnce(); expect(onComplete).toHaveBeenCalledOnce();
});
it('archives pre-execution SDK tool-validation errors through a safe dedicated hook', async () => {
  const onToolError = vi.fn(async () => {});
  const { result } = response([{ type: 'start-step' }, { type: 'tool-call' }, { type: 'tool-error', toolCallId: 'tool-demo', toolName: 'read', input: { date: null }, error: { name: 'AI_InvalidToolInputError', message: 'NEVER_SAVE_RAW_ERROR' } }, finishStep('tool-calls'), { type: 'start-step' }, textPart('Could not validate the query.'), finishStep(), finish()], { onToolError });
  expect(await result.text()).toBe('Could not validate the query.');
  expect(onToolError).toHaveBeenCalledExactlyOnceWith({ toolCallId: 'tool-demo', toolName: 'read', input: { date: null }, failure: { code: 'tool_input', retryable: false } });
  expect(JSON.stringify(onToolError.mock.calls)).not.toContain('NEVER_SAVE');
});
it('warns about an unarchived tool error even if final-answer persistence succeeds', async () => {
  const { result, onComplete } = response([{ type: 'start-step' }, { type: 'tool-call' }, { type: 'tool-error', toolCallId: 'tool-demo', toolName: 'unknown', input: {}, error: { name: 'AI_NoSuchToolError' } }, finishStep('tool-calls'), { type: 'start-step' }, textPart('Try a more precise question.'), finishStep(), finish()], { onToolError: async () => { throw Error('PRIVATE DB ERROR'); } });
  const delivered = await result.text();
  expect(delivered).toBe('Try a more precise question.\n\nArchive could not be verified.');
  expect(onComplete).toHaveBeenCalledOnce();
  expect(onComplete.mock.calls[0][0].answer).toBe(delivered);
});
it('aborts upstream and records cancellation exactly once without leaking raw reasons', async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  async function* waiting() { yield { type: 'start-step' }; await gate; yield textPart('Not delivered'); }
  const onComplete = vi.fn(async (_result: AssistantResponseResult) => {}), onCancel = vi.fn(() => release());
  const result = assistantResponseStream(waiting(), { diagnostics: createAssistantRunDiagnostics(), fallback: code => `Fallback:${code}`, storageFailure: 'Archive warning', onComplete, onCancel });
  await result.body!.cancel('PRIVATE CANCEL REASON');
  expect(onCancel).toHaveBeenCalledOnce(); expect(onComplete).toHaveBeenCalledOnce();
  expect(onComplete.mock.calls[0][0]).toMatchObject({ status: 'cancelled', answer: '', diagnostics: { failure: { code: 'cancel' } } });
});

it('qualifies a buffered final kg quote once before delivery, checkpoint and archive', async () => {
  const qualifier = createLegacyWeightQualifier({ singleDate: null, currentMonthRequested: false });
  qualifier.observe({ toolName: 'adminGetSteelProductionEvidence', status: 'ok', input: {}, result: { ok: true, aggregates: [{ metric: { kg: 123.45, legacyPieces: 1 } }] } });
  const onCheckpoint = vi.fn(async (_answer: string) => {});
  const { result, onComplete } = response([
    { type: 'start-step' }, textPart('Po kontrolloj 123.45 kg…'), { type: 'tool-call' }, finishStep('tool-calls'),
    { type: 'start-step' }, textPart('Prerje **123,'), textPart('45** kg; stok 99 kg.'), finishStep(), finish(),
  ], { transformAnswer: qualifier.transformAnswer, onCheckpoint });
  const delivered = await result.text();
  expect(delivered).toBe('Prerje **≈123,45** kg; stok 99 kg.');
  expect(onCheckpoint).toHaveBeenCalledExactlyOnceWith(delivered);
  expect(onComplete.mock.calls[0][0]).toMatchObject({ answer: delivered, status: 'completed' });
  expect(qualifier.snapshot()).toEqual({ legacyValuesSeen: 1, qualifiersAdded: 1 });
});

it('fails closed to a safe fallback if answer qualification throws', async () => {
  const onCheckpoint = vi.fn(async (_answer: string) => {});
  const { result, onComplete } = response([{ type: 'start-step' }, textPart('Unqualified 123.45 kg'), finishStep(), finish()], { transformAnswer: () => { throw Error('PRIVATE TRANSFORM ERROR'); }, onCheckpoint });
  const delivered = await result.text();
  expect(delivered).toBe('Fallback:internal');
  expect(onCheckpoint).not.toHaveBeenCalled();
  expect(onComplete.mock.calls[0][0]).toMatchObject({ answer: delivered, status: 'error', diagnostics: { hasFinalAnswer: false, failure: { code: 'internal' } } });
});
