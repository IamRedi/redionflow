import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
const request = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  return { values: new Map<string, string>(), local: new AsyncLocalStorage<Map<string, string>>() };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (key: string) => { const jar = request.local.getStore() ?? request.values; return jar.has(key) ? { value: jar.get(key) } : undefined; } }),
  headers: async () => new Headers({ "accept-language": "en" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, unstable_cache: (fn: unknown) => fn }));
import { prisma } from "./prisma";
import { seedSecurityTenants, removeSecurityTenants, createTestSession } from "../../../tests/security/fixtures";
import { withTenantDbContext, inspectTenantDbPool, disconnectTenantDbPool, type TenantDb } from "./tenant-runtime";

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
beforeEach(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/baumkalk_integration" || url.username !== "int") throw new Error("Official disposable runner required.");
  vi.stubEnv("RLS_ENFORCE", "true");
  vi.stubEnv("APP_ENV", "saas");
  vi.stubEnv("SESSION_SIGNING_SECRET", "synthetic-runtime-pilot-signing-secret-only");
  request.values.clear();
  tenants = await seedSecurityTenants();
});
afterEach(async () => { await removeSecurityTenants(tenants.map(t => t.company.id)); vi.unstubAllEnvs(); });
afterAll(async () => { await disconnectTenantDbPool(); });
async function as(index: number, kind: "admin" | "worker" = "admin") {
  request.values.clear(); request.values.set(`bk_${kind}_id`, await createTestSession(kind, tenants[index][kind].id));
}
async function cleanPool(pid?: number) {
  const state = await inspectTenantDbPool();
  expect(state.role).toBe("bk_saas_pilot_runtime");
  expect(state.context ?? "").toBe("");
  expect([state.companies, state.sites, state.plans]).toEqual([0n, 0n, 0n]);
  if (pid) expect(state.pid).toBe(pid);
  return state;
}

it("real runtime LOGIN attributes and no-context reads deny before tenant authority", async () => {
  const [role] = await prisma.$queryRaw<Array<{ rolcanlogin: boolean; rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean; rolcreatedb: boolean; rolinherit: boolean }>>`
    SELECT rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit FROM pg_roles WHERE rolname='bk_saas_pilot_runtime'`;
  expect(role).toEqual({ rolcanlogin: true, rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false, rolinherit: false });
  await cleanPool();
});

it("REAL APPLICATION POOL: A then B then A uses the same backend without leaking rows or context", async () => {
  const { pid } = await cleanPool();
  for (const index of [0, 1, 0]) {
    await as(index);
    const rows = await withTenantDbContext(tenants[index].company.id, async tx => ({
      companies: await tx.companyProfile.findMany({ select: { id: true } }),
      sites: await tx.baustelle.findMany({ select: { id: true } }),
      plans: await tx.dailyWorkPlan.findMany({ select: { id: true } }),
      backend: await tx.$queryRaw<Array<{ pid: number; tenant: string }>>`SELECT pg_backend_pid() AS pid,current_setting('app.current_tenant_id',true) AS tenant`,
    }));
    expect(rows.companies).toEqual([{ id: tenants[index].company.id }]);
    expect(rows.sites).toEqual([{ id: tenants[index].site.id }]);
    expect(rows.plans).toEqual([{ id: tenants[index].plan.id }]);
    expect(rows.backend).toEqual([{ pid, tenant: tenants[index].company.id }]);
    await cleanPool(pid);
  }
});

it("REAL APPLICATION POOL: rollback and SQL transaction error clear the same connection for the next request", async () => {
  const { pid } = await cleanPool(); await as(0);
  const id = `synthetic-rollback-${tenants[0].company.id}`;
  await expect(withTenantDbContext(tenants[0].company.id, async tx => {
    await tx.baustelle.create({ data: { id, companyProfileId: tenants[0].company.id, name: "Synthetic rollback" } });
    throw new Error("synthetic-rollback");
  })).rejects.toThrow("synthetic-rollback");
  expect(await prisma.baustelle.findUnique({ where: { id } })).toBeNull();
  await cleanPool(pid);
  await as(1);
  expect(await withTenantDbContext(tenants[1].company.id, tx => tx.companyProfile.findMany({ select: { id: true } }))).toEqual([{ id: tenants[1].company.id }]);
  await expect(withTenantDbContext(tenants[1].company.id, tx => tx.$queryRaw`SELECT 1/0`)).rejects.toThrow();
  await cleanPool(pid); await as(0);
  expect(await withTenantDbContext(tenants[0].company.id, tx => tx.companyProfile.findMany({ select: { id: true } }))).toEqual([{ id: tenants[0].company.id }]);
  await cleanPool(pid);
});

