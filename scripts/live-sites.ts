/**
 * One-shot check at boot: who is working right now, on which site, and where
 * today's daily plan puts them.
 *
 *   LIVE_SITES_CHECK=log   only log
 *   LIVE_SITES_CHECK=fix   also put live sessions without a site on today's planned site
 *
 * Runs only when the installation holds exactly one company. Blank the
 * variable after one boot.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";
import { dateKey, dayRange } from "../src/lib/workzone/date-utils";
import { siteFromSavedRows } from "../src/lib/workzone/plan-site-rule";

export async function runLiveSitesCheck() {
  const mode = (process.env.LIVE_SITES_CHECK ?? "").trim();
  if (mode !== "log" && mode !== "fix") return;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseConnectionString({ preferDirect: true }) }) });
  try {
    const companies = await prisma.companyProfile.findMany({ select: { id: true }, take: 2 });
    if (companies.length !== 1) { console.log(`[live-sites] expected exactly one company, found ${companies.length}; nothing done.`); return; }
    const companyId = companies[0].id;
    const today = dateKey(new Date());
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, companyId);
      const plan = await tx.dailyWorkPlan.findUnique({
        where: { companyProfileId_planDate: { companyProfileId: companyId, planDate: dayRange(today).start } },
        select: { updatedAt: true, savedRows: { select: { workerNames: true, baustelleName: true } }, columns: { select: { title: true, baustelleId: true, baustelle: { select: { name: true, status: true } }, assignments: { where: { kind: "WORKER" }, select: { workerId: true, labelSnapshot: true } } } } },
      });
      console.log(`[live-sites] ${today}: plan ${plan ? `found (updated ${plan.updatedAt.toISOString()}), ${plan.columns.length} columns, ${plan.savedRows.length} saved rows` : "MISSING"}.`);
      for (const column of plan?.columns ?? []) {
        console.log(`[live-sites] plan column "${column.title}" -> site ${column.baustelle ? `"${column.baustelle.name}" (${column.baustelle.status})` : "NONE"}: ${column.assignments.map(a => `${a.labelSnapshot}${a.workerId ? "" : " (no worker id)"}`).join(", ") || "-"}`);
      }
      const plannedSite = new Map<string, { id: string; name: string }>();
      for (const column of plan?.columns ?? []) {
        if (!column.baustelleId || column.baustelle?.status !== "active") continue;
        for (const a of column.assignments) if (a.workerId) plannedSite.set(a.workerId, { id: column.baustelleId, name: column.baustelle.name });
      }
      const sites = await tx.baustelle.findMany({ where: { companyProfileId: companyId, status: "active" }, select: { id: true, name: true } });
      const live = await tx.workSession.findMany({
        where: { isLive: true, endTime: null, worker: { companyProfileId: companyId } },
        select: { id: true, workerId: true, startTime: true, baustelleId: true, baustelle: { select: { name: true } }, worker: { select: { firstName: true, lastName: true } } },
        orderBy: { startTime: "asc" },
      });
      let fixed = 0;
      for (const s of live) {
        const planned = plannedSite.get(s.workerId) ?? siteFromSavedRows(plan?.savedRows ?? [], `${s.worker.firstName} ${s.worker.lastName}`, sites) ?? undefined;
        console.log(`[live-sites] live ${s.worker.firstName} since ${s.startTime.toISOString()} at ${s.baustelle ? `"${s.baustelle.name}"` : "NO SITE"}; plan: ${planned ? `"${planned.name}"` : "none"}.`);
        if (mode === "fix" && planned && !s.baustelleId) {
          await tx.workSession.update({ where: { id: s.id }, data: { baustelleId: planned.id } });
          fixed += 1;
        }
      }
      console.log(`[live-sites] ${live.length} live sessions${mode === "fix" ? `, ${fixed} put on their planned site` : ""}.`);
    }, { timeout: 60_000 });
  } finally {
    await prisma.$disconnect();
  }
}
