import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { pendingTransport } from "../../../tests/storage/pending-transport";
const request = vi.hoisted(() => ({ values: new Map<string, string>(), notify: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => request.values.has(name) ? { value: request.values.get(name) } : undefined }) }));
vi.mock("@/lib/notifications/sendNotification", () => ({ sendNotification: request.notify }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/realtime/event-hub", () => ({ notifyRealtimeUpdate: vi.fn() }));
import { saveDailyPlanAction } from "@/app/(workzone)/workzone/daily-plan-actions";
import { dayRange } from "@/lib/workzone/date-utils";
import { prisma } from "./prisma";
import { seedSecurityTenants, removeSecurityTenants, createTestSession } from "../../../tests/security/fixtures";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { authenticateWorkerByCode } from "@/lib/auth/authenticate-worker";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { updateWorkerAction, revokeWorkerLoginCredentialAction } from "@/app/(admin)/app/admin/worker-admin-actions";
let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
let workerCookie: string;
let provider: ReturnType<typeof pendingTransport>;
let importAction: typeof import("@/app/(admin)/app/baustellen/import/actions").importProjectData;
beforeEach(async () => {
  vi.stubEnv("SESSION_SIGNING_SECRET", "synthetic-owner-remediation-signing-key-only");
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:1");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-key-only");
  vi.stubEnv("CONTENT_SCANNER", "none");
  provider = pendingTransport(); vi.stubGlobal("fetch", provider.fetcher);
  importAction = (await import("@/app/(admin)/app/baustellen/import/actions")).importProjectData;
  tenants = await seedSecurityTenants(); request.values.clear();
  request.values.set("bk_admin_id", await createTestSession("admin", tenants[0].admin.id));
});
afterEach(async () => {
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  await removeSecurityTenants(tenants.map(t => t.company.id));
  vi.unstubAllEnvs();
});
function form(values: Record<string, string>) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }
function importForm(reuse = false) {
  const data = form({ lang: "en", targetName: "Owner atomic import" });
  data.set("dataFile", new File([new Uint8Array(readFileSync("tests/fixtures/spreadsheets/trees.csv"))], "trees.csv", { type: "text/csv" }));
  if (reuse) data.set("targetBaustelleId", tenants[0].site.id);
  return data;
}
async function snapshot() {
  const sites = await prisma.baustelle.findMany({ where: { companyProfileId: { in: tenants.map(t => t.company.id) } }, orderBy: { id: "asc" } });
  const trees = await prisma.treeItem.findMany({ where: { baustelleId: { in: sites.map(s => s.id) } }, orderBy: { id: "asc" } });
  return { sites, trees, objects: [...provider.objects.entries()].sort() };
}
it("OR-02 upload failure leaves DB and managed storage exactly unchanged", async () => {
  const before = await snapshot(); provider.failures.upload = true;
  expect(await importAction(importForm())).toMatchObject({ ok: false });
  expect(await snapshot()).toEqual(before);
});
it.each(["site", "insert", "update", "document"])("OR-02 %s failure rolls back real PostgreSQL and cleans uploads", async failure => {
  const reuse = failure === "update";
  if (reuse) await prisma.treeItem.update({ where: { id: tenants[0].tree.id }, data: { treeId: "001" } });
  const before = await snapshot(); let injected = false;
  const original = prisma.$transaction.bind(prisma);
  vi.spyOn(prisma, "$transaction").mockImplementation((async (callback: (tx: unknown) => Promise<unknown>, options: unknown) =>
    original(async tx => {
      const delegate = failure === "site" || failure === "document" ? tx.baustelle : tx.treeItem;
      const method = failure === "site" || failure === "insert" ? "create" : "update";
      const real = delegate[method].bind(delegate) as unknown as (args: unknown) => Promise<unknown>;
      vi.spyOn(delegate, method).mockImplementation((async (args: never) => {
        const value = await real(args); injected = true; throw new Error(`synthetic ${failure} failure after DB write: ${Boolean(value)}`);
      }) as never);
      return callback(tx);
    }, options as never)) as never);
  expect(await importAction(importForm(reuse))).toMatchObject({ ok: false });
  expect(injected).toBe(true);
  expect(await snapshot()).toEqual(before);
});
it("OR-02 successful import commits site, trees and references together and removes the journal", async () => {
  const result = await importAction(importForm()); expect(result).toMatchObject({ ok: true, importedCount: 2 });
  if (!result.ok) throw new Error(result.message);
  const site = await prisma.baustelle.findUniqueOrThrow({ where: { id: result.baustelleId }, include: { treeItems: true } });
  expect(site.documents).toHaveLength(1); expect(site.treeItems).toHaveLength(2);
  expect(provider.objects.size).toBe(1); expect([...provider.objects.keys()].some(k => k.includes("pending-imports"))).toBe(false);
});
async function workerCredential() {
  const worker = await prisma.worker.update({ where: { id: tenants[0].worker.id }, data: { loginCodeHash: hashPassword("739182"), status: "active" } });
  workerCookie = await createTestSession("worker", worker.id);
  return worker;
}
function profile(loginCode = "") { return form({ id: tenants[0].worker.id, firstName: "Changed", lastName: "Synthetic", loginCode, status: "active", phone: "synthetic" }); }
it.each(["blank", "unrelated"])("OR-03 %s profile edit preserves credential, authentication and existing session", async kind => {
  const before = await workerCredential(); const data = profile();
  if (kind === "unrelated") data.delete("loginCode");
  await updateWorkerAction(data);
  const after = await prisma.worker.findUniqueOrThrow({ where: { id: before.id } });
  expect(after.firstName).toBe("Changed"); expect(after.phone).toBe("synthetic");
  expect(after.loginCodeHash).toBe(before.loginCodeHash); expect(after.sessionEpoch).toBe(before.sessionEpoch);
  expect(await authenticateWorkerByCode(prisma, "739182")).toMatchObject({ ok: true, worker: { id: before.id } });
  request.values.clear(); request.values.set("bk_worker_id", workerCookie);
  expect(await getCurrentWorker()).toMatchObject({ id: before.id });
});
it("OR-03 new valid code replaces the hash, authenticates and revokes the old session", async () => {
  const before = await workerCredential(); await updateWorkerAction(profile("648293"));
  const after = await prisma.worker.findUniqueOrThrow({ where: { id: before.id } });
  expect(after.loginCodeHash).not.toBe(before.loginCodeHash); expect(verifyPassword("648293", after.loginCodeHash!)).toBe(true);
  expect(await authenticateWorkerByCode(prisma, "648293")).toMatchObject({ ok: true, worker: { id: before.id } });
  expect(await authenticateWorkerByCode(prisma, "739182")).toMatchObject({ ok: false });
  request.values.clear(); request.values.set("bk_worker_id", workerCookie);
  expect(await getCurrentWorker()).toBeNull();
});
it("OR-03 explicit revoke removes credential and invalidates sessions", async () => {
  const before = await workerCredential(); await revokeWorkerLoginCredentialAction(form({ id: before.id }));
  const after = await prisma.worker.findUniqueOrThrow({ where: { id: before.id } });
  expect(after.loginCodeHash).toBeNull(); expect(after.loginCode).toBeNull(); expect(after.sessionEpoch).toBeGreaterThan(before.sessionEpoch);
  expect(await authenticateWorkerByCode(prisma, "739182")).toMatchObject({ ok: false });
  request.values.clear(); request.values.set("bk_worker_id", workerCookie);
  expect(await getCurrentWorker()).toBeNull();
});
it("OR-03 explicit revoke cannot modify another tenant", async () => {
  const before = await prisma.worker.findUniqueOrThrow({ where: { id: tenants[1].worker.id } });
  await revokeWorkerLoginCredentialAction(form({ id: before.id }));
  expect(await prisma.worker.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before);
});

