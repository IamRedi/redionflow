import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { registerNotificationSubscription } from "@/lib/notifications/notification-store";
import { getCurrentWorker } from "@/lib/workzone/worker-session";

const registerSchema = z.object({
  fcmToken: z.string().min(20).max(4096),
});

export async function POST(request: Request) {
  const originDenied = rejectCrossOriginMutation(request);
  if (originDenied) return originDenied;
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const [admin, worker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  const userId = admin?.id ?? worker?.id;
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!(await registerNotificationSubscription(userId, parsed.data.fcmToken))) {
    return NextResponse.json({ok:false,message:"Subscription unavailable."},{status:409});
  }

  return NextResponse.json({ ok: true });
}
