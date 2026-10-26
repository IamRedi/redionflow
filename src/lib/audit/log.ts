import { prisma } from "@/lib/db/prisma";

/**
 * T-033 — Central audit log.
 *
 * Record one row for every sensitive tenant state change (billing changes,
 * admin management, exports, plan-limit blocks, mode changes). The log is
 * per-tenant; admin can read only their own tenant's rows.
 *
 * Payload is JSON. Callers must NOT include raw PII (passwords, tokens,
 * full user rows). Keep it to a shortlist of relevant fields:
 * `{ subscriptionId, previousStatus, nextStatus }`, `{ removedAdminId }`,
 * `{ resource, currentCount, limit }`, etc.
 */

export type AuditActorType = "ADMIN" | "WORKER" | "SYSTEM";

export type AuditAction =
  | "signup.completed"
  | "signup.trial_attach_failed"
  | "subscription.status_changed"
  | "subscription.plan_changed"
  | "plan_limit.blocked"
  | "admin.removed"
  | "admin.created"
  | "data_export.downloaded"
  | "mode.changed";

export type RecordAuditInput = {
  companyProfileId: string;
  actorType: AuditActorType;
  actorId?: string | null;
  action: AuditAction | (string & {});
  payload?: Record<string, unknown>;
};

/**
 * Insert an audit row. Best-effort by design: audit writes must never break
 * the primary action. Wrap the call in a try/catch at the callsite when the
 * primary action is critical (billing webhook, signup).
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      companyProfileId: input.companyProfileId,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      payload: (input.payload ?? {}) as never,
    },
  });
}

/**
 * List audit entries for a tenant, newest first. Callers must resolve
 * `companyProfileId` from the session — this helper does not enforce access
 * control on its own.
 */
export async function listAuditEntries(companyProfileId: string, limit = 100) {
  return prisma.auditLog.findMany({
    where: { companyProfileId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(1, limit), 500),
  });
}
