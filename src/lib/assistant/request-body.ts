import { z } from "zod";
import { ASSISTANT_MAX_BODY_BYTES, ASSISTANT_MAX_HISTORY_CHARS, ASSISTANT_MAX_MESSAGE_CHARS, ASSISTANT_MAX_MESSAGES } from "./limits";

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(ASSISTANT_MAX_MESSAGE_CHARS) })).min(1).max(ASSISTANT_MAX_MESSAGES),
  conversationId: z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/).optional(),
  clientMessageId: z.string().uuid().optional(),
}).refine(({ messages }) => messages.reduce((sum, message) => sum + message.content.length, 0) <= ASSISTANT_MAX_HISTORY_CHARS)
  .refine(({ messages }) => messages.at(-1)?.role === "user" && Boolean(messages.at(-1)?.content.trim()));

export async function readAssistantBody(request: Request) {
  if (Number(request.headers.get("content-length")) > ASSISTANT_MAX_BODY_BYTES) return { ok: false as const, status: 413 };
  const reader = request.body?.getReader();
  if (!reader) return { ok: false as const, status: 400 };
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 10_000);
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) return { ok: false as const, status: 408 };
      if (done) break;
      size += value.byteLength;
      if (size > ASSISTANT_MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        return { ok: false as const, status: 413 };
      }
      chunks.push(value);
    }
    const parsed = schema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    return parsed.success ? { ok: true as const, data: parsed.data } : { ok: false as const, status: 400 };
  } catch {
    return { ok: false as const, status: timedOut ? 408 : 400 };
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
}
