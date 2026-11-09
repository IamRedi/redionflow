import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { loadWorkerAccess } from "@/lib/access/load";
import { can as decide, type AccessAction, type AccessSubject } from "@/lib/access/rules";
import { withTenantContext } from "@/lib/db/tenant-context";
import type { CrewPermissions } from "@/lib/workzone/crew-roles";
import { getCurrentWorker } from "@/lib/workzone/worker-session";

export type CompanyActor = {
  name: string;
  workerId: string | null;
  userId: string | null;
  isAdmin: boolean;
  /** Office, factory engineer: may move material through the factory. */
  canAdvance: boolean;
  /** Rights that do not depend on a site (whole-place grants, crew role). */
  can: CrewPermissions;
  /** Rights at one site: adds key-button grants given for that site. */
  at: (siteId: string) => CrewPermissions;
  /** Single access check (src/lib/access/rules.ts). */
  allows: (action: AccessAction, scopeId?: string) => boolean;
};

const ADMIN: AccessSubject = { kind: "admin" };

/** Old permission shape from the new rules; identical for workers whose level is not set yet. */
export function permissionsAt(subject: AccessSubject, siteId = ""): CrewPermissions {
  return {
    siteSteps: decide(subject, "field.steps", siteId),
    factorySteps: decide(subject, "factory.steps", siteId),
    office: decide(subject, "site.details", siteId),
    reportMissing: decide(subject, "site.missing_material", siteId),
  };
}

/** The signed-in person of the given company: a worker or an office admin. */
export async function currentCompanyActor(companyId: string): Promise<CompanyActor | null> {
  const [worker, admin] = await Promise.all([getCurrentWorker(), getCurrentAdmin()]);
  // One authenticated person; never combine privileges from two cookies.
  if (worker && admin) return null;
  if (worker && worker.companyProfileId === companyId) {
    const subject = await withTenantContext(companyId, tx => loadWorkerAccess(tx, companyId, worker.id));
    if (!subject) return null;
    const can = permissionsAt(subject);
    return {
      name: `${worker.firstName} ${worker.lastName}`.trim(),
      workerId: worker.id,
      userId: null,
      isAdmin: false,
      canAdvance: can.factorySteps,
      can,
      at: siteId => permissionsAt(subject, siteId),
      allows: (action, scopeId = "") => decide(subject, action, scopeId),
    };
  }
  if (admin && admin.companyProfileId === companyId) {
    const can = permissionsAt(ADMIN);
    return { name: (admin.name ?? admin.email ?? "Admin").trim(), workerId: null, userId: admin.id, isAdmin: true, canAdvance: true, can, at: () => can, allows: () => true };
  }
  return null;
}
