import { prisma } from "@/lib/db/prisma";

import { steelPhasesFor } from "./steel-phases";

/**
 * Makes sure a steel site has one row per work phase. Idempotent: existing
 * phases (and their status) are never touched.
 */
export async function ensureSteelPhases(site: { id: string; type: string }) {
  const phases = steelPhasesFor(site.type);
  if (phases.length === 0) return 0;
  const result = await prisma.treeItem.createMany({
    data: phases.map((phase) => ({
      baustelleId: site.id,
      treeId: phase.treeId,
      species: phase.key,
      diameter: 0,
      status: "todo" as const,
    })),
    skipDuplicates: true,
  });
  return result.count;
}
