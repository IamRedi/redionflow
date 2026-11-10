import { prisma } from '@/lib/db/prisma';
import { QUICK_UNDO_MS } from './session-rules';

export class SessionStartError extends Error {}
/** Both profile and site starts take the same worker lock. A second click
 * reuses a live session and a backdated restart cannot count closed time twice. */
export async function beginWorkerSession(input: { companyId: string; workerId: string; start: Date; siteId: string | null; moveExisting?: boolean; now?: Date }) {
  const now = input.now ?? new Date();
  if (!Number.isFinite(input.start.getTime()) || input.start.getTime() > now.getTime() + 60_000) throw new SessionStartError('CLOCK');
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Worker" WHERE id=${input.workerId} AND "companyProfileId"=${input.companyId} FOR UPDATE`;
    const worker = await tx.worker.findFirst({ where: { id: input.workerId, companyProfileId: input.companyId, status: 'active' }, select: { id: true } });
    if (!worker) throw new SessionStartError('WORKER');
    if (input.siteId && !await tx.baustelle.findFirst({ where: { id: input.siteId, companyProfileId: input.companyId }, select: { id: true } })) throw new SessionStartError('SITE');
    const existing = await tx.workSession.findFirst({ where: { workerId: worker.id, isLive: true, endTime: null }, orderBy: { startTime: 'desc' } });
    if (existing) {
      if (input.moveExisting && existing.baustelleId !== input.siteId) {
        await tx.workSession.update({ where: { id: existing.id }, data: { baustelleId: input.siteId, closedBySystem: false, systemNote: null } });
        return { kind: 'moved' as const, id: existing.id };
      }
      return { kind: 'existing' as const, id: existing.id };
    }
    // A stop reversed within 30 seconds reopens the same session, as if it never stopped.
    // The end time comes from a minute-precision field, so it may sit up to a minute before the click.
    const justStopped = await tx.workSession.findFirst({ where: { workerId: worker.id, isLive: false, closedBySystem: false, endTime: { gte: new Date(now.getTime() - QUICK_UNDO_MS - 60_000) }, updatedAt: { gte: new Date(now.getTime() - QUICK_UNDO_MS) } }, orderBy: { updatedAt: 'desc' } });
    if (justStopped?.endTime) {
      await tx.workSessionPauseInterval.updateMany({ where: { workSessionId: justStopped.id, endedAt: justStopped.endTime }, data: { endedAt: null } });
      await tx.workSession.update({ where: { id: justStopped.id }, data: { endTime: null, totalHours: 0, isLive: true, ...(input.moveExisting ? { baustelleId: input.siteId } : {}) } });
      return { kind: 'resumed' as const, id: justStopped.id };
    }
    const overlap = await tx.workSession.findFirst({ where: { workerId: worker.id, endTime: { gt: input.start }, startTime: { lt: now } }, select: { id: true } });
    if (overlap) throw new SessionStartError('OVERLAP');
    const row = await tx.workSession.create({ data: { workerId: worker.id, baustelleId: input.siteId, startTime: input.start, breakMinutes: 30, isLive: true } });
    return { kind: 'created' as const, id: row.id };
  });
}
