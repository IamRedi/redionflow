import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rejectCrossOriginMutation } from '@/lib/auth/same-origin';
import { getCurrentCompanyId } from '@/lib/db/tenant';
import { currentCompanyActor } from '@/lib/site-files/actor';
import { withTenantContext } from '@/lib/db/tenant-context';
import { sendNotification } from '@/lib/notifications/sendNotification';
import { testNotificationKey } from '@/lib/notifications/events';
import { encodeBrowserSubscription, validBrowserSubscription, webPushConfig } from '@/lib/notifications/web-push';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

const schema = z.object({ team: z.boolean().optional(), subscription: z.unknown().optional() }).strict();
export async function POST(request: Request) {
  const denied = rejectCrossOriginMutation(request); if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const companyId = await getCurrentCompanyId(), actor = companyId ? await currentCompanyActor(companyId) : null;
  if (!actor || !companyId) return NextResponse.json({ ok: false }, { status: 401 });
  if (parsed.data.team && !actor.isAdmin) return NextResponse.json({ ok: false }, { status: 403 });
  if (!webPushConfig()) return NextResponse.json({ ok: false, code: 'NOT_CONFIGURED' }, { status: 503 });
  // A real test is explicit and limited, rather than a side effect of opening the bell.
  const id = (actor.userId ?? actor.workerId)!;
  const allowed = await withTenantContext(companyId, async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`notification-test:${companyId}:${id}`}))`;
    if (await tx.auditLog.findFirst({ where: { companyProfileId: companyId, action: 'notification.test_requested', actorId: id, createdAt: { gt: new Date(Date.now() - 30000) } }, select: { id: true } })) return false;
    await tx.auditLog.create({ data: { companyProfileId: companyId, actorType: actor.isAdmin ? 'ADMIN' : 'WORKER', actorId: id, action: 'notification.test_requested' } });
    return true;
  });
  if (!allowed) return NextResponse.json({ ok: false, code: 'RATE_LIMIT' }, { status: 429 });
  const lang = await resolveRequestLanguage();
  const title = t('workzone.notificationTestTitle', lang), body = t('workzone.notificationTestBody', lang);
  if (parsed.data.team) {
    // Team test (admin): every active person of the company on every device they activated.
    const people = await withTenantContext(companyId, async tx => [
      ...(await tx.user.findMany({ where: { companyProfileId: companyId, role: 'ADMIN', isActive: true }, select: { id: true } })),
      ...(await tx.worker.findMany({ where: { companyProfileId: companyId, status: 'active' }, select: { id: true } })),
    ]);
    const result = await sendNotification({ userIds: people.map(person => person.id), title, body, url: '/workzone', tag: testNotificationKey() });
    return NextResponse.json({ ok: result.sent > 0, ...result });
  }
  if (!validBrowserSubscription(parsed.data.subscription)) return NextResponse.json({ ok: false }, { status: 400 });
  const token = encodeBrowserSubscription(parsed.data.subscription);
  const owned = await withTenantContext(companyId, tx => tx.notificationSubscription.findFirst({ where: { userId: id, fcmToken: token }, select: { id: true } }));
  if (!owned) return NextResponse.json({ ok: false }, { status: 404 });
  const result = await sendNotification({ userIds: [id], title, body, url: '/workzone', tag: testNotificationKey(), onlyToken: token });
  return NextResponse.json({ ok: result.sent > 0, ...result });
}
