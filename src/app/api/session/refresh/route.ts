import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { rejectCrossOriginMutation } from '@/lib/auth/same-origin';
import { resolvePilotIdentity } from '@/lib/auth/pilot-session';
import { createSessionCookie, readSessionCookie, sessionMaxAge, SESSION_RENEW_AFTER_SECONDS } from '@/lib/auth/session-cookie';

export async function POST(request: Request) {
  const denied = rejectCrossOriginMutation(request);
  if (denied) return denied;
  const response = new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  // Revalidate status, role, company and exact epoch; never renew from a token alone.
  const identity = await resolvePilotIdentity();
  if (!identity) return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const name = identity.kind === 'admin' ? 'bk_admin_id' : 'bk_worker_id';
  const claims = readSessionCookie((await cookies()).get(name)?.value, identity.kind);
  if (!claims || claims.id !== identity.id) return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const maxAge = sessionMaxAge(identity.kind);
  if (claims.expiresAt - Date.now() <= (maxAge - SESSION_RENEW_AFTER_SECONDS) * 1000) {
    response.cookies.set(name, await createSessionCookie(identity.kind, identity.id, claims.epoch), {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge,
    });
  }
  return response;
}
