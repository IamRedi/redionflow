import { readFile } from "node:fs/promises";
import path from "node:path";

import { brandFaviconSrc } from "@/lib/branding";

export const runtime = "nodejs";

export async function GET() {
  const logoPath = brandFaviconSrc.replace(/^\//, "");
  const filePath = path.join(process.cwd(), "public", logoPath);
  const icon = await readFile(filePath);

  return new Response(icon, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
