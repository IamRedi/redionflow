import type { Prisma } from "@/generated/prisma/client";

import { legacyGrantRows, type AccessLevel } from "./rules";

type Tx = Prisma.TransactionClient;

/**
 * Sets a worker's level. The first time (level still empty) the crew role's
 * current rights are kept as visible "act" grants, so nobody loses work they
 * do today; the boss can remove them with the key button.
 */
export async function applyAccessLevel(tx: Tx, companyId: string, workerId: string, level: AccessLevel, grantedByUserId: string | null) {
  const row = await tx.worker.findFirst({ where: { id: workerId, companyProfileId: companyId }, select: { accessLevel: true, crewRole: true, siteDocumentGrants: { select: { baustelleId: true } } } });
  if (!row) return false;
  if (row.accessLevel === null) {
    for (const grant of legacyGrantRows(row.crewRole, new Set(row.siteDocumentGrants.map(g => g.baustelleId)))) {
      await tx.accessGrant.upsert({
        where: { companyProfileId_place_scopeId_workerId: { companyProfileId: companyId, place: grant.place, scopeId: grant.scopeId, workerId } },
        create: { companyProfileId: companyId, place: grant.place, scopeId: grant.scopeId, workerId, level: "act", grantedByUserId },
        update: {},
      });
    }
  }
  await tx.worker.update({ where: { id: workerId }, data: { accessLevel: level } });
  return true;
}
