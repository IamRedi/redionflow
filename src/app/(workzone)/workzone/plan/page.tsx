import Link from "next/link";

import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { withPilotDbContext } from "@/lib/db/tenant-runtime";
import { companyOrLogin } from "@/lib/workzone/company-or-login";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { currentCompanyActor } from "@/lib/site-files/actor";
import { NoAccessHere } from "@/components/access/no-access";
import { planCopy, planDayLabel } from "./plan-copy";
import { SavedPlanList } from "./saved-plan";
import { dateKey, dayRange } from "@/lib/workzone/date-utils";
import { DailyPlanBoard } from "../daily-plan-board";
import { AccessKeyButton } from "@/components/access/access-key-button";
const WORKZONE_LABEL = 'Workzone';

function planDay(value: string) {
  const range = dayRange(value);
  if (Number.isNaN(range.start.getTime())) return null;
  return range.start;
}

function addDaysToKey(value: string, days: number) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return value;
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function PlanHeader({ date, lang, canEdit }: { date: string; lang: string; canEdit: boolean }) {
  const c = planCopy(lang);
  const today = dateKey(new Date());
  const nav = "grid size-10 shrink-0 place-items-center rounded-xl border bg-card shadow-sm transition hover:bg-muted sm:size-11";
  return (
    <section className="rounded-3xl border bg-card p-3 shadow-sm max-lg:sticky max-lg:top-0 max-lg:z-20 max-lg:-mx-3 max-lg:rounded-none max-lg:border-x-0 max-lg:border-t-0 max-lg:bg-background/95 max-lg:pt-[max(0.75rem,env(safe-area-inset-top))] max-lg:backdrop-blur sm:p-5" data-testid="plan-header">
      <Link href="/workzone" className="hidden text-xs text-muted-foreground hover:text-foreground lg:inline">← {WORKZONE_LABEL}</Link>
      <div className="flex items-center gap-2 lg:mt-1">
        <Link href="/workzone" className="grid size-10 shrink-0 place-items-center rounded-full border bg-card shadow-sm hover:bg-muted lg:hidden" aria-label="Workzone" data-testid="plan-close"><ArrowLeft className="size-5" aria-hidden /></Link>
        <CalendarDays className="hidden size-6 text-orange-600 dark:text-orange-400 lg:block" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{c.title}</h1>
        {canEdit ? <AccessKeyButton place="daily_plan" compact /> : null}
      </div>
      <div className="mt-2.5 flex items-center gap-2 sm:mt-3">
        <Link href={`/workzone/plan?date=${encodeURIComponent(addDaysToKey(date, -1))}`} className={nav} aria-label={c.previous} title={c.previous}><ChevronLeft className="size-5" /></Link>
        <span className="inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border bg-background px-3 text-sm font-semibold capitalize sm:min-h-11 sm:flex-none" data-testid="plan-day">
          <span className="truncate">{planDayLabel(date, lang)}</span>
          {date === today ? <span className="shrink-0 rounded-full bg-orange-600 px-2 py-0.5 text-[11px] font-semibold normal-case text-white dark:bg-orange-500 dark:text-slate-950">{c.today}</span> : null}
        </span>
        <Link href={`/workzone/plan?date=${encodeURIComponent(addDaysToKey(date, 1))}`} className={nav} aria-label={c.next} title={c.next}><ChevronRight className="size-5" /></Link>
        {date !== today ? <Link href={`/workzone/plan?date=${encodeURIComponent(today)}`} className="inline-flex min-h-10 shrink-0 items-center rounded-xl border bg-card px-3 text-sm font-semibold shadow-sm hover:bg-muted sm:min-h-11">{c.today}</Link> : null}
      </div>
    </section>
  );
}

/** On phones the plan is its own full screen (no Workzone bars); on desktop it stays in the page. */
const FULL_SCREEN = "max-lg:fixed max-lg:inset-0 max-lg:z-[60] max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:bg-background max-lg:px-3 max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden";

