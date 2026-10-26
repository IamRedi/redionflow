BEGIN;
-- Freeze tenant rows before preflight until all invariant triggers are installed.
-- Reads remain available; writes queue for this transaction or time out at the caller.
LOCK TABLE
  public."AuditLog",
  public."Baustelle",
  public."CalculationTemplate",
  public."CompanyInventoryCatalog",
  public."CompanyInventoryItem",
  public."CompanyKnowledge",
  public."CompanyProfile",
  public."DailyWorkPlan",
  public."DailyWorkPlanAssignment",
  public."DailyWorkPlanColumn",
  public."DailyWorkPlanSavedRow",
  public."DailyWorkPlanSnapshot",
  public."DailyWorkPlanSnapshotRow",
  public."FleetIngestToken",
  public."GpsLocationPoint",
  public."InventoryAssetMovement",
  public."InventoryMovement",
  public."LaborRole",
  public."Machine",
  public."MachineBaustellePresence",
  public."MachineConeMovement",
  public."ManualTask",
  public."NotificationSettings",
  public."NotificationSubscription",
  public."OverheadSettings",
  public."PositionExternalServiceItem",
  public."PositionLaborItem",
  public."PositionMachineItem",
  public."PositionMaterialItem",
  public."Project",
  public."ProjectPosition",
  public."Subscription",
  public."TemplatePositionPreset",
  public."TreeItem",
  public."User",
  public."VacationRequest",
  public."WorkLog",
  public."WorkReportNote",
  public."WorkSession",
  public."WorkSessionPauseInterval",
  public."Worker",
  public."WorkerAssetItem",
  public."WorkzoneAnnouncement",
  public."WorkzoneSyncAction"
