import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { boundedBody, demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";
import { demoOfficeActor } from "@/lib/workshop/offices/access";
import { officeEnvelope, officeMonth, officeRole } from "@/lib/workshop/offices/model";
import { officeCommand, officeSnapshot } from "@/lib/workshop/offices/store";
import { restoreOfficeSites } from "@/lib/workshop/offices/restore-sites";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { const actor = await demoOfficeActor(); await restoreOfficeSites(actor.companyId); const q = new URL(request.url).searchParams; return Response.json(await officeSnapshot(q.has("room") ? officeRole.parse(q.get("room")) : undefined, q.has("month") ? officeMonth.parse(q.get("month")) : undefined), { headers: demoHeaders }); }
  catch (e) { return workshopResponseError(e); }
}
export async function POST(request: Request) {
  try { await demoOfficeActor(); const denied = rejectCrossOriginMutation(request); if (denied) return denied; if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "required" }, { status: 415, headers: demoHeaders }); return Response.json(await officeCommand(officeEnvelope.parse(JSON.parse((await boundedBody(request, 16000)).toString("utf8")))), { headers: demoHeaders }); }
  catch (e) { return workshopResponseError(e); }
}
