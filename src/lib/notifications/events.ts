import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { withTenantContext } from '@/lib/db/tenant-context';
import { getCurrentCompanyId } from '@/lib/db/tenant';
import { logger } from '@/lib/observability/logger';
import { notificationAudience, type NotificationScope } from './audience';
import { sendNotification } from './sendNotification';
import type { NotificationPreference } from './notification-store';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { steelWorkLabel } from '@/components/steel/work-catalog-label';
import { isRuntimePilotEnabled } from '@/lib/auth/pilot-session';

export type WorkNotification = NotificationScope & { key: string; kind: 'plan' | 'process' | 'site' | 'test'; title: string; body: string; url: string; preference: NotificationPreference };
/** Provider errors never turn a committed business action into a failed save. */
export async function dispatchWorkNotification(companyId: string, event: WorkNotification) {
  // The restricted RLS pilot is a disposable local rollout of named tables,
  // not the AL Steel production connection. Push has no grants there: never
  // escape that boundary through a privileged notification query/provider.
  if (isRuntimePilotEnabled()) return { sent: 0, failed: 0, eligible: 0 };
  try {
    if (await getCurrentCompanyId() !== companyId) return { sent: 0, failed: 0, eligible: 0 };
    const claim = await withTenantContext(companyId, async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`notification:${companyId}:${event.key}`}))`;
      if (await tx.auditLog.findFirst({ where: { companyProfileId: companyId, action: 'notification.delivery', payload: { path: ['eventKey'], equals: event.key } }, select: { id: true } })) return null;
      const userIds = await notificationAudience(tx, companyId, event);
      const record = await tx.auditLog.create({ data: { companyProfileId: companyId, actorType: 'SYSTEM', action: 'notification.delivery', payload: { eventKey: event.key, kind: event.kind, scopeId: event.siteId ?? '', eligible: userIds.length, state: 'sending' } } });
      return { id: record.id, userIds };
    });
    if (!claim) return { sent: 0, failed: 0, eligible: 0 };
    const result = await sendNotification({ ...event, userIds: claim.userIds, tag: event.key });
    await withTenantContext(companyId, tx => tx.auditLog.update({ where: { id: claim.id }, data: { payload: { eventKey: event.key, kind: event.kind, scopeId: event.siteId ?? '', eligible: claim.userIds.length, sent: result.sent, failed: result.failed, state: result.failed ? 'partial' : result.sent ? 'completed' : claim.userIds.length ? 'no_devices' : 'no_audience' } } }));
    return { ...result, eligible: claim.userIds.length };
  } catch {
    logger.warn({ event: 'notification.delivery_failed', kind: event.kind }, 'Notification delivery did not complete');
    return { sent: 0, failed: 1, eligible: 0 };
  }
}
export const testNotificationKey = () => `test:${randomUUID()}`;

export type CompletionSnapshot = { siteId: string; name: string; complete: boolean; processes: Array<{ id: string; label: string; side: 'factory' | 'field'; complete: boolean }> };
export async function siteCompletionSnapshot(tx: Prisma.TransactionClient, companyId: string, siteId: string): Promise<CompletionSnapshot | null> {
  const { projectSteelTasks, steelTaskTotals } = await import('@/lib/steel-work/progress');
  const { pieces, stagePieces, stagesFor, sideOfStage } = await import('@/lib/elements/stages');
  const { readSteelPhaseMeta } = await import('@/lib/workzone/steel-phases');
  const site = await tx.baustelle.findFirst({ where: { id: siteId, companyProfileId: companyId, type: { in: ['STEEL_ASSEMBLY', 'STEEL_WORKSHOP'] } }, select: {
    name: true, type: true, treeItems: { include: { steelTask: { include: { definition: true } } } },
    siteElements: { where: { companyProfileId: companyId }, select: { list: true, kind: true, quantity: true, processRoutes: true, factoryDoneAt: true, fieldDoneAt: true, work: { where: { companyProfileId: companyId }, select: { stage: true, pieces: true } } } },
  } });
  if (!site) return null;
  const lang = await resolveRequestLanguage();
  const elements = site.siteElements.map(e => ({ ...e, list: e.list === 'part' ? 'part' as const : 'assembly' as const }));
  const tasks = projectSteelTasks(site.treeItems, elements), totals = steelTaskTotals(tasks);
  const processes: CompletionSnapshot['processes'] = tasks.map(task => ({ id: task.id, label: steelWorkLabel({ kind: 'site', key: task.treeId, label: task.steelTask?.definition.label || readSteelPhaseMeta(task.notes).label }, lang), side: sideOfStage(task.steelTask?.definition.linkedProcessKey ?? '') ?? (site.type === 'STEEL_WORKSHOP' ? 'factory' : 'field'), complete: task.status === 'done' }));
  const linked = new Set(tasks.map(task => task.steelTask?.definition.linkedProcessKey).filter(Boolean));
  for (const side of ['factory', 'field'] as const) {
    const keys = new Set(elements.flatMap(e => [...stagesFor(side, e.list, e.processRoutes)]));
    const definitions = await tx.steelWorkDefinition.findMany({ where: { companyProfileId: companyId, kind: side, key: { in: [...keys] } }, select: { key: true, label: true } });
    for (const key of keys) {
      if (linked.has(key)) continue;
      const applicable = elements.filter(e => stagesFor(side, e.list, e.processRoutes).includes(key));
      const required = applicable.reduce((sum, e) => sum + pieces(e), 0);
      const done = applicable.reduce((sum, e) => sum + stagePieces(e, key), 0);
      processes.push({ id: `stage:${key}`, label: steelWorkLabel({ kind: side, key, label: definitions.find(d => d.key === key)?.label || '' }, lang), side, complete: required > 0 && done >= required });
    }
  }
  return { siteId, name: site.name, complete: totals.total > 0 && totals.done === totals.total, processes };
}
export async function dispatchCompletions(companyId: string, before: CompletionSnapshot | null, after: CompletionSnapshot | null, transitionKey: string) {
  if (!before || !after) return;
  for (const process of after.processes) if (process.complete && before.processes.some(p => p.id === process.id && !p.complete)) {
    await dispatchWorkNotification(companyId, { key: `${transitionKey}:${process.id}`, kind: 'process', action: process.side === 'factory' ? 'factory.view' : 'field.view', siteId: after.siteId, title: after.name, body: `✓ ${process.label}`, url: `/workzone/baustellen/${after.siteId}`, preference: 'workEnd' });
  }
  if (after.complete && !before.complete) await dispatchWorkNotification(companyId, { key: `${transitionKey}:site`, kind: 'site', action: 'site.view', siteId: after.siteId, title: after.name, body: '✓ 100%', url: `/workzone/baustellen/${after.siteId}`, preference: 'workEnd' });
}
