import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { canAdvanceProduction } from "@/lib/factory/production";
import { getCurrentWorker } from "@/lib/workzone/worker-session";

export type CompanyActor = {
  name: string;
  workerId: string | null;
  userId: string | null;
  isAdmin: boolean;
  /** Office, foreman or master: may move material through the factory. */
  canAdvance: boolean;
};

/** The signed-in person of the given company: a worker or an office admin. */
export async function currentCompanyActor(companyId: string): Promise<CompanyActor | null> {
  const [worker, admin] = await Promise.all([getCurrentWorker(), getCurrentAdmin()]);
  if (worker && worker.companyProfileId === companyId) {
    return {
      name: `${worker.firstName} ${worker.lastName}`.trim(),
      workerId: worker.id,
      userId: null,
      isAdmin: false,
      canAdvance: canAdvanceProduction({ isAdmin: false, level: worker.level }),
    };
  }
  if (admin && admin.companyProfileId === companyId) {
    return { name: (admin.name ?? admin.email ?? "Admin").trim(), workerId: null, userId: admin.id, isAdmin: true, canAdvance: true };
  }
  return null;
}
