import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { prisma as legacyDb } from "./prisma";
import { TenantUnauthorizedError, TenantAccessError } from "./tenant";
import { isRuntimePilotEnabled, resolvePilotIdentity } from "@/lib/auth/pilot-session";
import { runTenantOperation } from "./operation-boundary";

export type TenantDb = Prisma.TransactionClient;
export class TenantRuntimeSecurityError extends Error {}

// A cached connection pool, not tenant state. Tenant identity exists only in the
// authenticated call and Postgres transaction-local context, never in this cache.
let runtimeClient: PrismaClient | undefined;
let queryCount = 0;

function client() {
  if (runtimeClient) return runtimeClient;
  const raw = process.env.TENANT_DATABASE_URL;
  if (!raw) throw new TenantRuntimeSecurityError("TENANT_DATABASE_URL is required; privileged fallback is forbidden.");
  const url = new URL(raw);
  if (process.env.APP_ENV !== "saas" || url.hostname !== "127.0.0.1" ||
      !["/baumkalk_integration", "/baumkalk_e2e"].includes(url.pathname) ||
      url.username !== "bk_saas_pilot_runtime") {
    throw new TenantRuntimeSecurityError("Runtime pilot requires its restricted LOGIN in an official disposable local database.");
  }
  const max = Number(process.env.TENANT_DB_POOL_MAX ?? 4);
  if (!Number.isSafeInteger(max) || max < 1 || max > 4) throw new TenantRuntimeSecurityError("Invalid pilot pool size.");
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: raw, max, connectionTimeoutMillis: 5_000 }),
    log: [{ emit: "event", level: "query" }],
  });
  db.$on("query", () => { queryCount += 1; }); // Counts only; never retains SQL, IDs or credentials.
  runtimeClient = db;
  return db;
}

type ConnectionGuard = {
  safe_role: boolean; policies_active: boolean; context: string | null;
};

/** Always restricted; authenticates again before opening the transaction. */
export async function withTenantDbContext<T>(
  authenticatedTenantId: string,
  callback: (tx: TenantDb) => Promise<T>,
  requiredRole: "any" | "admin" = "any",
): Promise<T> {
  if (!isRuntimePilotEnabled()) throw new TenantRuntimeSecurityError("Runtime RLS pilot is disabled.");
  const identity = await resolvePilotIdentity();
  if (!identity) throw new TenantUnauthorizedError();
  if (identity.companyProfileId !== authenticatedTenantId || (requiredRole === "admin" && identity.kind !== "admin")) {
    throw new TenantAccessError("Authenticated tenant/role mismatch.");
  }
  return client().$transaction(async tx => {
    const [guard] = await tx.$queryRaw<ConnectionGuard[]>`
      SELECT (
        current_user = session_user AND r.rolname = 'bk_saas_pilot_runtime'
        AND r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls
        AND NOT r.rolcreaterole AND NOT r.rolcreatedb AND NOT r.rolinherit
        AND NOT EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid)
        AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relowner=r.oid)
      ) AS safe_role,
      (SELECT count(*) = 8 AND bool_and(c.relrowsecurity AND c.relforcerowsecurity)
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname IN ('CompanyProfile','Baustelle','DailyWorkPlan',
          'DailyWorkPlanColumn','DailyWorkPlanAssignment','DailyWorkPlanSavedRow','DailyWorkPlanSnapshot','DailyWorkPlanSnapshotRow')) AS policies_active,
      current_setting('app.current_tenant_id',true) AS context
      FROM pg_roles r WHERE r.rolname=current_user`;
    if (!guard?.safe_role || !guard.policies_active || guard.context) {
      throw new TenantRuntimeSecurityError("Restricted role, RLS policy or pooled tenant-context invariant failed.");
    }
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${identity.companyProfileId}, true)`;
    return runTenantOperation(() => callback(tx));
  }, { maxWait: 5_000, timeout: 15_000 });
}

/** Only the named pilot callsites use this switch; it does not roll out RLS globally. */
export async function withPilotDbContext<T>(tenant: string, callback: (tx: TenantDb) => Promise<T>, role: "any" | "admin" = "any"): Promise<T> {
  if (isRuntimePilotEnabled()) return withTenantDbContext(tenant, callback, role);
  return legacyDb.$transaction(callback);
}

/** Fixed diagnostic, no arbitrary outside-transaction query API. */
export async function inspectTenantDbPool() {
  const [state] = await client().$queryRaw<Array<{
    pid: number; role: string; context: string | null; companies: bigint; sites: bigint; plans: bigint;
  }>>`SELECT pg_backend_pid() AS pid, current_user AS role,
    current_setting('app.current_tenant_id',true) AS context,
    (SELECT count(*) FROM "CompanyProfile") AS companies,
    (SELECT count(*) FROM "Baustelle") AS sites,
    (SELECT count(*) FROM "DailyWorkPlan") AS plans`;
  return { ...state, queryCount };
}

export async function disconnectTenantDbPool() {
  await runtimeClient?.$disconnect();
  runtimeClient = undefined;
}
