'use server';

import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createSessionCookie, sessionMaxAge } from '@/lib/auth/session-cookie';
import { ensureLoginAllowed, getClientIp, registerFailedLogin } from '@/lib/auth/login-guard';
import { ADMIN_COOKIE } from '@/lib/auth/admin-session';
import { DISPLAY_COOKIE } from '@/lib/auth/display-session';
import { WORKER_COOKIE } from '@/lib/workzone/worker-session';
import { bauflowMusterPublicDemoConfigured } from '@/lib/demo/bauflow-muster';
import { getBauflowDemoAccount } from '@/lib/demo/bauflow-muster-access';

/** Next's same-origin server-action protection applies before role entry. */
export async function enterBauflowDemo(form: FormData) {
  if (!bauflowMusterPublicDemoConfigured()) notFound();
  const ip = getClientIp(await headers());
  const allowed = await ensureLoginAllowed('demo', ip);
  if (!allowed.ok) redirect('/muster?busy=1');
  // Count every entry, including success, without consuming real-login buckets.
  const reserved = await registerFailedLogin('demo', ip);
  if (reserved.retryAfterSeconds) redirect('/muster?busy=1');
  const rawRole = form.get('role');
  const account = typeof rawRole === 'string' && rawRole.length <= 16
    ? await getBauflowDemoAccount(rawRole) : null;
  if (!account) notFound();
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  jar.delete(WORKER_COOKIE);
  jar.delete(DISPLAY_COOKIE);
  jar.set(account.kind === 'admin' ? ADMIN_COOKIE : WORKER_COOKIE,
    await createSessionCookie(account.kind, account.id, account.sessionEpoch), {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: sessionMaxAge(account.kind),
    });
  redirect('/workzone');
}
