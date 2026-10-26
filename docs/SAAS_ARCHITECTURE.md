# SaaS Architecture

## Core Principle

BaumdienstFlow is:

- 1 codebase
- 1 platform
- multi-product
- mode-driven

No separate apps.

## Master Brand

Master brand: `RediOnFlow`

Used only for:

- footer
- legal
- documents

RediOnFlow is not the main UI product name.

## Products

User-facing product is derived from `company.mode`.

| Mode | Product | Scope |
| --- | --- | --- |
| `baumdienst` | BaumdienstFlow²⁶ | Full system and reference implementation |
| `bau` | BauFlow²⁶ | Construction companies, without tree logic |

BaumdienstFlow²⁶ includes:

- Workzone
- Trees
- Machines
- Reports

BauFlow²⁶ focuses on:

- tasks
- materials
- team coordination

A third mode (PersonalFlow) existed as an experiment and was removed on
2026-10-26 to keep the platform focused on two products. The database
rejects any other mode via a CHECK constraint.

`²⁶` is visual only. Never use it in DB, API, or logic.

## Mode System

`company.mode`:

```ts
"baumdienst" | "bau"
```

Controls:

- UI
- navigation
- visible modules
- feature flags
- assistant behavior

## Feature Flags

Central config:

```ts
const modeConfig = {
  baumdienst: {
    trees: true,
    machines: true,
    reports: true,
  },
  bau: {
    trees: false,
    machines: true,
    reports: true,
  },
  personal: {
    trees: false,
    machines: false,
    reports: "limited",
  },
};
```

Rule:

- no hardcoded product logic
- only feature flags

## Current System

Current production model is single-client.

Each client uses:

- dedicated deployment
- dedicated database
- isolated infrastructure

Deployment options:

- Railway
- Docker VPS

Database:

- Supabase
- Postgres

This model is stable, secure, and used for real clients.

## SaaS System

Future SaaS platform: `RediOnFlow`

Single global platform:

- Frontend: Vercel
- Backend: Supabase DB, Auth, Realtime
- Optional workers: Railway for imports, AI, cron, heavy jobs

Architecture:

```txt
User
  ↓
Vercel (Next.js)
  ↓
Service Layer (API / Server Actions)
  ↓
Supabase (DB + RLS + Auth)
  ↓
Storage
```

## Multi-Tenancy

All SaaS data must include:

```txt
company_id
```

Rules:

- strict RLS
- no cross-company access
- no `service_role` in frontend

## Load Distribution

Main load:

1. Database: Supabase
2. Realtime connections
3. Storage: files

Frontend is not a bottleneck.

## Dual Strategy

The project runs in parallel:

| System | Model | Purpose |
| --- | --- | --- |
| Single-client | Dedicated deploy | Stable production clients |
| SaaS | Multi-tenant global platform | RediOnFlow scaling |

Both must share:

- same codebase
- same logic
- same database structure

Only these may differ:

- environment
- deployment
- mode

## Rollout Order

1. Keep the current BaumdienstFlow single-client system stable.
2. Build SaaS structures around the same BaumdienstFlow behavior.
3. Make BaumdienstFlow in SaaS match the current client product.
4. Derive BauFlow from the same logic, without tree-specific modules.

No mode may fork the codebase.

## Work Rule

Every SaaS step must update repo notes:

- what changed
- how it was done
- what comes next

Use repo facts first:

- `docs/ADN.md`
- `docs/DECISIONS.md`
- `docs/ROADMAP.md`
- `docs/WORKLOG.md`

## Scaling Rule

System must scale without structural changes.

Allowed:

- optimize queries
- upgrade compute
- add caching

Not allowed:

- rewrite architecture
- duplicate codebase

## UI Branding

Top-right corner shows product name based on `company.mode`:

- BaumdienstFlow²⁶
- BauFlow²⁶

RediOnFlow is not shown there.

## Final Rule

We are not building multiple apps.

We are building one system that adapts based on:

- mode
- configuration
- UI

---

## Implementation Status (T-023)

### What is built (2026-05-28)

#### Database

`CompanyProfile.mode String @default("baumdienst")`

Migration: `20260527221723_add_company_mode`

#### Central config

`src/lib/mode-config.ts`

```ts
type CompanyMode = "baumdienst" | "bau"

modeConfig = {
  baumdienst: { trees: true,  machines: true, reports: true, baustellen: true, calculation: true, inventory: true, gps: true },
  bau:        { trees: false, machines: true, reports: true, baustellen: true, calculation: true, inventory: true, gps: true },
}
```

Exports: `resolveMode`, `getFeatures`, `productBranding`, `getCompanyMode`

#### Admin navigation (mode-aware)

`src/app/(admin)/app/layout.tsx`

Each nav item has an optional `requires` flag. Items whose flag is `false` in the current mode are hidden automatically. No hardcoded product checks.

