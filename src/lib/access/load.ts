import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/observability/logger";

import { ACCESS_PLACES, can, type AccessAction, type AccessGrantRow, type AccessLevel, type AccessPlace, type AccessSubject } from "./rules";

type Tx = Prisma.TransactionClient;

const readLevel = (value: string | null): AccessLevel | null => (value === "BASE" || value === "FULL_VIEW" ? value : null);
const readPlace = (value: string): AccessPlace | null => ((ACCESS_PLACES as readonly string[]).includes(value) ? (value as AccessPlace) : null);

/** Fresh access facts of one worker, read inside the caller's tenant transaction. */
export async function loadWorkerAccess(tx: Tx, companyId: string, workerId: string): Promise<AccessSubject | null> {
  const worker = await tx.worker.findFirst({
    where: { id: workerId, companyProfileId: companyId },
    select: {
      status: true, crewRole: true, accessLevel: true,
      accessGrants: { where: { companyProfileId: companyId }, select: { place: true, scopeId: true, level: true } },
      siteDocumentGrants: { where: { companyProfileId: companyId }, select: { baustelleId: true } },
    },
  });
  if (!worker) return null;
  const grants: AccessGrantRow[] = [];
  for (const grant of worker.accessGrants) {
    const place = readPlace(grant.place);
    if (place && (grant.level === "view" || grant.level === "act")) grants.push({ place, scopeId: grant.scopeId, level: grant.level });
  }
  return {
    kind: "worker",
    active: worker.status === "active",
    accessLevel: readLevel(worker.accessLevel),
    crewRole: worker.crewRole,
    grants,
    legacySiteGrants: new Set(worker.siteDocumentGrants.map(row => row.baustelleId)),
  };
}

/**
 * Shadow check while call sites still use the old role checks: logs when the
 * new rules would decide differently, so the switch-on changes nothing by
 * surprise. Always returns the old decision.
 */
export function shadowAccess(subject: AccessSubject | null, action: AccessAction, scopeId: string, oldDecision: boolean, where: string) {
  if (!subject) return oldDecision;
  const next = can(subject, action, scopeId);
  if (next !== oldDecision) logger.info({ event: "access.shadow_diff", action, where, old: oldDecision, next }, "Access rules differ");
  return oldDecision;
}
