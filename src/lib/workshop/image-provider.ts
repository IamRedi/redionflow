import { compactPhoto } from "@/lib/asset-photos/image";
import type { WorkshopAsset } from "./demo-model";
import { IMAGE_MODEL, IMAGE_TIMEOUT_MS, imagePrompt } from "./image-identity";
import { imageFormats, type ImagePlacement } from "./image-format";

export class ImageProviderError extends Error {
  constructor(public code: "aiFailed" | "aiTimeout" | "aiUnavailable") { super(code); }
}

/** One fixed-provider call. Never retry an uncertain paid request automatically. */
export async function generateStudioImage(prompt: string, placement:ImagePlacement="equipment") {
  const key = process.env.BAUMDIENST_IMAGE_OPENAI_API_KEY?.trim();
  if (!key) throw new ImageProviderError("aiUnavailable");
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST", redirect: "error", cache: "no-store", signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, n: 1, size: imageFormats[placement].size, quality: "medium", complexity: "low", background: "opaque", output_format: "webp", output_compression: 80, moderation: "auto" }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ImageProviderError([401, 403, 429].includes(response.status) ? "aiUnavailable" : "aiFailed");
    }
    if (!response.headers.get("content-type")?.includes("application/json") || Number(response.headers.get("content-length")) > 8_000_000) throw new ImageProviderError("aiFailed");
    const reader = response.body?.getReader(); if (!reader) throw new ImageProviderError("aiFailed");
    let size = 0; const parts: Uint8Array[] = [];
    try {
      while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 8_000_000) { await reader.cancel(); throw new ImageProviderError("aiFailed"); } parts.push(part.value); }
    } finally { reader.releaseLock(); }
    const body = JSON.parse(Buffer.concat(parts, size).toString("utf8"));
    const encoded = body?.data?.length === 1 ? body.data[0]?.b64_json : undefined;
    if (typeof encoded !== "string" || !encoded.length || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new ImageProviderError("aiFailed");
    // Never follow provider URLs or render XML. Revalidate and strip raster metadata.
    const photo=await compactPhoto(new Uint8Array(Buffer.from(encoded,"base64")));
    if(Math.abs(photo.width/photo.height/imageFormats[placement].ratio-1)>.02)throw new ImageProviderError("aiFailed");
    return photo.data;
  } catch (error) {
    if (error instanceof ImageProviderError) throw error;
    throw new ImageProviderError(controller.signal.aborted ? "aiTimeout" : "aiFailed");
  } finally { clearTimeout(timer); }
}
export async function generateEquipmentImage(asset: WorkshopAsset) { return generateStudioImage(imagePrompt(asset)); }
