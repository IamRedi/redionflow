import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@ai-sdk/openai', async importOriginal => {
  const actual = await importOriginal<typeof import('@ai-sdk/openai')>();
  return { ...actual, openai: actual.createOpenAI({ apiKey: 'synthetic-not-a-real-key', fetch: (input, init) => state.fetch(input, init) }) };
});
vi.mock('@/lib/db/prisma', () => ({ prisma: new Proxy({}, { get() { throw Error('Database access forbidden in provider contract tests'); } }) }));
vi.mock('@/lib/db/tenant-context', () => ({ withTenantContext: () => { throw Error('Database access forbidden in provider contract tests'); } }));
import { createOpenAI } from '@ai-sdk/openai';
import { asSchema, generateText, stepCountIs, type ToolSet } from 'ai';
import { z } from 'zod';
import { createDocumentResolution } from './document-resolution';
import type { LanguageModelV3CallOptions } from '@ai-sdk/provider';
import { groundedTools } from './grounding';
import { assistantGeneration } from './generation';
import { legacyAssistantTools } from './legacy-tools';
import { companyAssistantTools, steelAssistantTools } from './business-tools';
import { assistantTurnContext } from './turn-context';
import { adminAssistantPrompt } from './admin-prompt';
import type { RequesterContext } from './requester';
import type { AssistantFailure } from './diagnostics';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('Real network access forbidden in provider contract tests'); }));
});
afterEach(() => { vi.unstubAllGlobals(); });

it('sends explicit non-strict function schemas through the real OpenAI adapter and executes omitted optional fields without nulls', async () => {
  const requests: Array<Record<string, unknown>> = [];
  state.fetch.mockImplementation(async (_input, init: RequestInit) => {
    requests.push(JSON.parse(init.body as string));
    return Response.json({ id: `response-demo-${requests.length}`, created_at: 1, model: 'gpt-4o-mini',
      output: requests.length === 1 ? [{ type: 'function_call', id: 'function-demo', call_id: 'call-demo', name: 'readOptional', arguments: '{}' }]
        : [{ type: 'message', id: 'message-demo', role: 'assistant', content: [{ type: 'output_text', text: 'Two projects.', annotations: [] }] }],
      usage: { input_tokens: 20, output_tokens: 10 },
    });
  });
  const execute = vi.fn(async (_input: unknown) => ({ ok: true, total: 2 }));
  const tools = groundedTools({ readOptional: { description: 'Synthetic read', inputSchema: z.object({ query: z.string().optional() }), execute } }, 'Europe/Tirane');
  const provider = createOpenAI({ apiKey: 'synthetic-not-a-real-key', fetch: (input, init) => state.fetch(input, init) });
  const result = await generateText({ model: provider('gpt-4o-mini'), tools, prompt: 'How many projects?', maxRetries: 0, stopWhen: stepCountIs(2), prepareStep: ({ stepNumber }) => ({ toolChoice: stepNumber === 0 ? { type: 'tool', toolName: 'readOptional' } : 'none' }) });
  expect(result.text).toBe('Two projects.');
  expect(execute).toHaveBeenCalledOnce();
  expect(execute.mock.calls[0][0]).toEqual({});
  const wire = (requests[0].tools as Array<{ strict: boolean; parameters: { required?: string[]; properties: { query: { type: string } } } }>)[0];
  expect(wire.strict).toBe(false);
  expect(wire.parameters.required ?? []).not.toContain('query');
  expect(wire.parameters.properties.query.type).toBe('string');
  expect(requests[0].model).toBe('gpt-4o-mini');
});

