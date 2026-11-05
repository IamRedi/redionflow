import { getRequesterContext, type RequesterContext } from './requester';
import { AssistantHistoryError } from './history';

const headers = { 'cache-control': 'private, no-store', vary: 'Cookie', 'x-content-type-options': 'nosniff' };
type Admin = Extract<RequesterContext, { kind: 'admin' }>;

export function assistantHistoryPage(request: Request, defaultLimit: number) {
  const params = new URL(request.url).searchParams;
  const rawLimit = params.get('limit');
  if (rawLimit !== null && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(rawLimit)) throw new AssistantHistoryError(400, 'INVALID_REQUEST');
  return { cursor: params.get('cursor') ?? undefined, limit: rawLimit ? Number(rawLimit) : defaultLimit };
}

/** Private archive reads have the same fresh admin identity as generation. */
export async function assistantHistoryRead(read: (requester: Admin) => Promise<unknown>) {
  try {
    const requester = await getRequesterContext();
    if (requester.kind !== 'admin') return Response.json({ error: 'Administrator access required.' }, { status: 403, headers });
    return Response.json(await read(requester), { headers });
  } catch (error) {
    const status = error instanceof AssistantHistoryError ? error.status : 503;
    return Response.json({ error: status === 404 ? 'Conversation not found.' : 'Conversation history unavailable.' }, { status, headers });
  }
}
