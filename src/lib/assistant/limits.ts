/** Shared browser/server bounds. The visible transcript is kept in the browser. */
export const ASSISTANT_MAX_MESSAGES = 16;
export const ASSISTANT_MAX_MESSAGE_CHARS = 4_000;
export const ASSISTANT_MAX_HISTORY_CHARS = 12_000;
export const ASSISTANT_MAX_BODY_BYTES = 96 * 1024;
export const ASSISTANT_MAX_OUTPUT_TOKENS = 1_024;
export const ASSISTANT_MAX_INPUT_BYTES = 64 * 1024;
export const ASSISTANT_TIMEOUT_MS = 45_000;
export const assistantSteps = (kind: "admin" | "worker") => kind === "admin" ? 4 : 1;

export type AssistantMessage = { role: "user" | "assistant"; content: string };

export function assistantHistory(messages: AssistantMessage[]): AssistantMessage[] {
  const recent = messages.slice(-ASSISTANT_MAX_MESSAGES).map(({ role, content }) => ({ role, content: content.slice(0, ASSISTANT_MAX_MESSAGE_CHARS) }));
  let length = recent.reduce((sum, message) => sum + message.content.length, 0);
  while (length > ASSISTANT_MAX_HISTORY_CHARS && recent.length > 1) {
    length -= recent.shift()!.content.length;
  }
  return recent;
}
