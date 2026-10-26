import { prisma } from "@/lib/db/prisma";
import { findMachinePresencesForBaustelles } from "@/lib/workzone/fleet-gps";
import { effectiveSessionHours, isReportableSession } from "@/lib/workzone/session-rules";
import { isRecord, readLatLng } from "@/lib/workzone/site-json";
import {
  dateKey,
  dayRange,
  formatReportDate,
  formatReportDateTime,
  formatReportDay,
  formatReportTime,
  monthKey,
  monthRange,
} from "./date-utils";

export {
  dateKey,
  dayRange,
  formatReportDate,
  formatReportDateTime,
  formatReportDay,
  formatReportTime,
  monthKey,
  monthRange,
} from "./date-utils";

export type ReportMessage = {
  id: string;
  authorName: string;
  authorRole: "Admin" | "Worker" | "System";
  text: string;
  createdAt: string;
};

function reportText(lang?: string) {
  const normalized = lang?.toLowerCase();
  const selected = normalized === "en" || normalized === "it" || normalized === "sq" || normalized === "ro" || normalized === "pl" ? normalized : "de";
  const messages = {
    de: {
      note: "Notiz",
      done: "erledigt",
      extraTree: (actor: string) => `Extra Baum${actor ? ` von ${actor}` : ""}`,
      fence: "Bauzaun",
      sign: "Halteverbot-Schilder",
      plate: "Abdeckplatten",
      tree: (id: string) => `Baum ${id}`,
      site: "Baustelle",
      machine: "Maschine",
      deployed: "gesetzt",
      collected: "eingesammelt",
      moved: "bewegt",
      cones: "Konen",
      from: "von",
      to: "auf",
      notePrefix: "Notiz",
    },
    en: {
      note: "Note",
      done: "done",
      extraTree: (actor: string) => `Extra tree${actor ? ` by ${actor}` : ""}`,
      fence: "construction fence",
      sign: "no-parking signs",
      plate: "cover plates",
      tree: (id: string) => `tree ${id}`,
      site: "site",
      machine: "machine",
      deployed: "deployed",
      collected: "collected",
      moved: "moved",
      cones: "cones",
      from: "from",
      to: "onto",
      notePrefix: "Note",
    },
    it: {
      note: "Nota",
      done: "completato",
      extraTree: (actor: string) => `Albero extra${actor ? ` da ${actor}` : ""}`,
      fence: "recinzione da cantiere",
      sign: "cartelli divieto di sosta",
      plate: "piastre di copertura",
      tree: (id: string) => `albero ${id}`,
      site: "cantiere",
      machine: "macchina",
      deployed: "posato",
      collected: "raccolto",
      moved: "spostato",
      cones: "coni",
      from: "da",
      to: "su",
      notePrefix: "Nota",
    },
    sq: {
      note: "Shenim",
      done: "perfunduar",
      extraTree: (actor: string) => `Dru ekstra${actor ? ` nga ${actor}` : ""}`,
      fence: "gardh kantieri",
      sign: "shenja ndalim parkimi",
      plate: "pllaka mbuluese",
      tree: (id: string) => `dru ${id}`,
      site: "kantier",
      machine: "makine",
      deployed: "vendosur",
      collected: "mbledhur",
      moved: "levizur",
      cones: "kone",
      from: "nga",
      to: "ne",
      notePrefix: "Shenim",
    },
    ro: {
      note: "Nota",
      done: "finalizat",
      extraTree: (actor: string) => `Arbore extra${actor ? ` de ${actor}` : ""}`,
      fence: "gard de santier",
      sign: "semne interzis parcare",
      plate: "placi de acoperire",
      tree: (id: string) => `arbore ${id}`,
      site: "santier",
      machine: "utilaj",
      deployed: "pus",
      collected: "strans",
      moved: "mutat",
      cones: "conuri",
      from: "de la",
      to: "pe",
      notePrefix: "Nota",
    },
    pl: {
      note: "Notatka",
      done: "wykonane",
      extraTree: (actor: string) => `Dodatkowe drzewo${actor ? ` od ${actor}` : ""}`,
      fence: "ogrodzenie budowlane",
      sign: "znaki zakazu parkowania",
      plate: "plyty przykrywajace",
      tree: (id: string) => `drzewo ${id}`,
      site: "budowa",
      machine: "maszyna",
      deployed: "ustawione",
      collected: "zebrane",
      moved: "przeniesione",
      cones: "pacholki",
      from: "z",
      to: "na",
      notePrefix: "Notatka",
    },
  } as const;
  return messages[selected];
}