it("unauthenticated, missing/invalid/forged tenant and wrong role deny without invoking a callback", async () => { // gitleaks:allow (false positive: test title, not a key)
  const callback = vi.fn(async () => true);
  await expect(withTenantDbContext(tenants[0].company.id, callback)).rejects.toThrow("No authenticated tenant");
  await as(0);
  for (const id of ["", "invalid tenant", tenants[1].company.id]) await expect(withTenantDbContext(id, callback)).rejects.toThrow("mismatch");
  await as(0, "worker");
  await expect(withTenantDbContext(tenants[0].company.id, callback, "admin")).rejects.toThrow("mismatch");
  expect(callback).not.toHaveBeenCalled(); await cleanPool();
});

it("escaped transaction client expires and database reconnect starts with no tenant state", async () => {
  await as(0); let escaped: TenantDb | undefined;
  await withTenantDbContext(tenants[0].company.id, async tx => { escaped = tx; return tx.companyProfile.count(); });
  await expect(escaped!.companyProfile.findMany()).rejects.toThrow(/closed|expired|not found/i);
  const prior = await cleanPool(); await disconnectTenantDbPool();
  const next = await cleanPool(); expect(next.pid).not.toBe(prior.pid);
  await as(1);
  expect(await withTenantDbContext(tenants[1].company.id, tx => tx.companyProfile.findMany({ select: { id: true } }))).toEqual([{ id: tenants[1].company.id }]);
  await cleanPool(next.pid);
});

// Framework request/revalidation are stubbed; sessions, roles, Prisma, transactions,
// RLS policies, app guards and integrity triggers all execute against real Postgres.
import { getOrCreateDefaultCompany, getCompanyMode } from "./company";
import { bootstrapSignupTenant } from "@/lib/auth/signup-bootstrap";
import { signupAction } from "@/app/(public)/signup/actions";
import { createBaustelleAction, updateBaustelleCanvasPositionAction, updateBaustelleMetaAction, deleteBaustelleAction, clearBaustelleImportDataAction } from "@/app/(admin)/app/baustellen/actions";
import { ensureDailyPlanAction, moveDailyPlanItemAction, removeDailyPlanItemAction, clearDailyPlanAction, saveDailyPlanAction, updateDailyPlanColumnNoteAction } from "@/app/(workzone)/workzone/daily-plan-actions";
import { hashPassword } from "@/lib/auth/password";

