import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isStudioMediaId } from "@/lib/workshop/studio-media";
import { requireWorkshopDemo, SharedWorkshopError } from "@/lib/workshop/shared-store";
import { workshopResponseError } from "@/lib/workshop/shared-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireWorkshopDemo();
    const { id } = await params;
    if (!isStudioMediaId(id)) throw new SharedWorkshopError("missing", 404);
    const bytes = await readFile(join(process.cwd(), "assets/baumdienst-studio/v1", `${id}.webp`));
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "image/webp", "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox", "Cross-Origin-Resource-Policy": "same-origin",
    } });
  } catch (error) { return workshopResponseError(error); }
}
