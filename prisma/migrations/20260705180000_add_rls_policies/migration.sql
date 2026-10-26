-- T-034 — Supabase / Postgres Row-Level Security policies.
--
-- Strategy: every tenant-owned table gets RLS ENABLED with a single
-- USING/CHECK policy keyed on a Postgres session variable
-- `app.current_tenant_id`. The variable is set per-request by the
-- application (see `src/lib/db/tenant-context.ts`).
--
-- Safety by default: if the session variable is unset, `current_setting`
-- with the `missing_ok = true` argument returns NULL, and the policy
-- evaluates to FALSE — a query without tenant context returns zero rows
-- and cannot mutate anything.
--
-- The Prisma app role should carry `BYPASSRLS = false` in production so
-- these policies enforce. During migration / seed / admin scripts, use a
-- role WITH bypass (default `postgres` on local dev) so schema changes
-- work without setting the tenant variable.
--
-- Rollback: `20260705180000_add_rls_policies/rollback.sql` (drop policies
-- + ALTER TABLE ... DISABLE ROW LEVEL SECURITY).

-- Helper: return the current tenant id from the session variable, or NULL.
CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS text
  LANGUAGE sql STABLE AS $$
    SELECT current_setting('app.current_tenant_id', true)
  $$;

-- ---------------------------------------------------------------------------
-- Per-tenant tables: enable RLS + a single tenant-scoped policy.
-- Each policy grants ALL (SELECT + INSERT + UPDATE + DELETE) for rows
-- whose companyProfileId matches the session variable. INSERTs are
-- additionally checked via WITH CHECK so a caller cannot fabricate rows
-- for another tenant.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'AuditLog',
    'Baustelle',
    'CalculationTemplate',
    'CompanyInventoryCatalog',
    'CompanyInventoryItem',
    'CompanyKnowledge',
    'DailyWorkPlan',
    'GpsLocationPoint',
    'InventoryAssetMovement',
    'InventoryMovement',
    'LaborRole',
    'Machine',
    'MachineBaustellePresence',
    'MachineConeMovement',
    'OverheadSettings',
    'Project',
    'Subscription',
    'User',
    'VacationRequest',
    'Worker',
    'WorkzoneAnnouncement',
    'WorkzoneSyncAction'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL '
      'USING ("companyProfileId" = app_current_tenant_id()) '
      'WITH CHECK ("companyProfileId" = app_current_tenant_id())',
      tbl || '_tenant_policy', tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- CompanyProfile itself: RLS-scope by its own id.
-- Callers select a CompanyProfile only when the tenant variable matches its id.
-- ---------------------------------------------------------------------------
ALTER TABLE "CompanyProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyProfile" FORCE ROW LEVEL SECURITY;
CREATE POLICY "CompanyProfile_tenant_policy" ON "CompanyProfile" FOR ALL
  USING ("id" = app_current_tenant_id())
  WITH CHECK ("id" = app_current_tenant_id());

-- ---------------------------------------------------------------------------
-- Child tables scoped via parent (no direct companyProfileId column).
-- Policies join to the owning parent to derive tenant ownership.
-- ---------------------------------------------------------------------------

-- TreeItem via Baustelle
ALTER TABLE "TreeItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreeItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY "TreeItem_tenant_policy" ON "TreeItem" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Baustelle" b
    WHERE b."id" = "TreeItem"."baustelleId"
      AND b."companyProfileId" = app_current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Baustelle" b
    WHERE b."id" = "TreeItem"."baustelleId"
      AND b."companyProfileId" = app_current_tenant_id()
  ));

-- ManualTask via Baustelle
ALTER TABLE "ManualTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ManualTask" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ManualTask_tenant_policy" ON "ManualTask" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Baustelle" b
    WHERE b."id" = "ManualTask"."baustelleId"
      AND b."companyProfileId" = app_current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Baustelle" b
    WHERE b."id" = "ManualTask"."baustelleId"
      AND b."companyProfileId" = app_current_tenant_id()
  ));

-- WorkLog via Baustelle
ALTER TABLE "WorkLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY "WorkLog_tenant_policy" ON "WorkLog" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Baustelle" b
    WHERE b."id" = "WorkLog"."baustelleId"
      AND b."companyProfileId" = app_current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Baustelle" b
    WHERE b."id" = "WorkLog"."baustelleId"
      AND b."companyProfileId" = app_current_tenant_id()
  ));

-- WorkSession via Worker
ALTER TABLE "WorkSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkSession" FORCE ROW LEVEL SECURITY;
CREATE POLICY "WorkSession_tenant_policy" ON "WorkSession" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Worker" w
    WHERE w."id" = "WorkSession"."workerId"
      AND w."companyProfileId" = app_current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Worker" w
    WHERE w."id" = "WorkSession"."workerId"
      AND w."companyProfileId" = app_current_tenant_id()
  ));

-- WorkerAssetItem via Worker
ALTER TABLE "WorkerAssetItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkerAssetItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY "WorkerAssetItem_tenant_policy" ON "WorkerAssetItem" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Worker" w
    WHERE w."id" = "WorkerAssetItem"."workerId"
      AND w."companyProfileId" = app_current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Worker" w
    WHERE w."id" = "WorkerAssetItem"."workerId"
      AND w."companyProfileId" = app_current_tenant_id()
  ));

-- WorkReportNote via Worker
ALTER TABLE "WorkReportNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkReportNote" FORCE ROW LEVEL SECURITY;
CREATE POLICY "WorkReportNote_tenant_policy" ON "WorkReportNote" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Worker" w
    WHERE w."id" = "WorkReportNote"."workerId"
      AND w."companyProfileId" = app_current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Worker" w
    WHERE w."id" = "WorkReportNote"."workerId"
      AND w."companyProfileId" = app_current_tenant_id()
  ));

