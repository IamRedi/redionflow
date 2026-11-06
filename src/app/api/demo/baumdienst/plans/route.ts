import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { boundedBody, demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";
import { ensureWorkshopDemo, requireWorkshopDemo } from "@/lib/workshop/shared-store";
import { demoPlanEnvelope } from "@/lib/workshop/plan-model";
import { demoPlansSnapshot, mutateDemoPlan } from "@/lib/workshop/plan-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await requireWorkshopDemo();
    const date = z.iso.date().parse(new URL(request.url).searchParams.get("date"));
    await ensureWorkshopDemo();
    return Response.json(await prisma.$transaction(tx => demoPlansSnapshot(date, tx), { isolationLevel: "RepeatableRead" }), { headers: demoHeaders });
  } catch (error) { return workshopResponseError(error); }
}
export async function POST(request: Request) {
  try {
    await requireWorkshopDemo();
    const rejected = rejectCrossOriginMutation(request); if (rejected) return rejected;
    if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "required" }, { status: 415, headers: demoHeaders });
    return Response.json(await mutateDemoPlan(demoPlanEnvelope.parse(JSON.parse((await boundedBody(request, 8000)).toString("utf8")))), { headers: demoHeaders });
  } catch (error) { return workshopResponseError(error); }
}