export function parseReportMessages(note: string | null | undefined, lang?: string): ReportMessage[] {
  const text = reportText(lang);
  if (!note?.trim()) return [];

  try {
    const parsed = JSON.parse(note);
    const messages = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.messages) ? parsed.messages : [];
    return (messages as unknown[])
      .filter(isRecord)
      .filter((message) => typeof message?.text === "string" && message.text.trim())
      .map((message, index: number) => ({
        id: String(message.id ?? `legacy-${index}`),
        authorName: String(message.authorName ?? text.note),
        authorRole: message.authorRole === "Admin" || message.authorRole === "Worker" ? message.authorRole : "System",
        text: String(message.text).trim(),
        createdAt: String(message.createdAt ?? new Date(0).toISOString()),
      }));
  } catch {
    return [
      {
        id: "legacy-note",
        authorName: text.note,
        authorRole: "System",
        text: note.trim(),
        createdAt: new Date(0).toISOString(),
      },
    ];
  }
}

export function serializeReportMessages(messages: ReportMessage[]) {
  return JSON.stringify({ messages });
}

export function baustelleStandort(baustelle: { description?: string | null; coordinates?: unknown } | null | undefined) {
  if (!baustelle) return "-";
  if (baustelle.description?.trim()) return baustelle.description.trim();
  const coords = readLatLng(baustelle.coordinates);
  if (coords) return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
  return "-";
}

export function treeExtra(tree: { notes?: string | null }, keys: string | string[]) {
  if (!tree.notes) return "-";
  const wanted = Array.isArray(keys) ? keys : [keys];
  try {
    const parsed = JSON.parse(tree.notes);
    for (const key of wanted) {
      const value = parsed?.[key];
      if (value != null && String(value).trim() !== "") return String(value);
    }
    return "-";
  } catch {
    return "-";
  }
}

export function treeAction(tree: { notes?: string | null }, lang?: string) {
  const text = reportText(lang);
  if (!tree.notes) return text.done;
  try {
    const parsed = JSON.parse(tree.notes);
    return String(parsed?.action ?? parsed?.massnahme ?? parsed?.task ?? text.done);
  } catch {
    return tree.notes;
  }
}

export function treeHaltverbot(tree: { notes?: string | null }) {
  if (!tree.notes) return false;
  try {
    const parsed = JSON.parse(tree.notes);
    return Boolean(parsed?.haltverbot);
  } catch {
    return false;
  }
}

export function treeWorkerNote(tree: { notes?: string | null }) {
  if (!tree.notes) return "-";
  try {
    const parsed = JSON.parse(tree.notes);
    const note = parsed?.note;
    return typeof note === "string" && note.trim() ? note.trim() : "-";
  } catch {
    return "-";
  }
}

export function treeExtraOrigin(tree: { notes?: string | null }, lang?: string) {
  const text = reportText(lang);
  if (!tree.notes) return "";
  try {
    const parsed = JSON.parse(tree.notes);
    if (!parsed?.extraTree) return "";
    const actor = typeof parsed.addedByName === "string" && parsed.addedByName.trim() ? parsed.addedByName.trim() : "";
    return text.extraTree(actor);
  } catch {
    return "";
  }
}

