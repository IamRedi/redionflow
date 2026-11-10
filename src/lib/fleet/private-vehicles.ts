import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { maySeePrivateVehicles } from "./private-vehicles-rule";
import { getCurrentWorker } from "@/lib/workzone/worker-session";

export { maySeePrivateVehicles };

/** The signed-in person; two sessions at once count as nobody. */
export async function currentMaySeePrivateVehicles(): Promise<boolean> {
  const [admin, worker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  if (admin && worker) return false;
  if (admin) return maySeePrivateVehicles({ name: admin.name ?? admin.email, isAdmin: true });
  if (worker) return maySeePrivateVehicles({ name: `${worker.firstName} ${worker.lastName}`, isAdmin: false });
  return false;
}

/** Prisma filter for vehicle lists: hides private vehicles from everyone else. */
export async function visibleVehiclesWhere(): Promise<{ isPrivate?: false }> {
  return (await currentMaySeePrivateVehicles()) ? {} : { isPrivate: false };
}
