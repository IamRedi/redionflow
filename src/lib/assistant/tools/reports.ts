/** Report tools: private summaries, daily reports and monthly timesheets. */

import { prisma } from "@/lib/db/prisma";
import {
  baustelleStandort,
  coneActivity,
  dateKey,
  formatReportTime,
  getAdminDailyReport,
  getWorkerDailyReport,
  getWorkerMonthlyReport,
  groupDailyWorkByBaustelle,
  inventoryActivity,
  monthlySessionRows,
  parseReportMessages,
  treeAction,
  treeExtra,
  treeHaltverbot,
  treeWorkerNote,
} from "@/lib/workzone/reporting";
import { effectiveSessionHours } from "@/lib/workzone/session-rules";
import type { RequesterContext } from "../requester";
import { assistantToolText } from "./text";
import {
  startOfLocalDay,
  todayKey,
  currentMonthKey,
  validDateKey,
  validMonthKey,
  endOfLocalDay,
  findWorkerByName,
  workerLinks,
  sessionPayload,
} from "./shared";

export async function getWorkerPrivateSummary(
  requester: RequesterContext,
  input: { workerName: string; days?: number },
): Promise<
  | {
      ok: true;
      worker: string;
      days: number;
      totalHours: number;
      sessions: Array<{
        date: string;
        startTime: string;
        endTime: string | null;
        isLive: boolean;
        hours: number;
        baustelle: string | null;
        source: string;
      }>;
      message: string;
    }
  | { ok: false; message: string }
> {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false, message: text.sensitiveAdminOnly };

  const worker = await findWorkerByName(requester.companyId, input.workerName);
  if (!worker) return { ok: false, message: text.workerNotFound };

  const days = Math.min(31, Math.max(1, Math.floor(Number(input.days ?? 7) || 7)));
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const sessions = await prisma.workSession.findMany({
    where: { workerId: worker.id, startTime: { gte: since } },
    orderBy: { startTime: "desc" },
    select: {
      startTime: true,
      endTime: true,
      breakMinutes: true,
      totalHours: true,
      baustelle: { select: { name: true } },
    },
    take: 250,
  });

  const rows = sessions.map((s) => ({
    date: dateKey(s.startTime),
    ...sessionPayload(s, new Date(), text, requester.preferredLanguage),
  }));
  const totalHours = rows.reduce((sum, r) => sum + (Number.isFinite(r.hours) ? r.hours : 0), 0);

  return {
    ok: true,
    worker: `${worker.firstName} ${worker.lastName}`.trim(),
    days,
    totalHours,
    sessions: rows,
    message: text.hoursOverview(days, `${worker.firstName} ${worker.lastName}`.trim()),
  };
}

function dailyReportPayload(report: Awaited<ReturnType<typeof getWorkerDailyReport>>, date: string, text = assistantToolText("DE"), lang?: string) {
  const groups = groupDailyWorkByBaustelle(report, lang);
  const notes = parseReportMessages(report.note?.note, lang).map((m) => ({
    authorName: m.authorName,
    authorRole: m.authorRole,
    text: m.text,
    createdAt: m.createdAt,
  }));
  const sessions = report.sessions.map((s) => sessionPayload(s, new Date(), text, lang));
  const totalHours = sessions.reduce((sum, s) => sum + s.hours, 0);

  return {
    date,
    worker: report.worker ? `${report.worker.firstName} ${report.worker.lastName}`.trim() : null,
    totalHours,
    sessions,
    baustellen: groups.map((group) => ({
      name: group.baustelle.name,
      standort: baustelleStandort(group.baustelle),
      arbeitszeiten: group.sessions.map((session) => ({
        startTime: formatReportTime(session.startTime, lang),
        endTime: formatReportTime(session.endTime, lang),
        isLive: !session.endTime,
      })),
      kollegen: group.colleagues,
      aktivitaeten: group.activities.map((activity) => ({
        time: formatReportTime(activity.time, lang),
        title: activity.title,
        detail: activity.detail,
        treeId: activity.treeId,
      })),
      tasks: group.tasks.map((task) => ({ description: task.description, createdAt: task.createdAt.toISOString() })),
      trees: group.trees.map((tree) => ({
        treeId: tree.treeId,
        species: tree.species || null,
        diameter: tree.diameter,
        crownWidth: treeExtra(tree, ["crownWidth", "kronenbreite", "kronenBreite"]),
        height: treeExtra(tree, ["height", "hoehe", "lartesi"]),
        note: treeWorkerNote(tree),
        haltverbot: treeHaltverbot(tree),
        action: treeAction(tree, lang),
        completedAt: tree.completedAt ? tree.completedAt.toISOString() : null,
      })),
    })),
    notes,
  };
}

