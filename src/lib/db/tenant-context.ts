import { prisma } from "@/lib/db/prisma";

/**
 * T-034 — Bind the current Postgres session to a tenant so RLS policies fire.
 *
 * The RLS policies from `20260705180000_add_rls_policies` look up
 * `current_setting('app.current_tenant_id')`. This helper wraps a Prisma
 * callback in a transaction, sets the variable with `SET LOCAL` (so it
 * lives for exactly one transaction), and executes the callback with
 * the transaction client.
 *
 * Use this in code paths that must be RLS-safe when `RLS_ENFORCE=true`.
 * Server actions and API routes that already rely on `getCurrentCompanyId`
 * for scoping can adopt it incrementally — application-layer scoping
 * (T-025 / T-025b) remains the primary defence, RLS is line two.
 *
 * When `RLS_ENFORCE=false` the helper still runs the callback in a
 * transaction and sets the variable so we get consistent behaviour in
 * development; the policies simply do not enforce until the DB migration
 * lands.
 */
export async function withTenantContext<T>(
  companyProfileId: string,
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // SET LOCAL scopes the variable to this transaction only; the pooled
    // connection is safe for the next request.
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant_id', $1, true)`,
      companyProfileId,
    );
    return fn(tx);
  });
}

/**
 * Read the flag without importing it directly so callers can pick up env
 * changes at request time (Vercel edge cache aside).
 */
export function isRlsEnforced(): boolean {
  const raw = process.env.RLS_ENFORCE?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}
