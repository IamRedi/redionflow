import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";
import { assertResetAllowed } from "./env-guard";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const adapter = new PrismaPg({
  connectionString: resolveDatabaseConnectionString() ?? requireEnv("DATABASE_URL"),
});
const prisma = new PrismaClient({ adapter });

async function main() {
  assertResetAllowed("reset-workzone-data");

  const company =
    (await prisma.companyProfile.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, displayName: true },
    })) ?? null;

  if (!company) {
    console.log("No company found. Nothing to reset.");
    return;
  }

  const companyId = company.id;

  // We intentionally keep:
  // - Workers, Machines
  // - CompanyInventoryCatalog / CompanyInventoryItem (master data)
  // - Projects (kalkulation) unless you decide otherwise
  //
  // We delete ONLY Workzone / Baustelle execution + tracking data for clean tests.
  console.log(`Resetting Workzone data for company: ${company.displayName} (${companyId})`);

  await prisma.$transaction(async (tx) => {
    await tx.workReportNote.deleteMany({ where: { worker: { companyProfileId: companyId } } });
    await tx.workLog.deleteMany({ where: { baustelle: { companyProfileId: companyId } } });
    await tx.manualTask.deleteMany({ where: { baustelle: { companyProfileId: companyId } } });
    await tx.workSession.deleteMany({ where: { worker: { companyProfileId: companyId } } });

    // Daily planner
    await tx.dailyWorkPlanAssignment.deleteMany({ where: { column: { plan: { companyProfileId: companyId } } } });
    await tx.dailyWorkPlanColumn.deleteMany({ where: { plan: { companyProfileId: companyId } } });
    await tx.dailyWorkPlanSavedRow.deleteMany({ where: { plan: { companyProfileId: companyId } } });
    await tx.dailyWorkPlan.deleteMany({ where: { companyProfileId: companyId } });

    // Safety equipment movement ledger for Baustellen
    await tx.inventoryMovement.deleteMany({ where: { companyProfileId: companyId } });

    // Baustellen + trees
    await tx.treeItem.deleteMany({ where: { baustelle: { companyProfileId: companyId } } });
    await tx.baustelle.deleteMany({ where: { companyProfileId: companyId } });
  });

  console.log("Done. Workzone data cleared. Workers/Machines kept.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

