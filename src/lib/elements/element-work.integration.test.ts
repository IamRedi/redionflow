import { afterEach, beforeEach, expect, it, vi } from "vitest";
const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (key: string) => (request.values.has(key) ? { value: request.values.get(key) } : undefined), set: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { addElementWorkAction, removeElementWorkAction, setElementDoneAction, setElementProcessesAction } from "@/app/(workzone)/workzone/element-actions";
import { seedSecurityTenants, removeSecurityTenants, createTestSession } from "../../../tests/security/fixtures";
import { importElementList, type ElementImportMode } from "./import";
import type { ParsedElementList } from "./tekla-list";
import { doneQty, type ElementList } from "./stages";

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
beforeEach(async () => {
  vi.stubEnv("SESSION_SIGNING_SECRET", "synthetic-element-work-signing-key-only");
  request.values.clear();
  tenants = await seedSecurityTenants();
});
afterEach(async () => {
  await removeSecurityTenants(tenants.map((tenant) => tenant.company.id));
  vi.unstubAllEnvs();
});

const list = (marks: string[]): ParsedElementList => ({
  list: "assembly",
  projectNumber: "0001",
  projectName: "Synthetic",
  elements: marks.map((mark) => ({ mark, kind: "BEAM", profile: "HEA200", material: "S275JR", quantity: 2, lengthMm: 4000, weightKg: 170, areaM2: 4.5 })),
  totalPieces: marks.length * 2,
  totalKg: marks.length * 340,
});

async function importFor(tenant: (typeof tenants)[number], marks: string[], mode: ElementImportMode = 'merge') {
  return withTenantContext(tenant.company.id, (tx) =>
    importElementList(tx, { companyId: tenant.company.id, baustelleId: tenant.site.id, parsed: list(marks), fileName: "list.xls", mode }),
  );
}

