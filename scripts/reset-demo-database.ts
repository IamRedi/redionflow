import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";
import { assertResetAllowed } from "./env-guard";

const TABLES = [
  "DailyWorkPlanSnapshotRow",
  "DailyWorkPlanSnapshot",
  "DailyWorkPlanAssignment",
  "DailyWorkPlanColumn",
  "DailyWorkPlanSavedRow",
  "DailyWorkPlan",
  "MachineConeMovement",
  "InventoryAssetMovement",
  "InventoryMovement",
  "ManualTask",
  "WorkLog",
  "WorkSession",
  "WorkReportNote",
  "WorkerAssetItem",
  "VacationRequest",
  "TreeItem",
  "Baustelle",
  "PositionExternalServiceItem",
  "PositionMaterialItem",
  "PositionMachineItem",
  "PositionLaborItem",
  "ProjectPosition",
  "Project",
  "TemplatePositionPreset",
  "CalculationTemplate",
  "Machine",
  "Worker",
  "LaborRole",
  "OverheadSettings",
  "CompanyInventoryItem",
  "CompanyInventoryCatalog",
  "CompanyKnowledge",
  "WorkzoneAnnouncement",
  "CompanyProfile",
  "User",
] as const;

const adapter = new PrismaPg({
  connectionString: resolveDatabaseConnectionString({ preferDirect: true }),
});
const prisma = new PrismaClient({ adapter });

function quotedTableList() {
  return TABLES.map((table) => `"${table}"`).join(", ");
}

async function main() {
  assertResetAllowed("reset-demo-database");

  console.log("[reset-demo-database] clearing demo database tables");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTableList()} RESTART IDENTITY CASCADE`);
  console.log("[reset-demo-database] done");
}

main()
  .catch((error) => {
    console.error("[reset-demo-database] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
