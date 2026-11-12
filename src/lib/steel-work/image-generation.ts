import { createOpenAI } from '@ai-sdk/openai';
import { generateImage } from 'ai';
import { categorizeAssistantFailure, type AssistantFailure } from '@/lib/assistant/diagnostics';

export const STEEL_IMAGE_MODEL = 'gpt-image-2.5-flare-2026-09-08';
export const STEEL_IMAGE_TIMEOUT_MS = 120_000;
const MAX_PROMPT_BYTES = 8_192, MAX_REFERENCE_BYTES = 200_000, MAX_IMAGE_BYTES = 12_000_000;
// Bound the JSON/base64 response before the SDK parses or decodes its image.
const MAX_RESPONSE_BYTES = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 65_536;
type ImageCode = 'input' | 'output_limit' | 'invalid_image' | 'provider';
export class SteelImageGenerationError extends Error {
  readonly name = 'SteelImageGenerationError';
  constructor(readonly code: ImageCode, readonly failure?: AssistantFailure) { super('Steel illustration unavailable'); }
}
type ImageMime = 'image/webp' | 'image/png' | 'image/jpeg';
export type SteelImageResult = { bytes: Uint8Array; mime: ImageMime; usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } };

function imageMime(bytes: Uint8Array): ImageMime | null {
  const buffer = Buffer.from(bytes);
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

async function boundedImageFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, { ...init, redirect: 'error' });
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => {});
    throw new SteelImageGenerationError('output_limit');
  }
  const reader = response.body?.getReader();
  if (!reader) return response;
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.length;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw new SteelImageGenerationError('output_limit');
      }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return new Response(new Uint8Array(Buffer.concat(chunks)), { status: response.status, statusText: response.statusText, headers: response.headers });
}

function ownFailure(error: unknown): SteelImageGenerationError | undefined {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    if (current instanceof SteelImageGenerationError) return current;
    current = (current as { cause?: unknown }).cause;
  }
}
function tokenCount(value: unknown) { return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 10_000_000 ? value as number : undefined; }

/** One image edit using only a bounded task description and a trusted style reference. */
export async function generateSteelImage(prompt: string, reference: Uint8Array, signal: AbortSignal): Promise<SteelImageResult> {
  if (typeof prompt !== 'string' || !prompt.trim() || Buffer.byteLength(prompt, 'utf8') > MAX_PROMPT_BYTES || !(reference instanceof Uint8Array) || !reference.length || reference.length > MAX_REFERENCE_BYTES || !imageMime(reference)) throw new SteelImageGenerationError('input');
  const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(STEEL_IMAGE_TIMEOUT_MS)]);
  try {
    if (abortSignal.aborted) throw new SteelImageGenerationError('provider', categorizeAssistantFailure(null, signal.aborted ? { cancelled: true } : { timedOut: true }));
    const provider = createOpenAI({ fetch: boundedImageFetch });
    const result = await generateImage({
      model: provider.image(STEEL_IMAGE_MODEL), prompt: { text: prompt, images: [reference] },
      n: 1, maxImagesPerCall: 1, maxRetries: 0, size: '1024x768', abortSignal,
      providerOptions: { openai: { quality: 'medium', background: 'opaque', outputFormat: 'webp', outputCompression: 80 } },
    });
    if (result.images.length !== 1) throw new SteelImageGenerationError('invalid_image');
    const image = result.images[0];
    if (image.base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) throw new SteelImageGenerationError('output_limit');
    const bytes = image.uint8Array;
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new SteelImageGenerationError('output_limit');
    const mime = imageMime(bytes);
    if (!mime) throw new SteelImageGenerationError('invalid_image');
    const usage: SteelImageResult['usage'] = {};
    for (const key of ['inputTokens', 'outputTokens', 'totalTokens'] as const) {
      const count = tokenCount(result.usage[key]);
      if (count !== undefined) usage[key] = count;
    }
    return { bytes, mime, usage };
  } catch (error) {
    const known = ownFailure(error);
    if (known) throw known;
    throw new SteelImageGenerationError('provider', categorizeAssistantFailure(error, abortSignal.aborted ? signal.aborted ? { cancelled: true } : { timedOut: true } : { source: 'provider' }));
  }
}
