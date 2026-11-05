import { cookies } from "next/headers";
import { z } from "zod";
import { createSessionCookie } from "@/lib/auth/session-cookie";
import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { boundedBody, demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";
import { requireWorkshopDemo, workshopDirectory } from "@/lib/workshop/shared-store";
import { DEMO_ACTOR_COOKIE } from "@/lib/workshop/demo-actor";

export async function POST(request: Request) {
  try {
    await requireWorkshopDemo(); const rejected = rejectCrossOriginMutation(request); if (rejected) return rejected;
    const { key } = z.object({ key: z.string().max(128) }).strict().parse(JSON.parse((await boundedBody(request, 512)).toString("utf8")));
    const directory = await workshopDirectory();
    if (key !== "admin" && !directory.workers.some(w => w.key === key)) return Response.json({ error: "missing" }, { status: 404, headers: demoHeaders });
    const value = await createSessionCookie("display", `bdf-demo:${key}`, 0);
    (await cookies()).set(DEMO_ACTOR_COOKIE, value, { httpOnly: true, sameSite: "strict", secure: process.env.APP_BASE_URL?.startsWith("https://") ?? false, path: "/api/demo/baumdienst", maxAge: 86400 });
    return Response.json({ ok: true }, { headers: demoHeaders });
  } catch (e) { return workshopResponseError(e); }
}
