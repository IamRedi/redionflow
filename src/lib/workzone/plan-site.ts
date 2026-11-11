import { withPilotDbContext } from "@/lib/db/tenant-runtime";
import { dateKey, dayRange, monthRange } from "@/lib/workzone/date-utils";
import { siteFromSavedRows } from "@/lib/workzone/plan-site-rule";

/**
 * The daily plan is where a worker's site comes from: starting the day puts the worker on
 * the site the plan gives them. Another site only by "Fillo punë këtu" on that site.
 */
export async function plannedSiteId(companyId: string, workerId: string, at: Date): Promise<string | null> {
  const planDate = dayRange(dateKey(at)).start;
  const assignment = await withPilotDbContext(companyId, (tx) => tx.dailyWorkPlanAssignment.findFirst({
    where: { workerId, column: { baustelleId: { not: null }, plan: { companyProfileId: companyId, planDate } } },
    select: { column: { select: { baustelleId: true, baustelle: { select: { status: true } } } } },
  }));
  const site = assignment?.column;
  if (site?.baustelleId && site.baustelle?.status === "active") return site.baustelleId;
  // The editable plan may be empty after saving; the saved plan still names the site.
  return withPilotDbContext(companyId, async (tx) => {
    const [plan, worker, sites] = await Promise.all([
      tx.dailyWorkPlan.findUnique({ where: { companyProfileId_planDate: { companyProfileId: companyId, planDate } }, select: { savedRows: { select: { workerNames: true, baustelleName: true } } } }),
      tx.worker.findFirst({ where: { id: workerId, companyProfileId: companyId }, select: { firstName: true, lastName: true } }),
      tx.baustelle.findMany({ where: { companyProfileId: companyId, status: "active" }, select: { id: true, name: true } }),
    ]);
    if (!plan?.savedRows.length || !worker) return null;
    return siteFromSavedRows(plan.savedRows, `${worker.firstName} ${worker.lastName}`, sites)?.id ?? null;
  });
}

/** Day key → planned site name for one worker over a month (timesheet fallback for days without a site). */
export async function plannedSiteNames(companyId: string, workerId: string, month: string): Promise<Map<string, string>> {
  const { start, end } = monthRange(month);
  if (Number.isNaN(start.getTime())) return new Map();
  const rows = await withPilotDbContext(companyId, (tx) => tx.dailyWorkPlanAssignment.findMany({
    where: { workerId, column: { baustelleId: { not: null }, plan: { companyProfileId: companyId, planDate: { gte: start, lt: end } } } },
    select: { column: { select: { title: true, baustelle: { select: { name: true } }, plan: { select: { planDate: true } } } } },
  }));
  return new Map(rows.map((row) => [dateKey(row.column.plan.planDate), row.column.baustelle?.name ?? row.column.title]));
}

/** Site id → today's note from the saved daily plan (what the engineer wrote on the site card). */
export async function plannedSiteNotes(companyId: string, at: Date = new Date()): Promise<Map<string, string>> {
  const planDate = dayRange(dateKey(at)).start;
  const plan = await withPilotDbContext(companyId, (tx) => tx.dailyWorkPlan.findUnique({
    where: { companyProfileId_planDate: { companyProfileId: companyId, planDate } },
    select: { savedRows: { select: { baustelleName: true, note: true } }, columns: { select: { title: true, baustelleId: true } } },
  }));
  const notes = new Map<string, string>();
  for (const row of plan?.savedRows ?? []) {
    const note = row.note?.trim();
    if (!note) continue;
    const column = plan?.columns.find((entry) => entry.baustelleId && entry.title.trim() === row.baustelleName.trim());
    if (column?.baustelleId) notes.set(column.baustelleId, note);
  }
  return notes;
}
