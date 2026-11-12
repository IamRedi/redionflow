import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { generateSteelImage, STEEL_IMAGE_MODEL, STEEL_IMAGE_TIMEOUT_MS, SteelImageGenerationError } from './image-generation';

const reference = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'));
const prompt = 'Draw a fictional steel support connection in the reference style.';
let raster: Uint8Array;
const network = vi.fn<typeof fetch>();
const signal = () => new AbortController().signal;
function response(images: string[] = [Buffer.from(raster).toString('base64')]) {
  return Response.json({ data: images.map(b64_json => ({ b64_json, revised_prompt: 'PRIVATE_PROVIDER_TEXT' })), usage: { input_tokens: 12, output_tokens: 34, total_tokens: 46 } });
}
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-image-test-key-never-sent');
  vi.stubGlobal('fetch', network);
  raster = new Uint8Array(await sharp({ create: { width: 4, height: 3, channels: 4, background: { r: 249, g: 115, b: 22, alpha: 1 } } }).webp().toBuffer());
  network.mockImplementation(async () => response());
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('uses the actual installed image edit adapter with one reference, fixed model/options and safe usage only', async () => {
  const result = await generateSteelImage(prompt, reference, signal());
  expect(result).toEqual({ bytes: raster, mime: 'image/webp', usage: { inputTokens: 12, outputTokens: 34, totalTokens: 46 } });
  expect(network).toHaveBeenCalledOnce();
  const [url, init] = network.mock.calls[0];
  expect(new URL(String(url)).pathname).toBe('/v1/images/edits');
  expect(init?.redirect).toBe('error');
  const form = init?.body as FormData;
  expect(form.get('model')).toBe(STEEL_IMAGE_MODEL);
  expect(form.get('prompt')).toBe(prompt);
  expect(form.get('n')).toBe('1');
  expect(form.get('size')).toBe('1024x768');
  expect(form.get('quality')).toBe('medium');
  expect(form.get('background')).toBe('opaque');
  expect(form.get('output_format')).toBe('webp');
  expect(form.get('output_compression')).toBe('80');
  const images = [...form.entries()].filter(([key]) => key.startsWith('image'));
  expect(images).toHaveLength(1);
  expect(new Uint8Array(await (images[0][1] as File).arrayBuffer())).toEqual(reference);
  expect(JSON.stringify(result)).not.toContain('PRIVATE_PROVIDER_TEXT');
});

it.each([
  ['empty prompt', '', reference], ['UTF8 prompt over8KiB', 'ç'.repeat(4_097), reference],
  ['oversized reference', prompt, new Uint8Array(200_001)], ['SVG reference', prompt, new TextEncoder().encode('<svg/>')],
])('rejects %s before contacting the provider', async (_name, text, image) => {
  await expect(generateSteelImage(text, image, signal())).rejects.toMatchObject({ code: 'input' });
  expect(network).not.toHaveBeenCalled();
});

it('does not retry HTTP errors and exposes no raw provider details', async () => {
  network.mockImplementation(async () => Response.json({ error: { type: 'server_error', message: 'PRIVATE_ERROR_TEXT' } }, { status: 503 }));
  const error = await generateSteelImage(prompt, reference, signal()).catch(error => error);
  expect(error).toBeInstanceOf(SteelImageGenerationError);
  expect(error).toMatchObject({ code: 'provider', failure: { code: 'provider_unavailable', httpStatus: 503 } });
  expect(JSON.stringify(error)).not.toContain('PRIVATE_ERROR_TEXT');
  expect(error.message).not.toContain(prompt);
  expect(network).toHaveBeenCalledOnce();
});

it('does not retry empty responses or accept multiple images/executable output', async () => {
  for (const images of [[], ['PHN2Zy8+'], [Buffer.from(raster).toString('base64'), Buffer.from(raster).toString('base64')]]) {
    network.mockClear(); network.mockImplementation(async () => response(images));
    await expect(generateSteelImage(prompt, reference, signal())).rejects.toBeInstanceOf(SteelImageGenerationError);
    expect(network).toHaveBeenCalledOnce();
  }
});

it('bounds provider response bytes before parsing or base64 decoding, with or without content-length', async () => {
  network.mockImplementation(async () => new Response('{}', { headers: { 'content-length': '20000000' } }));
  await expect(generateSteelImage(prompt, reference, signal())).rejects.toMatchObject({ code: 'output_limit' });
  network.mockImplementation(async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(16_065_537)); controller.close(); } })));
  await expect(generateSteelImage(prompt, reference, signal())).rejects.toMatchObject({ code: 'output_limit' });
  expect(network).toHaveBeenCalledTimes(2);
});

it('rejects decoded-image size above12MB even when the response envelope fits', async () => {
  network.mockImplementation(async () => response(['A'.repeat(16_000_004)]));
  await expect(generateSteelImage(prompt, reference, signal())).rejects.toMatchObject({ code: 'output_limit' });
  expect(network).toHaveBeenCalledOnce();
});

it('never calls the provider after client cancellation and distinguishes the120-second deadline', async () => {
  const cancelled = new AbortController(); cancelled.abort();
  await expect(generateSteelImage(prompt, reference, cancelled.signal)).rejects.toMatchObject({ failure: { code: 'cancel' } });
  expect(network).not.toHaveBeenCalled();
  const deadline = new AbortController();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
  network.mockImplementation(async (_url, options) => new Promise((_resolve, reject) => { options?.signal?.addEventListener('abort', () => reject(new DOMException('PRIVATE_ABORT_TEXT', 'AbortError')), { once: true }); }));
  const pending = generateSteelImage(prompt, reference, signal());
  const failure = expect(pending).rejects.toMatchObject({ failure: { code: 'timeout' } });
  await vi.waitFor(() => expect(network).toHaveBeenCalledOnce());
  deadline.abort();
  await failure;
  expect(timeout).toHaveBeenCalledWith(STEEL_IMAGE_TIMEOUT_MS);
});
