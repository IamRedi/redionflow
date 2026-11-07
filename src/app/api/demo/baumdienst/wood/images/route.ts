import { z } from "zod";
import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { currentDemoActor } from "@/lib/workshop/demo-actor";
import { requestPhaseImage } from "@/lib/workshop/image-store";
import { boundedBody,demoHeaders,workshopResponseError } from "@/lib/workshop/shared-http";
import { requireWorkshopDemo,workshopDirectory } from "@/lib/workshop/shared-store";
export const runtime="nodejs";
export const maxDuration=120;
const input=z.object({phaseId:z.string().min(1).max(128),requestId:z.uuid()}).strict();
export async function POST(request:Request){try{await requireWorkshopDemo();const rejected=rejectCrossOriginMutation(request);if(rejected)return rejected;const body=input.parse(JSON.parse((await boundedBody(request,1000)).toString("utf8")));return Response.json(await requestPhaseImage(body.phaseId,body.requestId,await currentDemoActor(await workshopDirectory())),{headers:demoHeaders});}catch(e){return workshopResponseError(e);}}
