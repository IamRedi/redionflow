import { beforeEach, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@ai-sdk/openai", async () => {
  const { MockLanguageModelV3 } = await import("ai/test");
  return { openai: () => new MockLanguageModelV3({ doStream: async () => {
    provider.calls++;
    return { stream: new ReadableStream({ start(controller) { controller.close(); } }), warnings: [] };
  } }) };
});
import { assistantGeneration } from "./generation";
beforeEach(() => { provider.calls = 0; });
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
  await expect(generation.model.doStream(options)).rejects.toThrow("limit");
  expect(provider.calls).toBe(0);
});
it("settles actual usage on completion; abort/error keep the reservation", async () => {
  const settle = vi.fn(async () => {});
  const generation = assistantGeneration(new Request("http://localhost"), "worker", settle);
  await generation.onFinish({ totalUsage: { totalTokens: 125 } });
  await generation.onAbort();
  expect(settle.mock.calls).toEqual([[125], []]);
});
