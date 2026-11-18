import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import type { CompanyActor } from '@/lib/site-files/actor';
import { fuelTimeZone } from '@/lib/fleet/fuel/time';
import { dayKey, midnight, nextDay } from '@/lib/dashboard/steel-metrics';
import { readSteelPhaseMeta } from '@/lib/workzone/steel-phases';

export type PhaseNoteView = { id: string; text: string; authorKey: string; authorName: string; writtenAt: string | null; legacy: boolean };
export type PhaseNotesPage = { entries: PhaseNoteView[]; authors: Array<{ key: string; name: string }>; hasMore: boolean; nextCursor: string | null; zone: string };
type Tx = Prisma.TransactionClient;
type Task = { id: string; companyProfileId: string; treeItem: { notes: string | null } };
export function legacyPhaseNote(raw: string | null): PhaseNoteView | null {
  const meta = readSteelPhaseMeta(raw);
  let text = meta.note;
  if (!text && raw?.trim()) { try { JSON.parse(raw); } catch { text = raw; } }
  if (!text.trim()) return null;
  const date = meta.noteAt && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(meta.noteAt) ? new Date(meta.noteAt) : null;
  return { id: 'legacy', text, authorKey: `legacy:${meta.noteBy}`, authorName: meta.noteBy, writtenAt: date && Number.isFinite(date.getTime()) ? date.toISOString() : null, legacy: true };
}
/** Called only under the existing catalog transaction lock. No edit/delete of diary rows. */
export async function appendPhaseNote(tx: Tx, task: Task, actor: CompanyActor, text: string, now: Date, requestId?: string) {
  const authorKey = `${actor.workerId ? 'worker' : 'user'}:${actor.workerId ?? actor.userId}`;
  const entryKey = requestId ?? randomUUID();
  const existing = await tx.steelPhaseNote.findUnique({ where: { taskId_entryKey: { taskId: task.id, entryKey } } });
  if (existing) return existing.authorKey === authorKey && existing.text === text ? 'duplicate' : 'conflict';
  if (!await tx.steelPhaseNote.findFirst({ where: { companyProfileId: task.companyProfileId, taskId: task.id }, select: { id: true } })) {
    const old = legacyPhaseNote(task.treeItem.notes);
    if (old) await tx.steelPhaseNote.create({ data: { companyProfileId: task.companyProfileId, taskId: task.id, entryKey: 'legacy', text: old.text, authorKey: old.authorKey, authorName: old.authorName, writtenAt: old.writtenAt ? new Date(old.writtenAt) : null, legacy: true, createdAt: new Date(now.getTime() - 1) } });
  }
  await tx.steelPhaseNote.create({ data: { companyProfileId: task.companyProfileId, taskId: task.id, entryKey, text, authorKey, authorName: actor.name, writtenAt: now, createdAt: now } });
  return 'created';
}
export function phaseNoteDayRange(day: string, zone: string) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(day) || new Date(`${day}T12:00Z`).toISOString().slice(0, 10) !== day) throw new Error('Invalid note date');
  return { gte: midnight(day, zone), lt: midnight(nextDay(day), zone) };
}
export async function phaseNotesPage(tx: Tx, task: Task, filter: { day?: string; author?: string; cursor?: string }): Promise<PhaseNotesPage> {
  const company = await tx.companyProfile.findUniqueOrThrow({ where: { id: task.companyProfileId }, select: { country: true } });
  const zone = fuelTimeZone(company.country), scope = { companyProfileId: task.companyProfileId, taskId: task.id };
  const dateRange = filter.day ? phaseNoteDayRange(filter.day, zone) : undefined;
  const allCount = await tx.steelPhaseNote.count({ where: scope });
  const authors = await tx.steelPhaseNote.findMany({ where: scope, distinct: ['authorKey'], orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 200, select: { authorKey: true, authorName: true } });
  if (!allCount) {
    if (filter.cursor) throw new Error('Invalid note cursor');
    const old = legacyPhaseNote(task.treeItem.notes);
    const matches = old && (!filter.author || old.authorKey === filter.author) && (!filter.day || (old.writtenAt && dayKey(new Date(old.writtenAt), zone) === filter.day));
    return { entries: matches ? [old] : [], authors: old ? [{ key: old.authorKey, name: old.authorName }] : [], hasMore: false, nextCursor: null, zone };
  }
  const cursor = filter.cursor ? await tx.steelPhaseNote.findFirst({ where: { ...scope, id: filter.cursor }, select: { id: true, createdAt: true } }) : null;
  // A foreign/unknown cursor never leaks another task or silently starts over.
  if (filter.cursor && !cursor) throw new Error('Invalid note cursor');
  const rows = await tx.steelPhaseNote.findMany({ where: { ...scope, ...(filter.author ? { authorKey: filter.author } : {}), ...(dateRange ? { writtenAt: dateRange } : {}), ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21 });
  const entries = rows.slice(0, 20).map(row => ({ id: row.id, text: row.text, authorKey: row.authorKey, authorName: row.authorName, writtenAt: row.writtenAt?.toISOString() ?? null, legacy: row.legacy }));
  return { entries, authors: authors.map(a => ({ key: a.authorKey, name: a.authorName })), hasMore: rows.length > 20, nextCursor: rows.length > 20 ? entries.at(-1)!.id : null, zone };
}