-- ProjectPosition via Project
ALTER TABLE "ProjectPosition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectPosition" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ProjectPosition_tenant_policy" ON "ProjectPosition" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p."id" = "ProjectPosition"."projectId"
      AND p."companyProfileId" = app_current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p."id" = "ProjectPosition"."projectId"
      AND p."companyProfileId" = app_current_tenant_id()
  ));

-- Position line items (labor/machine/material/external) via ProjectPosition → Project
DO $$
DECLARE
  child text;
  position_children text[] := ARRAY[
    'PositionLaborItem',
    'PositionMachineItem',
    'PositionMaterialItem',
    'PositionExternalServiceItem'
  ];
BEGIN
  FOREACH child IN ARRAY position_children LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', child);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', child);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL '
      'USING (EXISTS ('
      '  SELECT 1 FROM "ProjectPosition" pp JOIN "Project" p ON p."id" = pp."projectId" '
      '  WHERE pp."id" = %I."positionId" AND p."companyProfileId" = app_current_tenant_id()'
      ')) '
      'WITH CHECK (EXISTS ('
      '  SELECT 1 FROM "ProjectPosition" pp JOIN "Project" p ON p."id" = pp."projectId" '
      '  WHERE pp."id" = %I."positionId" AND p."companyProfileId" = app_current_tenant_id()'
      '))',
      child || '_tenant_policy', child, child, child
    );
  END LOOP;
END $$;

-- TemplatePositionPreset via CalculationTemplate
ALTER TABLE "TemplatePositionPreset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TemplatePositionPreset" FORCE ROW LEVEL SECURITY;
CREATE POLICY "TemplatePositionPreset_tenant_policy" ON "TemplatePositionPreset" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "CalculationTemplate" ct
    WHERE ct."id" = "TemplatePositionPreset"."templateId"
      AND ct."companyProfileId" = app_current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "CalculationTemplate" ct
    WHERE ct."id" = "TemplatePositionPreset"."templateId"
      AND ct."companyProfileId" = app_current_tenant_id()
  ));

-- DailyWorkPlan children via parent
DO $$
DECLARE
  child text;
  plan_children text[] := ARRAY[
    'DailyWorkPlanColumn',
    'DailyWorkPlanSnapshot'
  ];
BEGIN
  FOREACH child IN ARRAY plan_children LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', child);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', child);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL '
      'USING (EXISTS ('
      '  SELECT 1 FROM "DailyWorkPlan" dp '
      '  WHERE dp."id" = %I."planId" AND dp."companyProfileId" = app_current_tenant_id()'
      ')) '
      'WITH CHECK (EXISTS ('
      '  SELECT 1 FROM "DailyWorkPlan" dp '
      '  WHERE dp."id" = %I."planId" AND dp."companyProfileId" = app_current_tenant_id()'
      '))',
      child || '_tenant_policy', child, child, child
    );
  END LOOP;
END $$;

-- DailyWorkPlanAssignment via DailyWorkPlanColumn → DailyWorkPlan
ALTER TABLE "DailyWorkPlanAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyWorkPlanAssignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "DailyWorkPlanAssignment_tenant_policy" ON "DailyWorkPlanAssignment" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "DailyWorkPlanColumn" dc JOIN "DailyWorkPlan" dp ON dp."id" = dc."planId"
    WHERE dc."id" = "DailyWorkPlanAssignment"."columnId"
      AND dp."companyProfileId" = app_current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "DailyWorkPlanColumn" dc JOIN "DailyWorkPlan" dp ON dp."id" = dc."planId"
    WHERE dc."id" = "DailyWorkPlanAssignment"."columnId"
      AND dp."companyProfileId" = app_current_tenant_id()
  ));

-- DailyWorkPlanSavedRow via DailyWorkPlan (has planId directly)
ALTER TABLE "DailyWorkPlanSavedRow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyWorkPlanSavedRow" FORCE ROW LEVEL SECURITY;
CREATE POLICY "DailyWorkPlanSavedRow_tenant_policy" ON "DailyWorkPlanSavedRow" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "DailyWorkPlan" dp
    WHERE dp."id" = "DailyWorkPlanSavedRow"."planId"
      AND dp."companyProfileId" = app_current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "DailyWorkPlan" dp
    WHERE dp."id" = "DailyWorkPlanSavedRow"."planId"
      AND dp."companyProfileId" = app_current_tenant_id()
  ));

-- DailyWorkPlanSnapshotRow via DailyWorkPlanSnapshot → DailyWorkPlan
ALTER TABLE "DailyWorkPlanSnapshotRow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyWorkPlanSnapshotRow" FORCE ROW LEVEL SECURITY;
CREATE POLICY "DailyWorkPlanSnapshotRow_tenant_policy" ON "DailyWorkPlanSnapshotRow" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "DailyWorkPlanSnapshot" dps JOIN "DailyWorkPlan" dp ON dp."id" = dps."planId"
    WHERE dps."id" = "DailyWorkPlanSnapshotRow"."snapshotId"
      AND dp."companyProfileId" = app_current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "DailyWorkPlanSnapshot" dps JOIN "DailyWorkPlan" dp ON dp."id" = dps."planId"
    WHERE dps."id" = "DailyWorkPlanSnapshotRow"."snapshotId"
      AND dp."companyProfileId" = app_current_tenant_id()
  ));

-- ---------------------------------------------------------------------------
-- Public / cross-tenant tables intentionally NOT scoped:
--   Plan, StripeWebhookEvent, WorkSessionPauseInterval,
--   NotificationSubscription, NotificationSettings
-- These carry either global config (Plan) or ledger data whose access
-- control lives at the application layer.
-- ---------------------------------------------------------------------------
