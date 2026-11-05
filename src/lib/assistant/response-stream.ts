import { categorizeAssistantFailure, type AssistantFailure, type AssistantFailureCode, type AssistantRunDiagnostics } from './diagnostics';

export type AssistantResponseStatus = 'completed' | 'partial' | 'error' | 'cancelled';
export type AssistantResponseResult = {
  answer: string;
  status: AssistantResponseStatus;
  diagnostics: ReturnType<AssistantRunDiagnostics['snapshot']>;
};
export type AssistantResponseStreamOptions = {
  diagnostics: AssistantRunDiagnostics;
  fallback: (failure: AssistantFailureCode) => string;
  storageFailure: string;
  transformAnswer?: (text: string) => string;
  onCheckpoint?: (answer: string) => Promise<void>;
  onToolError?: (event: { toolCallId: string; toolName: string; input: unknown; failure: AssistantFailure }) => Promise<void>;
  onComplete: (result: AssistantResponseResult) => Promise<void>;
  onCancel?: () => void;
  headers?: HeadersInit;
};

function record(value: unknown) { return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null; }

/** Emit final-answer steps, never a tool-call introduction mistaken for an answer. */
export function assistantResponseStream(parts: AsyncIterable<unknown>, options: AssistantResponseStreamOptions): Response {
  const iterator = parts[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  const run = options.diagnostics;
  let answer = '', stepText = '', stepCalls = false, cancelled = false, archiveFailed = false;
  let completion: Promise<void> | null = null;
  const persist = (status: AssistantResponseStatus) => {
    // ReadableStream cancellation can race its start/finally path.
    completion ??= (async () => {
      try { await options.onComplete({ answer, status, diagnostics: run.snapshot() }); }
      catch { archiveFailed = true; }
    })();
    return completion;
  };
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (text: string) => {
        if (cancelled || !text) return;
        answer += text;
        controller.enqueue(encoder.encode(text));
      };
      const checkpoint = async () => {
        try { await options.onCheckpoint?.(answer); } catch { /* Final persistence is still attempted. */ }
      };
      const flushText = async () => {
        const text = !stepCalls ? stepText : '';
        stepText = ''; stepCalls = false;
        if (text.trim()) {
          let safeText: string;
          try { safeText = options.transformAnswer ? options.transformAnswer(text) : text; }
          catch { run.fail(null); return; }
          emit(safeText); await checkpoint();
        }
      };
      try {
        while (!cancelled) {
          const next = await iterator.next();
          if (next.done || cancelled) break;
          run.observe(next.value);
          const part = record(next.value);
          if (!part) continue;
          if (part.type === 'start-step') { stepText = ''; stepCalls = false; }
          if (part.type === 'text-delta' && typeof part.text === 'string') stepText += part.text;
          if (part.type === 'tool-call' || part.type === 'tool-result' || part.type === 'tool-error') stepCalls = true;
          if (part.type === 'tool-error' && options.onToolError) {
            try {
              await options.onToolError({ toolCallId: typeof part.toolCallId === 'string' ? part.toolCallId.slice(0, 120) : '', toolName: typeof part.toolName === 'string' ? part.toolName.slice(0, 100) : '', input: part.input, failure: categorizeAssistantFailure(part.error, { source: 'tool' }) });
            } catch { archiveFailed = true; }
          }
          if (part.type === 'finish-step') await flushText();
        }
      } catch (error) {
        if (!cancelled) run.fail(error, { source: 'provider' });
      } finally {
        if (cancelled) {
          run.end();
          await persist('cancelled');
          return;
        }
        // An interrupted no-tool final step may contain useful partial text.
        await flushText();
        run.end();
        const snapshot = run.snapshot();
        const hadAnswer = !!answer.trim();
        if (!snapshot.hasFinalAnswer) {
          let text: string;
          try { text = options.fallback(snapshot.failure?.code ?? 'empty_answer'); }
          catch { text = 'The assistant could not complete this answer.'; }
          emit(`${hadAnswer ? '\n\n' : ''}${text}`);
        }
        // If a trace failed but final storage recovers, retain its visible
        // warning in the archived answer as well as in the delivered text.
        const archiveWarningEmitted = archiveFailed && !!options.storageFailure;
        if (archiveWarningEmitted) emit(`${answer.trim() ? '\n\n' : ''}${options.storageFailure}`);
        await persist(snapshot.hasFinalAnswer ? 'completed' : hadAnswer ? 'partial' : 'error');
        if (!cancelled && archiveFailed && !archiveWarningEmitted && options.storageFailure) emit(`${answer.trim() ? '\n\n' : ''}${options.storageFailure}`);
        if (!cancelled) controller.close();
      }
    },
    async cancel() {
      cancelled = true;
      run.fail(null, { cancelled: true });
      run.end();
      try { options.onCancel?.(); } catch { /* Cancellation still persists. */ }
      // Abort the upstream request via onCancel; do not wait on an unresponsive
      // iterator before recording the cancellation and its current text.
      try { const returned = iterator.return?.(); if (returned) void returned.catch(() => {}); } catch { /* No raw upstream errors. */ }
      await persist('cancelled');
    },
  });
  const headers = new Headers(options.headers);
  headers.set('content-type', 'text/plain; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(stream, { headers });
}
