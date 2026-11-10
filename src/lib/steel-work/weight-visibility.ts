import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { isWeightUnit, maySeeWeights } from "./weight-visibility-rule";

export { isWeightUnit, maySeeWeights };

/** The signed-in person (admin or worker); two sessions at once, or a display screen, count as nobody. */
export async function currentMaySeeWeights(): Promise<boolean> {
  const [admin, worker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  if (admin && worker) return maySeeWeights(null);
  if (admin) return maySeeWeights({ name: admin.name ?? admin.email });
  if (worker) return maySeeWeights({ name: `${worker.firstName} ${worker.lastName}` });
  return maySeeWeights(null);
}

/** Element rows for someone who may not see weights: no kg leaves the server. */
export function withoutWeights<T extends { weightKg?: number | null }>(rows: T[], show: boolean): T[] {
  return show ? rows : rows.map(row => ({ ...row, weightKg: null }));
}

/** A batch amount in kg or t becomes "no amount" for someone who may not see weights. */
export function batchQuantity(quantity: number | null, unit: string | null | undefined, show: boolean): number | null {
  return !show && isWeightUnit(unit) ? null : quantity;
}
