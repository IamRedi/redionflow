import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { crewPermissions, type CrewPermissions } from "@/lib/workzone/crew-roles";
import { getCurrentWorker } from "@/lib/workzone/worker-session";

export type CompanyActor = {
  name: string;
  workerId: string | null;
  userId: string | null;
  isAdmin: boolean;
  /** Office, factory engineer: may move material through the factory. */
  canAdvance: boolean;
  can: CrewPermissions;
};

/** The signed-in person of the given company: a worker or an office admin. */
export async function currentCompanyActor(companyId: string): Promise<CompanyActor | null> {
  const [worker, admin] = await Promise.all([getCurrentWorker(), getCurrentAdmin()]);
  if (worker && worker.companyProfileId === companyId) {
    const can = crewPermissions({ isAdmin: false, crewRole: worker.crewRole, level: worker.level });
    return {
      name: `${worker.firstName} ${worker.lastName}`.trim(),
      workerId: worker.id,
      userId: null,
      isAdmin: false,
      canAdvance: can.factorySteps,
      can,
    };
  }
  if (admin && admin.companyProfileId === companyId) {
    const can = crewPermissions({ isAdmin: true });
    return { name: (admin.name ?? admin.email ?? "Admin").trim(), workerId: null, userId: admin.id, isAdmin: true, canAdvance: true, can };
  }
  return null;
}
