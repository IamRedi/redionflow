import { z } from "zod";
import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { currentDemoActor } from "@/lib/workshop/demo-actor";
import { requestEquipmentImage } from "@/lib/workshop/image-store";
import { boundedBody, demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";
import { requireWorkshopDemo, workshopDirectory } from "@/lib/workshop/shared-store";

export const runtime = "nodejs";
export const maxDuration = 120;
const input = z.object({ assetId: z.string().min(1).max(128), requestId: z.uuid() }).strict();
export async function POST(request: Request) {
  try {
    await requireWorkshopDemo();
    const rejected = rejectCrossOriginMutation(request); if (rejected) return rejected;
    const body = input.parse(JSON.parse((await boundedBody(request, 1000)).toString("utf8")));
    const actor = await currentDemoActor(await workshopDirectory());
    return Response.json(await requestEquipmentImage(body.assetId, body.requestId, actor), { headers: demoHeaders });
  } catch (error) { return workshopResponseError(error); }
}
