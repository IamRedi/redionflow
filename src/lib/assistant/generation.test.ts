import { afterEach, beforeEach, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@ai-sdk/openai", async () => {
  const { MockLanguageModelV3 } = await import("ai/test");
  return { openai: () => new MockLanguageModelV3({ doStream: async () => {
    provider.calls++;
    return { stream: new ReadableStream({ start(controller) { controller.close(); } }), warnings: [] };
  } }) };
});
import { assistantGeneration } from "./generation";
import { AssistantGenerationError } from './diagnostics';
beforeEach(() => { provider.calls = 0; });
afterEach(() => { vi.restoreAllMocks(); });
const options = { prompt: [{ role: "user" as const, content: [{ type: "text" as const, text: "Synthetic question" }] }], maxOutputTokens: 1_024 };
it("caps paid model steps and disables automatic provider retries", async () => {
  const generation = assistantGeneration(new Request("http://localhost"), "admin", vi.fn());
  expect(generation.maxRetries).toBe(0);
  for (let i = 0; i < 4; i++) await generation.model.doStream(options);
  await expect(generation.model.doStream(options)).rejects.toThrow("limit");
  expect(provider.calls).toBe(4);
});
it("checks the real prompt and tool schemas before a provider call", async () => {
  const generation = assistantGeneration(new Request("http://localhost"), "admin", vi.fn());
  await expect(generation.model.doStream({ ...options, prompt: [{ role: "system", content: "x".repeat(70_000) }] })).rejects.toThrow("limit");
  expect(provider.calls).toBe(0);
});
it("cancels before contacting the provider when the browser disconnects", async () => {
  const controller = new AbortController();
  const generation = assistantGeneration(new Request("http://localhost", { signal: controller.signal }), "worker", vi.fn());
  controller.abort();
  await expect(generation.model.doStream(options)).rejects.toMatchObject({ code: 'cancel' });
  expect(provider.calls).toBe(0);
});
it("settles actual usage on completion; abort/error keep the reservation", async () => {
  const settle = vi.fn(async () => {});
  const generation = assistantGeneration(new Request("http://localhost"), "worker", settle);
  await generation.onFinish({ totalUsage: { totalTokens: 125 } });
  await generation.onAbort();
  expect(settle.mock.calls).toEqual([[125], []]);
});
it('reports typed input and step limits without exposing any prompt', async () => {
  const onFailure = vi.fn(), onProviderCall = vi.fn();
  const generation = assistantGeneration(new Request('http://localhost'), 'admin', vi.fn(), { onFailure, onProviderCall });
  await expect(generation.model.doStream({ ...options, prompt: [{ role: 'system', content: 'PRIVATE_PROMPT'.repeat(6000) }] })).rejects.toBeInstanceOf(AssistantGenerationError);
  expect(onFailure.mock.calls[0][0]).toMatchObject({ code: 'input_payload', step: 0 });
  expect(JSON.stringify(onFailure.mock.calls)).not.toContain('PRIVATE_PROMPT');
  expect(onProviderCall).not.toHaveBeenCalled();
  for (let index = 0; index < 4; index += 1) await generation.model.doStream(options);
  await expect(generation.model.doStream(options)).rejects.toMatchObject({ code: 'step_limit' });
  expect(onProviderCall).toHaveBeenCalledTimes(4);
  expect(provider.calls).toBe(4);
});
it('distinguishes client cancellation and server timeout before any provider attempt', async () => {
  const client = new AbortController(), onFailure = vi.fn();
  const cancelled = assistantGeneration(new Request('http://localhost', { signal: client.signal }), 'admin', vi.fn(), { onFailure });
  client.abort();
  await expect(cancelled.model.doStream(options)).rejects.toMatchObject({ code: 'cancel' });
  const timeout = new AbortController();
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
  const timedOut = assistantGeneration(new Request('http://localhost'), 'admin', vi.fn(), { onFailure });
  timeout.abort();
  await expect(timedOut.model.doStream(options)).rejects.toMatchObject({ code: 'timeout' });
  expect(onFailure.mock.calls.map(([event]) => event.code)).toEqual(['cancel', 'timeout']);
  expect(provider.calls).toBe(0);
});
it('diagnostic-hook failure never changes generation or its cost/abort bounds', async () => {
  const generation = assistantGeneration(new Request('http://localhost'), 'worker', vi.fn(), { onProviderCall: () => { throw Error('private logging failure'); } });
  await expect(generation.model.doStream(options)).resolves.toBeDefined();
  expect(provider.calls).toBe(1);
  expect(generation.maxOutputTokens).toBe(1024);
  expect(generation.maxRetries).toBe(0);
});