it('measures real steel registries and enforces the existing accumulated-input limit before contacting a provider', async () => {
  state.fetch.mockImplementation(async () => new Response('data: {"type":"response.created","response":{"id":"response-demo","created_at":1,"model":"gpt-4o-mini"}}\n\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":20,"output_tokens":1}}}\n\n', { headers: { 'content-type': 'text/event-stream' } }));
  const requester: RequesterContext = { kind: 'admin', adminId: 'admin-demo', companyId: 'company-demo', displayName: 'Admin Demo', preferredLanguage: 'SQ', timeZone: 'Europe/Tirane' };
  const question = 'Sa materiale ka bërë fabrika dje?';
  const turn = assistantTurnContext([{ role: 'user', content: question }], { timeZone: 'Europe/Tirane', now: new Date('2026-11-05T10:00Z') });
  const registry: ToolSet = { ...legacyAssistantTools(requester, turn, true), ...companyAssistantTools(requester, true), ...steelAssistantTools(requester, turn, createDocumentResolution()) };
  expect(registry).toHaveProperty('adminSearchCompanyAssets');
  expect(registry).toHaveProperty('adminGetCompanyWorkshop');
  expect(registry).toHaveProperty('adminGetSitePhaseDocuments');
  expect(registry).toHaveProperty('adminGetSitePhaseDocumentReceipts');
  delete registry.getAssistantCapabilities;
  const tools = groundedTools(registry, turn.timeZone);
  const wireTools = await Promise.all(Object.entries(tools).map(async ([name, tool]) => ({ type: 'function' as const, name, description: tool.description, inputSchema: await asSchema(tool.inputSchema).jsonSchema, strict: tool.strict })));
  const prompt: LanguageModelV3CallOptions['prompt'] = [{ role: 'system', content: adminAssistantPrompt({ requester, turn, steel: true, target: null }) }, { role: 'user', content: [{ type: 'text', text: question }] }];
  const bytes = (input: LanguageModelV3CallOptions['prompt']) => Buffer.byteLength(JSON.stringify({ prompt: input, tools: wireTools }), 'utf8') + 4096 + input.length * 64;
  const initialBytes = bytes(prompt);
  const historyPrompt = [...prompt.slice(0, 1), { role: 'assistant' as const, content: [{ type: 'text' as const, text: 'x'.repeat(12_000) }] }, ...prompt.slice(1)];
  const resultMessage = (index: number, size: number) => [
    { role: 'assistant' as const, content: [{ type: 'tool-call' as const, toolCallId: `demo-${index}`, toolName: 'adminGetSteelProductionSummary', input: {} }] },
    { role: 'tool' as const, content: [{ type: 'tool-result' as const, toolCallId: `demo-${index}`, toolName: 'adminGetSteelProductionSummary', output: { type: 'json' as const, value: { ok: true, rows: 'x'.repeat(size) } } }] },
  ];
  const typicalPrompt = [...historyPrompt, ...resultMessage(1, 12 * 1024)];
  const oversized = [...historyPrompt, ...resultMessage(1, 24 * 1024), ...resultMessage(2, 24 * 1024)];
  const calls: Array<{ step: number; inputBytes: number }> = [], failures: AssistantFailure[] = [];
  const generation = assistantGeneration(new Request('http://localhost'), 'admin', vi.fn(), { onProviderCall: event => { calls.push(event); }, onFailure: event => { failures.push(event); } });
  const streamed = await generation.model.doStream({ prompt, tools: wireTools, toolChoice: { type: 'required' }, maxOutputTokens: 1024 });
  await streamed.stream.pipeTo(new WritableStream({ write() {} }));
  expect(calls[0].inputBytes).toBe(initialBytes);
  expect(initialBytes).toBeLessThanOrEqual(65_536);
  expect(bytes(historyPrompt)).toBeLessThanOrEqual(65_536);
  expect(bytes(typicalPrompt)).toBeLessThanOrEqual(65_536);
  expect(wireTools.every(tool => tool.strict === false)).toBe(true);
  const followUp = await generation.model.doStream({ prompt: typicalPrompt, tools: wireTools, toolChoice: { type: 'auto' }, maxOutputTokens: 1024 });
  await followUp.stream.pipeTo(new WritableStream({ write() {} }));
  expect(calls[1].inputBytes).toBe(bytes(typicalPrompt));
  await expect(generation.model.doStream({ prompt: oversized, tools: wireTools, maxOutputTokens: 1024 })).rejects.toMatchObject({ code: 'input_payload' });
  expect(state.fetch).toHaveBeenCalledTimes(2);
  expect(failures.at(-1)).toMatchObject({ code: 'input_payload', inputBytes: bytes(oversized) });
  process.stdout.write(`ASSISTANT_INPUT_BYTES ${JSON.stringify({ tools: wireTools.length, initial: initialBytes, history12000: bytes(historyPrompt), historyAnd12KiBResult: bytes(typicalPrompt), historyAndTwo24KiBResults: bytes(oversized), limit: 65_536 })}\n`);
});
