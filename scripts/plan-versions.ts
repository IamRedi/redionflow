/**
 * One-time cleanup at boot: delete the saved versions ("Versioni 1..n") of
 * the daily plan of given days. The current saved plan stays.
 *
 *   PLAN_VERSIONS_DELETE=2026-11-10[,2026-11-11]
 *
 * Runs only when the installation holds exactly one company. Remove the
 * variable after one boot.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";
import { dayRange } from "../src/lib/workzone/date-utils";

export async function runPlanVersionsDelete() {
  const days = (process.env.PLAN_VERSIONS_DELETE ?? "").split(",").map(day => day.trim()).filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day));
  if (!days.length) return;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseConnectionString({ preferDirect: true }) }) });
  try {
    const companies = await prisma.companyProfile.findMany({ select: { id: true }, take: 2 });
    if (companies.length !== 1) { console.log(`[plan-versions] expected exactly one company, found ${companies.length}; nothing done.`); return; }
    const companyId = companies[0].id;
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, companyId);
      for (const day of days) {
        const planDate = dayRange(day).start;
        const plan = await tx.dailyWorkPlan.findUnique({ where: { companyProfileId_planDate: { companyProfileId: companyId, planDate } }, select: { id: true } });
        if (!plan) { console.log(`[plan-versions] ${day}: no plan.`); continue; }
        const removed = await tx.dailyWorkPlanSnapshot.deleteMany({ where: { planId: plan.id } });
        console.log(`[plan-versions] ${day}: deleted ${removed.count} versions; the current plan stays.`);
      }
    }, { timeout: 60_000 });
  } finally {
    await prisma.$disconnect();
  }
}
