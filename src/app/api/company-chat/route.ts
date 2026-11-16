import { NextResponse } from 'next/server';
import { companyChatIdentity } from '@/lib/company-chat/identity';
import { applyCompanyChatCommand, companyChatSnapshot } from '@/lib/company-chat/service';
import { ChatError, chatSequence, readChatCommand } from '@/lib/company-chat/contract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' };
function failed(error: unknown) {
  return NextResponse.json({ error: error instanceof ChatError ? error.code : 'unavailable' }, { status: error instanceof ChatError ? error.status : 503, headers });
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url), params = url.searchParams;
    if (params.get('demo') === '1' && !['/api/demo/baumdienst/chat', '/api/demo/baumdienst/offices/chat'].includes(url.pathname)) throw new ChatError('missing', 404);
    const actor = await companyChatIdentity(params.get('demo') === '1', url.pathname === '/api/demo/baumdienst/offices/chat');
    if (!actor) throw new ChatError('missing', 404);
    const before = params.get('before');
    if (before !== null && !chatSequence.safeParse(before).success) throw new ChatError('invalid');
    return NextResponse.json(await companyChatSnapshot(actor, { summary: params.get('summary') === '1', before: before ? BigInt(before) : undefined }), { headers });
  } catch (error) { return failed(error); }
}
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get('demo') === '1' && !['/api/demo/baumdienst/chat', '/api/demo/baumdienst/offices/chat'].includes(url.pathname)) throw new ChatError('missing', 404);
    // Compare the browser's host to the request host, including ports; HTTPS
    // termination at the existing reverse proxy must not break same-origin use.
    const origin = request.headers.get('origin');
    let source: URL | null = null;
    try { if (origin) source = new URL(origin); } catch { /* Reject malformed origins below. */ }
    if (!source || source.host !== (request.headers.get('host') ?? url.host) || !['http:', 'https:'].includes(source.protocol)) throw new ChatError('invalid', 403);
    const actor = await companyChatIdentity(url.searchParams.get('demo') === '1', url.pathname === '/api/demo/baumdienst/offices/chat');
    if (!actor) throw new ChatError('missing', 404);
    const command = await readChatCommand(request);
    const result = await applyCompanyChatCommand(actor, command);
    return NextResponse.json(result, { headers });
  } catch (error) { return failed(error); }
}
