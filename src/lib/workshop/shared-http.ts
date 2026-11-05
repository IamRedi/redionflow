import { ZodError } from "zod";
import { SharedWorkshopError } from "./shared-store";
import { WorkshopError } from "./demo-model";

export const demoHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
/** Enforce the actual streamed size too; Content-Length alone is untrusted. */
export async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new SharedWorkshopError("fileError", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new SharedWorkshopError("required");
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new SharedWorkshopError("fileError", 413); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, bytes);
}
export function workshopResponseError(error: unknown) {
  if (error instanceof WorkshopError) return Response.json({ error: error.message }, { status: error.message === "storage" ? 413 : 400, headers: demoHeaders });
  if (error instanceof SharedWorkshopError) return Response.json({ error: error.code }, { status: error.status, headers: { ...demoHeaders, ...(error.status === 429 ? { "Retry-After": "60" } : {}) } });
  if (error instanceof ZodError || error instanceof SyntaxError || error instanceof TypeError) return Response.json({ error: "required" }, { status: 400, headers: demoHeaders });
  console.error("Baumdienst shared demo unavailable", error instanceof Error ? error.name : "unknown");
  return Response.json({ error: "connection" }, { status: 503, headers: demoHeaders });
}