| Nav item | requires |
|---|---|
| Personal & Flotte | — (always) |
| Fleet GPS | `gps` |
| Barcode Inventar | `inventory` |
| Sicherheit & Ausrüstung | `inventory` |
| Baustellen | `baustellen` |
| BaumKalk group (Projekte, Vorlagen, Lohnrollen, Maschinen) | `trees` |
| Einstellungen | — (always) |

#### Product name in UI

`src/components/shell/FlowTopBar.tsx` — small text label top-right: `BaumdienstFlow²⁶` / `BauFlow²⁶`

Admin sidebar also shows the product badge next to "Admin Panel".

### What each mode looks like right now

#### baumdienst (current client — unchanged)

All nav visible. All features active. Product name: BaumdienstFlow²⁶.

#### bau (can test locally)

Nav hidden: BaumKalk group (Projekte / Vorlagen / Lohnrollen — trees=false).
Nav visible: Personal & Flotte, Fleet GPS, Barcode Inventar, Sicherheit, Baustellen, Einstellungen.
Product name: BauFlow²⁶.

Note: Baustellen and Workzone are fully functional in bau mode — workers, sessions, tasks all work. Only the tree-specific cost calculation module is hidden.

### How to switch mode for testing

```sql
-- local docker postgres
UPDATE "CompanyProfile" SET mode = 'bau' WHERE id = (SELECT id FROM "CompanyProfile" LIMIT 1);
-- restart dev server or hard-refresh — no redeploy needed
```

```sql
-- revert
UPDATE "CompanyProfile" SET mode = 'baumdienst' WHERE id = (SELECT id FROM "CompanyProfile" LIMIT 1);
```

### What is NOT yet built (2026-07-04)

Tracked as roadmap tasks. Order matters — see `docs/ROADMAP.md` priority chain.

- **T-022 Phase 5**: Workzone `UPLOAD_DOCUMENT` offline wrapper with IndexedDB blob storage.
- **T-025**: Application-layer `companyId` scoping (foundation for multi-tenant).
- **T-026**: Public `/signup` flow gated by `SAAS_MODE=true`; creates Company + primary admin + 14-day trial.
- **T-027**: Stripe integration + `Plan`/`Subscription` models.
- **T-028**: Plan-based feature limits (workers, machines, storage, active baustellen).
- **T-029**: Mode-aware i18n so BauFlow stops showing "Baum" text.
- **T-030**: ~~PersonalFlow simplified UI~~ (built, then removed 2026-10-26).
- **T-031**: Multi-product landing with product tabs and `Start free trial` CTA.
- **T-032**: Data portability — export/import per Company for SaaS ↔ dedicated migrations.
- **T-033**: Central `AuditLog` for sensitive actions.
- **Supabase RLS**: Deferred until after T-025 and T-026 stabilize.
- **Admin UI settings page to change mode**: intentionally not built — clients do not choose mode; RediON sets it via SQL or signup.

### Tenant scoping rule (T-025, 2026-07-04)

Every server action, API handler, and query that touches company-owned data
must resolve the caller's tenant through `src/lib/db/tenant.ts`. The rule has
three parts:

1. Call `getCurrentCompanyId()` (or `requireCurrentCompanyId()`) at the top of
   the action. Never read the tenant from user-controlled input.
2. Filter every list query with `where: { companyProfileId }`.
3. When loading a single entity by id, verify ownership with
   `assertOwnedByCurrentCompany(entity, currentCompanyId)` before writing or
   returning anything derived from it. Use `isOwnedByCurrentCompany` for a
   soft check when a mismatch should return an `ActionResult` rather than
   throw.

Reference example: `deleteBaustelleAction` in
`src/app/(admin)/app/baustellen/actions.ts`.

Deployment mode is read separately from `src/lib/saas-config.ts`:

- `SAAS_MODE=false` (default) — dedicated single-client deployment. Tenant
  scoping is a no-op because there is exactly one CompanyProfile, but the
  helpers must still be used so the code stays SaaS-safe.
- `SAAS_MODE=true` — SaaS multi-tenant deployment. Tenant scoping is
  load-bearing and a missed check would leak data.

Application-layer scoping is the current line of defence. Supabase RLS lands
in a later task (see T-025b and follow-ups).

### T-025b Audit checklist

Track each server action / API route as it is reviewed and either has scoping
applied or is confirmed not to touch company-owned data.

**Phase 1 — Workzone (2026-07-04):** scoped ✓

