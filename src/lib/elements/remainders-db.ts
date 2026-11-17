import type { Prisma } from '@/generated/prisma/client';
import { planRemainders } from './remainders';

export class RemainderConflict extends Error {}

/** Caller holds the company catalog lock; import and work confirmation use it too. */
export async function reconcileRemainders(tx: Prisma.TransactionClient, companyId: string, siteId: string) {
  const site = await tx.baustelle.findFirst({ where: { id: siteId, companyProfileId: companyId, type: 'STEEL_ASSEMBLY' }, select: { id: true } });
  if (!site) return { status: 'missingLists' as const, marks: [], rows: [] };
  const items = await tx.siteElement.findMany({ where: { companyProfileId: companyId, baustelleId: siteId },
    include: { work: { select: { pieces: true, stage: true } } }, orderBy: { id: 'asc' } });
  const plan = planRemainders(items);
  // Incomplete partial uploads must never fabricate free stock or erase prior elements.
  if (plan.status !== 'ready') {
    if (items.some(e => e.remainderOfId)) throw new RemainderConflict(plan.marks[0] ?? '');
    return plan;
  }
  const linked = new Map(items.filter(e => e.remainderOfId).map(e => [e.remainderOfId!, e]));
  const byId = new Map(items.map(e => [e.id, e]));
  const actions: Array<() => Promise<unknown>> = [];
  for (const row of plan.rows) {
    const source = byId.get(row.sourceId)!, previous = linked.get(row.sourceId);
    const stageTotals = new Map<string, number>();
    for (const work of previous?.work ?? []) stageTotals.set(work.stage,
      (stageTotals.get(work.stage) ?? 0) + (work.pieces > 0 ? work.pieces : previous!.quantity));
    if (row.remaining < Math.max(0, ...stageTotals.values())) throw new RemainderConflict(row.mark);
    if (!row.remaining) {
      // Never silently discard a configured route, finish or historical attribution.
      if (previous && (previous.work.length || previous.processRevision > 1 || previous.factoryDoneAt || previous.fieldDoneAt)) throw new RemainderConflict(row.mark);
      if (previous) actions.push(() => tx.siteElement.delete({ where: { id: previous.id } }));
      continue;
    }
    if (!previous && items.some(e => e.list === 'assembly' && e.mark === row.mark)) throw new RemainderConflict(row.mark);
    const data = { quantity: row.remaining, kind: source.kind, profile: source.profile, material: source.material,
      lengthMm: source.lengthMm, weightKg: source.weightKg, areaM2: source.areaM2 };
    if (previous) {
      if (Object.entries(data).some(([key, value]) => previous[key as keyof typeof data] !== value))
        actions.push(() => tx.siteElement.update({ where: { id: previous.id }, data }));
    } else actions.push(() => tx.siteElement.create({ data: { ...data, companyProfileId: companyId, baustelleId: siteId,
      list: 'assembly', isManual: true, mark: row.mark, remainderOfId: source.id,
      processRoutes: { v: 1, factory: [], field: [] }, processRevision: 1 } }));
  }
  for (const action of actions) await action();
  return plan;
}
