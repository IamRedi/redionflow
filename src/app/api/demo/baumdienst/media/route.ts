import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { currentDemoActor, withDemoActor } from "@/lib/workshop/demo-actor";
import { mediaEnvelope } from "@/lib/workshop/media";
import { changeDemoMedia } from "@/lib/workshop/media-store";
import { boundedBody, demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";
import { requireWorkshopDemo, workshopDirectory } from "@/lib/workshop/shared-store";
export const runtime="nodejs";
export async function POST(request:Request) { try {
  await requireWorkshopDemo(); const rejected=rejectCrossOriginMutation(request);if(rejected)return rejected;
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({error:"required"},{status:415,headers:demoHeaders});
  const input=mediaEnvelope.parse(JSON.parse((await boundedBody(request,2000)).toString("utf8")));
  return Response.json(await withDemoActor(await changeDemoMedia(input,await currentDemoActor(await workshopDirectory()))),{headers:demoHeaders});
} catch(error){return workshopResponseError(error);} }
