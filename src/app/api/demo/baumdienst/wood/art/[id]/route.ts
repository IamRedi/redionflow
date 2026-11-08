import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { woodArtIds } from "@/lib/workshop/wood-model";
import { requireWorkshopDemo,SharedWorkshopError } from "@/lib/workshop/shared-store";
import { demoHeaders,workshopResponseError } from "@/lib/workshop/shared-http";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{await requireWorkshopDemo();const {id}=await params;if(!(woodArtIds as readonly string[]).includes(id))throw new SharedWorkshopError("missing",404);const bytes=await readFile(join(process.cwd(),"assets/baumdienst-wood/v1",`${id}.webp`));return new Response(new Uint8Array(bytes),{headers:{...demoHeaders,"Content-Type":"image/webp","Cross-Origin-Resource-Policy":"same-origin"}});}catch(e){return workshopResponseError(e);}}
