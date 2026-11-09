import { afterEach, beforeEach, expect, it } from "vitest";

import { withTenantContext } from "@/lib/db/tenant-context";
import { removeSecurityTenants, seedSecurityTenants } from "../../../tests/security/fixtures";
import { loadWorkerAccess } from "./load";
import { can } from "./rules";

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
beforeEach(async () => { tenants = await seedSecurityTenants(); });
afterEach(async () => { await removeSecurityTenants(tenants.map(t => t.company.id)); });

it("loads level and key-button grants of a worker; a grant gives exactly its place", async () => {
  const [{ company, worker }] = tenants;
  await withTenantContext(company.id, async tx => {
    await tx.worker.update({ where: { id: worker.id }, data: { crewRole: null, accessLevel: "BASE" } });
    await tx.accessGrant.create({ data: { companyProfileId: company.id, place: "field", scopeId: "site-a", workerId: worker.id, level: "act" } });
    await tx.accessGrant.create({ data: { companyProfileId: company.id, place: "costs", workerId: worker.id, level: "view" } });
  });
  const subject = await withTenantContext(company.id, tx => loadWorkerAccess(tx, company.id, worker.id));
  expect(subject).toMatchObject({ kind: "worker", active: true, accessLevel: "BASE" });
  expect(can(subject!, "field.steps", "site-a")).toBe(true);
  expect(can(subject!, "field.steps", "site-b")).toBe(false);
  expect(can(subject!, "costs.view")).toBe(true);
  expect(can(subject!, "costs.manage")).toBe(false);
  expect(can(subject!, "factory.view")).toBe(false);
});

it("keeps grants inside their company and rejects unknown places or levels", async () => {
  const [a, b] = tenants;
  await withTenantContext(a.company.id, tx => tx.accessGrant.create({ data: { companyProfileId: a.company.id, place: "factory", workerId: a.worker.id, level: "act" } }));
  expect(await withTenantContext(b.company.id, tx => tx.accessGrant.count({ where: { companyProfileId: b.company.id } }))).toBe(0);
  expect(await withTenantContext(b.company.id, tx => loadWorkerAccess(tx, b.company.id, a.worker.id))).toBeNull();
  await expect(withTenantContext(a.company.id, tx => tx.accessGrant.create({ data: { companyProfileId: a.company.id, place: "bank", workerId: a.worker.id, level: "act" } }))).rejects.toThrow();
  await expect(withTenantContext(a.company.id, tx => tx.accessGrant.create({ data: { companyProfileId: a.company.id, place: "site", workerId: a.worker.id, level: "owner" } }))).rejects.toThrow();
  await expect(withTenantContext(a.company.id, tx => tx.worker.update({ where: { id: a.worker.id }, data: { accessLevel: "BOSS" } }))).rejects.toThrow();
  // Writing a grant for another company's worker is blocked.
  await expect(withTenantContext(b.company.id, tx => tx.accessGrant.create({ data: { companyProfileId: b.company.id, place: "site", workerId: a.worker.id, level: "view" } }))).rejects.toThrow();
});