function monthlyReportPayload(report: Awaited<ReturnType<typeof getWorkerMonthlyReport>>, month: string, text = assistantToolText("DE"), lang?: string) {
  const rows = monthlySessionRows(report, month, lang);
  const notesRaw = parseReportMessages(report.note?.note, lang);
  const notes = notesRaw
    .filter((m) => !m.text.startsWith("KOHE|"))
    .map((m) => ({ authorName: m.authorName, authorRole: m.authorRole, text: m.text, createdAt: m.createdAt }));
  const adminTimeRows = notesRaw
    .filter((message) => message.authorRole === "Admin" && message.text.startsWith("KOHE|"))
    .map((message) => {
      const [, startIso, endIso] = message.text.split("|");
      const start = new Date(startIso ?? "");
      const end = new Date(endIso ?? "");
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
      return {
        date: dateKey(start),
        start: formatReportTime(start, lang),
        end: formatReportTime(end, lang),
      };
    })
    .filter((row): row is { date: string; start: string; end: string } => Boolean(row));
  const totalHours = rows.reduce((sum, row) => sum + row.totalHours, 0);

  return {
    month,
    worker: report.worker ? `${report.worker.firstName} ${report.worker.lastName}`.trim() : null,
    totalHours,
    rows: rows.map((row) => ({
      date: row.date,
      day: row.dayName,
      startTime: formatReportTime(row.startTime, lang),
      endTime: formatReportTime(row.endTime, lang),
      isLive: row.hasLive,
      breakMinutes: row.hasWork ? row.breakMinutes : 0,
      locations: row.locations,
      hours: row.hasWork ? row.totalHours : 0,
      hasWork: row.hasWork,
    })),
    adminTimeRows,
    notes,
  };
}

export async function getMyDailyReport(requester: RequesterContext, input: { date?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false as const, message: text.notSignedIn };
  if (requester.kind !== "worker") return { ok: false as const, message: text.workerDailyAdminHint };

  const date = (input.date ?? todayKey()).trim();
  if (!validDateKey(date)) return { ok: false as const, message: text.invalidDate };

  const report = await getWorkerDailyReport(requester.workerId, date);
  if (!report.worker || report.worker.companyProfileId !== requester.companyId) return { ok: false as const, message: text.workerNotFound };
  const payload = dailyReportPayload(report, date, text, requester.preferredLanguage);

  return {
    ok: true as const,
    ...payload,
    profileUrl: `/workzone/profile`,
    dailyReportUrl: `/workzone/profile/day/${date}`,
    message: text.myDailyReport(date, payload.totalHours, payload.baustellen.length),
  };
}

export async function getMyMonthlyTimesheet(requester: RequesterContext, input: { month?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false as const, message: text.notSignedIn };
  if (requester.kind !== "worker") return { ok: false as const, message: text.workerMonthlyAdminHint };

  const month = (input.month ?? currentMonthKey()).trim();
  if (!validMonthKey(month)) return { ok: false as const, message: text.invalidMonth };

  const report = await getWorkerMonthlyReport(requester.workerId, month);
  if (!report.worker || report.worker.companyProfileId !== requester.companyId) return { ok: false as const, message: text.workerNotFound };
  const payload = monthlyReportPayload(report, month, text, requester.preferredLanguage);

  return {
    ok: true as const,
    ...payload,
    profileUrl: `/workzone/profile`,
    monthlyTimesheetUrl: `/workzone/profile/month/${month}`,
    message: text.myMonthlyTimesheet(month, payload.totalHours),
  };
}

