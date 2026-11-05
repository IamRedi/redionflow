/** Operational tools: live status, machines, equipment, knowledge and redaction. */

import { prisma } from "@/lib/db/prisma";
import { dateKey, formatReportTime } from "@/lib/workzone/reporting";
import type { RequesterContext } from "../requester";
import { normalizeAssistantLanguage, type AssistantLanguageCode } from "../language";
import { assistantToolText } from "./text";
import { assistantDayBounds } from '../turn-context';
import {
  startOfLocalDay,
  todayKey,
  resolveWorkerByName,
  workerLookupMessage,
  incompleteAssistantResult,
  sessionPayload,
} from "./shared";

export async function getMyOperationalSnapshot(
  requester: RequesterContext,
): Promise<
  | {
      ok: true;
      worker: string;
      live:
        | { active: false; message: string }
        | { active: true; baustelleName: string; startedAt: string; message: string };
      assignment: { machine: string | null; baustelle: string | null; message: string; basis?:string };
      message: string;
    }
  | { ok: false; message: string }
> {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false, message: text.notSignedIn };
  if (requester.kind !== "worker") {
    return {
      ok: false,
      message: text.operationalWorkerOnly,
    };
  }

  const worker = await prisma.worker.findFirst({
    where: { id: requester.workerId, companyProfileId: requester.companyId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!worker) return { ok: false, message: text.workerNotFound };

  const label = `${worker.firstName} ${worker.lastName}`.trim();
  const [live, assigned] = await Promise.all([
    getLiveLocation(requester, { workerName: label }),
    getAssignedMachine(requester, { workerName: label }),
  ]);

  if (!live.ok) return { ok: false, message: live.message };
  if (!assigned.ok) return { ok: false, message: assigned.message };

  const livePart = live.live
    ? {
        active: true as const,
        baustelleName: live.baustelleName,
        startedAt: live.startedAt,
        message: live.message,
      }
    : { active: false as const, message: live.message };

  return {
    ok: true,
    worker: label,
    live: livePart,
    assignment: {
      machine: assigned.machine,
      baustelle: assigned.baustelle,
      message: assigned.message,
      basis:assigned.basis,
    },
    message: [live.message, assigned.message].filter(Boolean).join(" · "),
  };
}

export async function getLiveLocation(
  requester: RequesterContext,
  input: { workerName: string },
): Promise<
  | { ok: true; worker: string; live: false; message: string }
  | { ok: true; worker: string; live: true; baustelleName: string; startedAt: string; message: string }
  | { ok: false; message: string }
> {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false, message: text.notSignedIn };
  const resolution = await resolveWorkerByName(requester.companyId, input.workerName);
  if (resolution.status !== 'found') return { ok: false, message: workerLookupMessage(resolution, requester.preferredLanguage) };
  const worker = resolution.worker;

  const live = await prisma.workSession.findFirst({
    where: { workerId: worker.id, isLive: true, endTime: null },
    orderBy: { startTime: "desc" },
    select: { startTime: true, baustelle: { select: { name: true } } },
  });
  if (!live || !live.baustelle?.name) {
    return { ok: true, worker: `${worker.firstName} ${worker.lastName}`.trim(), live: false, message: text.notLive };
  }
  return {
    ok: true,
    worker: `${worker.firstName} ${worker.lastName}`.trim(),
    live: true,
    baustelleName: live.baustelle.name,
    startedAt: formatReportTime(live.startTime, requester.preferredLanguage),
    message: text.liveOnSite(live.baustelle.name, formatReportTime(live.startTime, requester.preferredLanguage)),
  };
}

export async function getAssignedMachine(
  requester: RequesterContext,
  input: { workerName: string; date?: string },
): Promise<
  | { ok: true; worker: string; machine: string | null; baustelle: string | null; message: string; basis?:string }
  | { ok: false; message: string }
