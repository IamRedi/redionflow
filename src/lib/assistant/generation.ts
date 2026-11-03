import { openai } from "@ai-sdk/openai";
import { stepCountIs, wrapLanguageModel, type LanguageModelMiddleware } from "ai";
import { ASSISTANT_MAX_INPUT_BYTES, ASSISTANT_MAX_OUTPUT_TOKENS, ASSISTANT_TIMEOUT_MS, assistantSteps } from "./limits";

export function assistantGeneration(request: Request, kind: "admin" | "worker", settle: (tokens?: number) => Promise<void>) {
  const maxSteps = assistantSteps(kind);
  const abortSignal = AbortSignal.any([request.signal, AbortSignal.timeout(ASSISTANT_TIMEOUT_MS)]);
  let calls = 0;
  const middleware: LanguageModelMiddleware = {
    specificationVersion: "v3",
    async wrapStream({ params, doStream }) {
      // Include the actual SDK prompt AND tool schemas before each paid call.
      // UTF-8 byte count plus framing headroom is a conservative token bound.
      const bytes = Buffer.byteLength(JSON.stringify({ prompt: params.prompt, tools: params.tools }), "utf8") + 4_096 + params.prompt.length * 64;
      if (abortSignal.aborted || ++calls > maxSteps || bytes > ASSISTANT_MAX_INPUT_BYTES) throw new Error("Assistant request limit reached");
      return doStream();
    },
  };
  return {
    model: wrapLanguageModel({ model: openai("gpt-4o-mini"), middleware }),
    maxOutputTokens: ASSISTANT_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    abortSignal,
    stopWhen: stepCountIs(maxSteps),
    onFinish: async ({ totalUsage }: { totalUsage: { totalTokens?: number } }) => settle(totalUsage.totalTokens),
    onError: async () => settle(),
    onAbort: async () => settle(),
  };
}
