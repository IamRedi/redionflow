import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { registerNotificationSubscription } from "@/lib/notifications/notification-store";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { encodeBrowserSubscription, validBrowserSubscription, webPushConfig, type BrowserSubscription } from '@/lib/notifications/web-push';

const registerSchema = z.union([z.object({ fcmToken: z.string().min(20).max(4096).refine(value => !value.startsWith('webpush:')) }).strict(),
  z.object({ subscription: z.custom<BrowserSubscription>(validBrowserSubscription) }).strict()]);

export async function GET() {
  const [admin, worker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  if (Boolean(admin) === Boolean(worker)) return NextResponse.json({ ok: false }, { status: 401 });
  const config = webPushConfig();
  return NextResponse.json({ enabled: Boolean(config), publicKey: config?.publicKey ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const originDenied = rejectCrossOriginMutation(request);
  if (originDenied) return originDenied;
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const [admin, worker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  const userId = Boolean(admin) !== Boolean(worker) ? admin?.id ?? worker?.id : null;
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = 'subscription' in parsed.data ? encodeBrowserSubscription(parsed.data.subscription) : parsed.data.fcmToken;
  if (!(await registerNotificationSubscription(userId, token))) {
    return NextResponse.json({ok:false,message:"Subscription unavailable."},{status:409});
  }

  return NextResponse.json({ ok: true });
}