> {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false, message: text.notSignedIn };
  const resolution = await resolveWorkerByName(requester.companyId, input.workerName);
  if (resolution.status !== 'found') return { ok: false, message: workerLookupMessage(resolution, requester.preferredLanguage) };
  const worker = resolution.worker;

  const key = (input.date ?? todayKey(requester.timeZone)).trim();
  const day = startOfLocalDay(key, requester.timeZone);
  if (!day) return { ok: false, message: text.invalidDate };

  const plan = await prisma.dailyWorkPlan.findUnique({
    where: { companyProfileId_planDate: { companyProfileId: requester.companyId, planDate: day } },
    include: { columns: { include: { baustelle: { select: { name: true } }, assignments: true } } },
  });
  if (!plan) {
    return {
      ok: true,
      worker: `${worker.firstName} ${worker.lastName}`.trim(),
      machine: null,
      baustelle: null,
      message: text.noDailyPlanFound,
    };
  }

  for (const col of plan.columns) {
    const hasWorker = col.assignments.some((a) => a.kind === "WORKER" && a.workerId === worker.id);
    if (!hasWorker) continue;
    const machine = col.assignments.find((a) => a.kind === "MACHINE");
    return {
      ok: true,
      worker: `${worker.firstName} ${worker.lastName}`.trim(),
      machine: machine?.labelSnapshot ?? null,
      baustelle: col.baustelle?.name ?? col.title ?? null,
      message: machine?.labelSnapshot ? text.assignedWithMachine(machine.labelSnapshot) : text.assignedNoMachine,
      basis:'Recorded daily-plan assignment, not confirmed asset custody or current usability.',
    };
  }

  return {
    ok: true,
    worker: `${worker.firstName} ${worker.lastName}`.trim(),
    machine: null,
    baustelle: null,
    message: text.notInDailyPlan,
  };
}

export async function getEquipmentStatus(
  requester: RequesterContext,
  input: { category: "SIGN" | "PLATE" | "FENCE"; limit?: number },
): Promise<{ ok: true; summary: string; rows: Array<{ baustelle: string; treeId: string | null; quantityOnSite: number }> } | { ok: false; message: string }> {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false, message: text.notSignedIn };
  const take = Math.min(500, Math.max(50, Number(input.limit ?? 200) || 200));

  const moves = await prisma.inventoryMovement.findMany({
    where: { companyProfileId: requester.companyId, category: input.category },
    orderBy: { timestamp: "desc" },
    include: {
      baustelle: { select: { name: true } },
      treeItem: { select: { treeId: true } },
    },
    take,
  });

  // Net balance per (baustelle, treeItem)
  const map = new Map<string, { baustelle: string; treeId: string | null; qty: number }>();
  for (const m of moves.reverse()) {
    const key = `${m.baustelleId}::${m.treeItemId ?? "SITE"}`;
    const current = map.get(key) ?? { baustelle: m.baustelle.name, treeId: m.treeItem?.treeId ?? null, qty: 0 };
    const delta = m.type === "DEPLOY" ? m.quantity : -m.quantity;
    current.qty += delta;
    map.set(key, current);
  }

  const rows = Array.from(map.values())
    .filter((r) => r.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 20)
    .map((r) => ({ baustelle: r.baustelle, treeId: r.treeId, quantityOnSite: r.qty }));

  if (rows.length === 0) return { ok: true, summary: text.noEquipmentOnSite, rows: [] };

  const summary = rows
    .map((r) => (r.treeId ? `${r.baustelle} (${text.tree} ${r.treeId}): ${r.quantityOnSite}` : `${r.baustelle}: ${r.quantityOnSite}`))
    .join(" · ");
  return { ok: true, summary, rows };
}

