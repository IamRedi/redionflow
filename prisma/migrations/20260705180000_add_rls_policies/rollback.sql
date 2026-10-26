-- T-034 rollback: drop all tenant policies and disable RLS on every
-- table that `migration.sql` touched. Run manually when an emergency
-- rollback is required; NOT applied automatically by prisma migrate.

DO $$
DECLARE
  tbl text;
  all_tables text[] := ARRAY[
    'AuditLog', 'Baustelle', 'CalculationTemplate', 'CompanyInventoryCatalog',
    'CompanyInventoryItem', 'CompanyKnowledge', 'DailyWorkPlan', 'GpsLocationPoint',
    'InventoryAssetMovement', 'InventoryMovement', 'LaborRole', 'Machine',
    'MachineBaustellePresence', 'MachineConeMovement', 'OverheadSettings',
    'Project', 'Subscription', 'User', 'VacationRequest', 'Worker',
    'WorkzoneAnnouncement', 'WorkzoneSyncAction',
    'CompanyProfile', 'TreeItem', 'ManualTask', 'WorkLog', 'WorkSession',
    'WorkerAssetItem', 'WorkReportNote', 'ProjectPosition',
    'PositionLaborItem', 'PositionMachineItem', 'PositionMaterialItem',
    'PositionExternalServiceItem', 'TemplatePositionPreset',
    'DailyWorkPlanColumn', 'DailyWorkPlanSnapshot',
    'DailyWorkPlanAssignment', 'DailyWorkPlanSavedRow',
    'DailyWorkPlanSnapshotRow'
  ];
BEGIN
  FOREACH tbl IN ARRAY all_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_tenant_policy', tbl);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS app_current_tenant_id();
