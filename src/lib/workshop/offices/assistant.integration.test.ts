import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const jar = vi.hoisted(() => ({ value: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => key === "bdf_demo_office" && jar.value ? { value: jar.value } : undefined }) }));
import { createSessionCookie } from "@/lib/auth/session-cookie";
import { prisma } from "@/lib/db/prisma";
import { askOfficeAssistant, generateOfficeAnswer, OFFICE_AI_MODEL } from "./assistant";
import { officeSnapshot, OFFICE_WORKSPACE_KEY, readOfficeState } from "./store";
const fixture = (() => { try { const u = new URL(process.env.DATABASE_URL ?? ""); return u.protocol === "postgresql:" && ["127.0.0.1", "localhost"].includes(u.hostname) && u.port === "55435" && u.pathname === "/baumdemo_test"; } catch { return false; } })();
describe.runIf(fixture)("office AI against the dedicated synthetic database; provider is mocked", () => {
  beforeAll(async () => { const companies = await prisma.companyProfile.findMany({ select: { displayName: true, mode: true } }); expect(companies).toEqual([{ displayName: "Baumdienst Musterstadt GmbH", mode: "baumdienst" }]); });
  beforeEach(async () => { vi.stubEnv("BAUMDIENST_OFFICE_AI_ENABLED", "true"); vi.stubEnv("BAUMDIENST_IMAGE_OPENAI_API_KEY", "fixture-key-not-a-secret"); await prisma.baumdienstDemoWorkspace.deleteMany({ where: { key: OFFICE_WORKSPACE_KEY } }); jar.value = await createSessionCookie("display", "bdf-office:manager", 0); });
  afterEach(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await prisma.baumdienstDemoWorkspace.deleteMany({ where: { key: OFFICE_WORKSPACE_KEY } }); });
  const reply = () => new Response(JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: "Fictional role-scoped answer. No action performed." }] }] }), { headers: { "content-type": "application/json" } });
  it("reserves20 shared daily attempts durably, including failures, and never calls the provider after exhaustion", async () => {
    const fetcher = vi.fn(async () => reply()); vi.stubGlobal("fetch", fetcher);
    for (let i = 0; i < 20; i++) { const { revision } = await readOfficeState(); await askOfficeAssistant({ requestId: randomUUID(), revision, message: "Summarize the fictional office context.", lang: "en" }); }
    expect(fetcher).toHaveBeenCalledTimes(20);
    jar.value = await createSessionCookie("display", "bdf-office:finance", 0);
    const { revision } = await readOfficeState(); await expect(askOfficeAssistant({ requestId: randomUUID(), revision, message: "Another role", lang: "en" })).rejects.toMatchObject({ code: "aiQuota", status: 429 });
    expect(fetcher).toHaveBeenCalledTimes(20); expect((await officeSnapshot()).ai).toMatchObject({ used: 20, limit: 20 });
  }, 30000);
  it("replays a confirmed UUID without another charge and denies changed payload or another office's private turn", async () => {
    const fetcher = vi.fn(async () => reply()); vi.stubGlobal("fetch", fetcher);
    const input = { requestId: randomUUID(), revision: 0, message: "Private manager turn", lang: "en" as const };
    const first = await askOfficeAssistant(input); expect((await askOfficeAssistant(input)).answer).toBe(first.answer); expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(askOfficeAssistant({ ...input, message: "Changed content" })).rejects.toMatchObject({ status: 409 });
    jar.value = await createSessionCookie("display", "bdf-office:operations", 0);
    expect((await officeSnapshot()).turns).toEqual([]); expect((await officeSnapshot()).workers).toEqual([]);
    await expect(askOfficeAssistant(input)).rejects.toMatchObject({ status: 409 }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("counts an unconfirmed provider failure once, does not retry it, and sends bounded fixed-model read-only requests", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(url).toBe("https://api.openai.com/v1/responses"); expect(init?.redirect).toBe("error");
      const payload = JSON.parse(String(init?.body)); expect(payload).toMatchObject({ model: OFFICE_AI_MODEL, max_output_tokens: 700, store: false, reasoning: { effort: "none" } }); expect(payload.tools).toBeUndefined();
      return new Response("{}", { status: 503, headers: { "content-type": "application/json" } });
    }); vi.stubGlobal("fetch", fetcher);
    const input = { requestId: randomUUID(), revision: 0, message: "Fictional request", lang: "en" as const };
    await expect(askOfficeAssistant(input)).rejects.toMatchObject({ code: "aiUnavailable" });
    await expect(askOfficeAssistant(input)).rejects.toMatchObject({ code: "aiFailed" });
    expect(fetcher).toHaveBeenCalledTimes(1); const s = await readOfficeState(); expect(s.state.turns).toHaveLength(1); expect(s.state.turns[0].status).toBe("error");
  });
  it("never falls back to another model on malformed output or unsupported provider access", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: "incomplete", output: [] }), { headers: { "content-type": "application/json" } })); vi.stubGlobal("fetch", fetcher);
    await expect(generateOfficeAnswer("Fictional system", "Fictional question")).rejects.toMatchObject({ code: "aiFailed" }); expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(generateOfficeAnswer("Fictional system", "x".repeat(33000))).rejects.toMatchObject({ status: 413 }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("serializes an overlapping retry to one reserved turn and one provider call", async () => {
    let release: () => void = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
    const fetcher = vi.fn(async () => { await gate; return reply(); }); vi.stubGlobal("fetch", fetcher);
    const input = { requestId: randomUUID(), revision: 0, message: "One fictional request", lang: "en" as const };
    const first = askOfficeAssistant(input);
    try { await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1)); await expect(askOfficeAssistant(input)).rejects.toMatchObject({ code: "busy", status: 409 }); }
    finally { release(); }
    await first; expect(fetcher).toHaveBeenCalledTimes(1); expect((await readOfficeState()).state.turns).toHaveLength(1);
  });
});
