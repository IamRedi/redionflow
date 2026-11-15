/**
 * Create one real customer company on the SaaS platform, once.
 *
 *   PROVISION_COMPANY_JSON   company, owner and first sites (see src/lib/provision/company-input.ts)
 *   PROVISION_OWNER_PASSWORD first password of the owner admin (12+ characters)
 *
 * Without PROVISION_COMPANY_JSON the script does nothing, so it can sit in the
 * start command. When a company with the same legal name already exists it
 * changes nothing. Remove both variables after the first successful run.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";
import { hashPassword } from "../src/lib/auth/password";
import { parseProvisionInput } from "../src/lib/provision/company-input";
import { createCompanyRecords } from "../src/lib/provision/create-company";
import { runRosterImport } from "./import-roster";
import { runPilotSamples } from "./pilot-samples";
import { runAssistantAccess } from "./assistant-access";
import { runAttendanceReset } from "./attendance-reset";
import { runWorkNotifyOnly } from "./work-notify";
import { runOrphanSiteData } from "./orphan-site-data";
import { runAssistantOps } from "./assistant-ops";
import { runElementRoutes } from "./element-routes";
import { runLiveSitesCheck } from "./live-sites";
import { runPlanVersionsDelete } from "./plan-versions";
import { runActAll, runStaffAccess } from "./staff-access";

async function main() {
  await runPilotSamples().catch((error) => console.error("[samples] failed:", error instanceof Error ? error.message : error));
  await runRosterImport().catch((error) => console.error("[roster] failed:", error instanceof Error ? error.message : error));
  await runAssistantAccess().catch((error) => console.error("[assistant-access] failed:", error instanceof Error ? error.message : error));
  await runStaffAccess().catch((error) => console.error("[staff-access] failed:", error instanceof Error ? error.message : error));
  await runActAll().catch((error) => console.error("[act-all] failed:", error instanceof Error ? error.message : error));
  await runAttendanceReset().catch((error) => console.error("[attendance-reset] failed:", error instanceof Error ? error.message : error));
  await runWorkNotifyOnly().catch((error) => console.error("[work-notify] failed:", error instanceof Error ? error.message : error));
  await runOrphanSiteData().catch((error) => console.error("[orphan-data] failed:", error instanceof Error ? error.message : error));
  await runAssistantOps().catch((error) => console.error("[assistant-ops] failed:", error instanceof Error ? error.message : error));
  await runElementRoutes().catch((error) => console.error("[element-routes] failed:", error instanceof Error ? error.message : error));
  await runPlanVersionsDelete().catch((error) => console.error("[plan-versions] failed:", error instanceof Error ? error.message : error));
  await runLiveSitesCheck().catch((error) => console.error("[live-sites] failed:", error instanceof Error ? error.message : error));
  const input = parseProvisionInput(process.env.PROVISION_COMPANY_JSON, process.env.PROVISION_OWNER_PASSWORD);
  if (!input) {
    console.log("[provision] PROVISION_COMPANY_JSON not set, nothing to do.");
    return;
  }
  const { company: c, ownerPassword } = input;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseConnectionString({ preferDirect: true }) }) });
  try {
    const existing = await prisma.companyProfile.findFirst({ where: { legalName: c.legalName }, select: { id: true } });
    if (existing) {
      console.log(`[provision] ${c.legalName} already exists (${existing.id}), nothing changed.`);
      return;
    }
    const ownerTaken = await prisma.user.findUnique({ where: { email: c.owner.email }, select: { id: true } });
    if (ownerTaken) throw new Error(`Owner e-mail ${c.owner.email} is already used by another account.`);

    const created = await prisma.$transaction(tx => createCompanyRecords(tx, c, hashPassword(ownerPassword)));
    console.log(`[provision] created ${c.displayName} (${created.id}) with owner ${c.owner.email} and ${c.sites.length} sites.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // Never block the app start: log and continue.
  console.error("[provision] failed:", error instanceof Error ? error.message : error);
});
