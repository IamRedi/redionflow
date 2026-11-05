import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ companyId: "", requester: null as unknown }));
vi.mock("@/lib/db/tenant", async original => ({ ...await original<typeof import("@/lib/db/tenant")>(), getCurrentCompanyId: async () => state.companyId || null }));
vi.mock("@/lib/assistant/requester", () => ({ getRequesterContext: async () => state.requester }));
vi.mock("@/lib/auth/login-guard", () => ({ ensureLoginAllowed: async () => ({ ok: true }), getClientIp: () => "synthetic", registerFailedLogin: vi.fn() }));
vi.mock("ai", async original => ({ ...await original<typeof import("ai")>(), streamText: vi.fn((options: { onFinish?: (event: { finishReason: string; totalUsage: { totalTokens: number } }) => Promise<void> }) => ({
  toTextStreamResponse: () => new Response("Synthetic answer"),
  fullStream: (async function* () {
    yield { type: 'start-step' }; yield { type: 'text-delta', text: 'Synthetic answer' };
    yield { type: 'finish-step', finishReason: 'stop' };
    await options.onFinish?.({ finishReason: 'stop', totalUsage: { totalTokens: 50 } });
    yield { type: 'finish', finishReason: 'stop' };
  })(),
})) }));
import { streamText } from "ai";
import { prisma } from "@/lib/db/prisma";
import { seedSecurityTenants, removeSecurityTenants } from "../../../tests/security/fixtures";
import type { RequesterContext } from "./requester";
import { reserveAssistantQuota } from "./quota";
import { POST as adminPost } from "@/app/api/assistant/route";
import { POST as workerPost } from "@/app/api/assistant/worker/route";
let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
const now = new Date("2026-11-03T12:00:00Z");
function identity(index = 0, kind: "admin" | "worker" = "worker"): Exclude<RequesterContext, { kind: "anonymous" }> {
  const t = tenants[index];
  return { companyId: t.company.id, displayName: "Synthetic", preferredLanguage: "SQ", ...(kind === "admin" ? { kind, adminId: t.admin.id } : { kind, workerId: t.worker.id }) };
}
beforeEach(async () => {
  tenants = await seedSecurityTenants(); state.companyId = tenants[0].company.id; state.requester = identity();
  vi.stubEnv("OPENAI_API_KEY", "synthetic-never-sent"); vi.stubEnv("APP_BASE_URL", "http://127.0.0.1:3100");
  vi.mocked(streamText).mockClear();
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await removeSecurityTenants(tenants.map(t => t.company.id)); });
it("every valid request consumes quota, including simultaneous requests", async () => {
  const results = await Promise.all(Array.from({ length: 12 }, () => reserveAssistantQuota(identity(), now)));
  expect(results.filter(r => r.ok)).toHaveLength(6);
  expect(results.filter(r => !r.ok).every(r => !r.ok && r.status === 429)).toBe(true);
  const day = await prisma.assistantQuotaBucket.findFirstOrThrow({ where: { companyProfileId: state.companyId, actorKey: "company", window: "day" } });
  expect(day.requests).toBe(6);
});
it("invalid quota configuration fails closed without a provider call or charge", async () => {
  vi.stubEnv("ASSISTANT_USER_BURST_REQUESTS", "0"); state.requester = identity(0, "admin");
  const response = await adminPost(new Request("http://127.0.0.1:3100/api/assistant", { method: "POST", headers: { origin: "http://127.0.0.1:3100", "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }) }));
  expect(response.status).toBe(503); expect(streamText).not.toHaveBeenCalled();
  expect(await prisma.assistantQuotaBucket.count({ where: { companyProfileId: state.companyId } })).toBe(0);
});
it("shares the company ceiling across roles and keeps another tenant independent", async () => {
  vi.stubEnv("ASSISTANT_COMPANY_BURST_REQUESTS", "2");
  expect((await reserveAssistantQuota(identity(), now)).ok).toBe(true);
  expect((await reserveAssistantQuota(identity(0, "admin"), now)).ok).toBe(true);
  expect(await reserveAssistantQuota(identity(), now)).toMatchObject({ ok: false, status: 429 });
  state.companyId = tenants[1].company.id;
  expect((await reserveAssistantQuota(identity(1), now)).ok).toBe(true);
});
it("reserves token budget before spending, refunds actual usage only once", async () => {
  vi.stubEnv("ASSISTANT_COMPANY_DAILY_TOKENS", "70000");
  const first = await reserveAssistantQuota(identity(), now); expect(first.ok).toBe(true);
  expect(await reserveAssistantQuota(identity(), now)).toMatchObject({ ok: false, reason: "budget" });
  if (!first.ok) throw new Error("Expected reservation");
  await first.settle(100); await first.settle(0);
  const day = await prisma.assistantQuotaBucket.findFirstOrThrow({ where: { companyProfileId: state.companyId, actorKey: "company", window: "day" } });
  expect(day.tokens).toBe(100);
  const second = await reserveAssistantQuota(identity(), now); expect(second.ok).toBe(true);
  if (second.ok) await second.settle();
  expect(await reserveAssistantQuota(identity(), now)).toMatchObject({ ok: false, reason: "budget" });
});
it("rejects a forged tenant and resets daily allowance on the next UTC day", async () => {
  expect(await reserveAssistantQuota(identity(1), now)).toMatchObject({ ok: false, status: 403 });
  vi.stubEnv("ASSISTANT_USER_DAILY_REQUESTS", "1");
  const first = await reserveAssistantQuota(identity(), now); if (first.ok) await first.settle(100);
  expect(await reserveAssistantQuota(identity(), new Date(now.getTime() + 600_000))).toMatchObject({ ok: false, reason: "budget" });
  expect((await reserveAssistantQuota(identity(), new Date(now.getTime() + 86_400_000))).ok).toBe(true);
});
for (const kind of ["admin", "worker"] as const) it(`${kind} route blocks valid repeated requests before any paid generation`, async () => {
  state.requester = identity(0, kind); vi.stubEnv("ASSISTANT_USER_BURST_REQUESTS", "1");
  const post = kind === "admin" ? adminPost : workerPost;
  const request = () => new Request("http://127.0.0.1:3100/api/assistant", { method: "POST", headers: { origin: "http://127.0.0.1:3100", "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }) });
  const first = await post(request()); expect(first.status).toBe(200);
  expect(await first.text()).toBe('Synthetic answer');
  const blocked = await post(request()); expect(blocked.status).toBe(429); expect(blocked.headers.get("retry-after")).toBeTruthy();
  expect(streamText).toHaveBeenCalledTimes(1);
  expect(await prisma.worker.count({ where: { companyProfileId: state.companyId } })).toBe(1);
  if (kind === 'admin') {
    const runs = await prisma.assistantRun.findMany({ where: { companyProfileId: state.companyId }, orderBy: { startedAt: 'asc' } });
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ status: 'completed', answer: 'Synthetic answer', totalTokens: 50 });
    expect(runs[1]).toMatchObject({ status: 'rejected', errorCode: 'QUOTA_REJECTED', httpStatus: 429 });
  }
});