function form(values: Record<string, string>) {
  const value = new FormData(); for (const [key, text] of Object.entries(values)) value.set(key, text); return value;
}
for (const actor of [0, 1]) {
  const foreign = 1 - actor;
  for (const kind of ["admin", "worker"] as const) {
    it(`Company/Profile ${kind} ${actor}: own READ allows; foreign READ denies; Company writes have no grant`, async () => {
      await as(actor, kind); const a = tenants[actor]; const b = tenants[foreign];
      expect((await getOrCreateDefaultCompany()).id).toBe(a.company.id);
      expect(await getCompanyMode()).toBe("baumdienst");
      expect(await withTenantDbContext(a.company.id, tx => tx.companyProfile.findUnique({ where: { id: b.company.id } }))).toBeNull();
      await expect(withTenantDbContext(a.company.id, tx => tx.companyProfile.update({ where: { id: a.company.id }, data: { displayName: "Forbidden" } }))).rejects.toThrow(/permission denied/i);
      expect((await prisma.companyProfile.findUniqueOrThrow({ where: { id: a.company.id } })).displayName).toBe(a.marker);
      await cleanPool();
    });
  }
  for (const verb of ["SELECT", "INSERT", "UPDATE", "DELETE"] as const) {
    it(`Baustelle RLS ${actor}: ${verb} own ALLOW and foreign DENY independently of app filters`, async () => {
      await as(actor); const a = tenants[actor]; const b = tenants[foreign];
      if (verb === "SELECT") {
        expect(await withTenantDbContext(a.company.id, tx => tx.baustelle.findMany({ select: { id: true } }))).toEqual([{ id: a.site.id }]);
        expect(await withTenantDbContext(a.company.id, tx => tx.baustelle.findUnique({ where: { id: b.site.id } }))).toBeNull();
      } else if (verb === "INSERT") {
        const own = await withTenantDbContext(a.company.id, tx => tx.baustelle.create({ data: { companyProfileId: a.company.id, name: "Synthetic own" } }));
        expect(own.companyProfileId).toBe(a.company.id);
        await expect(withTenantDbContext(a.company.id, tx => tx.baustelle.create({ data: { companyProfileId: b.company.id, name: "Forbidden" } }))).rejects.toThrow(/row.level security/i);
      } else if (verb === "UPDATE") {
        expect(await withTenantDbContext(a.company.id, tx => tx.baustelle.updateMany({ where: { id: a.site.id }, data: { description: "Own changed" } }))).toEqual({ count: 1 });
        expect(await withTenantDbContext(a.company.id, tx => tx.baustelle.updateMany({ where: { id: b.site.id }, data: { description: "Forbidden" } }))).toEqual({ count: 0 });
        await expect(withTenantDbContext(a.company.id, tx => tx.baustelle.update({ where: { id: a.site.id }, data: { companyProfileId: b.company.id } }))).rejects.toThrow("Tenant ownership cannot be reassigned");
      } else {
        expect(await withTenantDbContext(a.company.id, tx => tx.baustelle.deleteMany({ where: { id: b.site.id } }))).toEqual({ count: 0 });
        expect(await withTenantDbContext(a.company.id, tx => tx.baustelle.deleteMany({ where: { id: a.site.id } }))).toEqual({ count: 1 });
      }
      expect(await prisma.baustelle.findUnique({ where: { id: b.site.id } })).toMatchObject({ name: b.marker, description: null });
      expect(await prisma.baustelle.count({ where: { companyProfileId: b.company.id } })).toBe(1);
      await cleanPool();
    });
    it(`DailyPlan RLS ${actor}: ${verb} own ALLOW and foreign DENY independently of app filters`, async () => {
      await as(actor); const a = tenants[actor]; const b = tenants[foreign];
      if (verb === "SELECT") {
        expect(await withTenantDbContext(a.company.id, tx => tx.dailyWorkPlan.findMany({ select: { id: true } }))).toEqual([{ id: a.plan.id }]);
        expect(await withTenantDbContext(a.company.id, tx => tx.dailyWorkPlan.findUnique({ where: { id: b.plan.id } }))).toBeNull();
        expect(await withTenantDbContext(a.company.id, tx => tx.dailyWorkPlanAssignment.findMany({ select: { id: true } }))).toEqual([{ id: a.assignment.id }]);
      } else if (verb === "INSERT") {
        expect(await withTenantDbContext(a.company.id, tx => tx.dailyWorkPlan.create({ data: { companyProfileId: a.company.id, planDate: new Date("2026-10-02"), createdByAdminId: a.admin.id } }))).toMatchObject({ companyProfileId: a.company.id });
        await expect(withTenantDbContext(a.company.id, tx => tx.dailyWorkPlan.create({ data: { companyProfileId: b.company.id, planDate: new Date("2026-10-02"), createdByAdminId: b.admin.id } }))).rejects.toThrow();
      } else if (verb === "UPDATE") {
        expect(await withTenantDbContext(a.company.id, tx => tx.dailyWorkPlan.updateMany({ where: { id: a.plan.id }, data: { planDate: new Date("2026-10-02") } }))).toEqual({ count: 1 });
        expect(await withTenantDbContext(a.company.id, tx => tx.dailyWorkPlan.updateMany({ where: { id: b.plan.id }, data: { planDate: new Date("2026-10-02") } }))).toEqual({ count: 0 });
        expect(await withTenantDbContext(a.company.id, tx => tx.dailyWorkPlanColumn.updateMany({ where: { id: b.column.id }, data: { note: "Forbidden" } }))).toEqual({ count: 0 });
      } else {
        // Plan delete is not a public action: real workflow removes assignments/columns.
        expect(await withTenantDbContext(a.company.id, tx => tx.dailyWorkPlanAssignment.deleteMany({ where: { id: b.assignment.id } }))).toEqual({ count: 0 });
        expect(await withTenantDbContext(a.company.id, tx => tx.dailyWorkPlanColumn.deleteMany({ where: { id: b.column.id } }))).toEqual({ count: 0 });
        expect(await withTenantDbContext(a.company.id, tx => tx.dailyWorkPlanAssignment.deleteMany({ where: { id: a.assignment.id } }))).toEqual({ count: 1 });
        expect(await withTenantDbContext(a.company.id, tx => tx.dailyWorkPlanColumn.deleteMany({ where: { id: a.column.id } }))).toEqual({ count: 1 });
      }
      expect(await prisma.dailyWorkPlan.findUnique({ where: { id: b.plan.id } })).toMatchObject({ planDate: b.plan.planDate });
      expect(await prisma.dailyWorkPlanAssignment.findUnique({ where: { id: b.assignment.id } })).not.toBeNull();
      await cleanPool();
    });
  }
  it(`actual Baustelle actions ${actor}: own create/update/clear/delete; forged company/object refused`, async () => {
    await as(actor); const a = tenants[actor]; const b = tenants[foreign];
    expect((await createBaustelleAction({ companyId: b.company.id, name: "Forbidden", status: "active", type: "OTHER" })).ok).toBe(false);
    expect((await createBaustelleAction({ companyId: a.company.id, name: "Synthetic own action", status: "active", type: "OTHER" })).ok).toBe(true);
    expect((await updateBaustelleCanvasPositionAction({ baustelleId: b.site.id, x: 4, y: 7, viewport: "desktop" })).ok).toBe(false);
    expect((await updateBaustelleCanvasPositionAction({ baustelleId: a.site.id, x: 4, y: 7, viewport: "desktop" })).ok).toBe(true);
    await updateBaustelleMetaAction(form({ baustelleId: a.site.id, name: "Synthetic updated", type: "OTHER", status: "active", address: "Synthetic", description: "Synthetic" }));
    expect(await prisma.baustelle.findUnique({ where: { id: a.site.id } })).toMatchObject({ name: "Synthetic updated", canvasX: 4 });
    // Empty document lists ensure these authorized operations have no external storage calls.
    await clearBaustelleImportDataAction(form({ baustelleId: b.site.id }));
    await deleteBaustelleAction(form({ baustelleId: b.site.id }));
    expect(await prisma.treeItem.findUnique({ where: { id: b.tree.id } })).not.toBeNull();
    await clearBaustelleImportDataAction(form({ baustelleId: a.site.id }));
    expect(await prisma.treeItem.findUnique({ where: { id: a.tree.id } })).toBeNull();
    await deleteBaustelleAction(form({ baustelleId: a.site.id }));
    expect(await prisma.baustelle.findUnique({ where: { id: a.site.id } })).toBeNull();
    expect(await prisma.baustelle.findUnique({ where: { id: b.site.id } })).toMatchObject({ name: b.marker });
    await cleanPool();
  });
  it(`actual DailyPlan actions ${actor}: prepare/worker+machine assign/note/save/snapshot/remove/clear`, async () => {
    await as(actor); const a = tenants[actor]; const b = tenants[foreign]; const date = "2026-10-03";
    expect((await ensureDailyPlanAction({ date })).ok).toBe(true);
    for (const [kind, itemId] of [["WORKER", a.worker.id], ["MACHINE", a.machine.id]] as const) {
      expect((await moveDailyPlanItemAction({ date, columnId: b.site.id, kind, itemId })).ok).toBe(false);
      const foreignItem = kind === "WORKER" ? b.worker.id : b.machine.id;
      expect((await moveDailyPlanItemAction({ date, columnId: a.site.id, kind, itemId: foreignItem })).ok).toBe(false);
      expect((await moveDailyPlanItemAction({ date, columnId: a.site.id, kind, itemId })).ok).toBe(true);
    }
    expect((await updateDailyPlanColumnNoteAction({ date, columnId: b.site.id, note: "Forbidden" })).ok).toBe(false);
    expect((await updateDailyPlanColumnNoteAction({ date, columnId: a.site.id, note: "Synthetic note" })).ok).toBe(true);
    expect((await saveDailyPlanAction({ date })).ok).toBe(true);
    expect((await updateDailyPlanColumnNoteAction({ date, columnId: a.site.id, note: "Synthetic revision" })).ok).toBe(true);
    expect((await saveDailyPlanAction({ date })).ok).toBe(true);
    // 2026-10-03 midnight in Europe/Berlin is 22:00Z, independent of host TZ.
    const plan = await prisma.dailyWorkPlan.findUniqueOrThrow({ where: { companyProfileId_planDate: { companyProfileId: a.company.id, planDate: new Date("2026-10-02T22:00:00Z") } }, include: { columns: { include: { assignments: true } }, snapshots: { include: { rows: true } }, savedRows: true } });
    expect(plan.snapshots).toHaveLength(1); expect(plan.snapshots[0].rows.some(row => row.note === "Synthetic note")).toBe(true);
    expect(plan.savedRows.some(row => row.note === "Synthetic revision")).toBe(true);
    const column = plan.columns.find(value => value.baustelleId === a.site.id)!;
    expect(column.assignments).toHaveLength(2);
    expect((await removeDailyPlanItemAction({ date, assignmentId: b.assignment.id })).ok).toBe(false);
    expect((await removeDailyPlanItemAction({ date, assignmentId: column.assignments[0].id })).ok).toBe(true);
    expect((await clearDailyPlanAction({ date })).ok).toBe(true);
    expect(await prisma.dailyWorkPlanColumn.count({ where: { planId: plan.id } })).toBe(0);
    expect(await prisma.dailyWorkPlanAssignment.findUnique({ where: { id: b.assignment.id } })).not.toBeNull();
    await cleanPool();
  });
  for (const reference of ["site", "worker", "machine", "column", "actor"] as const) {
    it(`restricted tenant ${actor} rejects forged DailyPlan ${reference} reference at DB boundary`, async () => {
      await as(actor); const a = tenants[actor]; const b = tenants[foreign];
      if (reference === "site") await expect(withTenantDbContext(a.company.id, tx => tx.dailyWorkPlanColumn.create({ data: { planId: a.plan.id, baustelleId: b.site.id, title: "Forbidden" } }))).rejects.toThrow();
      if (reference === "worker") await expect(withTenantDbContext(a.company.id, tx => tx.dailyWorkPlanAssignment.create({ data: { columnId: a.column.id, kind: "WORKER", workerId: b.worker.id, labelSnapshot: "Forbidden" } }))).rejects.toThrow();
      if (reference === "machine") await expect(withTenantDbContext(a.company.id, tx => tx.dailyWorkPlanAssignment.create({ data: { columnId: a.column.id, kind: "MACHINE", machineId: b.machine.id, labelSnapshot: "Forbidden" } }))).rejects.toThrow();
      if (reference === "column") await expect(withTenantDbContext(a.company.id, tx => tx.dailyWorkPlanAssignment.create({ data: { columnId: b.column.id, kind: "WORKER", workerId: a.worker.id, labelSnapshot: "Forbidden" } }))).rejects.toThrow();
      if (reference === "actor") await expect(withTenantDbContext(a.company.id, tx => tx.dailyWorkPlan.create({ data: { companyProfileId: a.company.id, createdByAdminId: b.admin.id, planDate: new Date("2026-10-04") } }))).rejects.toThrow();
      expect(await prisma.dailyWorkPlanAssignment.count({ where: { labelSnapshot: "Forbidden" } })).toBe(0);
      await cleanPool();
    });
  }
}

