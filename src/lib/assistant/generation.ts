import { openai } from "@ai-sdk/openai";
import { stepCountIs, wrapLanguageModel, type LanguageModelMiddleware } from "ai";
import { ASSISTANT_MAX_INPUT_BYTES, ASSISTANT_MAX_OUTPUT_TOKENS, ASSISTANT_TIMEOUT_MS, assistantSteps } from "./limits";
import { AssistantGenerationError, categorizeAssistantFailure, type AssistantFailure } from './diagnostics';

export type AssistantGenerationHooks = {
  onProviderCall?: (event: { step: number; inputBytes: number }) => void | Promise<void>;
  onFailure?: (failure: AssistantFailure) => void | Promise<void>;
};

function notify<T>(hook: ((event: T) => void | Promise<void>) | undefined, event: T) {
  try { const pending = hook?.(event); if (pending) void pending.catch(() => {}); } catch { /* Diagnostics cannot break generation. */ }
}

export function assistantGeneration(request: Request, kind: "admin" | "worker", settle: (tokens?: number) => Promise<void>, hooks: AssistantGenerationHooks = {}) {
  const maxSteps = assistantSteps(kind);
  const abortSignal = AbortSignal.any([request.signal, AbortSignal.timeout(ASSISTANT_TIMEOUT_MS)]);
  let calls = 0;
  const middleware: LanguageModelMiddleware = {
    specificationVersion: "v3",
    async wrapStream({ params, doStream }) {
      // Include the actual SDK prompt AND tool schemas before each paid call.
      // UTF-8 byte count plus framing headroom is a conservative token bound.
      const bytes = Buffer.byteLength(JSON.stringify({ prompt: params.prompt, tools: params.tools }), "utf8") + 4_096 + params.prompt.length * 64;
      const code = abortSignal.aborted ? request.signal.aborted ? 'cancel' : 'timeout' : calls >= maxSteps ? 'step_limit' : bytes > ASSISTANT_MAX_INPUT_BYTES ? 'input_payload' : null;
      if (code) {
        const error = new AssistantGenerationError(code, { step: calls, inputBytes: bytes });
        notify(hooks.onFailure, categorizeAssistantFailure(error));
        throw error;
      }
      notify(hooks.onProviderCall, { step: calls, inputBytes: bytes });
      calls += 1;
      try { return await doStream(); }
      catch (error) { notify(hooks.onFailure, categorizeAssistantFailure(error, { source: 'provider' })); throw error; }
    },
  };
  return {
    model: wrapLanguageModel({ model: openai("gpt-4o-mini"), middleware }),
    maxOutputTokens: ASSISTANT_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    abortSignal,
    stopWhen: stepCountIs(maxSteps),
    onFinish: async ({ totalUsage }: { totalUsage: { totalTokens?: number } }) => settle(totalUsage.totalTokens),
    onError: async (event?: { error: unknown }) => { notify(hooks.onFailure, categorizeAssistantFailure(event?.error, { source: 'provider' })); await settle(); },
    onAbort: async () => { notify(hooks.onFailure, categorizeAssistantFailure(null, request.signal.aborted ? { cancelled: true } : abortSignal.aborted ? { timedOut: true } : { cancelled: true })); await settle(); },
  };
}