export async function getKnowledge(
  requester: RequesterContext,
  input: { query: string; language?: AssistantLanguageCode },
) {
  const lang = normalizeAssistantLanguage(input.language ?? requester.preferredLanguage);
  const text = assistantToolText(lang);
  const q = input.query.trim();
  if (!q) return { ok: false, message: text.knowledgeQueryRequired };

  const where = {
      companyProfileId: requester.companyId,
      isActive: true,
      language: lang,
      OR: [{ key: { equals: q, mode: 'insensitive' as const } }, { title: { contains: q, mode: 'insensitive' as const } }],
  };
  const [rows, totalMatches] = await Promise.all([
    prisma.companyKnowledge.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 3, select: { title: true, content: true, updatedAt: true } }),
    prisma.companyKnowledge.count({ where }),
  ]);
  if (!rows.length) return { ok: false, message: text.knowledgeNotFound };
  const matches = rows.map(row => ({ title: row.title, content: row.content.slice(0, 3000), contentTruncated: row.content.length > 3000, updatedAt: row.updatedAt.toISOString() }));
  const complete = totalMatches <= matches.length && matches.every(row => !row.contentTruncated);
  return { ok: true, title: matches[0].title, content: matches[0].content, matches, totalMatches, returnedCount: matches.length, complete, truncated: !complete };
}

/** Eingeloggter Mitarbeiter: eigene Stunden aus WorkSessions (letzte X Tage). */
export async function getMyHoursSummary(requester: RequesterContext, input: { days?: number }) {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false as const, message: text.notSignedIn };
  if (requester.kind !== "worker") {
    return { ok: false as const, message: text.privateSummaryAdminHint };
  }

  const days = Math.min(31, Math.max(1, Math.floor(Number(input.days ?? 14) || 14)));
  const zone = requester.timeZone ?? 'Europe/Berlin';
  const today = todayKey(zone);
  const sinceKey = new Date(Date.parse(`${today}T12:00:00Z`) - (days - 1) * 86400_000).toISOString().slice(0, 10);
  const since = assistantDayBounds(sinceKey, zone)!.start;

  const sessions = await prisma.workSession.findMany({
    where: { workerId: requester.workerId, worker: { companyProfileId: requester.companyId }, startTime: { gte: since } },
    orderBy: { startTime: "desc" },
    select: {
      startTime: true,
      endTime: true,
      breakMinutes: true,
      totalHours: true,
      baustelle: { select: { name: true } },
    },
    take: 301,
  });

  const complete = sessions.length <= 300;
  const rows = sessions.slice(0, 300).map((s) => ({
    date: dateKey(s.startTime),
    ...sessionPayload(s, new Date(), text, requester.preferredLanguage),
  }));
  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);

  return {
    ok: true as const,
    days,
    totalHours: complete ? totalHours : null,
    returnedHours: totalHours,
    complete,
    truncated: !complete,
    totalSessions: complete ? sessions.length : null,
    sessions: rows,
    message: complete ? text.myHoursSummary(days, totalHours) : incompleteAssistantResult(requester.preferredLanguage),
  };
}

/** Öffentliche Baustellen-Infos (Workzone): Namen, Typ, Adresse — für alle eingeloggten Nutzer derselben Firma. */
export async function getCompanyBaustellenDirectory(requester: RequesterContext) {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false as const, message: text.notSignedIn };

  const where = { companyProfileId: requester.companyId, status: 'active' as const };
  const [rows, count] = await Promise.all([
    prisma.baustelle.findMany({ where, select: { name: true, type: true, address: true, description: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 120 }),
    prisma.baustelle.count({ where }),
  ]);

  return {
    ok: true as const,
    count,
    returnedCount: rows.length,
    complete: rows.length === count,
    truncated: rows.length < count,
    baustellen: rows.map((b) => ({
      name: b.name,
      type: b.type,
      address: b.address,
      descriptionSnippet: b.description ? b.description.slice(0, 200) : null,
    })),
    message: text.activeSitesDirectory(count),
  };
}

export function redactPrivateWorkerData(requester: RequesterContext, text: string) {
  // placeholder hook for future redaction rules
  if (requester.kind === "admin") return text;
  return text;
}