it("worker can read own site/plan but every actual pilot mutation denies admin authority", async () => {
  await as(0, "worker"); const a = tenants[0];
  expect(await withTenantDbContext(a.company.id, tx => tx.baustelle.count())).toBe(1);
  expect(await withTenantDbContext(a.company.id, tx => tx.dailyWorkPlan.count())).toBe(1);
  expect((await createBaustelleAction({ companyId: a.company.id, name: "Forbidden", status: "active", type: "OTHER" })).ok).toBe(false);
  expect((await updateBaustelleCanvasPositionAction({ baustelleId: a.site.id, x: 5, y: 6, viewport: "desktop" })).ok).toBe(false);
  expect((await ensureDailyPlanAction({ date: "2026-10-03" })).ok).toBe(false);
  expect((await moveDailyPlanItemAction({ date: "2026-10-03", columnId: a.site.id, kind: "WORKER", itemId: a.worker.id })).ok).toBe(false);
  expect((await updateDailyPlanColumnNoteAction({ date: "2026-10-03", columnId: a.site.id, note: "Forbidden" })).ok).toBe(false);
  expect((await removeDailyPlanItemAction({ date: "2026-10-03", assignmentId: a.assignment.id })).ok).toBe(false);
  expect((await saveDailyPlanAction({ date: "2026-10-03" })).ok).toBe(false);
  expect((await clearDailyPlanAction({ date: "2026-10-03" })).ok).toBe(false);
  await deleteBaustelleAction(form({ baustelleId: a.site.id }));
  expect(await prisma.baustelle.count({ where: { companyProfileId: a.company.id } })).toBe(1);
  await cleanPool();
});

