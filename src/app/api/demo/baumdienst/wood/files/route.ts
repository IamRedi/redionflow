import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { boundedBody,demoHeaders,workshopResponseError } from "@/lib/workshop/shared-http";
import { requireWorkshopDemo,SharedWorkshopError } from "@/lib/workshop/shared-store";
import { woodMediaEnvelope } from "@/lib/workshop/wood-model";
import { uploadWoodMedia } from "@/lib/workshop/wood-store";
export const runtime="nodejs";
let active=0;
export async function POST(request:Request){let acquired=false;try{await requireWorkshopDemo();const rejected=rejectCrossOriginMutation(request);if(rejected)return rejected;if(active>=2)throw new SharedWorkshopError("busy",429);active++;acquired=true;const contentType=request.headers.get("content-type")??"";if(!contentType.startsWith("multipart/form-data;"))throw new SharedWorkshopError("fileError",415);const bytes=await boundedBody(request,12_050_000);const form=await new Response(new Uint8Array(bytes),{headers:{"Content-Type":contentType}}).formData();if(typeof form.get("revision")!=="string"||!/^\d+$/.test(String(form.get("revision"))))throw new SharedWorkshopError("required");const input=woodMediaEnvelope.parse({requestId:form.get("requestId"),revision:Number(form.get("revision")),target:form.get("target"),kind:form.get("kind")});const file=form.get("file");if(!(file instanceof File))throw new SharedWorkshopError("fileError");return Response.json(await uploadWoodMedia(input,file),{headers:demoHeaders});}catch(e){return workshopResponseError(e);}finally{if(acquired)active--;}}