export default async function DailyPlanPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const currentLang = await resolveRequestLanguage();
  const c = planCopy(currentLang);
  const params = await searchParams;
  const selectedDate = params.date && planDay(params.date) ? params.date : dateKey(new Date());
  const planDate = planDay(selectedDate)!;

  const company = await companyOrLogin();
  if (!company) return null;
  const actor = await currentCompanyActor(company.id);
  // Everybody sees the saved plan; the key button gives "Vepron" (create and save).
  if (!actor?.allows("daily_plan.view")) return <NoAccessHere backHref="/workzone" />;
  const canEdit = actor.allows("daily_plan.edit");

  if (!canEdit) {
    const saved = await withPilotDbContext(company.id, tx => tx.dailyWorkPlan.findUnique({
      where: { companyProfileId_planDate: { companyProfileId: company.id, planDate } },
      select: { savedRows: { orderBy: { sortOrder: "asc" } } },
    }));
    return (
      <div className={`mx-auto w-full min-w-0 max-w-5xl space-y-4 max-lg:pb-8 ${FULL_SCREEN}`} data-testid="daily-plan-view" data-phone-fullscreen>
        <PlanHeader date={selectedDate} lang={currentLang} canEdit={false} />
        <SavedPlanList rows={saved?.savedRows ?? []} c={c} me={actor.name} />
      </div>
    );
  }
  const editorId = actor.userId;

  const { plan, workers, machines, baustellen } = await withPilotDbContext(company.id, async tx => {
    const planSeed = await tx.dailyWorkPlan.upsert({
      where: { companyProfileId_planDate: { companyProfileId: company.id, planDate } },
      create: {
        companyProfileId: company.id,
        planDate,
        createdByAdminId: editorId,
      },
      update: {},
      select: { id: true },
    });

    const previousDate = addDaysToKey(selectedDate, -1);
    const previousDay = planDay(previousDate);
    if (!previousDay) throw new Error("Invalid previous plan day");
    const [currentPlanCounts, previousPlan] = await Promise.all([
      tx.dailyWorkPlan.findUnique({
        where: { id: planSeed.id },
        select: {
          id: true,
          _count: {
            select: {
              columns: true,
              savedRows: true,
            },
          },
        },
      }),
      tx.dailyWorkPlan.findUnique({
        where: { companyProfileId_planDate: { companyProfileId: company.id, planDate: previousDay } },
        include: {
          columns: {
            orderBy: { sortOrder: "asc" },
            include: {
              assignments: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      }),
    ]);

    if (
      currentPlanCounts &&
      currentPlanCounts._count.columns === 0 &&
      currentPlanCounts._count.savedRows === 0 &&
      previousPlan &&
      previousPlan.columns.length > 0
    ) {
      await tx.dailyWorkPlanColumn.createMany({
        data: previousPlan.columns.map((column, index) => ({
          planId: planSeed.id,
          baustelleId: column.baustelleId,
          title: column.title,
          note: column.note,
          sortOrder: index,
        })),
      });

      const seededColumns = await tx.dailyWorkPlanColumn.findMany({
        where: { planId: planSeed.id },
        select: { id: true, baustelleId: true },
      });
      const nextColumnByBaustelleId = new Map(seededColumns.map((column) => [column.baustelleId ?? `__${column.id}`, column.id]));

      const assignmentData = previousPlan.columns.flatMap((column) => {
        const nextColumnId = nextColumnByBaustelleId.get(column.baustelleId ?? "");
        if (!nextColumnId) return [];
        return column.assignments.map((assignment) => ({
          columnId: nextColumnId,
          kind: assignment.kind,
          workerId: assignment.workerId,
          machineId: assignment.machineId,
          labelSnapshot: assignment.labelSnapshot,
          sortOrder: assignment.sortOrder,
        }));
      });

      if (assignmentData.length > 0) {
        await tx.dailyWorkPlanAssignment.createMany({
          data: assignmentData,
        });
      }
    }

    const [plan, workers, machines, baustellen] = await Promise.all([
      tx.dailyWorkPlan.findUnique({
        where: { companyProfileId_planDate: { companyProfileId: company.id, planDate } },
        include: {
          columns: {
            orderBy: { sortOrder: "asc" },
            include: {
              assignments: { orderBy: { sortOrder: "asc" } },
            },
          },
          savedRows: {
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
      tx.worker.findMany({
        where: { companyProfileId: company.id, status: "active" },
        orderBy: { firstName: "asc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          licenses: true,
          availability: true,
          vacationRequests: {
            where: {
              status: "APPROVED",
              startDate: { lt: dayRange(selectedDate).end },
              endDate: { gte: planDate },
            },
            select: { id: true },
            take: 1,
          },
        },
      }),
      tx.machine.findMany({
        where: { companyProfileId: company.id },
        orderBy: [{ isActive: "desc" }, { nickname: "asc" }, { name: "asc" }],
        select: { id: true, name: true, nickname: true, targe: true, patentaEnevojshme: true, isActive: true },
      }),
      tx.baustelle.findMany({
        // Only open sites; one that already has people today stays visible.
        where: { companyProfileId: company.id, OR: [{ status: "active" }, { dailyPlanColumns: { some: { planId: planSeed.id } } }] },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return { plan, workers, machines, baustellen };
  });

  return (
    <div className={`w-full min-w-0 space-y-4 max-lg:pb-28 ${FULL_SCREEN}`} data-testid="daily-plan-page" data-phone-fullscreen>
      <PlanHeader date={selectedDate} lang={currentLang} canEdit />

      {plan ? (
        <DailyPlanBoard
          date={selectedDate}
          columns={baustellen.map((baustelle) => {
            const column = plan.columns.find((item) => item.baustelleId === baustelle.id);
            return {
              id: baustelle.id,
              title: baustelle.name,
              note: column?.note ?? null,
              baustelleId: baustelle.id,
              assignments: (column?.assignments ?? []).map((item) => ({
                id: item.id,
                kind: item.kind,
                labelSnapshot: item.labelSnapshot,
                workerId: item.workerId,
                machineId: item.machineId,
              })),
            };
          })}
          workers={workers.map((worker) => ({
            id: worker.id,
            name: `${worker.firstName} ${worker.lastName}`.trim(),
            licenses: worker.licenses,
            availability: worker.availability,
            hasApprovedVacation: worker.vacationRequests.length > 0,
          }))}
          machines={machines.map((machine) => ({ id: machine.id, name: machine.nickname?.trim() || machine.name, targe: machine.targe, requiredLicense: machine.patentaEnevojshme, isActive: machine.isActive }))}
          baustellen={baustellen}
          savedRows={plan.savedRows.map((row) => ({
            id: row.id,
            workerNames: row.workerNames,
            machineNames: row.machineNames,
            baustelleName: row.baustelleName,
            note: row.note,
          }))}
        />
      ) : null}
    </div>
  );
}
