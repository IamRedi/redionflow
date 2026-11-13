import { z } from "zod";
import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { boundedBody, demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";
import { demoOfficeActor } from "@/lib/workshop/offices/access";
import { uploadOfficeFile } from "@/lib/workshop/offices/store";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { await demoOfficeActor(); const denied = rejectCrossOriginMutation(request); if (denied) return denied;
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) return Response.json({ error: "required" }, { status: 415, headers: demoHeaders });
    const raw = await boundedBody(request, 12_010_000), form = await new Request(request.url, { method: "POST", headers: { "content-type": request.headers.get("content-type")! }, body: new Uint8Array(raw) }).formData();
    const data = z.object({ requestId: z.uuid(), revision: z.coerce.number().int().nonnegative(), folderId: z.uuid().optional(), shared: z.enum(["true", "false"]).transform(v => v === "true") }).strict().parse({ requestId: form.get("requestId"), revision: form.get("revision"), folderId: form.get("folderId") || undefined, shared: form.get("shared") });
    const file = form.get("file"); if (!(file instanceof File)) return Response.json({ error: "required" }, { status: 400, headers: demoHeaders });
    return Response.json(await uploadOfficeFile(data, file), { headers: demoHeaders });
  } catch (e) { return workshopResponseError(e); }
}
