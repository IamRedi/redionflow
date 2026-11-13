import { z } from "zod";
import { demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";
import { officeFile } from "@/lib/workshop/offices/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; z.uuid().parse(id); const site = new URL(request.url).searchParams.get("site") || undefined; if (site) z.string().min(1).max(128).parse(site); const file = await officeFile(id, site);
    return new Response(new Uint8Array(file.data), { headers: { ...demoHeaders, "Content-Type": file.mime, "Content-Length": String(file.bytes), "Content-Disposition": `attachment; filename="office-document"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()]/g, c => `%${c.charCodeAt(0).toString(16)}`)}`, "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (e) { return workshopResponseError(e); }
}