it("minimal system identity proof rejects revoked, inactive, missing membership and conflicting sessions", async () => {
  const callback = vi.fn(async () => true); await as(0);
  await prisma.user.update({ where: { id: tenants[0].admin.id }, data: { sessionEpoch: { increment: 1 } } });
  await expect(withTenantDbContext(tenants[0].company.id, callback)).rejects.toThrow("No authenticated tenant");
  await as(0); await prisma.user.update({ where: { id: tenants[0].admin.id }, data: { isActive: false } });
  await expect(withTenantDbContext(tenants[0].company.id, callback)).rejects.toThrow("No authenticated tenant");
  await prisma.user.update({ where: { id: tenants[0].admin.id }, data: { isActive: true } });
  // Membership ownership is immutable: create a genuinely unlinked legacy account.
  const unlinked = await prisma.user.create({ data: { email: `${tenants[0].marker}@unlinked.example.test`, role: "ADMIN", isActive: true, companyProfileId: null } });
  try {
    request.values.clear(); request.values.set("bk_admin_id", await createTestSession("admin", unlinked.id));
    await expect(withTenantDbContext(tenants[0].company.id, callback)).rejects.toThrow("No authenticated tenant");
  } finally { await prisma.user.delete({ where: { id: unlinked.id } }); }
  await as(0); request.values.set("bk_worker_id", await createTestSession("worker", tenants[1].worker.id));
  await expect(withTenantDbContext(tenants[0].company.id, callback)).rejects.toThrow("No authenticated tenant");
  expect(callback).not.toHaveBeenCalled(); await cleanPool();
});

