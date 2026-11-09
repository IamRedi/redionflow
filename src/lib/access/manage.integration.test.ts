import { afterEach, beforeEach, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ actor: vi.fn() }));
vi.mock("@/lib/company-assets/access", async original => ({ ...await original<typeof import("@/lib/company-assets/access")>(), assetActor: identity.actor }));

import { prisma } from "@/lib/db/prisma";
import { removeSecurityTenants, seedSecurityTenants } from "../../../tests/security/fixtures";
import { readPlaceAccess, readWorkerAccessSummary, setPlaceAccess, setWorkerAccessLevel } from "./manage";

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
beforeEach(async () => {
  tenants = await seedSecurityTenants();
  const [{ company, admin }] = tenants;
  identity.actor.mockResolvedValue({ companyId: company.id, userId: admin.id, workerId: null, name: "Admin", canManage: true, canRepair: true });
});
afterEach(async () => { identity.actor.mockReset(); await removeSecurityTenants(tenants.map(t => t.company.id)); });

it("adds, changes and removes a person at a site with the key button", async () => {
  const [{ worker, site }] = tenants;
  await prisma.worker.update({ where: { id: worker.id }, data: { crewRole: null } });
  const before = await readPlaceAccess("site", site.id);
  expect(before.scopeName).toBe(site.name);
  expect(before.people.find(p => p.id === worker.id)).toMatchObject({ level: "BASE", grant: null, acts: "none", sees: false });

  const acting = await setPlaceAccess({ place: "site", scopeId: site.id, workerId: worker.id, level: "act" });
  expect(acting.people.find(p => p.id === worker.id)).toMatchObject({ grant: "act", grantScope: "here", acts: "all", sees: true });

  const viewing = await setPlaceAccess({ place: "site", scopeId: site.id, workerId: worker.id, level: "view" });
  expect(viewing.people.find(p => p.id === worker.id)).toMatchObject({ grant: "view", acts: "none", sees: true });

  const summary = await readWorkerAccessSummary(worker.id);
  expect(summary.grants).toEqual([{ place: "site", scopeId: site.id, scopeName: site.name, level: "view" }]);

  const removed = await setPlaceAccess({ place: "site", scopeId: site.id, workerId: worker.id, level: null });
  expect(removed.people.find(p => p.id === worker.id)).toMatchObject({ grant: null, sees: false });
});

it("sets the level and shows role rights as partial", async () => {
  const [{ worker }] = tenants;
  await prisma.worker.update({ where: { id: worker.id }, data: { crewRole: "FIELD_ENGINEER" } });
  const site = await readPlaceAccess("site", tenants[0].site.id);
  expect(site.people.find(p => p.id === worker.id)).toMatchObject({ level: "FULL_VIEW", acts: "some", grant: null });
  const based = await setWorkerAccessLevel({ workerId: worker.id, level: "BASE" });
  // The role's rights become visible grants the first time the level is set.
  expect(based).toMatchObject({ level: "BASE", levelSet: true, fromRole: [], grants: [{ place: "site", scopeId: "", level: "act" }] });
  const again = await setWorkerAccessLevel({ workerId: worker.id, level: "FULL_VIEW" });
  expect(again.grants).toHaveLength(1);
});

it("refuses non-admins, other companies' people and sites, and bad input", async () => {
  const [a, b] = tenants;
  await expect(setPlaceAccess({ place: "site", scopeId: b.site.id, workerId: a.worker.id, level: "act" })).rejects.toThrow("NOT_FOUND");
  await expect(setPlaceAccess({ place: "factory", workerId: b.worker.id, level: "act" })).rejects.toThrow("NOT_FOUND");
  await expect(setPlaceAccess({ place: "bank", workerId: a.worker.id, level: "act" })).rejects.toThrow("BAD_INPUT");
  await expect(setPlaceAccess({ place: "factory", workerId: a.worker.id, level: "owner" })).rejects.toThrow("BAD_INPUT");
  await expect(setWorkerAccessLevel({ workerId: a.worker.id, level: "BOSS" })).rejects.toThrow("BAD_INPUT");
  identity.actor.mockResolvedValue({ companyId: a.company.id, userId: null, workerId: a.worker.id, name: "W", canManage: true, canRepair: true });
  await expect(readPlaceAccess("factory")).rejects.toThrow("DENIED");
  await expect(setPlaceAccess({ place: "factory", workerId: a.worker.id, level: "act" })).rejects.toThrow("DENIED");
  expect(await prisma.accessGrant.count({ where: { companyProfileId: { in: [a.company.id, b.company.id] } } })).toBe(0);
});
