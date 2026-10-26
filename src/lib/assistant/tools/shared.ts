/** Date, name and payload helpers shared by the assistant tools. */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { dateKey, formatReportTime } from "@/lib/workzone/reporting";
import { effectiveSessionHours } from "@/lib/workzone/session-rules";
import { assistantToolText } from "./text";

export function startOfLocalDay(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((v) => Number(v));
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function currentMonthKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function validDateKey(value: string) {
  return Boolean(startOfLocalDay(value));
}

export function validMonthKey(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function endOfLocalDay(date: Date) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function dateKeyFromDate(date: Date) {
  return dateKey(date);
}

export function normalizeName(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

export function workerByNameFilter(companyId: string, workerName: string): Prisma.WorkerWhereInput {
  const name = normalizeName(workerName);
  const [first, ...rest] = name.split(" ");
  const last = rest.join(" ").trim();
  return {
    companyProfileId: companyId,
    OR: [
      { firstName: { equals: first, mode: "insensitive" }, lastName: last ? { equals: last, mode: "insensitive" } : undefined },
      { firstName: { equals: name, mode: "insensitive" } },
      { lastName: { equals: name, mode: "insensitive" } },
    ],
  };
}

export async function findWorkerByName(companyId: string, workerName: string) {
  return prisma.worker.findFirst({
    where: workerByNameFilter(companyId, workerName),
    select: { id: true, firstName: true, lastName: true, phone: true, emailAccount: true },
  });
}

export function workerLinks(workerId: string, date?: string, month?: string) {
  return {
    profileUrl: `/app/admin/workers/${workerId}`,
    dailyReportUrl: date ? `/app/admin/workers/${workerId}/day/${date}` : null,
    monthlyTimesheetUrl: month ? `/app/admin/workers/${workerId}/month/${month}` : null,
  };
}

export function sessionPayload(
  session: { startTime: Date; endTime: Date | null; breakMinutes: number; totalHours: number; baustelle?: { name: string } | null },
  now = new Date(),
  text = assistantToolText("DE"),
  lang?: string,
) {
  const isLive = !session.endTime;
  return {
    startTime: formatReportTime(session.startTime, lang),
    endTime: session.endTime ? formatReportTime(session.endTime, lang) : null,
    isLive,
    breakMinutes: session.breakMinutes,
    hours: effectiveSessionHours(session, now),
    baustelle: session.baustelle?.name ?? null,
    source: text.sessionSource,
  };
}

/**
 * Admin-only: profile fields stored on Worker (licenses, position, …).
 */
