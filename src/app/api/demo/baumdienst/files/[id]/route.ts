import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";
import { DEMO_WORKSPACE_KEY, requireWorkshopDemo, SharedWorkshopError } from "@/lib/workshop/shared-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireWorkshopDemo();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new SharedWorkshopError("missing", 404);
    const file = await prisma.baumdienstDemoFile.findFirst({ where: { id, workspaceKey: DEMO_WORKSPACE_KEY } });
    if (!file) throw new SharedWorkshopError("missing", 404);
    return new Response(new Uint8Array(file.data), { headers: { ...demoHeaders, "Content-Type": file.mime, "Content-Length": String(file.bytes), "Content-Disposition": `${file.kind === "document" ? "attachment" : "inline"}; filename="demo-file${file.mime === "image/webp" ? ".webp" : ""}"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()]/g, c => `%${c.charCodeAt(0).toString(16)}`)}`, "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (error) { return workshopResponseError(error); }
}