function workerFullName(worker: { firstName: string; lastName: string }) {
  return `${worker.firstName} ${worker.lastName}`.trim();
}

function equipmentCategoryLabel(category: string, lang?: string) {
  const text = reportText(lang);
  if (category === "FENCE") return text.fence;
  if (category === "SIGN") return text.sign;
  if (category === "PLATE") return text.plate;
  return category;
}

function treeLabel(tree: { treeId: string } | null | undefined, lang?: string) {
  const text = reportText(lang);
  return tree?.treeId ? text.tree(tree.treeId) : text.site;
}

function machineLabel(machine: { nickname?: string | null; name?: string | null } | null | undefined, lang?: string) {
  return machine?.nickname || machine?.name || reportText(lang).machine;
}

function isMissingManualTaskResolutionColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("ManualTask.resolvedByUserId") ||
    message.includes("ManualTask.resolvedByWorkerId") ||
    message.includes("ManualTask.resolvedAt")
  );
}

type LegacyManualTaskRow = {
  id: string;
  description: string;
  userId: string;
  workerId: string | null;
  createdAt: Date;
  isFlagged: boolean;
  baustelleId: string;
  baustelleName: string;
  baustelleDescription: string | null;
  baustelleCoordinates: unknown;
};

function legacyTaskWithBaustelle(row: LegacyManualTaskRow) {
  return {
    id: row.id,
    description: row.description,
    userId: row.userId,
    workerId: row.workerId,
    createdAt: row.createdAt,
    isFlagged: row.isFlagged,
    baustelleId: row.baustelleId,
    baustelle: {
      id: row.baustelleId,
      name: row.baustelleName,
      description: row.baustelleDescription,
      coordinates: row.baustelleCoordinates,
    },
  };
}

async function getWorkerResolvedTasks(workerId: string, start: Date, end: Date) {
  try {
    return await prisma.manualTask.findMany({
      where: { resolvedByWorkerId: workerId, resolvedAt: { gte: start, lt: end } },
      include: { baustelle: true },
      orderBy: { resolvedAt: "asc" },
    });
  } catch (error) {
    if (!isMissingManualTaskResolutionColumn(error)) throw error;
    const rows = await prisma.$queryRaw<LegacyManualTaskRow[]>`
      SELECT
        mt."id",
        mt."description",
        mt."userId",
        mt."workerId",
        mt."createdAt",
        mt."isFlagged",
        b."id" AS "baustelleId",
        b."name" AS "baustelleName",
        b."description" AS "baustelleDescription",
        b."coordinates" AS "baustelleCoordinates"
      FROM "ManualTask" mt
      INNER JOIN "Baustelle" b ON b."id" = mt."baustelleId"
      WHERE mt."workerId" = ${workerId}
        AND mt."createdAt" >= ${start}
        AND mt."createdAt" < ${end}
      ORDER BY mt."createdAt" ASC
    `;
    return rows.map(legacyTaskWithBaustelle);
  }
}

async function getAdminResolvedTasks(adminId: string, start: Date, end: Date) {
  try {
    return await prisma.manualTask.findMany({
      where: { resolvedByUserId: adminId, resolvedAt: { gte: start, lt: end } },
      include: { baustelle: true },
      orderBy: { resolvedAt: "asc" },
    });
  } catch (error) {
    if (!isMissingManualTaskResolutionColumn(error)) throw error;
    const rows = await prisma.$queryRaw<LegacyManualTaskRow[]>`
      SELECT
        mt."id",
        mt."description",
        mt."userId",
        mt."workerId",
        mt."createdAt",
        mt."isFlagged",
        b."id" AS "baustelleId",
        b."name" AS "baustelleName",
        b."description" AS "baustelleDescription",
        b."coordinates" AS "baustelleCoordinates"
      FROM "ManualTask" mt
      INNER JOIN "Baustelle" b ON b."id" = mt."baustelleId"
      WHERE mt."userId" = ${adminId}
        AND mt."createdAt" >= ${start}
        AND mt."createdAt" < ${end}
      ORDER BY mt."createdAt" ASC
    `;
    return rows.map(legacyTaskWithBaustelle);
  }
}

