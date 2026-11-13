import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { boundedBody, demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";
import { demoOfficeActor } from "@/lib/workshop/offices/access";
import { askOfficeAssistant, officeAssistantInput } from "@/lib/workshop/offices/assistant";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try { await demoOfficeActor(); const denied = rejectCrossOriginMutation(request); if (denied) return denied; if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "required" }, { status: 415, headers: demoHeaders });
    return Response.json(await askOfficeAssistant(officeAssistantInput.parse(JSON.parse((await boundedBody(request, 10000)).toString("utf8"))), request.signal), { headers: demoHeaders });
  } catch (e) { return workshopResponseError(e); }
}
