import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { isSaasMode } from "@/lib/saas-config";

/**
 * T-025 — Tenant scoping foundation.
 *
 * Every server action and API handler that reads or writes company-owned
 * data must resolve the caller's `companyProfileId` through this module.
 *
 * On dedicated single-client deployments (SAAS_MODE=false) there is exactly
 * one CompanyProfile, so these helpers are effectively no-ops. Their value
 * comes later on the SaaS multi-tenant deployment, where a cross-tenant
 * mistake in a query would leak data.
 *
 * The rule:
 *   1. `getCurrentCompanyId()` — resolve the tenant of the current request.
 *   2. Filter every list query with `{ where: { companyProfileId } }`.
 *   3. When loading a single entity by id, call `assertOwnedByCurrentCompany`
 *      before returning it or writing anything derived from it.
 *
 * Do NOT read the tenant from user-controlled input (form fields, query
 * params). Always resolve it from the authenticated session.
 */

export class TenantAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantAccessError";
  }
}

export class TenantUnauthorizedError extends Error {
  constructor(message = "No authenticated tenant.") {
    super(message);
    this.name = "TenantUnauthorizedError";
  }
}

/**
 * Resolve the tenant (`companyProfileId`) of the current request from the
 * authenticated worker or admin session.
 *
 * Returns `null` when no session is present so callers can decide between
 * throwing (server actions) or redirecting to login (page handlers).
 */
export async function getCurrentCompanyId(): Promise<string | null> {
  const [worker, admin] = await Promise.all([getCurrentWorker(), getCurrentAdmin()]);
  // A browser must not combine an admin role from one identity with the
  // tenant of another. Login normally clears the other role cookie.
  if (worker && admin) return null;
  if (worker?.status === "active") return worker.companyProfileId;
  if (!admin) return null;

  // T-026: prefer the explicit User -> CompanyProfile link. This is set for
  // every SaaS signup and backfilled for dedicated deployments by the
  // 20260704120000_add_user_company_and_trial migration.
  const user = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { companyProfileId: true },
  });
  if (user?.companyProfileId) return user.companyProfileId;

  // Fallback for admins created before the backfill (edge case only): resolve
  // to the single default company on dedicated deployments. SaaS must never
  // fall back to the first tenant, because that would leak cross-tenant data.
  if (isSaasMode) return null;

  const company = await prisma.companyProfile.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return company?.id ?? null;
}

/**
 * Same as `getCurrentCompanyId` but throws when there is no session. Use
 * this in server actions where an unauthenticated caller should be a hard
 * error, not a silent read of the wrong tenant.
 */
export async function requireCurrentCompanyId(): Promise<string> {
  const id = await getCurrentCompanyId();
  if (!id) throw new TenantUnauthorizedError();
  return id;
}

/**
 * Assert that an entity belongs to the current tenant. Throws
 * `TenantAccessError` when the id does not match.
 *
 * Usage:
 * ```ts
 * const baustelle = await prisma.baustelle.findUnique({
 *   where: { id: baustelleId },
 *   select: { id: true, companyProfileId: true, ... },
 * });
 * if (!baustelle) return { ok: false, message: "Nicht gefunden." };
 * assertOwnedByCurrentCompany(baustelle, currentCompanyId);
 * ```
 */
export function assertOwnedByCurrentCompany(
  entity: { companyProfileId: string } | null | undefined,
  currentCompanyId: string,
): void {
  if (!entity) throw new TenantAccessError("Entity not found.");
  if (entity.companyProfileId !== currentCompanyId) {
    throw new TenantAccessError("Entity belongs to another tenant.");
  }
}

/**
 * Lightweight variant that returns a boolean instead of throwing, useful in
 * server actions that want to return a soft `ActionResult` on mismatch.
 */
export function isOwnedByCurrentCompany(
  entity: { companyProfileId: string } | null | undefined,
  currentCompanyId: string,
): boolean {
  return Boolean(entity && entity.companyProfileId === currentCompanyId);
}