- `src/app/(workzone)/workzone/actions.ts` — tree / task / session / baustelle actions
- `src/app/(workzone)/workzone/hr-actions.ts` — worker + session + reports + assets (via `assertWorkerAccess`)
- `src/app/(workzone)/workzone/safety-actions.ts` — safety equipment (via `resolveActorForTarget`)
- `src/app/(workzone)/workzone/inventory-actions.ts` — barcode inventory (via `resolveWorkerAccess` + tenant guard)
- `src/app/(workzone)/workzone/machine-actions.ts` — machine notes / defects / block
- `src/app/(workzone)/workzone/cone-actions.ts` — cone deploy / collect / transfer (via `machineConeAvailable`)
- `src/app/(workzone)/workzone/vacation-actions.ts` — vacation approve / reject / request
- `src/app/(workzone)/workzone/announcement-actions.ts` — workzone announcements
- `src/app/(workzone)/workzone/daily-plan-actions.ts` — daily work plan

**Phase 2 — Admin actions (2026-07-04):** scoped ✓

- `src/app/(admin)/app/baustellen/actions.ts` — all 6 baustelle CRUD + delete actions
- `src/app/(admin)/app/baustellen/import/actions.ts` — import verifies default company matches current
- `src/app/(admin)/app/admin/worker-admin-actions.ts` — update/delete verify worker ownership
- `src/app/(admin)/app/admin/safety-actions.ts` — catalog upsert verifies company
- `src/app/(admin)/app/settings/actions.ts` — save verifies current tenant matches form companyId
- `src/app/(admin)/app/projects/actions.ts` — new `ownedProject(id)` helper + tenant guard on create
- `src/app/(admin)/app/projects/[projectId]/positions/[positionId]/actions.ts` — `ownedPosition(id)` helper applied across 15 actions; labor/machine references also tenant-checked
- `src/app/(admin)/app/projects/[projectId]/quick-start-actions.ts` — quick-start verifies project ownership
- `src/app/(admin)/app/projects/[projectId]/recipe-builder-actions.ts` — recipe builder verifies project ownership
- `src/app/(admin)/app/projects/[projectId]/template-actions.ts` — apply template verifies project + template share tenant
- `src/app/(admin)/app/dashboard/actions.ts` — cache-only, no tenant risk
- `src/app/(admin)/app/profile/actions.ts` — intentionally deferred: `User` model has no `companyProfileId` today; landing in T-026 (signup ties User to Company)

**Phase 3 — API routes (2026-07-04):** scoped ✓

- `src/app/api/workzone/sync/route.ts` — already tenant-scoped (T-022)
- `src/app/api/workzone/sync/upload/route.ts` — already tenant-scoped (T-022 Phase 5)
- `src/app/api/workzone/gps/route.ts` — verified: uses `getCurrentWorker` + `company.id !== worker.companyProfileId` guard
- `src/app/api/notifications/register/route.ts` — session-scoped via `getCurrentAdmin`/`getCurrentWorker`; tenant implicit
- `src/app/api/assistant/route.ts` + `assistant/worker/route.ts` — session-scoped via `getRequesterContext`; tools operate under caller identity
- `src/app/api/admin-login/route.ts`, `display-login/route.ts`, `healthz/route.ts` — no tenant-owned data touched
- `src/app/api/fleet/gps/route.ts` — dedicated-safe (single default company). SaaS multi-tenant support requires per-tenant tokens or an explicit `companyId` claim; documented inline and deferred to a T-025b Phase 3 follow-up
- `src/app/api/realtime/updates/route.ts` — SSE from a global event hub. On SaaS, per-tenant channels are required so a client only receives its own updates. Deferred to T-034 territory alongside RLS

Phase 3 leaves two SaaS-specific gaps that are safe on dedicated
deployments today: fleet GPS multi-tenant ingest and the realtime hub. Both
are called out in `docs/SAAS_ARCHITECTURE.md` and reappear before SaaS launch.

### T-034 (2026-07-05): closed both Phase 3 gaps

- **Fleet GPS multi-tenant** — `FleetIngestToken` model + `resolveFleetIngestTenant`
  helper. Per-tenant credentials replace the shared `FLEET_GPS_INGEST_TOKEN`
  env; the env fallback stays for dedicated backwards compatibility.
- **Realtime hub per-tenant channels** — `notifyRealtimeUpdate(event, scope,
  companyProfileId?)` + `subscribeRealtimeUpdates(fn, { companyProfileId })`.
  `/api/realtime/updates` subscribes with the caller's tenant so SSE cannot
  leak cross-tenant.
- **RLS layer** — every tenant-owned table (direct + child) gets RLS with
  `USING/WITH CHECK ("companyProfileId" = app_current_tenant_id())`. Applied
  progressively via `withTenantContext(companyId, fn)` and gated by
  `RLS_ENFORCE=true`. Full runbook and rollback SQL in `docs/RLS.md`.

### Two Deployment Tracks (both live)

- **Dedicated** — `SAAS_MODE=false`, single Company per deployment, own database (Railway/Docker + Supabase/Postgres). Current stable path.
- **SaaS (RediOnFlow)** — `SAAS_MODE=true`, multi-tenant on Vercel + Supabase, subscription-based, all three modes selectable at signup.

Neither track may fork the codebase. Difference lives in env + tenant scoping + billing.
