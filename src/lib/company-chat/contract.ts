import { z } from 'zod';

export const CHAT_PAGE_SIZE = 40;
export const CHAT_MESSAGE_LIMIT = 1500;
export const CHAT_HISTORY_LIMIT = 10000;
export const chatSequence = z.string().refine(s => /^(0|[1-9]\d{0,18})$/.test(s) && BigInt(s) <= BigInt('9223372036854775807'));
export const chatCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('send'), actorKey: z.string().max(180), requestId: z.uuid(), body: z.string().trim().min(1).max(CHAT_MESSAGE_LIMIT).refine(s => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)) }).strict(),
  z.object({ type: z.literal('read'), actorKey: z.string().max(180), through: chatSequence }).strict(),
]);
export type ChatCommand = z.infer<typeof chatCommand>;
export type ChatIdentity = { companyId: string; key: string; name: string; notificationUserId?: string; demo: boolean; context?: 'office' };
export type ChatPerson = Pick<ChatIdentity, 'key' | 'name' | 'demo' | 'context'>;
export type ChatMessage = { id: string; seq: string; authorKey: string; authorName: string; body: string; at: string };
export type ChatSnapshot = { actor: ChatPerson; messages: ChatMessage[]; older: string | null; unread: number; latest: string; latestAuthor: string | null };
export class ChatError extends Error { constructor(public code: 'missing' | 'profile' | 'invalid' | 'rate' | 'retry' | 'storage', public status = 400) { super(code); } }

/** Bound chunked as well as declared bodies; never log chat text. */
export async function readChatCommand(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ChatError('invalid', 415);
  if (Number(request.headers.get('content-length')) > 8192) throw new ChatError('invalid', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ChatError('invalid');
  let timedOut = false, size = 0;
  const timeout = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 5000);
  try {
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) throw new ChatError('invalid', 408);
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { void reader.cancel().catch(() => {}); throw new ChatError('invalid', 413); }
      chunks.push(value);
    }
    const parsed = chatCommand.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (!parsed.success) throw new ChatError('invalid');
    return parsed.data;
  } catch (error) { if (error instanceof ChatError) throw error; throw new ChatError('invalid', timedOut ? 408 : 400); }
  finally { clearTimeout(timeout); reader.releaseLock(); }
}