export type DailyReportActivity = {
  id: string;
  time: Date;
  baustelleId: string;
  treeId: string | null;
  title: string;
  detail: string;
};

export function inventoryActivity(movement: {
  id: string;
  timestamp: Date;
  baustelleId: string;
  category: string;
  quantity: number;
  type: string;
  note?: string | null;
  treeItem?: { treeId: string } | null;
}, lang?: string): DailyReportActivity {
  const text = reportText(lang);
  const label = equipmentCategoryLabel(movement.category, lang);
  const verb = movement.type === "DEPLOY" ? text.deployed : text.collected;
  const target = treeLabel(movement.treeItem, lang);
  const note = movement.note?.trim() ? ` ${text.notePrefix}: ${movement.note.trim()}` : "";

  return {
    id: `inventory-${movement.id}`,
    time: movement.timestamp,
    baustelleId: movement.baustelleId,
    treeId: movement.treeItem?.treeId ?? null,
    title: `${movement.quantity} ${label} ${verb}`,
    detail: `${target}.${note}`,
  };
}

export function coneActivity(movement: {
  id: string;
  createdAt: Date;
  baustelleId?: string | null;
  quantity: number;
  type: string;
  note?: string | null;
  treeItem?: { treeId: string } | null;
  fromMachine?: { nickname?: string | null; name?: string | null } | null;
  toMachine?: { nickname?: string | null; name?: string | null } | null;
}, lang?: string): DailyReportActivity | null {
  if (!movement.baustelleId) return null;

  const text = reportText(lang);
  const target = treeLabel(movement.treeItem, lang);
  const note = movement.note?.trim() ? ` ${text.notePrefix}: ${movement.note.trim()}` : "";
  if (movement.type === "DEPLOY") {
    return {
      id: `cone-${movement.id}`,
      time: movement.createdAt,
      baustelleId: movement.baustelleId,
      treeId: movement.treeItem?.treeId ?? null,
      title: `${movement.quantity} ${text.cones} ${text.deployed}`,
      detail: `${target}, ${text.from} ${machineLabel(movement.fromMachine, lang)}.${note}`,
    };
  }
  if (movement.type === "COLLECT") {
    return {
      id: `cone-${movement.id}`,
      time: movement.createdAt,
      baustelleId: movement.baustelleId,
      treeId: movement.treeItem?.treeId ?? null,
      title: `${movement.quantity} ${text.cones} ${text.collected}`,
      detail: `${target}, ${text.to} ${machineLabel(movement.toMachine, lang)}.${note}`,
    };
  }

  return {
    id: `cone-${movement.id}`,
    time: movement.createdAt,
    baustelleId: movement.baustelleId,
    treeId: movement.treeItem?.treeId ?? null,
    title: `${movement.quantity} ${text.cones} ${text.moved}`,
    detail: `${target}.${note}`,
  };
}