IN SHARE ROW EXCLUSIVE MODE;
-- No production application in this task. Preflight refuses existing inconsistent rows.
-- Definer is restricted to allowlisted, read-only owner resolution; never returns row bodies.
CREATE FUNCTION public.bk_row_tenant(entity text, row_id text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF row_id IS NULL THEN RETURN NULL; END IF;
  CASE entity
    WHEN 'User' THEN RETURN (SELECT "companyProfileId" FROM public."User" WHERE id = row_id);
    WHEN 'Subscription' THEN RETURN (SELECT "companyProfileId" FROM public."Subscription" WHERE id = row_id);
    WHEN 'AuditLog' THEN RETURN (SELECT "companyProfileId" FROM public."AuditLog" WHERE id = row_id);
    WHEN 'FleetIngestToken' THEN RETURN (SELECT "companyProfileId" FROM public."FleetIngestToken" WHERE id = row_id);
    WHEN 'WorkzoneAnnouncement' THEN RETURN (SELECT "companyProfileId" FROM public."WorkzoneAnnouncement" WHERE id = row_id);
    WHEN 'CompanyKnowledge' THEN RETURN (SELECT "companyProfileId" FROM public."CompanyKnowledge" WHERE id = row_id);
    WHEN 'CompanyInventoryCatalog' THEN RETURN (SELECT "companyProfileId" FROM public."CompanyInventoryCatalog" WHERE id = row_id);
    WHEN 'CompanyInventoryItem' THEN RETURN (SELECT "companyProfileId" FROM public."CompanyInventoryItem" WHERE id = row_id);
    WHEN 'OverheadSettings' THEN RETURN (SELECT "companyProfileId" FROM public."OverheadSettings" WHERE id = row_id);
    WHEN 'LaborRole' THEN RETURN (SELECT "companyProfileId" FROM public."LaborRole" WHERE id = row_id);
    WHEN 'Machine' THEN RETURN (SELECT "companyProfileId" FROM public."Machine" WHERE id = row_id);
    WHEN 'MachineConeMovement' THEN RETURN (SELECT "companyProfileId" FROM public."MachineConeMovement" WHERE id = row_id);
    WHEN 'Worker' THEN RETURN (SELECT "companyProfileId" FROM public."Worker" WHERE id = row_id);
    WHEN 'VacationRequest' THEN RETURN (SELECT "companyProfileId" FROM public."VacationRequest" WHERE id = row_id);
    WHEN 'GpsLocationPoint' THEN RETURN (SELECT "companyProfileId" FROM public."GpsLocationPoint" WHERE id = row_id);
    WHEN 'MachineBaustellePresence' THEN RETURN (SELECT "companyProfileId" FROM public."MachineBaustellePresence" WHERE id = row_id);
    WHEN 'Baustelle' THEN RETURN (SELECT "companyProfileId" FROM public."Baustelle" WHERE id = row_id);
    WHEN 'InventoryMovement' THEN RETURN (SELECT "companyProfileId" FROM public."InventoryMovement" WHERE id = row_id);
    WHEN 'InventoryAssetMovement' THEN RETURN (SELECT "companyProfileId" FROM public."InventoryAssetMovement" WHERE id = row_id);
    WHEN 'DailyWorkPlan' THEN RETURN (SELECT "companyProfileId" FROM public."DailyWorkPlan" WHERE id = row_id);
    WHEN 'CalculationTemplate' THEN RETURN (SELECT "companyProfileId" FROM public."CalculationTemplate" WHERE id = row_id);
    WHEN 'Project' THEN RETURN (SELECT "companyProfileId" FROM public."Project" WHERE id = row_id);
    WHEN 'WorkzoneSyncAction' THEN RETURN (SELECT "companyProfileId" FROM public."WorkzoneSyncAction" WHERE id = row_id);
    WHEN 'CompanyProfile' THEN RETURN (SELECT id FROM public."CompanyProfile" WHERE id = row_id);
    WHEN 'WorkerAssetItem' THEN RETURN public.bk_row_tenant('Worker', (SELECT "workerId" FROM public."WorkerAssetItem" WHERE id = row_id));
    WHEN 'WorkReportNote' THEN RETURN public.bk_row_tenant('Worker', (SELECT "workerId" FROM public."WorkReportNote" WHERE id = row_id));
    WHEN 'WorkSession' THEN RETURN public.bk_row_tenant('Worker', (SELECT "workerId" FROM public."WorkSession" WHERE id = row_id));
    WHEN 'WorkSessionPauseInterval' THEN RETURN public.bk_row_tenant('WorkSession', (SELECT "workSessionId" FROM public."WorkSessionPauseInterval" WHERE id = row_id));
    WHEN 'TreeItem' THEN RETURN public.bk_row_tenant('Baustelle', (SELECT "baustelleId" FROM public."TreeItem" WHERE id = row_id));
    WHEN 'WorkLog' THEN RETURN public.bk_row_tenant('Baustelle', (SELECT "baustelleId" FROM public."WorkLog" WHERE id = row_id));
    WHEN 'ManualTask' THEN RETURN public.bk_row_tenant('Baustelle', (SELECT "baustelleId" FROM public."ManualTask" WHERE id = row_id));
    WHEN 'DailyWorkPlanColumn' THEN RETURN public.bk_row_tenant('DailyWorkPlan', (SELECT "planId" FROM public."DailyWorkPlanColumn" WHERE id = row_id));
    WHEN 'DailyWorkPlanAssignment' THEN RETURN public.bk_row_tenant('DailyWorkPlanColumn', (SELECT "columnId" FROM public."DailyWorkPlanAssignment" WHERE id = row_id));
    WHEN 'DailyWorkPlanSavedRow' THEN RETURN public.bk_row_tenant('DailyWorkPlan', (SELECT "planId" FROM public."DailyWorkPlanSavedRow" WHERE id = row_id));
    WHEN 'DailyWorkPlanSnapshot' THEN RETURN public.bk_row_tenant('DailyWorkPlan', (SELECT "planId" FROM public."DailyWorkPlanSnapshot" WHERE id = row_id));
    WHEN 'DailyWorkPlanSnapshotRow' THEN RETURN public.bk_row_tenant('DailyWorkPlanSnapshot', (SELECT "snapshotId" FROM public."DailyWorkPlanSnapshotRow" WHERE id = row_id));
    WHEN 'TemplatePositionPreset' THEN RETURN public.bk_row_tenant('CalculationTemplate', (SELECT "templateId" FROM public."TemplatePositionPreset" WHERE id = row_id));
    WHEN 'ProjectPosition' THEN RETURN public.bk_row_tenant('Project', (SELECT "projectId" FROM public."ProjectPosition" WHERE id = row_id));
    WHEN 'PositionLaborItem' THEN RETURN public.bk_row_tenant('ProjectPosition', (SELECT "positionId" FROM public."PositionLaborItem" WHERE id = row_id));
    WHEN 'PositionMachineItem' THEN RETURN public.bk_row_tenant('ProjectPosition', (SELECT "positionId" FROM public."PositionMachineItem" WHERE id = row_id));
    WHEN 'PositionMaterialItem' THEN RETURN public.bk_row_tenant('ProjectPosition', (SELECT "positionId" FROM public."PositionMaterialItem" WHERE id = row_id));
    WHEN 'PositionExternalServiceItem' THEN RETURN public.bk_row_tenant('ProjectPosition', (SELECT "positionId" FROM public."PositionExternalServiceItem" WHERE id = row_id));
    WHEN 'NotificationSubscription' THEN RETURN public.bk_row_tenant('Actor', (SELECT "userId" FROM public."NotificationSubscription" WHERE id = row_id));
    WHEN 'NotificationSettings' THEN RETURN public.bk_row_tenant('Actor', (SELECT "userId" FROM public."NotificationSettings" WHERE id = row_id));
    WHEN 'Actor' THEN
      -- User/Worker IDs live in separate namespaces. Ambiguous actors have no owner.
      IF EXISTS (SELECT 1 FROM public."User" WHERE id=row_id)
        AND EXISTS (SELECT 1 FROM public."Worker" WHERE id=row_id) THEN RETURN NULL; END IF;
      RETURN COALESCE(public.bk_row_tenant('User', row_id), public.bk_row_tenant('Worker', row_id));
    ELSE RETURN NULL;
  END CASE;
END $$;
REVOKE ALL ON FUNCTION public.bk_row_tenant(text, text) FROM PUBLIC;

CREATE FUNCTION public.bk_enforce_tenant_references() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE data jsonb := to_jsonb(NEW); previous jsonb; tenant text; old_tenant text; ref text; i integer;
BEGIN
  IF TG_ARGV[1] = 'SELF' THEN tenant := data ->> TG_ARGV[0];
  ELSE tenant := public.bk_row_tenant(TG_ARGV[1], data ->> TG_ARGV[0]); END IF;
  IF TG_OP = 'UPDATE' THEN
    previous := to_jsonb(OLD);
    IF TG_ARGV[1] = 'SELF' THEN old_tenant := previous ->> TG_ARGV[0];
    ELSE old_tenant := public.bk_row_tenant(TG_ARGV[1], previous ->> TG_ARGV[0]); END IF;
    IF tenant IS DISTINCT FROM old_tenant THEN
      RAISE EXCEPTION 'Tenant ownership cannot be reassigned' USING ERRCODE = '23514';
    END IF;
  END IF;
  -- FK ON DELETE SET NULL can run after an owning parent has already been
  -- cascade-deleted in the same statement. Permit only removal of links;
  -- no reparenting or non-null mutation can use this narrow cascade case.
  IF TG_OP = 'UPDATE' AND tenant IS NULL AND old_tenant IS NULL
    AND data ->> TG_ARGV[0] IS NOT NULL
    AND (data ->> TG_ARGV[0]) IS NOT DISTINCT FROM (previous ->> TG_ARGV[0])
    AND NOT EXISTS (SELECT 1 FROM jsonb_each(data) e
      WHERE e.value IS DISTINCT FROM (previous -> e.key) AND e.value <> 'null'::jsonb) THEN
    RETURN NEW;
  END IF;
  i := 2;
  WHILE i < TG_NARGS LOOP
    ref := data ->> TG_ARGV[i];
    IF ref IS NOT NULL AND (tenant IS NULL OR public.bk_row_tenant(TG_ARGV[i+1], ref) IS DISTINCT FROM tenant) THEN
      RAISE EXCEPTION 'Tenant reference mismatch' USING ERRCODE = '23514';
    END IF;
    i := i + 2;
  END LOOP;
  IF TG_TABLE_NAME = 'WorkSessionPauseInterval' AND (data ->> 'workerId') IS DISTINCT FROM
    (SELECT "workerId" FROM public."WorkSession" WHERE id = (data ->> 'workSessionId')) THEN
    RAISE EXCEPTION 'Pause worker does not own session' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.bk_enforce_tenant_references() FROM PUBLIC;

-- Validate pre-existing tenant links without rewriting or deleting any data.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public."WorkSessionPauseInterval" p JOIN public."WorkSession" s ON s.id=p."workSessionId" WHERE p."workerId" IS DISTINCT FROM s."workerId") THEN
    RAISE EXCEPTION 'Pause integrity preflight failed' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."User" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: User.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."Subscription" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: Subscription.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."AuditLog" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: AuditLog.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."AuditLog" t WHERE t."actorId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Actor', t."actorId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: AuditLog.actorId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."WorkzoneAnnouncement" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: WorkzoneAnnouncement.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."CompanyKnowledge" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: CompanyKnowledge.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."CompanyInventoryCatalog" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: CompanyInventoryCatalog.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."CompanyInventoryItem" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: CompanyInventoryItem.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."OverheadSettings" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: OverheadSettings.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."LaborRole" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: LaborRole.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."Machine" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: Machine.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."MachineConeMovement" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: MachineConeMovement.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."MachineConeMovement" t WHERE t."fromMachineId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Machine', t."fromMachineId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: MachineConeMovement.fromMachineId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."MachineConeMovement" t WHERE t."toMachineId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Machine', t."toMachineId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: MachineConeMovement.toMachineId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."MachineConeMovement" t WHERE t."baustelleId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Baustelle', t."baustelleId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: MachineConeMovement.baustelleId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."MachineConeMovement" t WHERE t."treeItemId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('TreeItem', t."treeItemId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: MachineConeMovement.treeItemId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."MachineConeMovement" t WHERE t."actorWorkerId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Worker', t."actorWorkerId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: MachineConeMovement.actorWorkerId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."MachineConeMovement" t WHERE t."actorAdminId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('User', t."actorAdminId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: MachineConeMovement.actorAdminId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."Worker" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: Worker.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."Worker" t WHERE t."addedByWorkerId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Worker', t."addedByWorkerId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: Worker.addedByWorkerId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."VacationRequest" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: VacationRequest.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."VacationRequest" t WHERE t."workerId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Worker', t."workerId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: VacationRequest.workerId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."VacationRequest" t WHERE t."reviewedByAdminId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('User', t."reviewedByAdminId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: VacationRequest.reviewedByAdminId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."GpsLocationPoint" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: GpsLocationPoint.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."GpsLocationPoint" t WHERE t."machineId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Machine', t."machineId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: GpsLocationPoint.machineId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."GpsLocationPoint" t WHERE t."workerId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Worker', t."workerId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: GpsLocationPoint.workerId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."GpsLocationPoint" t WHERE t."workSessionId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('WorkSession', t."workSessionId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: GpsLocationPoint.workSessionId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."GpsLocationPoint" t WHERE t."baustelleId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Baustelle', t."baustelleId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: GpsLocationPoint.baustelleId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."MachineBaustellePresence" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: MachineBaustellePresence.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."MachineBaustellePresence" t WHERE t."machineId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Machine', t."machineId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: MachineBaustellePresence.machineId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."MachineBaustellePresence" t WHERE t."baustelleId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Baustelle', t."baustelleId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: MachineBaustellePresence.baustelleId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."MachineBaustellePresence" t WHERE t."workSessionId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('WorkSession', t."workSessionId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: MachineBaustellePresence.workSessionId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."Baustelle" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: Baustelle.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."InventoryMovement" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: InventoryMovement.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."InventoryMovement" t WHERE t."baustelleId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Baustelle', t."baustelleId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: InventoryMovement.baustelleId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."InventoryMovement" t WHERE t."workerId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Worker', t."workerId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: InventoryMovement.workerId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."InventoryMovement" t WHERE t."actorAdminId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('User', t."actorAdminId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: InventoryMovement.actorAdminId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."InventoryMovement" t WHERE t."treeItemId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('TreeItem', t."treeItemId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: InventoryMovement.treeItemId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."InventoryAssetMovement" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: InventoryAssetMovement.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."InventoryAssetMovement" t WHERE t."itemId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyInventoryItem', t."itemId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: InventoryAssetMovement.itemId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."InventoryAssetMovement" t WHERE t."workerId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Worker', t."workerId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: InventoryAssetMovement.workerId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."InventoryAssetMovement" t WHERE t."actorAdminId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('User', t."actorAdminId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: InventoryAssetMovement.actorAdminId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."DailyWorkPlan" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: DailyWorkPlan.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."DailyWorkPlan" t WHERE t."createdByAdminId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('User', t."createdByAdminId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: DailyWorkPlan.createdByAdminId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."CalculationTemplate" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: CalculationTemplate.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."Project" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: Project.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."WorkzoneSyncAction" t WHERE t."companyProfileId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('CompanyProfile', t."companyProfileId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: WorkzoneSyncAction.companyProfileId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."WorkzoneSyncAction" t WHERE t."actorId" IS NOT NULL AND (public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS NULL OR public.bk_row_tenant('CompanyProfile', t."companyProfileId") IS DISTINCT FROM public.bk_row_tenant('Actor', t."actorId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: WorkzoneSyncAction.actorId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."WorkerAssetItem" t WHERE t."workerId" IS NOT NULL AND (public.bk_row_tenant('Worker', t."workerId") IS NULL OR public.bk_row_tenant('Worker', t."workerId") IS DISTINCT FROM public.bk_row_tenant('Worker', t."workerId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: WorkerAssetItem.workerId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."WorkerAssetItem" t WHERE t."companyInventoryItemId" IS NOT NULL AND (public.bk_row_tenant('Worker', t."workerId") IS NULL OR public.bk_row_tenant('Worker', t."workerId") IS DISTINCT FROM public.bk_row_tenant('CompanyInventoryItem', t."companyInventoryItemId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: WorkerAssetItem.companyInventoryItemId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."WorkReportNote" t WHERE t."workerId" IS NOT NULL AND (public.bk_row_tenant('Worker', t."workerId") IS NULL OR public.bk_row_tenant('Worker', t."workerId") IS DISTINCT FROM public.bk_row_tenant('Worker', t."workerId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: WorkReportNote.workerId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."WorkSession" t WHERE t."workerId" IS NOT NULL AND (public.bk_row_tenant('Worker', t."workerId") IS NULL OR public.bk_row_tenant('Worker', t."workerId") IS DISTINCT FROM public.bk_row_tenant('Worker', t."workerId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: WorkSession.workerId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."WorkSession" t WHERE t."baustelleId" IS NOT NULL AND (public.bk_row_tenant('Worker', t."workerId") IS NULL OR public.bk_row_tenant('Worker', t."workerId") IS DISTINCT FROM public.bk_row_tenant('Baustelle', t."baustelleId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: WorkSession.baustelleId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."WorkSessionPauseInterval" t WHERE t."workSessionId" IS NOT NULL AND (public.bk_row_tenant('WorkSession', t."workSessionId") IS NULL OR public.bk_row_tenant('WorkSession', t."workSessionId") IS DISTINCT FROM public.bk_row_tenant('WorkSession', t."workSessionId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: WorkSessionPauseInterval.workSessionId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."WorkSessionPauseInterval" t WHERE t."workerId" IS NOT NULL AND (public.bk_row_tenant('WorkSession', t."workSessionId") IS NULL OR public.bk_row_tenant('WorkSession', t."workSessionId") IS DISTINCT FROM public.bk_row_tenant('Worker', t."workerId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: WorkSessionPauseInterval.workerId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."TreeItem" t WHERE t."baustelleId" IS NOT NULL AND (public.bk_row_tenant('Baustelle', t."baustelleId") IS NULL OR public.bk_row_tenant('Baustelle', t."baustelleId") IS DISTINCT FROM public.bk_row_tenant('Baustelle', t."baustelleId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: TreeItem.baustelleId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."TreeItem" t WHERE t."completedBy" IS NOT NULL AND (public.bk_row_tenant('Baustelle', t."baustelleId") IS NULL OR public.bk_row_tenant('Baustelle', t."baustelleId") IS DISTINCT FROM public.bk_row_tenant('User', t."completedBy"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: TreeItem.completedBy' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."TreeItem" t WHERE t."completedByWorkerId" IS NOT NULL AND (public.bk_row_tenant('Baustelle', t."baustelleId") IS NULL OR public.bk_row_tenant('Baustelle', t."baustelleId") IS DISTINCT FROM public.bk_row_tenant('Worker', t."completedByWorkerId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: TreeItem.completedByWorkerId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."WorkLog" t WHERE t."userId" IS NOT NULL AND (public.bk_row_tenant('Baustelle', t."baustelleId") IS NULL OR public.bk_row_tenant('Baustelle', t."baustelleId") IS DISTINCT FROM public.bk_row_tenant('User', t."userId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: WorkLog.userId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."WorkLog" t WHERE t."baustelleId" IS NOT NULL AND (public.bk_row_tenant('Baustelle', t."baustelleId") IS NULL OR public.bk_row_tenant('Baustelle', t."baustelleId") IS DISTINCT FROM public.bk_row_tenant('Baustelle', t."baustelleId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: WorkLog.baustelleId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."ManualTask" t WHERE t."baustelleId" IS NOT NULL AND (public.bk_row_tenant('Baustelle', t."baustelleId") IS NULL OR public.bk_row_tenant('Baustelle', t."baustelleId") IS DISTINCT FROM public.bk_row_tenant('Baustelle', t."baustelleId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: ManualTask.baustelleId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."ManualTask" t WHERE t."userId" IS NOT NULL AND (public.bk_row_tenant('Baustelle', t."baustelleId") IS NULL OR public.bk_row_tenant('Baustelle', t."baustelleId") IS DISTINCT FROM public.bk_row_tenant('User', t."userId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: ManualTask.userId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."ManualTask" t WHERE t."workerId" IS NOT NULL AND (public.bk_row_tenant('Baustelle', t."baustelleId") IS NULL OR public.bk_row_tenant('Baustelle', t."baustelleId") IS DISTINCT FROM public.bk_row_tenant('Worker', t."workerId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: ManualTask.workerId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."ManualTask" t WHERE t."resolvedByUserId" IS NOT NULL AND (public.bk_row_tenant('Baustelle', t."baustelleId") IS NULL OR public.bk_row_tenant('Baustelle', t."baustelleId") IS DISTINCT FROM public.bk_row_tenant('User', t."resolvedByUserId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: ManualTask.resolvedByUserId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."ManualTask" t WHERE t."resolvedByWorkerId" IS NOT NULL AND (public.bk_row_tenant('Baustelle', t."baustelleId") IS NULL OR public.bk_row_tenant('Baustelle', t."baustelleId") IS DISTINCT FROM public.bk_row_tenant('Worker', t."resolvedByWorkerId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: ManualTask.resolvedByWorkerId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."DailyWorkPlanColumn" t WHERE t."planId" IS NOT NULL AND (public.bk_row_tenant('DailyWorkPlan', t."planId") IS NULL OR public.bk_row_tenant('DailyWorkPlan', t."planId") IS DISTINCT FROM public.bk_row_tenant('DailyWorkPlan', t."planId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: DailyWorkPlanColumn.planId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."DailyWorkPlanColumn" t WHERE t."baustelleId" IS NOT NULL AND (public.bk_row_tenant('DailyWorkPlan', t."planId") IS NULL OR public.bk_row_tenant('DailyWorkPlan', t."planId") IS DISTINCT FROM public.bk_row_tenant('Baustelle', t."baustelleId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: DailyWorkPlanColumn.baustelleId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."DailyWorkPlanAssignment" t WHERE t."columnId" IS NOT NULL AND (public.bk_row_tenant('DailyWorkPlanColumn', t."columnId") IS NULL OR public.bk_row_tenant('DailyWorkPlanColumn', t."columnId") IS DISTINCT FROM public.bk_row_tenant('DailyWorkPlanColumn', t."columnId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: DailyWorkPlanAssignment.columnId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."DailyWorkPlanAssignment" t WHERE t."workerId" IS NOT NULL AND (public.bk_row_tenant('DailyWorkPlanColumn', t."columnId") IS NULL OR public.bk_row_tenant('DailyWorkPlanColumn', t."columnId") IS DISTINCT FROM public.bk_row_tenant('Worker', t."workerId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: DailyWorkPlanAssignment.workerId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."DailyWorkPlanAssignment" t WHERE t."machineId" IS NOT NULL AND (public.bk_row_tenant('DailyWorkPlanColumn', t."columnId") IS NULL OR public.bk_row_tenant('DailyWorkPlanColumn', t."columnId") IS DISTINCT FROM public.bk_row_tenant('Machine', t."machineId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: DailyWorkPlanAssignment.machineId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."DailyWorkPlanSavedRow" t WHERE t."planId" IS NOT NULL AND (public.bk_row_tenant('DailyWorkPlan', t."planId") IS NULL OR public.bk_row_tenant('DailyWorkPlan', t."planId") IS DISTINCT FROM public.bk_row_tenant('DailyWorkPlan', t."planId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: DailyWorkPlanSavedRow.planId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."DailyWorkPlanSnapshot" t WHERE t."planId" IS NOT NULL AND (public.bk_row_tenant('DailyWorkPlan', t."planId") IS NULL OR public.bk_row_tenant('DailyWorkPlan', t."planId") IS DISTINCT FROM public.bk_row_tenant('DailyWorkPlan', t."planId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: DailyWorkPlanSnapshot.planId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."DailyWorkPlanSnapshot" t WHERE t."createdByAdminId" IS NOT NULL AND (public.bk_row_tenant('DailyWorkPlan', t."planId") IS NULL OR public.bk_row_tenant('DailyWorkPlan', t."planId") IS DISTINCT FROM public.bk_row_tenant('User', t."createdByAdminId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: DailyWorkPlanSnapshot.createdByAdminId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."DailyWorkPlanSnapshotRow" t WHERE t."snapshotId" IS NOT NULL AND (public.bk_row_tenant('DailyWorkPlanSnapshot', t."snapshotId") IS NULL OR public.bk_row_tenant('DailyWorkPlanSnapshot', t."snapshotId") IS DISTINCT FROM public.bk_row_tenant('DailyWorkPlanSnapshot', t."snapshotId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: DailyWorkPlanSnapshotRow.snapshotId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."TemplatePositionPreset" t WHERE t."templateId" IS NOT NULL AND (public.bk_row_tenant('CalculationTemplate', t."templateId") IS NULL OR public.bk_row_tenant('CalculationTemplate', t."templateId") IS DISTINCT FROM public.bk_row_tenant('CalculationTemplate', t."templateId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: TemplatePositionPreset.templateId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."ProjectPosition" t WHERE t."projectId" IS NOT NULL AND (public.bk_row_tenant('Project', t."projectId") IS NULL OR public.bk_row_tenant('Project', t."projectId") IS DISTINCT FROM public.bk_row_tenant('Project', t."projectId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: ProjectPosition.projectId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."PositionLaborItem" t WHERE t."positionId" IS NOT NULL AND (public.bk_row_tenant('ProjectPosition', t."positionId") IS NULL OR public.bk_row_tenant('ProjectPosition', t."positionId") IS DISTINCT FROM public.bk_row_tenant('ProjectPosition', t."positionId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: PositionLaborItem.positionId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."PositionLaborItem" t WHERE t."laborRoleId" IS NOT NULL AND (public.bk_row_tenant('ProjectPosition', t."positionId") IS NULL OR public.bk_row_tenant('ProjectPosition', t."positionId") IS DISTINCT FROM public.bk_row_tenant('LaborRole', t."laborRoleId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: PositionLaborItem.laborRoleId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."PositionMachineItem" t WHERE t."positionId" IS NOT NULL AND (public.bk_row_tenant('ProjectPosition', t."positionId") IS NULL OR public.bk_row_tenant('ProjectPosition', t."positionId") IS DISTINCT FROM public.bk_row_tenant('ProjectPosition', t."positionId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: PositionMachineItem.positionId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."PositionMachineItem" t WHERE t."machineId" IS NOT NULL AND (public.bk_row_tenant('ProjectPosition', t."positionId") IS NULL OR public.bk_row_tenant('ProjectPosition', t."positionId") IS DISTINCT FROM public.bk_row_tenant('Machine', t."machineId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: PositionMachineItem.machineId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."PositionMaterialItem" t WHERE t."positionId" IS NOT NULL AND (public.bk_row_tenant('ProjectPosition', t."positionId") IS NULL OR public.bk_row_tenant('ProjectPosition', t."positionId") IS DISTINCT FROM public.bk_row_tenant('ProjectPosition', t."positionId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: PositionMaterialItem.positionId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."PositionExternalServiceItem" t WHERE t."positionId" IS NOT NULL AND (public.bk_row_tenant('ProjectPosition', t."positionId") IS NULL OR public.bk_row_tenant('ProjectPosition', t."positionId") IS DISTINCT FROM public.bk_row_tenant('ProjectPosition', t."positionId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: PositionExternalServiceItem.positionId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."NotificationSubscription" t WHERE t."userId" IS NOT NULL AND (public.bk_row_tenant('Actor', t."userId") IS NULL OR public.bk_row_tenant('Actor', t."userId") IS DISTINCT FROM public.bk_row_tenant('Actor', t."userId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: NotificationSubscription.userId' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."NotificationSettings" t WHERE t."userId" IS NOT NULL AND (public.bk_row_tenant('Actor', t."userId") IS NULL OR public.bk_row_tenant('Actor', t."userId") IS DISTINCT FROM public.bk_row_tenant('Actor', t."userId"))) THEN
    RAISE EXCEPTION 'Tenant integrity preflight failed: NotificationSettings.userId' USING ERRCODE = '23514';
  END IF;
END $$;
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."User"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."Subscription"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."AuditLog"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile', 'actorId', 'Actor');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."FleetIngestToken"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."WorkzoneAnnouncement"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."CompanyKnowledge"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."CompanyInventoryCatalog"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."CompanyInventoryItem"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."OverheadSettings"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."LaborRole"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."Machine"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."MachineConeMovement"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile', 'fromMachineId', 'Machine', 'toMachineId', 'Machine', 'baustelleId', 'Baustelle', 'treeItemId', 'TreeItem', 'actorWorkerId', 'Worker', 'actorAdminId', 'User');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."Worker"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile', 'addedByWorkerId', 'Worker');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."VacationRequest"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile', 'workerId', 'Worker', 'reviewedByAdminId', 'User');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."GpsLocationPoint"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile', 'machineId', 'Machine', 'workerId', 'Worker', 'workSessionId', 'WorkSession', 'baustelleId', 'Baustelle');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."MachineBaustellePresence"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile', 'machineId', 'Machine', 'baustelleId', 'Baustelle', 'workSessionId', 'WorkSession');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."Baustelle"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."InventoryMovement"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile', 'baustelleId', 'Baustelle', 'workerId', 'Worker', 'actorAdminId', 'User', 'treeItemId', 'TreeItem');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."InventoryAssetMovement"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile', 'itemId', 'CompanyInventoryItem', 'workerId', 'Worker', 'actorAdminId', 'User');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."DailyWorkPlan"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile', 'createdByAdminId', 'User');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."CalculationTemplate"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."Project"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."WorkzoneSyncAction"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('companyProfileId', 'CompanyProfile', 'companyProfileId', 'CompanyProfile', 'actorId', 'Actor');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."CompanyProfile"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('id', 'SELF');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."WorkerAssetItem"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('workerId', 'Worker', 'workerId', 'Worker', 'companyInventoryItemId', 'CompanyInventoryItem');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."WorkReportNote"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('workerId', 'Worker', 'workerId', 'Worker');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."WorkSession"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('workerId', 'Worker', 'workerId', 'Worker', 'baustelleId', 'Baustelle');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."WorkSessionPauseInterval"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('workSessionId', 'WorkSession', 'workSessionId', 'WorkSession', 'workerId', 'Worker');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."TreeItem"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('baustelleId', 'Baustelle', 'baustelleId', 'Baustelle', 'completedBy', 'User', 'completedByWorkerId', 'Worker');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."WorkLog"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('baustelleId', 'Baustelle', 'userId', 'User', 'baustelleId', 'Baustelle');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."ManualTask"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('baustelleId', 'Baustelle', 'baustelleId', 'Baustelle', 'userId', 'User', 'workerId', 'Worker', 'resolvedByUserId', 'User', 'resolvedByWorkerId', 'Worker');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."DailyWorkPlanColumn"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('planId', 'DailyWorkPlan', 'planId', 'DailyWorkPlan', 'baustelleId', 'Baustelle');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."DailyWorkPlanAssignment"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('columnId', 'DailyWorkPlanColumn', 'columnId', 'DailyWorkPlanColumn', 'workerId', 'Worker', 'machineId', 'Machine');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."DailyWorkPlanSavedRow"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('planId', 'DailyWorkPlan', 'planId', 'DailyWorkPlan');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."DailyWorkPlanSnapshot"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('planId', 'DailyWorkPlan', 'planId', 'DailyWorkPlan', 'createdByAdminId', 'User');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."DailyWorkPlanSnapshotRow"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('snapshotId', 'DailyWorkPlanSnapshot', 'snapshotId', 'DailyWorkPlanSnapshot');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."TemplatePositionPreset"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('templateId', 'CalculationTemplate', 'templateId', 'CalculationTemplate');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."ProjectPosition"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('projectId', 'Project', 'projectId', 'Project');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."PositionLaborItem"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('positionId', 'ProjectPosition', 'positionId', 'ProjectPosition', 'laborRoleId', 'LaborRole');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."PositionMachineItem"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('positionId', 'ProjectPosition', 'positionId', 'ProjectPosition', 'machineId', 'Machine');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."PositionMaterialItem"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('positionId', 'ProjectPosition', 'positionId', 'ProjectPosition');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."PositionExternalServiceItem"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('positionId', 'ProjectPosition', 'positionId', 'ProjectPosition');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."NotificationSubscription"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('userId', 'Actor', 'userId', 'Actor');
CREATE TRIGGER bk_tenant_integrity BEFORE INSERT OR UPDATE ON public."NotificationSettings"
FOR EACH ROW EXECUTE FUNCTION public.bk_enforce_tenant_references('userId', 'Actor', 'userId', 'Actor');

-- Later child tables must not remain readable/writable outside tenant context.
ALTER TABLE public."WorkSessionPauseInterval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WorkSessionPauseInterval" FORCE ROW LEVEL SECURITY;
CREATE POLICY pause_tenant_policy ON public."WorkSessionPauseInterval" FOR ALL
USING (EXISTS (SELECT 1 FROM public."WorkSession" s JOIN public."Worker" w ON w.id=s."workerId"
  WHERE s.id="workSessionId" AND w."companyProfileId"=current_setting('app.current_tenant_id',true)))
WITH CHECK (EXISTS (SELECT 1 FROM public."WorkSession" s JOIN public."Worker" w ON w.id=s."workerId"
  WHERE s.id="workSessionId" AND w."companyProfileId"=current_setting('app.current_tenant_id',true)));
-- Resolve identity globally before RLS can hide a conflicting actor in the other table.
-- Narrow definer returns only the caller's already-bound tenant or NULL, never another
-- tenant ID or actor data. No writes/dynamic SQL; runtime role needs an explicit grant.
CREATE FUNCTION public.bk_notification_tenant(actor_id text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog, public AS $$
  SELECT CASE WHEN public.bk_row_tenant('Actor', actor_id)=current_setting('app.current_tenant_id',true)
    THEN current_setting('app.current_tenant_id',true) ELSE NULL END;
$$;
REVOKE ALL ON FUNCTION public.bk_notification_tenant(text) FROM PUBLIC;
ALTER TABLE public."NotificationSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NotificationSubscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_subscription_tenant ON public."NotificationSubscription" FOR ALL
USING (public.bk_notification_tenant("userId")=current_setting('app.current_tenant_id',true))
WITH CHECK (public.bk_notification_tenant("userId")=current_setting('app.current_tenant_id',true));
ALTER TABLE public."NotificationSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NotificationSettings" FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_settings_tenant ON public."NotificationSettings" FOR ALL
USING (public.bk_notification_tenant("userId")=current_setting('app.current_tenant_id',true))
WITH CHECK (public.bk_notification_tenant("userId")=current_setting('app.current_tenant_id',true));


COMMIT;
