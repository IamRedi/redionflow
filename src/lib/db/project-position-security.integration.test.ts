import { afterEach, beforeEach, expect, it, vi } from "vitest";
const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => request.values.has(key) ? { value: request.values.get(key) } : undefined }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
import { prisma } from "./prisma";
import { seedSecurityTenants, removeSecurityTenants, createTestSession } from "../../../tests/security/fixtures";
import * as actions from "@/app/(admin)/app/projects/[projectId]/positions/[positionId]/actions";

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
beforeEach(async () => {
  vi.stubEnv("SESSION_SIGNING_SECRET", "synthetic-position-review-signing-key-only");
  request.values.clear(); tenants = await seedSecurityTenants();
});
afterEach(async () => { await removeSecurityTenants(tenants.map(t => t.company.id)); vi.unstubAllEnvs(); });
async function costs(tenant: typeof tenants[number]) {
  const position = await prisma.projectPosition.create({ data: { projectId: tenant.project.id, title: tenant.marker } });
  const role = await prisma.laborRole.create({ data: { companyProfileId: tenant.company.id, name: `${tenant.marker}-${position.id}`, wageType: "HOURLY" } });
  const [labor, machine, material, external] = await Promise.all([
    prisma.positionLaborItem.create({ data: { positionId: position.id, laborRoleId: role.id, laborRoleNameSnapshot: role.name, hours: "1" } }),
    prisma.positionMachineItem.create({ data: { positionId: position.id, machineId: tenant.machine.id, machineNameSnapshot: tenant.marker, quantity: "1" } }),
    prisma.positionMaterialItem.create({ data: { positionId: position.id, title: tenant.marker, quantity: "1", unit: "piece", unitPriceCents: 100 } }),
    prisma.positionExternalServiceItem.create({ data: { positionId: position.id, title: tenant.marker, amountCents: 100 } }),
  ]);
  return { position, role, rows: { labor, machine, material, external } };
}
const cases = [
  { kind: "labor", update: actions.updateLaborRow, remove: actions.deleteLaborRow,
    read: (id: string) => prisma.positionLaborItem.findUnique({ where: { id } }),
    check: async (id: string) => expect((await prisma.positionLaborItem.findUniqueOrThrow({ where: { id } })).workers).toBe(2) },
  { kind: "machine", update: actions.updateMachineRow, remove: actions.deleteMachineRow,
    read: (id: string) => prisma.positionMachineItem.findUnique({ where: { id } }),
    check: async (id: string) => expect((await prisma.positionMachineItem.findUniqueOrThrow({ where: { id } })).quantity.toString()).toBe("9") },
  { kind: "material", update: actions.updateMaterialRow, remove: actions.deleteMaterialRow,
    read: (id: string) => prisma.positionMaterialItem.findUnique({ where: { id } }),
    check: async (id: string) => expect((await prisma.positionMaterialItem.findUniqueOrThrow({ where: { id } })).title).toBe("Synthetic changed") },
  { kind: "external", update: actions.updateExternalRow, remove: actions.deleteExternalRow,
    read: (id: string) => prisma.positionExternalServiceItem.findUnique({ where: { id } }),
    check: async (id: string) => expect((await prisma.positionExternalServiceItem.findUniqueOrThrow({ where: { id } })).amountCents).toBe(2300) },
] as const;
for (const actor of [0, 1]) for (const c of cases) for (const operation of ["update", "delete"] as const) {
  it(`admin ${actor} ${operation} ${c.kind} binds child to owned position and preserves foreign rows`, async () => {
    const a = tenants[actor], b = tenants[1 - actor];
    const own = await costs(a), foreign = await costs(b), otherOwn = await costs(a);
    request.values.set("bk_admin_id", await createTestSession("admin", a.admin.id));
    const invoke = operation === "update" ? c.update : c.remove;
    function form(id: string) {
      const values = { id, positionId: own.position.id, projectId: a.project.id, laborRoleId: own.role.id,
        machineId: a.machine.id, title: "Synthetic changed", hours: "9", workers: "2", quantity: "9",
        timeUnit: "HOURS", unit: "piece", unitPriceEur: "23", amountEur: "23" };
      const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data;
    }
    for (const target of [foreign.rows[c.kind], otherOwn.rows[c.kind]]) {
      const before = JSON.stringify(await c.read(target.id));
      await invoke(form(target.id));
      expect(JSON.stringify(await c.read(target.id))).toBe(before);
    }
    const id = own.rows[c.kind].id;
    await invoke(form(id));
    if (operation === "delete") expect(await c.read(id)).toBeNull();
    else await c.check(id);
  });
}
