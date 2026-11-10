import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ requester: null as unknown }));
vi.mock("@/lib/assistant/requester", () => ({ getRequesterContext: async () => state.requester }));
vi.mock("@/lib/auth/login-guard", () => ({ ensureLoginAllowed: async () => ({ ok: true }), getClientIp: () => "synthetic", registerFailedLogin: vi.fn() }));
vi.mock("ai", async original => ({ ...await original<typeof import("ai")>(), streamText: vi.fn(() => { throw new Error("provider must not be called"); }) }));
import { streamText } from "ai";
import { prisma } from "@/lib/db/prisma";
import { seedSecurityTenants, removeSecurityTenants } from "../../../tests/security/fixtures";
import { hasAssistantAccess } from "./access";
import { POST as adminPost } from "@/app/api/assistant/route";
import { POST as workerPost } from "@/app/api/assistant/worker/route";

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
const ask = () => new Request("http://127.0.0.1:3100/api/assistant", { method: "POST", headers: { "content-type": "application/json", origin: "http://127.0.0.1:3100" }, body: JSON.stringify({ messages: [{ role: "user", content: "Sa orë punova sot?" }] }) });

beforeEach(async () => {
  tenants = await seedSecurityTenants();
  vi.stubEnv("OPENAI_API_KEY", "synthetic-never-sent"); vi.stubEnv("APP_BASE_URL", "http://127.0.0.1:3100");
  vi.mocked(streamText).mockClear();
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await removeSecurityTenants(tenants.map(t => t.company.id)); });

it("keeps open access for companies that do not limit the assistant", async () => {
  const t = tenants[0];
  expect(await hasAssistantAccess({ kind: "worker", workerId: t.worker.id, companyId: t.company.id })).toBe(true);
  expect(await hasAssistantAccess({ kind: "admin", adminId: t.admin.id, companyId: t.company.id })).toBe(true);
});

it("limits a company to the owner and the people the boss enabled", async () => {
  const [t, other] = tenants;
  await prisma.companyProfile.updateMany({ where: { id: { in: [t.company.id, other.company.id] } }, data: { assistantAccessSelected: true } });
  await prisma.user.update({ where: { id: t.admin.id }, data: { isOwner: false, assistantAccess: false } });
  expect(await hasAssistantAccess({ kind: "worker", workerId: t.worker.id, companyId: t.company.id })).toBe(false);
  expect(await hasAssistantAccess({ kind: "admin", adminId: t.admin.id, companyId: t.company.id })).toBe(false);

  await prisma.worker.update({ where: { id: t.worker.id }, data: { assistantAccess: true } });
  expect(await hasAssistantAccess({ kind: "worker", workerId: t.worker.id, companyId: t.company.id })).toBe(true);
  // A grant never carries over to another company.
  expect(await hasAssistantAccess({ kind: "worker", workerId: t.worker.id, companyId: other.company.id })).toBe(false);

  await prisma.user.update({ where: { id: t.admin.id }, data: { isOwner: true } });
  expect(await hasAssistantAccess({ kind: "admin", adminId: t.admin.id, companyId: t.company.id })).toBe(true);

  // A fixed name list leaves the owner no automatic pass.
  vi.stubEnv("ASSISTANT_ACCESS_ONLY", "Someone Else");
  expect(await hasAssistantAccess({ kind: "admin", adminId: t.admin.id, companyId: t.company.id })).toBe(false);
});

it("answers a person without access with the boss message, without calling the provider", async () => {
  const t = tenants[0];
  await prisma.companyProfile.update({ where: { id: t.company.id }, data: { assistantAccessSelected: true } });
  await prisma.user.update({ where: { id: t.admin.id }, data: { isOwner: false, assistantAccess: false } });

  state.requester = { kind: "worker", workerId: t.worker.id, companyId: t.company.id, displayName: "Synthetic", preferredLanguage: "SQ" };
  const worker = await workerPost(ask());
  expect(worker.status).toBe(200);
  expect(await worker.text()).toBe("Nuk keni akses në AI. Aksesin jua hap shefi.");

  state.requester = { kind: "admin", adminId: t.admin.id, companyId: t.company.id, displayName: "Synthetic", preferredLanguage: "SQ" };
  const admin = await adminPost(ask());
  expect(admin.status).toBe(200);
  expect(await admin.text()).toBe("Nuk keni akses në AI. Aksesin jua hap shefi.");
  expect(streamText).not.toHaveBeenCalled();
  expect(await prisma.assistantQuotaBucket.count({ where: { companyProfileId: t.company.id } })).toBe(0);
});
