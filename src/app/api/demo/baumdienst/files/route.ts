import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { uploadEnvelope } from "@/lib/workshop/shared-contract";
import { boundedBody, demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";
import { requireWorkshopDemo, SharedWorkshopError } from "@/lib/workshop/shared-store";
import { uploadWorkshopFile } from "@/lib/workshop/shared-files";

export const runtime = "nodejs";
let activeUploads = 0;
export async function POST(request: Request) {
  let acquired = false;
  try {
    const company = await requireWorkshopDemo();
    const rejected = rejectCrossOriginMutation(request); if (rejected) return rejected;
    // Bound multipart buffers as well as native image conversions on this replica.
    if (activeUploads >= 2) throw new SharedWorkshopError("busy", 429);
    activeUploads++; acquired = true;
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data;")) throw new SharedWorkshopError("fileError", 415);
    const bytes = await boundedBody(request, 12_050_000);
    const form = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": contentType } }).formData();
    const input = uploadEnvelope.parse({ requestId: form.get("requestId"), revision: form.get("revision"), kind: form.get("kind"), target: form.get("target"), ...(form.get("jobId") ? { jobId: form.get("jobId") } : {}) });
    const file = form.get("file");
    if (!(file instanceof File)) throw new SharedWorkshopError("fileError");
    return Response.json(await uploadWorkshopFile(input, file, company.id), { headers: demoHeaders });
  } catch (error) { return workshopResponseError(error); }
  finally { if (acquired) activeUploads--; }
}