it.each([
  ["2026-10-02T12:00:00Z", "2026-10-03"],
  ["2026-03-28T12:00:00Z", "2026-03-29"],
  ["2026-10-24T12:00:00Z", "2026-10-25"],
])("OR-01 actual save action sends tomorrow notifications across UTC/Berlin at %s", async (instant, date) => {
  await prisma.dailyWorkPlan.update({ where: { id: tenants[0].plan.id }, data: { planDate: dayRange(date).start } });
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(instant));
  request.values.set("bk_admin_id", await createTestSession("admin", tenants[0].admin.id));
  for (const zone of ["UTC", "Europe/Berlin"]) {
    vi.stubEnv("TZ", zone); request.notify.mockClear();
    expect((await saveDailyPlanAction({ date, lang: "en" })).ok).toBe(true);
    expect(request.notify).toHaveBeenCalledTimes(1);
    expect(request.notify).toHaveBeenCalledWith(expect.objectContaining({ userIds: [tenants[0].worker.id], url: "/workzone/plan", preference: "tagesplan" }));
  }
});

it("OR-02 post-commit journal deletion failure keeps a successful import and recovery preserves its documents", async () => {
  provider.failures.remove = true;
  const result = await importAction(importForm());
  expect(result).toMatchObject({ ok: true, importedCount: 2 });
  if (!result.ok) throw new Error(result.message);
  const site = await prisma.baustelle.findUniqueOrThrow({ where: { id: result.baustelleId } });
  expect(site.documents).toHaveLength(1); expect(provider.objects.size).toBe(2);
  const journal = [...provider.objects.entries()].find(([key]) => key.includes("pending-imports/"));
  expect(journal).toBeTruthy();
  const batch = JSON.parse(journal![1]) as { id: string; expiresAt: number };
  provider.failures.remove = false;
  const { reconcilePendingImport } = await import("@/lib/storage/object-storage");
  await reconcilePendingImport(batch.id, async (companyProfileId, id) =>
    (await prisma.baustelle.findFirst({ where: { id, companyProfileId }, select: { documents: true } }))?.documents ?? [], batch.expiresAt);
  expect(provider.objects.size).toBe(1);
  expect(await prisma.baustelle.findUniqueOrThrow({ where: { id: result.baustelleId } })).toEqual(site);
});
it.each(["12345", "1234567", "12x3456"])("OR-03 invalid replacement %s preserves the credential and epoch", async code => {
  const before = await workerCredential(); await updateWorkerAction(profile(code));
  expect(await prisma.worker.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before);
});
