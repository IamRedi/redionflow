import { z } from "zod";
import { officeSiteFiles } from "@/lib/workshop/offices/store";
import { demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { const site = z.string().min(1).max(128).parse(new URL(request.url).searchParams.get("site")); return Response.json({ files: (await officeSiteFiles(site)).map(f => ({ ...f, url: `/api/demo/baumdienst/offices/files/${f.id}?site=${encodeURIComponent(site)}` })) }, { headers: demoHeaders }); }
  catch (e) { return workshopResponseError(e); }
}
