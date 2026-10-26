import { unstable_cache } from "next/cache";

import type { WorkerAvailability } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { dateKey, dayRange } from "@/lib/workzone/reporting";
import { effectiveSessionHours } from "@/lib/workzone/session-rules";
import { REPORT_TIME_ZONE, formatReportDay, monthKey, monthRange, reportLocale } from "@/lib/workzone/date-utils";

export const DASHBOARD_SNAPSHOT_TAG = "dashboard-snapshot";
const SNAPSHOT_TTL_SECONDS = 60;
const MAX_HOURS_CHART_ROWS = 6;
const MAX_BAUSTELLEN_CHART_ROWS = 6;

type MachineStatusSnapshot = {
  active: number;
  inactive: number;
  total: number;
};

type SafetyInventorySnapshot = {
  totalAvailable: number;
  signAvailable: number;
  plateAvailable: number;
  fenceAvailable: number;
};

type DashboardChartRow = {
  id: string;
  label: string;
  value: number;
  hint: string;
  detail?: string;
};

type DashboardWeekDayColumn = {
  key: string;
  label: string;
};

type DashboardWeekHoursRow = {
  id: string;
  label: string;
  total: number;
  days: Array<{
    key: string;
    value: number;
    workers: Array<{
      id: string;
      label: string;
      hours: number;
    }>;
  }>;
};

type DashboardWorkerHoursRow = {
  id: string;
  label: string;
  total: number;
};

type DashboardTrendPoint = {
  key: string;
  label: string;
  fullLabel: string;
  value: number;
};

export type DashboardSnapshot = {
  generatedAt: string;
  todayKey: string;
  selectedWeek: {
    offset: number;
    label: string;
    startKey: string;
    endKey: string;
    isCurrent: boolean;
  };
  stats: {
    activeWorkers: number;
    workersWorkedToday: number;
    unavailableWorkers: number;
    activeBaustellen: number;
    completedBaustellenToday: number;
    totalWorkHoursToday: number;
    totalPauseHoursToday: number;
    totalGrossHoursToday: number;
    totalWorkHoursWeek: number;
    totalWorkHoursMonth: number;
    machineStatus: MachineStatusSnapshot;
    safetyInventory: SafetyInventorySnapshot;
  };
  charts: {
    weekHoursColumns: DashboardWeekDayColumn[];
    weekHoursByBaustelle: DashboardWeekHoursRow[];
    baustellenProgress: DashboardChartRow[];
    monthHoursTrend: DashboardTrendPoint[];
    workerHours: {
      weekly: DashboardWorkerHoursRow[];
      monthly: DashboardWorkerHoursRow[];
    };
  };
};

function toCountMap(rows: Array<{ baustelleId: string; count: number }>) {
  return new Map(rows.map((row) => [row.baustelleId, row.count]));
}

function berlinWeekdayIndex(date: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    weekday: "short",
  }).format(date);
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const index = order.indexOf(weekday);
  return index >= 0 ? index : 0;
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function weekRangeLocale(lang?: string): string {
  const l = lang?.toLowerCase();
  if (l === "en") return "en-US";
  if (l === "it") return "it-IT";
  if (l === "sq") return "sq-AL";
  if (l === "pl") return "pl-PL";
  if (l === "ro") return "ro-RO";
  return "de-DE";
}

function formatWeekRangeLabel(start: Date, endInclusive: Date, lang?: string) {
  const formatter = new Intl.DateTimeFormat(weekRangeLocale(lang), {
    timeZone: REPORT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  });
  return `${formatter.format(start)} - ${formatter.format(endInclusive)}`;
}

function workerChartName(firstName: string, lastName: string) {
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  return fullName || firstName.trim();
}

