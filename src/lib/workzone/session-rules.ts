import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { isSaasMode } from "@/lib/saas-config";

export const STANDARD_START_HOUR = 7;
export const STANDARD_END_HOUR = 16;
export const LATE_STOP_SUGGESTION_HOUR = 16;
export const LATE_STOP_SUGGESTION_MINUTE = 30;
export const STANDARD_BREAK_MINUTES = 30;
export const MIN_RECORDABLE_SESSION_MS = 60_000;

export function totalWorkHours(start: Date, end: Date, breakMinutes: number) {
  return Math.max(0, Math.round(((end.getTime() - start.getTime()) / 3_600_000 - breakMinutes / 60) * 100) / 100);
}

export function effectiveSessionHours(
  session: { startTime: Date; endTime: Date | null; breakMinutes: number; totalHours: number },
  now = new Date(),
) {
  if (session.endTime) return Number.isFinite(session.totalHours) ? session.totalHours : 0;
  return totalWorkHours(session.startTime, now, session.breakMinutes);
}

export function defaultBreakForRange(start: Date, end: Date) {
  const rawHours = (end.getTime() - start.getTime()) / 3_600_000;
  return rawHours > 4 ? STANDARD_BREAK_MINUTES : 0;
}

export type PauseIntervalRange = {
  startedAt: Date;
  endedAt: Date | null;
};

export function totalPauseMinutes(intervals: PauseIntervalRange[], fallbackEnd = new Date()) {
  return intervals.reduce((sum, interval) => {
    const end = interval.endedAt ?? fallbackEnd;
    const rawMinutes = (end.getTime() - interval.startedAt.getTime()) / 60_000;
    return sum + Math.max(0, Math.round(rawMinutes));
  }, 0);
}

export function hasOpenPause(intervals: PauseIntervalRange[]) {
  return intervals.some((interval) => interval.endedAt === null);
}

export function stopBreakMinutes(requestedBreakMinutes: number, intervals: PauseIntervalRange[], endTime: Date) {
  if (intervals.length === 0) return requestedBreakMinutes;
  return totalPauseMinutes(intervals, endTime);
}

export function isTrivialSession(start: Date, end: Date) {
  return end.getTime() - start.getTime() < MIN_RECORDABLE_SESSION_MS;
}

export function isReportableSession(session: { startTime: Date; endTime: Date | null }) {
  if (!session.endTime) return true;
  return !isTrivialSession(session.startTime, session.endTime);
}

function atLocalTime(base: Date, hour: number, minute = 0) {
  const date = new Date(base);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function nextDayNoon(base: Date) {
  const date = new Date(base);
  date.setDate(date.getDate() + 1);
  date.setHours(12, 0, 0, 0);
  return date;
}

function isForgottenDaySession(start: Date, now: Date) {
  const hour = start.getHours();
  if (hour < 5 || hour > 12) return false;
  return now.getTime() >= nextDayNoon(start).getTime();
}

function isWorkSessionSchemaDriftError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022";
  }

  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2021" || code === "P2022";
}

export async function autoCloseForgottenDaySessions(now = new Date()) {
  const companyId = isSaasMode ? await getCurrentCompanyId() : null;
  if (isSaasMode && !companyId) return 0;
  try {
    const liveSessions = await prisma.workSession.findMany({
      where: { isLive: true, endTime: null, ...(companyId ? { worker: { companyProfileId: companyId } } : {}) },
      select: { id: true, startTime: true },
    });

    const updates = liveSessions
      .filter((session) => isForgottenDaySession(session.startTime, now))
      .map((session) => {
        const endTime = atLocalTime(session.startTime, STANDARD_END_HOUR, 0);
        if (endTime.getTime() <= session.startTime.getTime()) return null;
        return prisma.workSession.update({
          where: { id: session.id },
          data: {
            endTime,
            breakMinutes: STANDARD_BREAK_MINUTES,
            totalHours: totalWorkHours(session.startTime, endTime, STANDARD_BREAK_MINUTES),
            isLive: false,
            closedBySystem: true,
            systemNote: "Automatisch geschlossen: Tages-Session nach 12:00 am Folgetag auf 16:00 mit 30 min Pause gesetzt.",
          },
        });
      })
      .filter((update) => update !== null);

    if (updates.length === 0) return 0;
    await prisma.$transaction(updates);
    return updates.length;
  } catch (error) {
    if (isWorkSessionSchemaDriftError(error)) return 0;
    throw error;
  }
}
