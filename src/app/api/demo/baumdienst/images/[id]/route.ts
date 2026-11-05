import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { DEMO_WORKSPACE_KEY, requireWorkshopDemo, SharedWorkshopError } from "@/lib/workshop/shared-store";
import { demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireWorkshopDemo(); const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new SharedWorkshopError("missing", 404);
    const image = await prisma.baumdienstDemoImageGeneration.findFirst({ where: { id, workspaceKey: DEMO_WORKSPACE_KEY, status: "ready" }, select: { data: true } });
    if (!image?.data) throw new SharedWorkshopError("missing", 404);
    return new Response(new Uint8Array(image.data), { headers: { ...demoHeaders, "Content-Type": "image/webp", "Content-Length": String(image.data.length), "Content-Security-Policy": "default-src 'none'; sandbox", "Cross-Origin-Resource-Policy": "same-origin" } });
  } catch (error) { return workshopResponseError(error); }
}
