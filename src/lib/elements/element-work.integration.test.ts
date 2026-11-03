import { afterEach, beforeEach, expect, it, vi } from "vitest";
const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (key: string) => (request.values.has(key) ? { value: request.values.get(key) } : undefined), set: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
import { prisma } from "@/lib/db/prisma";
import { withTenantContext } from "@/lib/db/tenant-context";
import { addElementWorkAction, removeElementWorkAction, setElementDoneAction } from "@/app/(workzone)/workzone/element-actions";
import { seedSecurityTenants, removeSecurityTenants, createTestSession } from "../../../tests/security/fixtures";
import { importElementList } from "./import";
import type { ParsedElementList } from "./tekla-list";

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

async function importFor(tenant: (typeof tenants)[number], marks: string[]) {
  return withTenantContext(tenant.company.id, (tx) =>
    importElementList(tx, { companyId: tenant.company.id, baustelleId: tenant.site.id, parsed: list(marks), fileName: "list.xls" }),
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
  expect(await importFor(a, ["B/2", "B/3"])).toMatchObject({ added: 1, updated: 1, removed: 1, kept: 1 });
  const after = await prisma.siteElement.findMany({ where: { baustelleId: a.site.id }, select: { mark: true, _count: { select: { work: true } } } });
  expect(after.map((row) => row.mark).sort()).toEqual(["B/10", "B/2", "B/3"]);
  expect(after.find((row) => row.mark === "B/10")?._count.work).toBe(1);
});

it("admin records who did how many pieces of a step, and finished pieces go to the site", async () => {
  const [a, b] = tenants;
  await importFor(a, ["B/1"]);
  await importFor(b, ["B/1"]);
  const own = await prisma.siteElement.findFirstOrThrow({ where: { baustelleId: a.site.id } });
  const foreign = await prisma.siteElement.findFirstOrThrow({ where: { baustelleId: b.site.id } });
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