export function groupDailyWorkByBaustelle(report: Awaited<ReturnType<typeof getWorkerDailyReport>>, lang?: string) {
  const groups = new Map<
    string,
    {
      baustelle: { id: string; name: string; description?: string | null; coordinates?: unknown };
      sessions: typeof report.sessions;
      trees: typeof report.trees;
      tasks: typeof report.tasks;
      activities: DailyReportActivity[];
      colleagues: string[];
      machinePresences: typeof report.machinePresences;
    }
  >();

  const ensureGroup = (baustelle: { id: string; name: string; description?: string | null; coordinates?: unknown } | null | undefined) => {
    if (!baustelle) return null;
    if (!groups.has(baustelle.id)) {
      groups.set(baustelle.id, {
        baustelle,
        sessions: [],
        trees: [],
        tasks: [],
        activities: [],
        colleagues: report.colleaguesByBaustelle[baustelle.id] ?? [],
        machinePresences: [],
      });
    }
    return groups.get(baustelle.id) ?? null;
  };

  for (const session of report.sessions) {
    ensureGroup(session.baustelle)?.sessions.push(session);
  }

  for (const tree of report.trees) {
    ensureGroup(tree.baustelle)?.trees.push(tree);
  }

  for (const task of report.tasks) {
    ensureGroup(task.baustelle)?.tasks.push(task);
  }

  for (const movement of report.inventoryMovements) {
    const group = ensureGroup(movement.baustelle);
    group?.activities.push(inventoryActivity(movement, lang));
  }

  for (const movement of report.coneMovements) {
    const activity = coneActivity(movement, lang);
    if (!activity) continue;
    const group = ensureGroup(movement.baustelle);
    group?.activities.push(activity);
  }

  for (const presence of report.machinePresences) {
    ensureGroup(presence.baustelle)?.machinePresences.push(presence);
  }

  return [...groups.values()]
    .map((group) => ({ ...group, activities: group.activities.sort((a, b) => a.time.getTime() - b.time.getTime()) }))
    .sort((a, b) => a.baustelle.name.localeCompare(b.baustelle.name));
}

export function monthDays(key: string) {
  const { start, end } = monthRange(key);
  const days: Date[] = [];
  for (const day = new Date(start); day < end; day.setDate(day.getDate() + 1)) {
    days.push(new Date(day));
  }
  return days;
}

export function monthlySessionRows(report: Awaited<ReturnType<typeof getWorkerMonthlyReport>>, key: string, lang?: string) {
  return monthDays(key).map((day) => {
    const keyForDay = dateKey(day);
    const sessions = report.sessions.filter((session) => dateKey(session.startTime) === keyForDay);
    const startTime = sessions.length ? new Date(Math.min(...sessions.map((session) => session.startTime.getTime()))) : null;
    const endedSessions = sessions.filter((session) => session.endTime);
    const hasLive = sessions.some((session) => !session.endTime);
    const endTime = endedSessions.length
      ? new Date(Math.max(...endedSessions.map((session) => session.endTime?.getTime() ?? 0)))
      : null;
    const breakMinutes = sessions.reduce((sum, session) => sum + session.breakMinutes, 0);
    const totalHours = sessions.reduce((sum, session) => sum + effectiveSessionHours(session), 0);
    const locations = [
      ...new Set(sessions.map((session) => session.baustelle?.name ?? "-").filter((name) => name && name !== "-")),
    ];

    return {
      date: keyForDay,
      dayOfMonth: String(day.getDate()).padStart(2, "0"),
      dayName: formatReportDay(day, lang),
      startTime,
      endTime,
      hasLive,
      breakMinutes,
      locations: locations.length ? locations.join(", ") : "-",
      totalHours,
      hasWork: sessions.length > 0,
    };
  });
}

