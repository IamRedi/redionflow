import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@ai-sdk/openai', async importOriginal => {
  const actual = await importOriginal<typeof import('@ai-sdk/openai')>();
  return { ...actual, openai: actual.createOpenAI({
    apiKey: 'synthetic-not-a-real-key',
    fetch: (input, init) => boundary.fetch(input, init),
  }) };
});

import { Output, streamText } from 'ai';
import { assistantGeneration } from '@/lib/assistant/generation';
import { parseSteelScene, steelSceneGenerationSchema, steelScenePrompt } from './visual';

const scene = { v: 1, shapes: [
  { type: 'rect', x: 20, y: 60, width: 100, height: 20, color: 'orange', radius: 0 },
  { type: 'circle', x: 70, y: 110, radius: 8, color: 'dark' },
  { type: 'line', from: [40, 100], to: [120, 40], width: 3, color: 'steel' },
  { type: 'polygon', points: [[150, 40], [190, 90], [120, 90]], color: 'light' },
] };
type WireRequest = { model: string; max_output_tokens: number; text?: { format?: { type: string; strict: boolean; schema: unknown } } };

function response(text: string, incomplete = false) {
  const chunks = [
    { type: 'response.created', response: { id: 'response-fixture', created_at: 1, model: 'gpt-4o-mini' } },
    { type: 'response.output_item.added', output_index: 0, item: { type: 'message', id: 'message-fixture', role: 'assistant', content: [] } },
    { type: 'response.output_text.delta', item_id: 'message-fixture', delta: text },
    { type: 'response.output_item.done', output_index: 0, item: { type: 'message', id: 'message-fixture', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] } },
    { type: incomplete ? 'response.incomplete' : 'response.completed', response: {
      ...(incomplete ? { incomplete_details: { reason: 'max_output_tokens' } } : {}),
      usage: { input_tokens: 20, output_tokens: 20 },
    } },
  ];
  return new Response(chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
}

/** Audit the actual adapter wire schema, not a hand-written JSON schema fixture. */
function expectStrictProviderSchema(node: unknown) {
  if (Array.isArray(node)) { node.forEach(expectStrictProviderSchema); return; }
  if (!node || typeof node !== 'object') return;
  const object = node as Record<string, unknown>;
  expect(object.oneOf).toBeUndefined();
  expect(object.prefixItems).toBeUndefined();
  if (object.type === 'object') {
    expect(object.additionalProperties).toBe(false);
    expect(new Set(object.required as string[])).toEqual(new Set(Object.keys(object.properties as object)));
  }
  if (object.type === 'array') {
    expect(object.items).toBeTypeOf('object');
    expect(Array.isArray(object.items)).toBe(false);
  }
  Object.values(object).forEach(expectStrictProviderSchema);
}

function generation() {
  const settle = vi.fn(async (_tokens?: number) => {});
  const options = assistantGeneration(new Request('https://fixture.invalid/steel-scene'), 'worker', settle);
  const result = streamText({ ...options, temperature: 0,
    output: Output.object({ schema: steelSceneGenerationSchema }),
    system: steelScenePrompt,
    prompt: JSON.stringify({ label: 'Fictional support frame', kind: 'factory', description: 'Join the supports' }),
  });
  return { options, result, settle };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('Real network forbidden in steel provider tests'); }));
});
afterEach(() => { vi.unstubAllGlobals(); });

it('sends a strict supported schema through the real OpenAI adapter within the existing one-call budget', async () => {
  const requests: WireRequest[] = [];
  boundary.fetch.mockImplementation(async (_input, init: RequestInit) => {
    requests.push(JSON.parse(init.body as string));
    return response(JSON.stringify(scene));
  });
  const { options, result, settle } = generation();
  const parts = [];
  for await (const part of result.fullStream) parts.push(part);
  expect(await result.output).toEqual(scene);
  expect(parseSteelScene(await result.output)).toEqual(scene);
  expect(parts.filter(part => part.type === 'finish')).toMatchObject([{ finishReason: 'stop' }]);
  expect(parts.filter(part => part.type === 'text-delta').map(part => part.text).join('')).toBe(JSON.stringify(scene));
  expect(boundary.fetch).toHaveBeenCalledOnce();
  expect(requests[0]).toMatchObject({ model: 'gpt-4o-mini', max_output_tokens: 1024, text: { format: { type: 'json_schema', strict: true } } });
  expectStrictProviderSchema(requests[0].text!.format!.schema);
  expect(options.maxRetries).toBe(0);
  expect(settle).toHaveBeenCalledExactlyOnceWith(40);
});

it('keeps existing stored rectangles without radius compatible while generation requires radius', () => {
  const legacy = { v: 1, shapes: [{ type: 'rect', x: 20, y: 60, width: 100, height: 20, color: 'orange' }] };
  expect(parseSteelScene(legacy)).toEqual(legacy);
  expect(steelSceneGenerationSchema.safeParse(legacy).success).toBe(false);
  expect(steelSceneGenerationSchema.safeParse(scene).success).toBe(true);
});

it('exposes provider truncation and rejects incomplete structured data without another model call', async () => {
  boundary.fetch.mockImplementation(async () => response('{"v":1,"shapes":[', true));
  const { result } = generation();
  // Attach before consuming: a structured-output rejection must not go unhandled.
  const output = Promise.resolve(result.output).then(() => true, () => false);
  const parts = [];
  for await (const part of result.fullStream) parts.push(part);
  expect(await output).toBe(false);
  expect(parts.filter(part => part.type === 'finish')).toMatchObject([{ finishReason: 'length' }]);
  expect(boundary.fetch).toHaveBeenCalledOnce();
});

it('does not retry a real adapter HTTP failure or settle it as completed token usage', async () => {
  boundary.fetch.mockImplementation(async () => Response.json({ error: { type: 'server_error', message: 'Synthetic unavailable provider' } }, { status: 503 }));
  const { result, settle } = generation();
  const output = Promise.resolve(result.output).then(() => true, () => false);
  const parts = [];
  for await (const part of result.fullStream) parts.push(part);
  expect(await output).toBe(false);
  expect(parts.some(part => part.type === 'error')).toBe(true);
  expect(boundary.fetch).toHaveBeenCalledOnce();
  expect(settle).toHaveBeenCalledExactlyOnceWith();
});
