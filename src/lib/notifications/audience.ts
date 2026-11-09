import type { Prisma } from '@/generated/prisma/client';
import { can, type AccessAction } from '@/lib/access/rules';
import { loadWorkerAccess } from '@/lib/access/load';

export type NotificationScope = { action: AccessAction; siteId?: string };
/** Resolve current Shikon/Vepron/Hiq rules; a role or plan assignment is not an access grant. */
export async function notificationAudience(tx: Prisma.TransactionClient, companyId: string, scope: NotificationScope) {
  if (scope.siteId && !await tx.baustelle.findFirst({ where: { id: scope.siteId, companyProfileId: companyId }, select: { id: true } })) return [];
  const admins = await tx.user.findMany({ where: { companyProfileId: companyId, role: 'ADMIN', isActive: true }, select: { id: true } });
  const workers = await tx.worker.findMany({ where: { companyProfileId: companyId, status: 'active' }, select: { id: true } });
  const ids = admins.map(row => row.id);
  for (const worker of workers) {
    const subject = await loadWorkerAccess(tx, companyId, worker.id);
    if (subject && can(subject, scope.action, scope.siteId) && (!scope.siteId || can(subject, 'site.view', scope.siteId))) ids.push(worker.id);
  }
  return [...new Set(ids)];
}
