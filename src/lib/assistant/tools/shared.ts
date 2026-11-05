/** Date, name and payload helpers shared by the assistant tools. */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { dateKey, formatReportTime } from "@/lib/workzone/date-utils";
import { effectiveSessionHours } from "@/lib/workzone/session-rules";
import { assistantToolText } from "./text";
import { assistantDayBounds, isAssistantDateKey } from '../turn-context';
import { dayKey } from '@/lib/dashboard/steel-metrics';

export function startOfLocalDay(dateKey: string, timeZone = 'Europe/Berlin') {
  if (!isAssistantDateKey(dateKey)) return null;
  return assistantDayBounds(dateKey, timeZone)?.start ?? null;
}

export function todayKey(timeZone = 'Europe/Berlin', now = new Date()) {
  return dayKey(now, timeZone);
}

export function currentMonthKey(timeZone = 'Europe/Berlin', now = new Date()) {
  return todayKey(timeZone, now).slice(0, 7);
}

export function validDateKey(value: string) {
  return Boolean(startOfLocalDay(value));
}

export function validMonthKey(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function endOfLocalDay(date: Date, timeZone = 'Europe/Berlin') {
  const bounds = assistantDayBounds(dayKey(date, timeZone), timeZone);
  return new Date(bounds ? bounds.end.getTime() - 1 : NaN);
}

export function dateKeyFromDate(date: Date) {
  return dateKey(date);
}

export function normalizeName(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

export function workerByNameFilter(companyId: string, workerName: string): Prisma.WorkerWhereInput {
  const name = normalizeName(workerName);
  if (!name) return { companyProfileId: companyId, id: { in: [] } };
  const words = name.split(' ');
  const fullNames = words.slice(1).map((_, index) => ({
    firstName: { equals: words.slice(0, index + 1).join(' '), mode: 'insensitive' as const },
    lastName: { equals: words.slice(index + 1).join(' '), mode: 'insensitive' as const },
  }));
  return {
    companyProfileId: companyId,
    OR: [
      ...fullNames,
      { firstName: { equals: name, mode: "insensitive" } },
      { lastName: { equals: name, mode: "insensitive" } },
    ],
  };
}

export async function resolveWorkerByName(companyId: string, workerName: string) {
  if (!companyId || !normalizeName(workerName)) return { status: 'not_found' as const };
  const rows = await prisma.worker.findMany({
    where: workerByNameFilter(companyId, workerName),
    select: { id: true, firstName: true, lastName: true, phone: true, emailAccount: true },
    orderBy: { id: 'asc' },
    take: 3,
  });
  if (!rows.length) return { status: 'not_found' as const };
  if (rows.length > 1) return {
    status: 'ambiguous' as const,
    candidates: rows.slice(0, 2).map(worker => ({ id: worker.id, name: `${worker.firstName} ${worker.lastName}`.trim() })),
    candidatesTruncated: rows.length > 2,
  };
  return { status: 'found' as const, worker: rows[0] };
}

/** Legacy callers retain their worker|null contract, but never guess a person. */
export async function findWorkerByName(companyId: string, workerName: string) {
  const result = await resolveWorkerByName(companyId, workerName);
  return result.status === 'found' ? result.worker : null;
}

export function workerLookupMessage(result: Awaited<ReturnType<typeof resolveWorkerByName>>, lang?: string) {
  const selected = lang === 'SQ' || lang === 'EN' || lang === 'IT' || lang === 'RO' || lang === 'PL' ? lang : 'DE';
  if (result.status !== 'ambiguous') return assistantToolText(selected).workerNotFound;
  const ask = {
    SQ: 'Ka disa punëtorë me këtë emër. Jep emrin dhe mbiemrin e plotë:',
    EN: 'Several workers match this name. Specify the full name:',
    IT: 'Più lavoratori hanno questo nome. Specifica nome e cognome:',
    RO: 'Mai mulți lucrători au acest nume. Precizează numele complet:',
    PL: 'Kilku pracowników ma to imię. Podaj pełne imię i nazwisko:',
    DE: 'Mehrere Mitarbeiter passen zu diesem Namen. Bitte vollständigen Namen angeben:',
  };
  return `${ask[selected]} ${result.candidates.map(candidate => candidate.name).join(' / ')}${result.candidatesTruncated ? ' …' : ''}`;
}

export function incompleteAssistantResult(lang?: string) {
  const text = {
    SQ: 'Rezultati është i kufizuar; totali i plotë nuk është verifikuar. Ngushto periudhën ose kërkimin.',
    EN: 'The result is limited; the complete total is not verified. Narrow the period or search.',
    IT: 'Il risultato è limitato; il totale completo non è verificato. Restringi il periodo o la ricerca.',
    RO: 'Rezultatul este limitat; totalul complet nu este verificat. Restrânge perioada sau căutarea.',
    PL: 'Wynik jest ograniczony; pełna suma nie jest zweryfikowana. Zawęź okres lub wyszukiwanie.',
    DE: 'Das Ergebnis ist begrenzt; die vollständige Summe ist nicht bestätigt. Zeitraum oder Suche eingrenzen.',
  };
  return text[lang === 'SQ' || lang === 'EN' || lang === 'IT' || lang === 'RO' || lang === 'PL' ? lang : 'DE'];
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
