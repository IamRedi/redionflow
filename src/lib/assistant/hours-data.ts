import { prisma } from '@/lib/db/prisma';
import { effectiveSessionHours } from '@/lib/workzone/session-rules';
import type { RequesterContext } from './requester';
import type { Prisma } from '@/generated/prisma/client';

/** Aggregate all closed rows in PostgreSQL; only open sessions need JS time math. */
export async function assistantHoursData(requester: RequesterContext, input: { from: Date; to: Date; now?: Date }) {
  if (requester.kind !== 'admin' || !requester.companyId) return null;
  if (!Number.isFinite(input.from.getTime()) || !Number.isFinite(input.to.getTime()) || input.from >= input.to) return null;
  const now = input.now ?? new Date();
  return prisma.$transaction(async tx => {
  await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${requester.companyId}, true)`;
  return assistantHoursSnapshot(tx, requester, { ...input, now });
  }, { isolationLevel: 'RepeatableRead' });
}

/** Reuse the same hours projection inside an authorized report snapshot. */
export async function assistantHoursSnapshot(tx: Prisma.TransactionClient, requester: RequesterContext, input: { from: Date; to: Date; now: Date }) {
  if (requester.kind !== 'admin' || !requester.companyId || input.from >= input.to) return null;
  const now = input.now;
  const actor = await tx.user.findFirst({ where: { id: requester.adminId, companyProfileId: requester.companyId, role: 'ADMIN', isActive: true }, select: { id: true } });
  if (!actor) return null;
  const where = { worker: { companyProfileId: requester.companyId }, startTime: { gte: input.from, lt: input.to } };
  const [closed, open] = await Promise.all([
    tx.workSession.groupBy({ by: ['workerId'], where: { ...where, endTime: { not: null } }, _sum: { totalHours: true }, _count: { _all: true } }),
    tx.workSession.findMany({ where: { ...where, endTime: null }, select: { workerId: true, startTime: true, endTime: true, totalHours: true, breakMinutes: true } }),
  ]);
  const totals = new Map<string, { hours: number; sessionRows: number }>();
  for (const row of closed) {
    const hours = row._sum.totalHours ?? 0;
    if (!Number.isFinite(hours)) throw new Error('Invalid recorded hours');
    totals.set(row.workerId, { hours, sessionRows: row._count._all });
  }
  for (const row of open) {
    const current = totals.get(row.workerId) ?? { hours: 0, sessionRows: 0 };
    current.hours += effectiveSessionHours(row, now);
    current.sessionRows++;
    totals.set(row.workerId, current);
  }
  const profiles = totals.size ? await tx.worker.findMany({ where: { companyProfileId: requester.companyId, id: { in: [...totals.keys()] } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const names = new Map(profiles.map(worker => [worker.id, `${worker.firstName} ${worker.lastName}`.trim()]));
  const workers = [...totals].map(([workerId, total]) => ({ workerId, worker: names.get(workerId) ?? '', hours: Math.round(total.hours * 100) / 100, sessionRows: total.sessionRows })).sort((a,b) => b.hours-a.hours || a.workerId.localeCompare(b.workerId));
  return { complete: true as const, asOf: now.toISOString(), timeZone: requester.timeZone ?? 'Europe/Berlin', sessionRows: workers.reduce((sum,w) => sum+w.sessionRows,0), totalHours: Math.round([...totals.values()].reduce((sum,w) => sum+w.hours,0)*100)/100, workers };
}