it("bootstrap is a fixed audited new-tenant command; tenant callback cannot invoke service or public action", async () => {
  const a = tenants[0]; const payload = { displayName: "Synthetic bootstrap", legalName: "Synthetic bootstrap", fullName: "Synthetic admin", mode: "bau", email: `${a.marker}@bootstrap.example.test`, passwordHash: hashPassword("synthetic-only-password"), trialEndsAt: new Date("2026-10-15") };
  const before = await prisma.companyProfile.count(); await as(0);
  for (const call of [() => bootstrapSignupTenant(payload), () => signupAction({})]) {
    await expect(withTenantDbContext(a.company.id, async () => call())).rejects.toThrow("Signup bootstrap cannot run");
    expect(await prisma.companyProfile.count()).toBe(before); await cleanPool();
  }
  await expect(bootstrapSignupTenant({ ...payload, companyProfileId: tenants[1].company.id })).rejects.toThrow();
  expect(await prisma.companyProfile.count()).toBe(before);
  request.values.clear(); const created = await bootstrapSignupTenant(payload); expect(created).not.toBeNull();
  try {
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: created!.admin.id } });
    expect(admin).toMatchObject({ companyProfileId: created!.companyId, role: "ADMIN", isActive: true });
    expect(await prisma.auditLog.count({ where: { companyProfileId: created!.companyId, action: "signup.bootstrap" } })).toBe(1);
    expect(await bootstrapSignupTenant(payload)).toBeNull();
  } finally { await removeSecurityTenants([created!.companyId]); }
  expect(await prisma.companyProfile.count()).toBe(before);
});

