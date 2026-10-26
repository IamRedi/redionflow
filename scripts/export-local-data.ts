import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";
import { sanitizeSnapshotValue } from "../src/lib/snapshot/credential-hygiene";

const OUTPUT_DIR = path.join(process.cwd(), "data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "seed-data.json");

const adapter = new PrismaPg({
  connectionString: resolveDatabaseConnectionString(),
});

const prisma = new PrismaClient({ adapter });

function normalizeForJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, innerValue) => {
      if (innerValue instanceof Date) {
        return innerValue.toISOString();
      }
      return innerValue;
    }),
  ) as T;
}

async function main() {
  await prisma.$connect();

  const data = {
    user: await prisma.user.findMany(),
    companyProfile: await prisma.companyProfile.findMany(),
    workzoneAnnouncement: await prisma.workzoneAnnouncement.findMany(),
    companyKnowledge: await prisma.companyKnowledge.findMany(),
    companyInventoryCatalog: await prisma.companyInventoryCatalog.findMany(),
    companyInventoryItem: await prisma.companyInventoryItem.findMany(),
    overheadSettings: await prisma.overheadSettings.findMany(),
    laborRole: await prisma.laborRole.findMany(),
    machine: await prisma.machine.findMany(),
    worker: await prisma.worker.findMany(),
    vacationRequest: await prisma.vacationRequest.findMany(),
    workerAssetItem: await prisma.workerAssetItem.findMany(),
    workReportNote: await prisma.workReportNote.findMany(),
    baustelle: await prisma.baustelle.findMany(),
    calculationTemplate: await prisma.calculationTemplate.findMany(),
    templatePositionPreset: await prisma.templatePositionPreset.findMany(),
    project: await prisma.project.findMany(),
    projectPosition: await prisma.projectPosition.findMany(),
    positionLaborItem: await prisma.positionLaborItem.findMany(),
    positionMachineItem: await prisma.positionMachineItem.findMany(),
    positionMaterialItem: await prisma.positionMaterialItem.findMany(),
    positionExternalServiceItem: await prisma.positionExternalServiceItem.findMany(),
    treeItem: await prisma.treeItem.findMany(),
    workSession: await prisma.workSession.findMany(),
    workLog: await prisma.workLog.findMany(),
    manualTask: await prisma.manualTask.findMany(),
    dailyWorkPlan: await prisma.dailyWorkPlan.findMany(),
    dailyWorkPlanColumn: await prisma.dailyWorkPlanColumn.findMany(),
    dailyWorkPlanAssignment: await prisma.dailyWorkPlanAssignment.findMany(),
    dailyWorkPlanSavedRow: await prisma.dailyWorkPlanSavedRow.findMany(),
    inventoryMovement: await prisma.inventoryMovement.findMany(),
    inventoryAssetMovement: await prisma.inventoryAssetMovement.findMany(),
    machineConeMovement: await prisma.machineConeMovement.findMany(),
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const snapshot = sanitizeSnapshotValue(normalizeForJson(data));
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  const summary = {
    companyProfile: data.companyProfile.length,
    user: data.user.length,
    worker: data.worker.length,
    machine: data.machine.length,
    baustelle: data.baustelle.length,
    treeItem: data.treeItem.length,
    workSession: data.workSession.length,
    manualTask: data.manualTask.length,
  };

  console.log(`[db:export] wrote ${OUTPUT_FILE}`);
  console.log(`[db:export] summary ${JSON.stringify(summary)}`);
}

main()
  .catch((error) => {
    console.error("[db:export] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
