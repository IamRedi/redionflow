import { describe, expect, it } from "vitest";

import { BAU_DEMO } from "../../../prisma/seed-data-bau";
import { BAUMDIENST_DEMO } from "../../../prisma/seed-data";
import { GLASFASER_DEMO } from "../../../prisma/seed-data-glasfaser";

describe.each([
  ["baumdienst", BAUMDIENST_DEMO],
  ["bau", BAU_DEMO],
  ["bau", GLASFASER_DEMO],
])("demo seed dataset: %s (%#)", (mode, data) => {
  const workerKeys = new Set(data.workers.map((worker) => worker.key));
  const machineKeys = new Set(data.machines.map((machine) => machine.key));
  const roleNames = new Set(data.laborRoles.map((role) => role.name));

  it("runs in its own company mode", () => {
    expect(data.mode).toBe(mode);
  });

  it("references only workers and machines it defines", () => {
    for (const site of data.sites) {
      for (const key of site.crew) expect(workerKeys).toContain(key);
      for (const key of site.machines) expect(machineKeys).toContain(key);
    }
    expect(workerKeys).toContain(data.vacationWorker);
    expect(workerKeys).toContain(data.plannedVacationWorker);
    expect(machineKeys).toContain(data.offer.project.position.machineKey);
    for (const item of data.offer.project.position.labor) expect(roleNames).toContain(item.roleName);
  });

  it("hands over only inventory items it defines, to workers it defines", () => {
    const codes = new Set(data.inventory?.items.map((item) => item.code));
    expect(codes.size).toBe(data.inventory?.items.length ?? 0);
    for (const [workerKey, itemCodes] of Object.entries(data.inventory?.handovers ?? {})) {
      expect(workerKeys).toContain(workerKey);
      for (const code of itemCodes) expect(codes).toContain(code);
    }
    const categories = data.inventory?.catalogs.map((catalog) => catalog.category) ?? [];
    expect(new Set(categories).size).toBe(categories.length);
  });

  it("uses only .example addresses", () => {
    expect(data.company.email).toMatch(/\.example$/);
    expect(data.systemUser.email).toMatch(/\.example$/);
  });
});

it("keeps the demo companies apart", () => {
  const all = [BAUMDIENST_DEMO, BAU_DEMO, GLASFASER_DEMO];
  expect(new Set(all.map((data) => data.company.displayName)).size).toBe(all.length);
  expect(new Set(all.map((data) => data.systemUser.email)).size).toBe(all.length);
});