it("runtime minimum grants deny unrelated modules, credential reads and bootstrap writes", async () => {
  await as(0); const id = tenants[0].company.id;
  for (const query of [
    (tx: TenantDb) => tx.project.findMany(),
    (tx: TenantDb) => tx.user.findMany({ select: { passwordHash: true } }),
    (tx: TenantDb) => tx.worker.findMany({ select: { loginCodeHash: true } }),
    (tx: TenantDb) => tx.user.create({ data: { email: "forbidden@example.test", companyProfileId: id } }),
  ]) {
    await expect(withTenantDbContext<unknown>(id, query)).rejects.toThrow(/permission denied/i); await cleanPool();
  }
});

it("local performance sanity: 30 serialized pool requests keep bounded query counts and no exhausted connections", async () => {
  await as(0); const before = await cleanPool(); const elapsed: number[] = [];
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    expect(await withTenantDbContext(tenants[0].company.id, tx => tx.baustelle.count())).toBe(1);
    elapsed.push(performance.now() - start);
  }
  const after = await cleanPool(before.pid); const sorted = [...elapsed].sort((a,b) => a-b);
  // Privileged fixture connection is a timing control only, never product runtime.
  const controls: number[] = [];
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    expect(await prisma.baustelle.count({ where: { companyProfileId: tenants[0].company.id } })).toBe(1);
    controls.push(performance.now() - start);
  }
  controls.sort((a,b) => a-b);
  const result = { requests: 30, runtimeQueries: after.queryCount - before.queryCount - 1,
    medianMs: Math.round(sorted[15]), p95Ms: Math.round(sorted[28]), maxMs: Math.round(sorted[29]), poolMax: 1, controlMedianMs: Number(controls[15].toFixed(2)),
    approximateOverheadMs: Number((sorted[15] - controls[15]).toFixed(2)) };
  console.log("RLS_PILOT_PERFORMANCE", JSON.stringify(result));
  expect(result.runtimeQueries).toBeLessThanOrEqual(30 * 6); // guard + set_config + business query + transaction control
});

it("invalid/tampered/expired session and disabled pilot never open a tenant transaction", async () => {
  const callback = vi.fn(async () => true); await as(0);
  const cookie = request.values.get("bk_admin_id")!;
  for (const value of ["invalid", `${cookie.split(".")[0]}.` + "A".repeat(43)]) {
    request.values.set("bk_admin_id", value);
    await expect(withTenantDbContext(tenants[0].company.id, callback)).rejects.toThrow("No authenticated tenant");
  }
  request.values.set("bk_admin_id", cookie);
  const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now + 31 * 24 * 60 * 60 * 1000);
  try { await expect(withTenantDbContext(tenants[0].company.id, callback)).rejects.toThrow("No authenticated tenant"); }
  finally { clock.mockRestore(); }
  vi.stubEnv("RLS_ENFORCE", "false");
  await expect(withTenantDbContext(tenants[0].company.id, callback)).rejects.toThrow("disabled");
  expect(callback).not.toHaveBeenCalled(); await cleanPool();
});

it("missing/privileged/foreign-host runtime URL refuses configuration and never falls back to system DB", async () => {
  const callback = vi.fn(async () => true); await as(0); await disconnectTenantDbPool();
  const actual = process.env.TENANT_DATABASE_URL!;
  try {
    for (const url of ["", process.env.DATABASE_URL!, "postgresql://bk_saas_pilot_runtime@forbidden.example.test/baumkalk_integration"]) {
      vi.stubEnv("TENANT_DATABASE_URL", url);
      await expect(withTenantDbContext(tenants[0].company.id, callback)).rejects.toThrow(/required|requires/);
    }
  } finally { vi.stubEnv("TENANT_DATABASE_URL", actual); }
  expect(callback).not.toHaveBeenCalled(); await cleanPool();
});

