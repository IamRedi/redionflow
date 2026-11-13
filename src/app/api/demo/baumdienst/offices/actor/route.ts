import { cookies } from "next/headers";
import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { createSessionCookie } from "@/lib/auth/session-cookie";
import { z } from "zod";
import { demoOfficeActor, OFFICE_COOKIE } from "@/lib/workshop/offices/access";
import { officeRole } from "@/lib/workshop/offices/model";
import { boundedBody, demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";
export async function POST(request: Request) {
  try { await demoOfficeActor(); const denied = rejectCrossOriginMutation(request); if (denied) return denied;
    const { role } = z.object({ role: officeRole }).strict().parse(JSON.parse((await boundedBody(request, 256)).toString("utf8")));
    const value = await createSessionCookie("display", `bdf-office:${role}`, 0);
    (await cookies()).set(OFFICE_COOKIE, value, { httpOnly: true, sameSite: "strict", secure: process.env.APP_BASE_URL?.startsWith("https://") ?? false, path: "/api/demo/baumdienst/offices", maxAge: 86400 });
    return Response.json({ ok: true }, { headers: demoHeaders });
  } catch (e) { return workshopResponseError(e); }
}
