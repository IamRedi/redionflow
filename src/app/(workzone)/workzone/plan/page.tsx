import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withPilotDbContext } from "@/lib/db/tenant-runtime";
import { getPilotAdmin as getCurrentAdmin } from "@/lib/auth/pilot-session";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { dateKey, dayRange } from "@/lib/workzone/date-utils";
import { DailyPlanBoard } from "../daily-plan-board";

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

export default async function DailyPlanPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const currentLang = await resolveRequestLanguage();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("workzone.createDailyPlan", currentLang)}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{t("workzone.dailyPlanAdminOnly", currentLang)}</CardContent>
      </Card>
    );
  }

  const params = await searchParams;
  const selectedDate = params.date ?? dateKey(new Date());
  const planDate = planDay(selectedDate);
  if (!planDate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("workzone.createDailyPlan", currentLang)}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{t("workzone.invalidDate", currentLang)}</CardContent>
      </Card>
    );
  }

  const company = await getOrCreateDefaultCompany();
  if (!company) return null;

  const { plan, workers, machines, baustellen } = await withPilotDbContext(company.id, async tx => {
    const planSeed = await tx.dailyWorkPlan.upsert({
      where: { companyProfileId_planDate: { companyProfileId: company.id, planDate } },
      create: {
        companyProfileId: company.id,
        planDate,
        createdByAdminId: admin.id,
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
        select: { id: true, name: true, nickname: true, patentaEnevojshme: true, isActive: true },
      }),
      tx.baustelle.findMany({
        where: { companyProfileId: company.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return { plan, workers, machines, baustellen };
  }, "admin");

  const prevDate = addDaysToKey(selectedDate, -1);
  const nextDate = addDaysToKey(selectedDate, 1);
  const todayDate = dateKey(new Date());

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{t("workzone.createDailyPlan", currentLang)}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Button asChild variant="outline" size="sm">
              <Link href={`/workzone/plan?date=${encodeURIComponent(prevDate)}`}>{t("workzone.previousDay", currentLang)}</Link>
            </Button>
            <span className="rounded-md border bg-card px-3 py-1 font-medium text-foreground">{selectedDate}</span>
            <Button asChild variant="outline" size="sm">
              <Link href={`/workzone/plan?date=${encodeURIComponent(todayDate)}`}>{t("common.today", currentLang)}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/workzone/plan?date=${encodeURIComponent(nextDate)}`}>{t("workzone.nextDay", currentLang)}</Link>
            </Button>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/workzone">{t("workzone.backToWorkzone", currentLang)}</Link>
        </Button>
      </div>

      {plan ? (
        <DailyPlanBoard
          date={selectedDate}
          showCurrentVersionHint
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
          machines={machines.map((machine) => ({ id: machine.id, name: machine.nickname ?? machine.name, requiredLicense: machine.patentaEnevojshme, isActive: machine.isActive }))}
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