export async function getWorkerDailyReport(workerId: string, key: string) {
  const { start, end } = dayRange(key);
  const [worker, sessionsRaw, tasks, trees, inventoryMovements, coneMovementsRaw, note] = await Promise.all([
    prisma.worker.findUnique({ where: { id: workerId } }),
    prisma.workSession.findMany({
      where: { workerId, startTime: { gte: start, lt: end } },
      include: { baustelle: true },
      orderBy: { startTime: "asc" },
    }),
    getWorkerResolvedTasks(workerId, start, end),
    prisma.treeItem.findMany({
      where: { completedByWorkerId: workerId, completedAt: { gte: start, lt: end } },
      include: { baustelle: true },
      orderBy: { completedAt: "asc" },
    }),
    prisma.inventoryMovement.findMany({
      where: { workerId, timestamp: { gte: start, lt: end } },
      include: { baustelle: true, treeItem: { select: { treeId: true } } },
      orderBy: { timestamp: "asc" },
    }),
    prisma.machineConeMovement.findMany({
      where: { actorWorkerId: workerId, createdAt: { gte: start, lt: end } },
      include: {
        baustelle: true,
        treeItem: { select: { treeId: true } },
        fromMachine: { select: { name: true, nickname: true } },
        toMachine: { select: { name: true, nickname: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workReportNote.findUnique({ where: { workerId_type_periodKey: { workerId, type: "DAILY", periodKey: key } } }),
  ]);

  const sessions = sessionsRaw.filter(isReportableSession);
  const baustelleIds = [...new Set(sessions.map((session) => session.baustelleId).filter((id): id is string => Boolean(id)))];
  const peerSessions =
    baustelleIds.length > 0
      ? (
          await prisma.workSession.findMany({
            where: {
              baustelleId: { in: baustelleIds },
              workerId: { not: workerId },
              startTime: { gte: start, lt: end },
            },
            include: { worker: true },
            orderBy: { startTime: "asc" },
          })
        ).filter(isReportableSession)
      : [];
  const colleaguesByBaustelle = peerSessions.reduce<Record<string, string[]>>((acc, session) => {
    if (!session.baustelleId || !session.worker) return acc;
    const name = workerFullName(session.worker);
    const current = acc[session.baustelleId] ?? [];
    if (!current.includes(name)) current.push(name);
    acc[session.baustelleId] = current;
    return acc;
  }, {});
  const coneMovements = coneMovementsRaw.filter((movement) => movement.baustelleId);
  const machinePresences = await findMachinePresencesForBaustelles(baustelleIds, start, end);

  return { worker, sessions, tasks, trees, inventoryMovements, coneMovements, machinePresences, colleaguesByBaustelle, note };
}

export async function getWorkerMonthlyReport(workerId: string, key: string) {
  const { start, end } = monthRange(key);
  const [worker, sessions, tasks, trees, note] = await Promise.all([
    prisma.worker.findUnique({ where: { id: workerId } }),
    prisma.workSession.findMany({
      where: { workerId, startTime: { gte: start, lt: end } },
      include: { baustelle: true },
      orderBy: { startTime: "asc" },
    }),
    getWorkerResolvedTasks(workerId, start, end),
    prisma.treeItem.findMany({
      where: { completedByWorkerId: workerId, completedAt: { gte: start, lt: end } },
      include: { baustelle: true },
      orderBy: { completedAt: "asc" },
    }),
    prisma.workReportNote.findUnique({ where: { workerId_type_periodKey: { workerId, type: "MONTHLY", periodKey: key } } }),
  ]);

  return { worker, sessions: sessions.filter(isReportableSession), tasks, trees, note };
}

export async function getAdminDailyReport(adminId: string, key: string) {
  const { start, end } = dayRange(key);
  const [admin, tasks, trees, inventoryMovements, coneMovementsRaw] = await Promise.all([
    prisma.user.findFirst({ where: { id: adminId, role: "ADMIN", isActive: true } }),
    getAdminResolvedTasks(adminId, start, end),
    prisma.treeItem.findMany({
      where: { completedBy: adminId, completedAt: { gte: start, lt: end } },
      include: { baustelle: true },
      orderBy: { completedAt: "asc" },
    }),
    prisma.inventoryMovement.findMany({
      where: { actorAdminId: adminId, timestamp: { gte: start, lt: end } },
      include: { baustelle: true, treeItem: { select: { treeId: true } } },
      orderBy: { timestamp: "asc" },
    }),
    prisma.machineConeMovement.findMany({
      where: { actorAdminId: adminId, createdAt: { gte: start, lt: end } },
      include: {
        baustelle: true,
        treeItem: { select: { treeId: true } },
        fromMachine: { select: { name: true, nickname: true } },
        toMachine: { select: { name: true, nickname: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const coneMovements = coneMovementsRaw.filter((movement) => movement.baustelleId);

  return { admin, tasks, trees, inventoryMovements, coneMovements };
}
