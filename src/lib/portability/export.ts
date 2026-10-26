import { prisma } from "@/lib/db/prisma";

/**
 * T-032 — Company data export.
 *
 * Collect every row that belongs to a single tenant into a single JSON
 * document. The shape is intentionally flat (`tables: { [name]: rows[] }`)
 * so a future importer can loop over tables in the correct dependency order
 * without hand-rolled joins.
 *
 * The export is *data-only*. Files stored in Supabase Storage (worker
 * assets, baustelle documents) are referenced by URL — the actual blob copy
 * is a separate manual/scripted step described in `docs/DATA_PORTABILITY.md`.
 *
 * Scope safety: every query below filters by `companyProfileId` directly or
 * through a parent whose `companyProfileId` was already asserted. There is
 * no path that leaks cross-tenant data.
 */

export const COMPANY_EXPORT_SCHEMA_VERSION = "1.0.0";

export type CompanyExport = {
  schemaVersion: string;
  exportedAt: string;
  companyProfileId: string;
  tables: Record<string, unknown[]>;
  files: {
    /** Distinct Supabase Storage URLs referenced from the exported rows. */
    urls: string[];
  };
};

function collectStorageUrls(rows: Array<Record<string, unknown>>, fields: string[]): string[] {
  const urls = new Set<string>();
  for (const row of rows) {
    for (const field of fields) {
      const value = row[field];
      if (typeof value === "string" && value.startsWith("http")) urls.add(value);
      else if (Array.isArray(value)) {
        for (const entry of value) {
          if (typeof entry === "string" && entry.startsWith("http")) urls.add(entry);
        }
      }
    }
  }
  return Array.from(urls);
}

/**
 * Build a portable snapshot of every row owned by `companyProfileId`. Safe
 * on live data; runs in a single logical read pass (no transaction — this
 * is an export, not a mutation).
 */
export async function buildCompanyExport(companyProfileId: string): Promise<CompanyExport> {
  const where = { companyProfileId };

  const [
    company,
    users,
    overheadSettings,
    subscription,
    workzoneAnnouncements,
    knowledge,
    inventoryCatalog,
    inventoryItems,
    laborRoles,
    machines,
    workers,
    workerAssetItems,
    workReportNotes,
    workSessions,
    baustellen,
    inventoryMovements,
    inventoryAssetMovements,
    coneMovements,
    dailyPlans,
    templates,
    templatePositions,
    projects,
    projectPositions,
    positionLabor,
    positionMachines,
    positionMaterials,
    positionExternals,
    vacationRequests,
    workzoneSyncActions,
    gpsLocationPoints,
    machineBaustellePresences,
  ] = await Promise.all([
    prisma.companyProfile.findUnique({ where: { id: companyProfileId } }),
    prisma.user.findMany({ where }),
    prisma.overheadSettings.findFirst({ where }),
    prisma.subscription.findUnique({ where: { companyProfileId } }),
    prisma.workzoneAnnouncement.findMany({ where }),
    prisma.companyKnowledge.findMany({ where }),
    prisma.companyInventoryCatalog.findMany({ where }),
    prisma.companyInventoryItem.findMany({ where }),
    prisma.laborRole.findMany({ where }),
    prisma.machine.findMany({ where }),
    prisma.worker.findMany({ where }),
    prisma.workerAssetItem.findMany({ where: { worker: { companyProfileId } } }),
    prisma.workReportNote.findMany({ where: { worker: { companyProfileId } } }),
    prisma.workSession.findMany({ where: { worker: { companyProfileId } } }),
    prisma.baustelle.findMany({ where }),
    prisma.inventoryMovement.findMany({ where }),
    prisma.inventoryAssetMovement.findMany({ where }),
    prisma.machineConeMovement.findMany({ where }),
    prisma.dailyWorkPlan.findMany({
      where,
      include: {
        columns: { include: { assignments: true } },
        savedRows: true,
        snapshots: { include: { rows: true } },
      },
    }),
    prisma.calculationTemplate.findMany({ where }),
    prisma.templatePositionPreset.findMany({
      where: { template: { companyProfileId } },
    }),
    prisma.project.findMany({ where }),
    prisma.projectPosition.findMany({ where: { project: { companyProfileId } } }),
    prisma.positionLaborItem.findMany({
      where: { position: { project: { companyProfileId } } },
    }),
    prisma.positionMachineItem.findMany({
      where: { position: { project: { companyProfileId } } },
    }),
    prisma.positionMaterialItem.findMany({
      where: { position: { project: { companyProfileId } } },
    }),
    prisma.positionExternalServiceItem.findMany({
      where: { position: { project: { companyProfileId } } },
    }),
    prisma.vacationRequest.findMany({ where }),
    prisma.workzoneSyncAction.findMany({ where }),
    prisma.gpsLocationPoint.findMany({ where }),
    prisma.machineBaustellePresence.findMany({ where }),
  ]);

  if (!company) {
    throw new Error(`No CompanyProfile found for id=${companyProfileId}`);
  }

  const treeItems = await prisma.treeItem.findMany({
    where: { baustelle: { companyProfileId } },
  });
  const manualTasks = await prisma.manualTask.findMany({
    where: { baustelle: { companyProfileId } },
  });
  const workLogs = await prisma.workLog.findMany({
    where: { baustelle: { companyProfileId } },
  });

  const tables: Record<string, unknown[]> = {
    CompanyProfile: [company],
    User: users,
    OverheadSettings: overheadSettings ? [overheadSettings] : [],
    Subscription: subscription ? [subscription] : [],
    WorkzoneAnnouncement: workzoneAnnouncements,
    CompanyKnowledge: knowledge,
    CompanyInventoryCatalog: inventoryCatalog,
    CompanyInventoryItem: inventoryItems,
    LaborRole: laborRoles,
    Machine: machines,
    Worker: workers,
    WorkerAssetItem: workerAssetItems,
    WorkReportNote: workReportNotes,
    WorkSession: workSessions,
    Baustelle: baustellen,
    TreeItem: treeItems,
    ManualTask: manualTasks,
    WorkLog: workLogs,
    InventoryMovement: inventoryMovements,
    InventoryAssetMovement: inventoryAssetMovements,
    MachineConeMovement: coneMovements,
    DailyWorkPlan: dailyPlans,
    CalculationTemplate: templates,
    TemplatePositionPreset: templatePositions,
    Project: projects,
    ProjectPosition: projectPositions,
    PositionLaborItem: positionLabor,
    PositionMachineItem: positionMachines,
    PositionMaterialItem: positionMaterials,
    PositionExternalServiceItem: positionExternals,
    VacationRequest: vacationRequests,
    WorkzoneSyncAction: workzoneSyncActions,
    GpsLocationPoint: gpsLocationPoints,
    MachineBaustellePresence: machineBaustellePresences,
  };

  const fileUrls = [
    ...collectStorageUrls(baustellen as Array<Record<string, unknown>>, ["documents"]),
    ...collectStorageUrls(workers as Array<Record<string, unknown>>, ["profileImageUrl", "documents"]),
    ...collectStorageUrls(workerAssetItems as Array<Record<string, unknown>>, ["photoUrl"]),
    ...collectStorageUrls(machines as Array<Record<string, unknown>>, ["photoUrl"]),
  ];

  return {
    schemaVersion: COMPANY_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    companyProfileId,
    tables,
    files: { urls: Array.from(new Set(fileUrls)) },
  };
}
