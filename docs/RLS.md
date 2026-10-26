# Row-Level Security (T-034)

Application-layer tenant scoping (T-025 / T-025b) is the primary defence
against cross-tenant reads and writes. Postgres Row-Level Security is line
two — a hard, database-level guarantee that survives even if an application
query forgets its `where: { companyProfileId }` filter.

This document describes how RLS is set up in the codebase, how to enable it
safely, how to roll it back, and how the fleet-GPS and realtime gaps flagged
in T-025b Phase 3 were closed.

## Design

- Every tenant-owned table gets `ENABLE ROW LEVEL SECURITY` + `FORCE ROW
  LEVEL SECURITY`. `FORCE` makes RLS apply even to table owners; without it
  a role that owns the table would silently bypass policies.
- Policies key on the Postgres session variable `app.current_tenant_id`,
  looked up via a small helper function `app_current_tenant_id()`. The
  variable is set per-transaction by the application (see
  `src/lib/db/tenant-context.ts`).
- If the variable is unset, `current_setting` with `missing_ok = true`
  returns `NULL` and every policy evaluates to `FALSE`. A tenant-less query
  returns **zero rows** and cannot mutate anything. This is the safe default.
- Child tables that do not carry `companyProfileId` directly (`TreeItem`,
  `ManualTask`, `WorkLog`, `WorkSession`, `WorkerAssetItem`, `WorkReportNote`,
  `ProjectPosition`, position line items, template presets, daily-plan
  children) are scoped via `EXISTS(SELECT 1 FROM parent ...)` policies. This
  keeps tenant enforcement even for rows the application only reaches via
  a join.
- Cross-tenant tables are intentionally NOT scoped: `Plan` (global catalog),
  `StripeWebhookEvent` (raw ledger), `WorkSessionPauseInterval`,
  `NotificationSubscription`, `NotificationSettings`. Access control for
  these lives at the application layer.

## Enabling RLS

The migration `prisma/migrations/20260705180000_add_rls_policies/migration.sql`
adds all policies. Application queries only start enforcing tenancy once
they run inside `withTenantContext(companyProfileId, fn)`. The env flag
`RLS_ENFORCE` guards the rollout so dedicated deployments do not break:

- `RLS_ENFORCE=false` (default): policies exist but application queries
  still run at request-level scoping. The transaction wrapping in
  `withTenantContext` is a no-op cost.
- `RLS_ENFORCE=true`: enable this once every code path that touches
  tenant-owned data is either (a) inside `withTenantContext`, or (b) uses
  a database role with `BYPASSRLS` for privileged jobs (migrations, seeds,
  admin scripts, background workers that legitimately span tenants).

**Progressive rollout playbook:**

1. Ship the migration.
2. Adopt `withTenantContext` at the highest-traffic surfaces first
   (workzone actions, admin actions, API routes).
3. Verify each surface manually with `RLS_ENFORCE=true` in staging.
4. Flip `RLS_ENFORCE=true` in production once staging is green.

## Postgres role setup

The Prisma app role must not have `BYPASSRLS`. Verify:

```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'baumkalk_app';
-- rolbypassrls must be FALSE
```

Migrations, seeds, and admin scripts should connect with a distinct role
(default `postgres` on Supabase) that carries `BYPASSRLS = true`. Never use
the bypass role from application requests. Never expose Supabase's
`service_role` key to the browser.

Supabase-specific note: the built-in `service_role` bypasses RLS and is
intended for trusted server-only use. Prisma should still connect with a
non-bypass role for application requests so RLS is the last line, not the
first bypass.

## Rollback

The rollback SQL lives next to the migration:
`prisma/migrations/20260705180000_add_rls_policies/rollback.sql`

Apply it manually in an incident. It drops every policy this migration
created and runs `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` + `NO FORCE`
on each table. The `app_current_tenant_id()` function is dropped last.

## Manual verification

```sql
-- With no tenant context set, all reads return zero rows:
SELECT count(*) FROM "Worker";
-- count = 0

-- Set the tenant and re-run:
SELECT set_config('app.current_tenant_id', 'clxxxx…tenant-id…', true);
SELECT count(*) FROM "Worker";
-- count = actual number for that tenant

-- Attempting to insert a row for a different tenant fails:
INSERT INTO "Worker" ("id", "companyProfileId", "firstName", "lastName", ...)
VALUES ('a', 'someone-elses-tenant', ...);
-- ERROR: new row violates row-level security policy for table "Worker"
```

## `withTenantContext` usage

```ts
import { withTenantContext } from "@/lib/db/tenant-context";
import { getCurrentCompanyId } from "@/lib/db/tenant";

export async function loadWorkers() {
  const tenant = await getCurrentCompanyId();
  if (!tenant) return [];
  return withTenantContext(tenant, (tx) =>
    tx.worker.findMany({ orderBy: { firstName: "asc" } }),
  );
}
```

Every DB query inside the callback runs under the tenant session variable
and passes RLS. Outside the callback the variable is unset and the pooled
connection is safe for the next request.

## Fleet GPS multi-tenant (closed)

The `FLEET_GPS_INGEST_TOKEN` env var was a shared secret — safe on
dedicated deployments, unsafe on SaaS. T-034 adds a `FleetIngestToken`
model so each tenant gets its own credential, and
`src/lib/fleet/ingest-auth.ts` resolves the tenant from the presented
token. The env var fallback stays supported for dedicated backwards
compatibility but is scoped to the single default company.

Rotate tokens by inserting a new row (any label) and setting the old row's
`isActive = false`. `lastUsedAt` shows when a token was last exercised.

## Realtime hub per-tenant channels (closed)

`notifyRealtimeUpdate(event, scope, companyProfileId?)` and
`subscribeRealtimeUpdates(fn, { companyProfileId })` now scope events by
tenant. Subscribers registered with a tenant id receive only their tenant's
events + unscoped system broadcasts. `/api/realtime/updates` resolves the
caller's tenant via `getCurrentCompanyId()` and subscribes with that scope,
so cross-tenant SSE leakage is impossible on the SaaS deployment.

Legacy publishers that call `notifyRealtimeUpdate(event, scope)` without a
tenant continue to broadcast to everyone. Migrate them in follow-ups: add
`companyProfileId` to the notification call when it is already in scope,
otherwise wrap in `withTenantContext` and read it from the current worker
or admin session.

## Follow-ups

- Sweep the remaining `notifyRealtimeUpdate` callers and add tenant scope.
- Adopt `withTenantContext` on every server action / API route that touches
  tenant-owned data, then flip `RLS_ENFORCE=true`.
- Grafana / alert on `AuditLog` entries with `action = 'plan_limit.blocked'`
  or `subscription.status_changed` for `past_due` transitions so support
  can act before customer complaints arrive.
