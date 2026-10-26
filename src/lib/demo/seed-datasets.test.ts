import { describe, expect, it } from "vitest";

import { BAU_DEMO } from "../../../prisma/seed-data-bau";
import { BAUMDIENST_DEMO } from "../../../prisma/seed-data";

describe.each([
  ["baumdienst", BAUMDIENST_DEMO],
  ["bau", BAU_DEMO],
])("demo seed dataset: %s", (mode, data) => {
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

  it("uses only .example addresses", () => {
    expect(data.company.email).toMatch(/\.example$/);
    expect(data.systemUser.email).toMatch(/\.example$/);
  });
});

it("keeps the two demo companies apart", () => {
  expect(BAU_DEMO.company.displayName).not.toBe(BAUMDIENST_DEMO.company.displayName);
  expect(BAU_DEMO.systemUser.email).not.toBe(BAUMDIENST_DEMO.systemUser.email);
});
