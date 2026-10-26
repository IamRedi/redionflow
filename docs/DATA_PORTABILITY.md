# Data portability (T-032)

Every tenant owns its data. Admins can request a full JSON snapshot of
their company at any time and — with the accompanying import script — hydrate
it into a fresh dedicated deployment. The reverse direction (dedicated →
SaaS) uses the same format.

## What the export contains

- **`schemaVersion`** — currently `"1.0.0"`. Increment when the shape changes.
- **`exportedAt`** — ISO timestamp when the snapshot was built.
- **`companyProfileId`** — the tenant id the export belongs to.
- **`tables`** — a flat object keyed by Prisma model name. Each entry is the
  full row list for that model, scoped to the tenant.
- **`files.urls`** — distinct Supabase Storage URLs referenced by exported
  rows (worker photos, baustelle documents, machine photos, etc.). The blob
  contents themselves are **not** in the JSON; they stay in Supabase Storage
  and must be copied separately (see below).

Tables exported today:

```
CompanyProfile, User, OverheadSettings, Subscription,
WorkzoneAnnouncement, CompanyKnowledge,
CompanyInventoryCatalog, CompanyInventoryItem,
LaborRole, Machine, Worker, WorkerAssetItem, WorkReportNote,
WorkSession, Baustelle, TreeItem, ManualTask, WorkLog,
InventoryMovement, InventoryAssetMovement, MachineConeMovement,
DailyWorkPlan (including columns + assignments + snapshots),
CalculationTemplate, TemplatePositionPreset,
Project, ProjectPosition, PositionLaborItem, PositionMachineItem,
PositionMaterialItem, PositionExternalServiceItem,
VacationRequest, WorkzoneSyncAction,
GpsLocationPoint, MachineBaustellePresence
```

## How to download

1. Sign in as an admin on the source deployment.
2. Open `Einstellungen`.
3. Click `JSON herunterladen`.

The response is served as `application/json` with a `Content-Disposition`
attachment, so browsers save it directly. The file name follows
`redionflow-export-<companyProfileId>-<timestamp>.json`.

Under the hood the download is served by `GET /api/portability/export`. The
route requires an admin session; it rejects worker sessions and unauthenticated
callers with `401`.

## Migration paths

### SaaS → dedicated

1. Export the JSON on the SaaS deployment.
2. Provision a fresh dedicated deployment (Railway or Docker + Supabase or
   Postgres) with the same `main` branch and env config.
3. Run the SaaS-mode migrations on the target so the schema matches.
4. Run the import script (`scripts/import-company.ts`, tracked separately)
   passing the JSON path. The importer inserts rows in dependency order and
   reuses existing ids so foreign keys stay intact.
5. Copy the Supabase Storage blobs referenced by `files.urls` into the
   destination bucket (Supabase CLI or `rclone`). The URLs stay valid if you
   preserve the object path; otherwise the importer can rewrite them.
6. Turn off SaaS-only env flags on the target (`SAAS_MODE=false`, drop
   Stripe env). The importer skips `Subscription` on dedicated targets.

### Dedicated → SaaS

1. Export the JSON on the dedicated deployment.
2. On the SaaS deployment, run the same import script but with a fresh
   `CompanyProfile` id (the importer accepts a `--newCompanyId` flag to
   remap all foreign keys). This avoids collisions with existing tenants.
3. Copy the Supabase Storage blobs into the SaaS bucket, using the new
   `companyProfileId` prefix (`worker-assets/<newId>/...`,
   `baustelle-documents/<newId>/...`).
4. Attach a `Subscription` row for the new tenant (starter trial by default,
   or a paid plan if the customer already checked out).

## Guard rails

- Every query in `buildCompanyExport` filters by `companyProfileId` directly
  or through a parent whose ownership was already asserted. There is no
  path that leaks cross-tenant data.
- The API route uses `getCurrentAdmin` + `requireCurrentCompanyId` so the
  caller can only export their own tenant. Cross-tenant admin impersonation
  is not possible today (an admin belongs to at most one tenant).
- `Subscription` is included so a customer can port their billing history,
  but on import into a SaaS destination the importer replaces the local
  `Subscription` row with a fresh trial (the source Stripe ids are not valid
  in the destination Stripe project).

## Follow-ups

- Ship `scripts/import-company.ts` alongside the exporter. The importer
  itself is deferred from T-032 to keep this task shippable; the export shape
  is already stable enough to hand-hydrate on the destination.
- Add an admin UI button to download **only** file blobs (via signed URLs)
  when the customer wants to leave the SaaS entirely.
- Add periodic export snapshots (daily/weekly) to Supabase Storage for large
  customers who want automatic backup coverage.