it("20 independent concurrent authenticated requests queue on the real single-connection pool without exhaustion or tenant leak", async () => {
  const { pid } = await cleanPool();
  const cookies = await Promise.all(tenants.map(t => createTestSession("admin", t.admin.id)));
  // Framework request-local cookies model separate HTTP requests; core auth/DB are real.
  await Promise.all(Array.from({ length: 20 }, (_, n) => {
    const index = n % 2; const tenant = tenants[index];
    return request.local.run(new Map([["bk_admin_id", cookies[index]]]), async () => {
      const rows = await withTenantDbContext(tenant.company.id, tx => tx.companyProfile.findMany({ select: { id: true } }));
      expect(rows).toEqual([{ id: tenant.company.id }]);
    });
  }));
  await cleanPool(pid);
});

it("actual pilot application flows never use the privileged singleton for tenant SQL", async () => {
  await as(0); const a = tenants[0];
  const forbidden = () => { throw new Error("SYSTEM_TENANT_QUERY_FORBIDDEN"); };
  // Poison the legacy object paths rather than mocking away authentication/RLS.
  // Fixture setup/assertions remain real and spies are restored before cleanup.
  const spies = [
    vi.spyOn(prisma, "$transaction").mockImplementation(forbidden),
    vi.spyOn(prisma.companyProfile, "findUnique").mockImplementation(forbidden),
    vi.spyOn(prisma.baustelle, "create").mockImplementation(forbidden),
    vi.spyOn(prisma.baustelle, "findUnique").mockImplementation(forbidden),
    vi.spyOn(prisma.baustelle, "update").mockImplementation(forbidden),
    vi.spyOn(prisma.dailyWorkPlan, "upsert").mockImplementation(forbidden),
    vi.spyOn(prisma.dailyWorkPlan, "findUnique").mockImplementation(forbidden),
    vi.spyOn(prisma.subscription, "findUnique").mockImplementation(forbidden),
  ];
  try {
    expect((await getOrCreateDefaultCompany()).id).toBe(a.company.id);
    expect(await getCompanyMode()).toBe("baumdienst");
    expect((await createBaustelleAction({ companyId: a.company.id, name: "Synthetic restricted action", status: "active", type: "OTHER" })).ok).toBe(true);
    expect((await updateBaustelleCanvasPositionAction({ baustelleId: a.site.id, x: 2, y: 3, viewport: "desktop" })).ok).toBe(true);
    expect((await ensureDailyPlanAction({ date: "2026-10-05" })).ok).toBe(true);
    expect((await moveDailyPlanItemAction({ date: "2026-10-05", columnId: a.site.id, itemId: a.worker.id, kind: "WORKER" })).ok).toBe(true);
    expect((await updateDailyPlanColumnNoteAction({ date: "2026-10-05", columnId: a.site.id, note: "Restricted" })).ok).toBe(true);
    expect((await saveDailyPlanAction({ date: "2026-10-05" })).ok).toBe(true);
    expect((await clearDailyPlanAction({ date: "2026-10-05" })).ok).toBe(true);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  } finally { for (const spy of spies) spy.mockRestore(); }
  await cleanPool();
});

it("public signup validates normalized bootstrap names before company creation and returns field errors", async () => {
  vi.stubEnv("LOGIN_GUARD_SALT", "ab".repeat(32)); // Synthetic valid encoding, no external requests.
  const before = await prisma.companyProfile.count();
  const result = await signupAction({ displayName: "  ", legalName: "  ", fullName: "  ", mode: "bau", email: `${tenants[0].marker}@invalid-bootstrap.example.test`, password: "Synthetic-only-password" });
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Invalid signup unexpectedly succeeded");
  expect(result.fieldErrors).toMatchObject({ displayName: expect.any(Array), legalName: expect.any(Array), fullName: expect.any(Array) });
  expect(await prisma.companyProfile.count()).toBe(before);
});