it("re-import updates in place, keeps checked elements and drops unchecked ones", async () => {
  const [a] = tenants;
  expect(await importFor(a, ["B/2", "B/10", "C/1"])).toMatchObject({ added: 3, updated: 0, removed: 0, kept: 0 });
  const rows = await prisma.siteElement.findMany({ where: { baustelleId: a.site.id }, orderBy: { sortIndex: "asc" } });
  expect(rows.map((row) => row.mark)).toEqual(["B/2", "B/10", "C/1"]);
  const checked = rows.find((row) => row.mark === "B/10")!;
  await prisma.siteElementWork.create({
    data: { companyProfileId: a.company.id, elementId: checked.id, stage: "welding", workerIds: [a.worker.id], workerNames: "x", checkedByName: "x" },
  });
  expect(await importFor(a, ["B/2", "B/3"], 'snapshot')).toMatchObject({ added: 1, updated: 1, removed: 1, kept: 1 });
  const after = await prisma.siteElement.findMany({ where: { baustelleId: a.site.id }, select: { mark: true, _count: { select: { work: true } } } });
  expect(after.map((row) => row.mark).sort()).toEqual(["B/10", "B/2", "B/3"]);
  expect(after.find((row) => row.mark === "B/10")?._count.work).toBe(1);
});
it('merges partial lists by default, retains unchecked marks and routes, and retries without doubling quantities', async () => {
  const [a] = tenants;
  await importFor(a, ['B/2', 'B/10']);
  const old = await prisma.siteElement.findMany({ where: { baustelleId: a.site.id } });
  const first = await importFor(a, ['C/1']);
  expect(first).toMatchObject({ added: 1, updated: 0, removed: 0, kept: 2 });
  expect(first.addedIds).toHaveLength(1);
  expect(await importFor(a, ['C/1'])).toMatchObject({ added: 0, updated: 1, removed: 0, kept: 2, addedIds: [] });
  expect(await prisma.siteElement.findMany({ where: { id: { in: old.map(row => row.id) } }, orderBy: { sortIndex: 'asc' } })).toMatchObject(old.sort((a,b) => a.sortIndex-b.sortIndex));
  expect(await prisma.siteElement.count({ where: { baustelleId: a.site.id } })).toBe(3);
  expect((await prisma.siteElement.aggregate({ where: { baustelleId: a.site.id }, _sum: { quantity: true } }))._sum.quantity).toBe(6);
});
it('rejects an upload that reduces quantities below confirmed pieces, atomically preserving all rows and work', async () => {
  const [a] = tenants;
  await importFor(a, ['B/2']);
  const row = await prisma.siteElement.findFirstOrThrow({ where: { baustelleId: a.site.id } });
  await prisma.siteElementWork.create({ data: { companyProfileId: a.company.id, elementId: row.id, stage: 'cutting', pieces: 2, workerNames: 'Synthetic', workerIds: [], checkedByName: 'Synthetic' } });
  const parsed = list(['A/1', 'B/2']); parsed.elements[1].quantity = 1;
  await expect(withTenantContext(a.company.id, tx => importElementList(tx, { companyId: a.company.id, baustelleId: a.site.id, parsed, fileName: 'partial.xls' }))).rejects.toThrow('B/2');
  expect(await prisma.siteElement.count({ where: { baustelleId: a.site.id } })).toBe(1);
  expect(await prisma.siteElement.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject(row);
  expect(await prisma.siteElementWork.count({ where: { elementId: row.id } })).toBe(1);
});
it('serializes concurrent initial partial uploads so shared marks have one identity', async () => {
  const [a] = tenants;
  const result = await Promise.all([importFor(a, ['A/1', 'B/2']), importFor(a, ['B/2', 'C/3'])]);
  expect(result.reduce((sum, row) => sum+row.added, 0)).toBe(3);
  expect(await prisma.siteElement.count({ where: { baustelleId: a.site.id } })).toBe(3);
});

it("admin records who did how many pieces of a step, and finished pieces go to the site", async () => {
  const [a, b] = tenants;
  await importFor(a, ["B/1"]);
  await importFor(b, ["B/1"]);
  const own = await prisma.siteElement.findFirstOrThrow({ where: { baustelleId: a.site.id } });
  const foreign = await prisma.siteElement.findFirstOrThrow({ where: { baustelleId: b.site.id } });
  // This regression exercises historical inferred routes, rather than a new
  // import's intentionally unconfigured applicability.
  await prisma.siteElement.updateMany({ where: { id: { in: [own.id, foreign.id] } }, data: { processRoutes: Prisma.DbNull } });
  request.values.set("bk_admin_id", await createTestSession("admin", a.admin.id));
  const add = (stage: string, pieces: number, elementId = own.id, workerIds = [a.worker.id]) => addElementWorkAction({ elementId, stage, workerIds, pieces });

  expect((await add("cutting", 1, own.id, [b.worker.id])).ok).toBe(false);
  expect((await add("cutting", 1, foreign.id)).ok).toBe(false);
  expect((await add("laser", 1)).ok).toBe(false);
  expect((await addElementWorkAction({ elementId: own.id, stage: "cutting", workerIds: [], pieces: 1 })).ok).toBe(false);
  expect(await prisma.siteElementWork.count({ where: { elementId: { in: [own.id, foreign.id] } } })).toBe(0);

  // 2 pieces: cut 1 now, 1 later; a third is refused (step full).
  expect(await add("cutting", 1)).toMatchObject({ ok: true, pieces: 1 });
  expect(await add("cutting", 5)).toMatchObject({ ok: true, pieces: 1 });
  expect((await add("cutting", 1)).ok).toBe(false);
  expect(await add("assembly", 1)).toMatchObject({ ok: true, pieces: 1 });
  const entries = await prisma.siteElementWork.findMany({ where: { elementId: own.id }, orderBy: { checkedAt: "asc" } });
  expect(entries.map((row) => [row.stage, row.pieces])).toEqual([["cutting", 1], ["cutting", 1], ["assembly", 1]]);
  expect(entries[0]?.workerNames).toBe(`${a.worker.firstName} ${a.worker.lastName}`.trim());

  // Not on the field list until finished.
  expect((await add("mounted", 1)).ok).toBe(false);
  expect((await setElementDoneAction({ elementId: own.id, side: "field", done: true })).ok).toBe(false);
  expect((await setElementDoneAction({ elementId: foreign.id, side: "factory", done: true })).ok).toBe(false);
  // Finish: route = cutting + assembly; 1 piece passed both, so 1 goes to the site.
  expect((await setElementDoneAction({ elementId: own.id, side: "factory", done: true })).ok).toBe(true);
  expect(await add("mounted", 2)).toMatchObject({ ok: true, pieces: 1 });
  expect((await add("mounted", 1)).ok).toBe(false);
  // The factory cannot take back the piece the site already mounted.
  const assemblyEntry = entries.find((row) => row.stage === "assembly")!;
  expect((await removeElementWorkAction({ workId: assemblyEntry.id })).ok).toBe(false);
  expect((await setElementDoneAction({ elementId: own.id, side: "factory", done: false })).ok).toBe(false);
  // The second piece passes assembly: now both are out, the site may mount it.
  expect(await add("assembly", 1)).toMatchObject({ ok: true, pieces: 1 });
  expect(await add("mounted", 1)).toMatchObject({ ok: true, pieces: 1 });
  // A mistaken cutting entry can go while nothing depends on it... here both are needed.
  const firstCut = entries.find((row) => row.stage === "cutting")!;
  expect((await removeElementWorkAction({ workId: firstCut.id })).ok).toBe(false);
});

async function prepareRoutes(marks = ["DEMO/1"]) {
  const tenant = tenants[0];
  await prisma.baustelle.update({ where: { id: tenant.site.id }, data: { type: "STEEL_ASSEMBLY" } });
  await importFor(tenant, marks);
  request.values.clear();
  request.values.set("bk_admin_id", await createTestSession("admin", tenant.admin.id));
  return prisma.siteElement.findMany({ where: { baustelleId: tenant.site.id }, orderBy: { mark: "asc" } });
}

it("configures only owned elements atomically and rejects stale revisions before changing any route", async () => {
  const rows = await prepareRoutes(["DEMO/1", "DEMO/2"]), [a, b] = rows;
  const input = { siteId: tenants[0].site.id, elementIds: rows.map(row => row.id), side: "factory", stages: ["cutting"] };
  expect(await setElementProcessesAction({ ...input, expectedRevisions: { [a.id]: 0, [b.id]: 1 } })).toMatchObject({ ok: false, code: "REVISION_CONFLICT" });
  for (const row of await prisma.siteElement.findMany({ where: { baustelleId: tenants[0].site.id } }))
    expect(row).toMatchObject({ processRevision: 0, processRoutes: { v: 1, factory: [], field: [] } });
  expect(await setElementProcessesAction({ ...input, expectedRevisions: { [a.id]: 0 } })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  expect(await setElementProcessesAction({ ...input, expectedRevisions: { [a.id]: 0, [b.id]: 0 } })).toMatchObject({ ok: true, revisions: { [a.id]: 1, [b.id]: 1 } });
  expect(await setElementProcessesAction({ ...input, expectedRevisions: { [a.id]: 1, [b.id]: 1 } })).toMatchObject({ ok: true, revisions: { [a.id]: 1, [b.id]: 1 } });
  expect(await setElementProcessesAction({ ...input, expectedRevisions: { [a.id]: 0, [b.id]: 0 }, stages: ["welding"] })).toMatchObject({ ok: false, code: "REVISION_CONFLICT" });
  await importFor(tenants[1], ["FOREIGN/1"]);
  const foreign = await prisma.siteElement.findFirstOrThrow({ where: { baustelleId: tenants[1].site.id } });
  expect(await setElementProcessesAction({ ...input, elementIds: [a.id, foreign.id], stages: ["welding"] })).toMatchObject({ ok: false, code: "NOT_FOUND" });
  expect(await setElementProcessesAction({ ...input, elementIds: [a.id], stages: ["mounted"] })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
});

it("keeps confirmations and legacy completion attribution while blocking a route change that takes back mounted material", async () => {
  const [row] = await prepareRoutes();
  await prisma.siteElement.update({ where: { id: row.id }, data: { processRoutes: Prisma.DbNull } });
  const saved = await addElementWorkAction({ elementId: row.id, stage: "cutting", workerIds: [tenants[0].worker.id], pieces: 2 });
  expect(saved.ok).toBe(true);
  expect((await setElementDoneAction({ elementId: row.id, side: "factory", done: true })).ok).toBe(true);
  expect((await addElementWorkAction({ elementId: row.id, stage: "mounted", workerIds: [tenants[0].worker.id], pieces: 1 })).ok).toBe(true);
  const before = await prisma.siteElement.findUniqueOrThrow({ where: { id: row.id }, include: { work: { orderBy: { id: "asc" } } } });
  const plan = { siteId: tenants[0].site.id, elementIds: [row.id], side: "factory", expectedRevisions: { [row.id]: 0 } };
  expect(await setElementProcessesAction({ ...plan, stages: ["cutting", "welding"] })).toMatchObject({ ok: false, code: "ALREADY_ON_SITE" });
  expect(await setElementProcessesAction({ ...plan, stages: [] })).toMatchObject({ ok: false, code: "ALREADY_ON_SITE" });
  expect(await setElementProcessesAction({ ...plan, stages: ["cutting"] })).toMatchObject({ ok: true, revisions: { [row.id]: 1 } });
  const after = await prisma.siteElement.findUniqueOrThrow({ where: { id: row.id }, include: { work: { orderBy: { id: "asc" } } } });
  expect(after.work).toEqual(before.work);
  expect(after.factoryDoneAt).toEqual(before.factoryDoneAt);
  expect(after.factoryDoneBy).toBe(before.factoryDoneBy);
  expect(doneQty({ ...after, list: after.list as ElementList }, "factory")).toBe(2);
  expect((await removeElementWorkAction({ workId: saved.workId! })).ok).toBe(false);
});

it("lets engineers plan either side while preserving side-specific confirmation permissions", async () => {
  const [row] = await prepareRoutes();
  const worker = tenants[0].worker;
  await prisma.worker.update({ where: { id: worker.id }, data: { crewRole: "FIELD_ENGINEER" } });
  request.values.clear(); request.values.set("bk_worker_id", await createTestSession("worker", worker.id));
  expect(await setElementProcessesAction({ siteId: tenants[0].site.id, elementIds: [row.id], side: "factory", stages: ["cutting"], expectedRevisions: { [row.id]: 0 } })).toMatchObject({ ok: true });
  expect((await addElementWorkAction({ elementId: row.id, stage: "cutting", workerIds: [worker.id], pieces: 2 })).ok).toBe(false);
  request.values.clear(); request.values.set("bk_admin_id", await createTestSession("admin", tenants[0].admin.id));
  expect((await addElementWorkAction({ elementId: row.id, stage: "cutting", workerIds: [worker.id], pieces: 2 })).ok).toBe(true);
  request.values.clear(); request.values.set("bk_worker_id", await createTestSession("worker", worker.id));
  expect(await setElementProcessesAction({ siteId: tenants[0].site.id, elementIds: [row.id], side: "field", stages: ["mounted"], expectedRevisions: { [row.id]: 1 } })).toMatchObject({ ok: true });
  expect((await addElementWorkAction({ elementId: row.id, stage: "mounted", workerIds: [worker.id], pieces: 1 })).ok).toBe(true);
  await prisma.worker.update({ where: { id: worker.id }, data: { crewRole: "FIELD_WORKER" } });
  expect(await setElementProcessesAction({ siteId: tenants[0].site.id, elementIds: [row.id], side: "field", stages: ["mounted"] })).toMatchObject({ ok: false, code: "ACCESS_DENIED" });
});

it("preserves configured absent marks and route versions during reimport without inventing completed material", async () => {
  const [a, b] = await prepareRoutes(["DEMO/1", "DEMO/2"]);
  expect(await setElementProcessesAction({ siteId: tenants[0].site.id, elementIds: [a.id], side: "factory", stages: ["cutting"], expectedRevisions: { [a.id]: 0 } })).toMatchObject({ ok: true });
  expect(await setElementProcessesAction({ siteId: tenants[0].site.id, elementIds: [a.id], side: "factory", stages: [], expectedRevisions: { [a.id]: 1 } })).toMatchObject({ ok: true });
  expect(await importFor(tenants[0], ["DEMO/3"], 'snapshot')).toMatchObject({ added: 1, removed: 1, kept: 1 });
  expect(await prisma.siteElement.findUnique({ where: { id: b.id } })).toBeNull();
  const kept = await prisma.siteElement.findUniqueOrThrow({ where: { id: a.id }, include: { work: true } });
  expect(kept).toMatchObject({ processRevision: 2, processRoutes: { v: 1, factory: [], field: [] }, work: [] });
  expect(doneQty({ ...kept, list: kept.list as ElementList }, "factory")).toBe(0);
  await importFor(tenants[0], ["DEMO/1"]);
  expect(await prisma.siteElement.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ processRevision: 2, processRoutes: { v: 1, factory: [], field: [] } });
});

it("starts new imported material unconfigured and preserves legacy null routes on reimport", async () => {
  const [row] = await prepareRoutes();
  expect(row).toMatchObject({ processRevision: 0, processRoutes: { v: 1, factory: [], field: [] } });
  expect((await addElementWorkAction({ elementId: row.id, stage: "cutting", workerIds: [tenants[0].worker.id], pieces: 1 })).ok).toBe(false);
  expect((await setElementDoneAction({ elementId: row.id, side: "factory", done: true })).ok).toBe(false);
  await prisma.siteElement.update({ where: { id: row.id }, data: { processRoutes: Prisma.DbNull } });
  await importFor(tenants[0], [row.mark]);
  expect(await prisma.siteElement.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ processRoutes: null, processRevision: 0 });
});

it("uses registered same-company custom processes, rejects foreign/new archived selections and lets an existing archived route finish", async () => {
  const [a, b] = await prepareRoutes(["DEMO/1", "DEMO/2"]);
  const fp = `fp-${"a".repeat(24)}`, sp = `sp-${"b".repeat(24)}`, foreignKey = `fp-${"c".repeat(24)}`;
  const factory = await prisma.steelWorkDefinition.create({ data: { companyProfileId: tenants[0].company.id, kind: "factory", key: fp, label: "Synthetic press" } });
  const field = await prisma.steelWorkDefinition.create({ data: { companyProfileId: tenants[0].company.id, kind: "field", key: sp, label: "Synthetic inspection" } });
  await prisma.steelWorkDefinition.create({ data: { companyProfileId: tenants[1].company.id, kind: "factory", key: foreignKey, label: "Foreign synthetic" } });
  const plan = (elementId: string, side: "factory" | "field", stages: string[]) => setElementProcessesAction({ siteId: tenants[0].site.id, elementIds: [elementId], side, stages });
  const add = (elementId: string, stage: string, pieces = 1) => addElementWorkAction({ elementId, stage, pieces, workerIds: [tenants[0].worker.id] });
  expect(await plan(a.id, "factory", [fp])).toMatchObject({ ok: true });
  expect(await plan(a.id, "field", [sp])).toMatchObject({ ok: true });
  expect(await plan(b.id, "factory", [foreignKey])).toMatchObject({ ok: false, code: "PROCESS_UNAVAILABLE" });
  expect(await add(a.id, fp)).toMatchObject({ ok: true, pieces: 1 });
  expect(await add(a.id, sp, 2)).toMatchObject({ ok: true, pieces: 1 });
  await prisma.steelWorkDefinition.updateMany({ where: { id: { in: [factory.id, field.id] } }, data: { archivedAt: new Date() } });
  expect(await plan(b.id, "factory", [fp])).toMatchObject({ ok: false, code: "PROCESS_UNAVAILABLE" });
  expect(await plan(b.id, "field", [sp])).toMatchObject({ ok: false, code: "PROCESS_UNAVAILABLE" });
  expect(await plan(a.id, "factory", [fp])).toMatchObject({ ok: true });
  expect(await add(a.id, fp)).toMatchObject({ ok: true, pieces: 1 });
  expect(await add(a.id, sp)).toMatchObject({ ok: true, pieces: 1 });
  expect((await add(a.id, sp)).ok).toBe(false);
  // Even a malformed imported/direct configuration cannot authorize a foreign
  // definition as a company process.
  await prisma.siteElement.update({ where: { id: b.id }, data: { processRoutes: { v: 1, factory: [foreignKey], field: [] } } });
  expect((await add(b.id, foreignKey)).ok).toBe(false);
  const part = await prisma.siteElement.create({ data: { companyProfileId: tenants[0].company.id, baustelleId: tenants[0].site.id, list: "part", mark: "PART/1", quantity: 2 } });
  expect(await plan(part.id, "field", [sp])).toMatchObject({ ok: false, code: "INVALID_INPUT" });
});
