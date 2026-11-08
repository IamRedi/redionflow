import { prisma } from "@/lib/db/prisma";
import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { boundedBody,demoHeaders,workshopResponseError } from "@/lib/workshop/shared-http";
import { requireWorkshopDemo } from "@/lib/workshop/shared-store";
import { woodEnvelope } from "@/lib/workshop/wood-model";
import { ensureWoodDemo,mutateWoodCommand,woodSnapshot } from "@/lib/workshop/wood-store";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){try{await requireWorkshopDemo();await ensureWoodDemo();return Response.json(await prisma.$transaction(tx=>woodSnapshot(tx),{isolationLevel:"RepeatableRead"}),{headers:demoHeaders});}catch(e){return workshopResponseError(e);}}
export async function POST(request:Request){try{await requireWorkshopDemo();const rejected=rejectCrossOriginMutation(request);if(rejected)return rejected;if(!request.headers.get("content-type")?.startsWith("application/json"))return Response.json({error:"required"},{status:415,headers:demoHeaders});return Response.json(await mutateWoodCommand(woodEnvelope.parse(JSON.parse((await boundedBody(request,14000)).toString("utf8")))),{headers:demoHeaders});}catch(e){return workshopResponseError(e);}}