export async function adminGetWorkerDailyReport(requester: RequesterContext, input: { workerName: string; date?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const worker = await findWorkerByName(requester.companyId, input.workerName);
  if (!worker) return { ok: false as const, message: text.workerNotFound };
  const date = (input.date ?? todayKey()).trim();
  if (!validDateKey(date)) return { ok: false as const, message: text.invalidDate };

  const report = await getWorkerDailyReport(worker.id, date);
  if (!report.worker || report.worker.companyProfileId !== requester.companyId) return { ok: false as const, message: text.workerNotFound };
  const payload = dailyReportPayload(report, date, text, requester.preferredLanguage);

  return {
    ok: true as const,
    ...payload,
    ...workerLinks(worker.id, date),
    message: text.workerDailyReport(date, payload.worker, payload.totalHours, payload.baustellen.length),
  };
}

export async function adminGetTeamDailyReport(requester: RequesterContext, input: { date?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const date = (input.date ?? todayKey()).trim();
  if (!validDateKey(date)) return { ok: false as const, message: text.invalidDate };
  const start = startOfLocalDay(date);
  if (!start) return { ok: false as const, message: text.invalidDate };
  const end = endOfLocalDay(start);

  const [workers, sessionsRaw, trees, inventoryMovements, coneMovements] = await Promise.all([
    prisma.worker.findMany({
      where: { companyProfileId: requester.companyId },
      select: { id: true, firstName: true, lastName: true, status: true, availability: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    }),
    prisma.workSession.findMany({
      where: { worker: { companyProfileId: requester.companyId }, startTime: { gte: start, lte: end } },
      include: { worker: true, baustelle: { select: { name: true } } },
      orderBy: { startTime: "asc" },
      take: 3000,
    }),
    prisma.treeItem.findMany({
      where: {
        completedAt: { gte: start, lte: end },
        completedByWorker: { companyProfileId: requester.companyId },
      },
      include: { completedByWorker: true, baustelle: { select: { name: true } } },
      orderBy: { completedAt: "asc" },
      take: 5000,
    }),
    prisma.inventoryMovement.findMany({
      where: { timestamp: { gte: start, lte: end }, worker: { companyProfileId: requester.companyId } },
      include: { worker: true, baustelle: { select: { name: true } }, treeItem: { select: { treeId: true } } },
      orderBy: { timestamp: "asc" },
      take: 5000,
    }),
    prisma.machineConeMovement.findMany({
      where: { createdAt: { gte: start, lte: end }, actorWorker: { companyProfileId: requester.companyId } },
      include: { actorWorker: true, baustelle: { select: { name: true } }, treeItem: { select: { treeId: true } } },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
  ]);

  const sessions = sessionsRaw.filter((session) => effectiveSessionHours(session) >= 1 / 60);
  const rows = new Map<
    string,
    {
      worker: string;
      status: string;
      availability: string;
      hours: number;
      baustellen: Set<string>;
      treeCount: number;
      trees: { treeId: string; baustelle: string; completedAt: string | null }[];
      materialActionCount: number;
      materialActions: string[];
    }
  >();

  for (const worker of workers) {
    rows.set(worker.id, {
      worker: `${worker.firstName} ${worker.lastName}`.trim(),
      status: worker.status,
      availability: worker.availability,
      hours: 0,
      baustellen: new Set<string>(),
      treeCount: 0,
      trees: [],
      materialActionCount: 0,
      materialActions: [],
    });
  }

  for (const session of sessions) {
    const row = rows.get(session.workerId);
    if (!row) continue;
    row.hours += effectiveSessionHours(session);
    if (session.baustelle?.name) row.baustellen.add(session.baustelle.name);
  }

  for (const tree of trees) {
    if (!tree.completedByWorkerId) continue;
    const row = rows.get(tree.completedByWorkerId);
    if (!row) continue;
    row.treeCount += 1;
    if (tree.baustelle?.name) row.baustellen.add(tree.baustelle.name);
    row.trees.push({
      treeId: tree.treeId,
      baustelle: tree.baustelle?.name ?? "-",
      completedAt: tree.completedAt ? formatReportTime(tree.completedAt, requester.preferredLanguage) : null,
    });
  }

  for (const movement of inventoryMovements) {
    if (!movement.workerId) continue;
    const row = rows.get(movement.workerId);
    if (!row) continue;
    row.materialActionCount += 1;
    if (movement.baustelle?.name) row.baustellen.add(movement.baustelle.name);
    row.materialActions.push(
      `${formatReportTime(movement.timestamp, requester.preferredLanguage)} ${movement.type === "DEPLOY" ? text.deployed : text.collected}: ${movement.quantity} ${movement.category}${movement.treeItem?.treeId ? ` ${text.tree} ${movement.treeItem.treeId}` : ""}`,
    );
  }

  for (const movement of coneMovements) {
    if (!movement.actorWorkerId) continue;
    const row = rows.get(movement.actorWorkerId);
    if (!row) continue;
    row.materialActionCount += 1;
    if (movement.baustelle?.name) row.baustellen.add(movement.baustelle.name);
    row.materialActions.push(
      `${formatReportTime(movement.createdAt, requester.preferredLanguage)} ${movement.type === "DEPLOY" ? text.deployed : movement.type === "COLLECT" ? text.collected : text.moved}: ${movement.quantity} ${text.cones}${movement.treeItem?.treeId ? ` ${text.tree} ${movement.treeItem.treeId}` : ""}`,
    );
  }

  const activeRows = [...rows.values()]
    .filter((row) => row.hours > 0 || row.treeCount > 0 || row.materialActionCount > 0)
    .map((row) => ({
      worker: row.worker,
      status: row.status,
      availability: row.availability,
      hours: row.hours,
      baustellen: [...row.baustellen],
      treeCount: row.treeCount,
      trees: row.trees,
      materialActionCount: row.materialActionCount,
      materialActions: row.materialActions,
    }))
    .sort((a, b) => b.treeCount - a.treeCount || a.worker.localeCompare(b.worker));
  const workersWithTrees = activeRows.filter((row) => row.treeCount > 0);
  const workersWorkedWithoutTrees = activeRows.filter((row) => row.treeCount === 0);

  return {
    ok: true as const,
    date,
    activeWorkerCount: activeRows.length,
    workersWithTrees,
    workersWorkedWithoutTrees,
    workers: activeRows,
    message:
      workersWithTrees.length === 0
        ? text.teamNoCompletedTrees(date)
        : text.teamCompletedTrees(date, workersWithTrees.length),
  };
}

export async function adminGetWorkerMonthlyTimesheet(requester: RequesterContext, input: { workerName: string; month?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const worker = await findWorkerByName(requester.companyId, input.workerName);
  if (!worker) return { ok: false as const, message: text.workerNotFound };
  const month = (input.month ?? currentMonthKey()).trim();
  if (!validMonthKey(month)) return { ok: false as const, message: text.invalidMonth };

  const report = await getWorkerMonthlyReport(worker.id, month);
  if (!report.worker || report.worker.companyProfileId !== requester.companyId) return { ok: false as const, message: text.workerNotFound };
  const payload = monthlyReportPayload(report, month, text, requester.preferredLanguage);

  return {
    ok: true as const,
    ...payload,
    ...workerLinks(worker.id, undefined, month),
    message: text.workerMonthlyTimesheet(month, payload.worker, payload.totalHours),
  };
}

export async function adminGetOwnDailyReport(requester: RequesterContext, input: { date?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const date = (input.date ?? todayKey()).trim();
  if (!validDateKey(date)) return { ok: false as const, message: text.invalidDate };
  const report = await getAdminDailyReport(requester.adminId, date);
  if (!report.admin) return { ok: false as const, message: text.adminNotFound };

  const groups = new Map<
    string,
    {
      baustelle: { id: string; name: string; description?: string | null; coordinates?: unknown };
      tasks: typeof report.tasks;
      trees: typeof report.trees;
      activities: Array<{ title: string; detail: string; time: Date }>;
    }
  >();

  const ensureGroup = (baustelle: { id: string; name: string; description?: string | null; coordinates?: unknown } | null | undefined) => {
    if (!baustelle) return null;
    if (!groups.has(baustelle.id)) groups.set(baustelle.id, { baustelle, tasks: [], trees: [], activities: [] });
    return groups.get(baustelle.id) ?? null;
  };

  for (const task of report.tasks) {
    ensureGroup(task.baustelle)?.tasks.push(task);
  }
  for (const tree of report.trees) {
    ensureGroup(tree.baustelle)?.trees.push(tree);
  }
  for (const movement of report.inventoryMovements) {
    ensureGroup(movement.baustelle)?.activities.push(inventoryActivity(movement, requester.preferredLanguage));
  }
  for (const movement of report.coneMovements) {
    const activity = coneActivity(movement, requester.preferredLanguage);
    if (!activity) continue;
    ensureGroup(movement.baustelle)?.activities.push(activity);
  }
  const baustellen = [...groups.values()].map((group) => ({
    name: group.baustelle.name,
    standort: baustelleStandort(group.baustelle),
    activities: group.activities
      .sort((a, b) => a.time.getTime() - b.time.getTime())
      .map((activity) => ({ title: activity.title, detail: activity.detail, time: formatReportTime(activity.time, requester.preferredLanguage) })),
    tasks: group.tasks.map((task) => ({ description: task.description, createdAt: task.createdAt.toISOString() })),
    trees: group.trees.map((tree) => ({
      treeId: tree.treeId,
      species: tree.species || null,
      diameter: tree.diameter,
      crownWidth: treeExtra(tree, ["crownWidth", "kronenbreite", "kronenBreite"]),
      height: treeExtra(tree, ["height", "hoehe", "lartesi"]),
      note: treeWorkerNote(tree),
      haltverbot: treeHaltverbot(tree),
      action: treeAction(tree, requester.preferredLanguage),
      completedAt: tree.completedAt ? tree.completedAt.toISOString() : null,
    })),
  }));

  return {
    ok: true as const,
    date,
    admin: report.admin.name ?? report.admin.email,
    dailyReportUrl: `/app/admin/day/${date}`,
    baustellen,
    message: text.adminDailyReport(date, baustellen.length),
  };
}

/**
 * Live location + today's machine assignment for the logged-in worker (no name lookup).
 * Use when the user asks "ku je?", "wo bin ich?", etc. without naming someone.
 */
