import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkshopDemo,SharedWorkshopError } from "@/lib/workshop/shared-store";
import { WOOD_WORKSPACE_KEY } from "@/lib/workshop/wood-store";
import { demoHeaders,workshopResponseError } from "@/lib/workshop/shared-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{await requireWorkshopDemo();const {id}=await params;if(!z.uuid().safeParse(id).success)throw new SharedWorkshopError("missing",404);const file=await prisma.baumdienstDemoFile.findFirst({where:{id,workspaceKey:WOOD_WORKSPACE_KEY,mime:"image/webp"},select:{data:true}});if(!file)throw new SharedWorkshopError("missing",404);return new Response(new Uint8Array(file.data),{headers:{...demoHeaders,"Content-Type":"image/webp","Content-Security-Policy":"default-src 'none'; sandbox","Cross-Origin-Resource-Policy":"same-origin"}});}catch(e){return workshopResponseError(e);}}