const loadDashboardSnapshot = unstable_cache(
  async (companyId: string, today: string, weekOffset: number, lang: string): Promise<DashboardSnapshot> => {
    const { start, end } = dayRange(today);
    const now = new Date();
    const monthStart = monthRange(monthKey(now)).start;
    const currentWeekStart = new Date(start);
    currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - berlinWeekdayIndex(start));
    const selectedWeekStart = addUtcDays(currentWeekStart, weekOffset * 7);
    const selectedWeekEnd = addUtcDays(selectedWeekStart, 7);
    const selectedWeekEndInclusive = addUtcDays(selectedWeekStart, 6);
    const queryStart = selectedWeekStart < monthStart ? selectedWeekStart : monthStart;
    const weekDays = Array.from({ length: 7 }, (_, index) => {
      const day = addUtcDays(selectedWeekStart, index);
      const dayNumber = day.toLocaleDateString(reportLocale(lang), {
        timeZone: REPORT_TIME_ZONE,
        day: "2-digit",
      });
      return {
        key: dateKey(day),
        label: `${formatReportDay(day, lang)} ${dayNumber}`,
        start: dayRange(dateKey(day)).start,
        end: dayRange(dateKey(day)).end,
      };
    });
    const allBaustellen = await prisma.baustelle.findMany({
      where: { companyProfileId: companyId },
      select: { id: true },
    });
    const baustelleIds = allBaustellen.map((row) => row.id);

    const [
      allWorkers,
      workerCounts,
      activeBaustellen,
      machineCounts,
      sessionsCurrentMonth,
      weeklyBaustellen,
      progressBaustellen,
      totalTreeCounts,
      doneTreeCounts,
      doneTodayCounts,
      safetyCatalog,
    ] = await Promise.all([
      prisma.worker.findMany({
        where: { companyProfileId: companyId },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
      prisma.worker.groupBy({
        by: ["availability"],
        where: { companyProfileId: companyId, status: "active" },
        _count: { _all: true },
      }),
      prisma.baustelle.count({
        where: { companyProfileId: companyId, status: "active" },
      }),
      prisma.machine.groupBy({
        by: ["isActive"],
        where: { companyProfileId: companyId },
        _count: { _all: true },
      }),
      prisma.workSession.findMany({
        where: {
          baustelle: { companyProfileId: companyId },
          startTime: { gte: queryStart, lt: now },
        },
        select: {
          id: true,
          workerId: true,
          startTime: true,
          endTime: true,
          breakMinutes: true,
          totalHours: true,
          baustelleId: true,
          baustelle: { select: { name: true } },
          worker: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.baustelle.findMany({
        where: { companyProfileId: companyId },
        select: { id: true, name: true },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      prisma.baustelle.findMany({
        where: { companyProfileId: companyId, status: "active" },
        select: { id: true, name: true },
        orderBy: { updatedAt: "desc" },
        take: MAX_BAUSTELLEN_CHART_ROWS,
      }),
      prisma.treeItem.groupBy({
        by: ["baustelleId"],
        where: { baustelleId: { in: baustelleIds } },
        _count: { _all: true },
      }),
      prisma.treeItem.groupBy({
        by: ["baustelleId"],
        where: { baustelleId: { in: baustelleIds }, status: "done" },
        _count: { _all: true },
      }),
      prisma.treeItem.groupBy({
        by: ["baustelleId"],
        where: {
          baustelleId: { in: baustelleIds },
          status: "done",
          completedAt: { gte: start, lt: end },
        },
        _count: { _all: true },
      }),
      prisma.companyInventoryCatalog.findMany({
        where: { companyProfileId: companyId, isActive: true },
        select: { category: true, totalQuantity: true },
      }),
    ]);

    const availabilityCounts = workerCounts.reduce<Partial<Record<WorkerAvailability, number>>>((acc, row) => {
      acc[row.availability] = row._count._all;
      return acc;
    }, {});

    const unavailableWorkers =
      (availabilityCounts.SICK ?? 0) + (availabilityCounts.VACATION ?? 0) + (availabilityCounts.UNAVAILABLE ?? 0);
    const activeWorkers = availabilityCounts.AVAILABLE ?? 0;

    const machineStatus = machineCounts.reduce<MachineStatusSnapshot>(
      (acc, row) => {
        if (row.isActive) acc.active = row._count._all;
        else acc.inactive = row._count._all;
        acc.total += row._count._all;
        return acc;
      },
      { active: 0, inactive: 0, total: 0 },
    );

    const sessionsToday = sessionsCurrentMonth.filter((session) => session.startTime >= start && session.startTime < end);
    const sessionsCurrentWeek = sessionsCurrentMonth.filter((session) => session.startTime >= currentWeekStart);
    const sessionsSelectedWeek = sessionsCurrentMonth.filter(
      (session) => session.startTime >= selectedWeekStart && session.startTime < selectedWeekEnd,
    );
    const sessionsMonth = sessionsCurrentMonth.filter((session) => session.startTime >= monthStart);
    const monthDays = Array.from(
      { length: Math.max(1, Math.floor((start.getTime() - monthStart.getTime()) / 86_400_000) + 1) },
      (_, index) => addUtcDays(monthStart, index),
    );

    const weeklyWorkerHoursMap = sessionsSelectedWeek.reduce<Map<string, DashboardWorkerHoursRow>>((acc, session) => {
      if (!session.worker) return acc;
      const current = acc.get(session.workerId) ?? {
        id: session.workerId,
        label: workerChartName(session.worker.firstName, session.worker.lastName),
        total: 0,
      };
      current.total += effectiveSessionHours(session);
      acc.set(session.workerId, current);
      return acc;
    }, new Map());

    const monthlyWorkerHoursMap = sessionsMonth.reduce<Map<string, DashboardWorkerHoursRow>>((acc, session) => {
      if (!session.worker) return acc;
      const current = acc.get(session.workerId) ?? {
        id: session.workerId,
        label: workerChartName(session.worker.firstName, session.worker.lastName),
        total: 0,
      };
      current.total += effectiveSessionHours(session);
      acc.set(session.workerId, current);
      return acc;
    }, new Map());

    const weekHoursByBaustelleMap = sessionsMonth.reduce<
      Map<
        string,
        {
          label: string;
          total: number;
          days: Map<
            string,
            {
              value: number;
              workers: Map<string, { label: string; hours: number }>;
            }
          >;
        }
      >
    >(
      (acc, session) => {
        if (!session.baustelleId || !session.baustelle?.name || !session.worker) return acc;
        if (session.startTime < selectedWeekStart || session.startTime >= selectedWeekEnd) return acc;
        const sessionDayKey = dateKey(session.startTime);
        const hours = effectiveSessionHours(session);
        const current = acc.get(session.baustelleId) ?? {
          label: session.baustelle.name,
          total: 0,
          days: new Map<
            string,
            {
              value: number;
              workers: Map<string, { label: string; hours: number }>;
            }
          >(),
        };
        current.total += hours;
        const currentDay = current.days.get(sessionDayKey) ?? {
          value: 0,
          workers: new Map<string, { label: string; hours: number }>(),
        };
        currentDay.value = Number((currentDay.value + hours).toFixed(2));
        const workerLabel = workerChartName(session.worker.firstName, session.worker.lastName);
        const currentWorker = currentDay.workers.get(session.workerId) ?? {
          label: workerLabel,
          hours: 0,
        };
        currentWorker.hours = Number((currentWorker.hours + hours).toFixed(2));
        currentDay.workers.set(session.workerId, currentWorker);
        current.days.set(sessionDayKey, currentDay);
        acc.set(session.baustelleId, current);
        return acc;
      },
      new Map(),
    );

    const monthHoursMap = sessionsMonth.reduce<Map<string, number>>((acc, session) => {
      const key = dateKey(session.startTime);
      acc.set(key, Number(((acc.get(key) ?? 0) + effectiveSessionHours(session)).toFixed(2)));
      return acc;
    }, new Map());

    const totalWorkHoursToday = Number(
      sessionsToday.reduce((sum, session) => sum + effectiveSessionHours(session), 0).toFixed(2),
    );
    const totalPauseHoursToday = Number(
      (sessionsToday.reduce((sum, session) => sum + Math.max(0, session.breakMinutes), 0) / 60).toFixed(2),
    );
    const totalGrossHoursToday = Number((totalWorkHoursToday + totalPauseHoursToday).toFixed(2));
    const totalWorkHoursWeek = Number(
      sessionsCurrentWeek.reduce((sum, session) => sum + effectiveSessionHours(session), 0).toFixed(2),
    );
    const totalWorkHoursMonth = Number(
      sessionsMonth.reduce((sum, session) => sum + effectiveSessionHours(session), 0).toFixed(2),
    );
    const workersWorkedToday = new Set(sessionsToday.map((session) => session.workerId)).size;

    const safetyInventory = safetyCatalog.reduce<SafetyInventorySnapshot>(
      (acc, item) => {
        const qty = Math.max(0, Number(item.totalQuantity ?? 0) || 0);
        acc.totalAvailable += qty;
        if (item.category === "SIGN") acc.signAvailable += qty;
        if (item.category === "PLATE") acc.plateAvailable += qty;
        if (item.category === "FENCE") acc.fenceAvailable += qty;
        return acc;
      },
      { totalAvailable: 0, signAvailable: 0, plateAvailable: 0, fenceAvailable: 0 },
    );

    const totalCounts = totalTreeCounts.map((row) => ({ baustelleId: row.baustelleId, count: row._count._all }));
    const doneCounts = doneTreeCounts.map((row) => ({ baustelleId: row.baustelleId, count: row._count._all }));
    const todayDoneCounts = doneTodayCounts.map((row) => ({ baustelleId: row.baustelleId, count: row._count._all }));
    const totalByBaustelle = toCountMap(totalCounts);
    const doneByBaustelle = toCountMap(doneCounts);
    const doneTodayByBaustelle = toCountMap(todayDoneCounts);

    const completedBaustellenToday = allBaustellen.reduce((sum, baustelle) => {
      const total = totalByBaustelle.get(baustelle.id) ?? 0;
      const done = doneByBaustelle.get(baustelle.id) ?? 0;
      const doneToday = doneTodayByBaustelle.get(baustelle.id) ?? 0;
      if (total > 0 && total === done && doneToday > 0) return sum + 1;
      return sum;
    }, 0);

    const weekHoursByBaustelle = weeklyBaustellen
      .map((baustelle) => {
        const row = weekHoursByBaustelleMap.get(baustelle.id);
        return {
          id: baustelle.id,
          label: baustelle.name,
          total: Number((row?.total ?? 0).toFixed(2)),
          days: weekDays.map((day) => ({
            key: day.key,
            value: Number((row?.days.get(day.key)?.value ?? 0).toFixed(2)),
            workers: Array.from(row?.days.get(day.key)?.workers.entries() ?? [])
              .map(([workerId, worker]) => ({
                id: workerId,
                label: worker.label,
                hours: Number(worker.hours.toFixed(2)),
              }))
              .sort((a, b) => b.hours - a.hours || a.label.localeCompare(b.label, "de")),
          })),
        };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "de"))
      .slice(0, MAX_HOURS_CHART_ROWS);

    const baustellenProgress = progressBaustellen
      .map((baustelle) => {
        const total = totalByBaustelle.get(baustelle.id) ?? 0;
        const done = doneByBaustelle.get(baustelle.id) ?? 0;
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        return {
          id: baustelle.id,
          label: baustelle.name,
          value: percent,
          hint: total > 0 ? `${done}/${total}` : "0/0",
          detail: total > 0 ? `${done}/${total}` : "0/0",
        };
      })
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "de"));

    const weeklyWorkerHours = allWorkers
      .map((worker) => {
        const row = weeklyWorkerHoursMap.get(worker.id);
        return {
          id: worker.id,
          label: workerChartName(worker.firstName, worker.lastName),
          total: Number((row?.total ?? 0).toFixed(2)),
        };
      })
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "de"));

    const monthlyWorkerHours = allWorkers
      .map((worker) => {
        const row = monthlyWorkerHoursMap.get(worker.id);
        return {
          id: worker.id,
          label: workerChartName(worker.firstName, worker.lastName),
          total: Number((row?.total ?? 0).toFixed(2)),
        };
      })
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "de"));

    const monthHoursTrend = monthDays.map((day) => ({
      key: dateKey(day),
      label: day.toLocaleDateString(reportLocale(lang), { timeZone: REPORT_TIME_ZONE, day: "2-digit" }),
      fullLabel: day.toLocaleDateString(reportLocale(lang), {
        timeZone: REPORT_TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      value: Number((monthHoursMap.get(dateKey(day)) ?? 0).toFixed(2)),
    }));

    return {
      generatedAt: new Date().toISOString(),
      todayKey: today,
      selectedWeek: {
        offset: weekOffset,
        label: formatWeekRangeLabel(selectedWeekStart, selectedWeekEndInclusive, lang),
        startKey: dateKey(selectedWeekStart),
        endKey: dateKey(selectedWeekEndInclusive),
        isCurrent: weekOffset === 0,
      },
      stats: {
        activeWorkers,
        workersWorkedToday,
        unavailableWorkers,
        activeBaustellen,
        completedBaustellenToday,
        totalWorkHoursToday,
        totalPauseHoursToday,
        totalGrossHoursToday,
        totalWorkHoursWeek,
        totalWorkHoursMonth,
        machineStatus,
        safetyInventory,
      },
      charts: {
        weekHoursColumns: weekDays.map((day) => ({ key: day.key, label: day.label })),
        weekHoursByBaustelle,
        baustellenProgress: baustellenProgress,
        monthHoursTrend,
        workerHours: {
          weekly: weeklyWorkerHours,
          monthly: monthlyWorkerHours,
        },
      },
    };
  },
  ["dashboard-snapshot"],
  {
    revalidate: SNAPSHOT_TTL_SECONDS,
    tags: [DASHBOARD_SNAPSHOT_TAG],
  },
);

export async function getDashboardSnapshot(companyId: string, lang = "de") {
  return loadDashboardSnapshot(companyId, dateKey(new Date()), 0, lang);
}

export async function getDashboardSnapshotForWeek(companyId: string, weekOffset = 0, lang = "de") {
  return loadDashboardSnapshot(companyId, dateKey(new Date()), Math.min(0, Math.trunc(weekOffset)), lang);
}
