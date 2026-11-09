import { withTenantContext } from '@/lib/db/tenant-context';
import { projectSteelTasks, steelTaskTotals } from './progress';

/** One tenant-scoped projection reused by cards/admin/export progress. */
export async function loadSteelTaskProgress(companyId: string, siteIds: string[]) {
  if (!siteIds.length) return new Map<string, ReturnType<typeof steelTaskTotals>>();
  const sites = await withTenantContext(companyId, tx => tx.baustelle.findMany({
    where: { id: { in: siteIds }, companyProfileId: companyId, type: { in: ['STEEL_WORKSHOP', 'STEEL_ASSEMBLY'] } },
    select: {
      id: true,
      treeItems: { select: { id: true, treeId: true, status: true, notes: true, steelTask: { select: { enabled: true, definition: { select: { id: true, archivedAt: true, linkedProcessKey: true, linkedList: true, linkedKind: true } } } } } },
      siteElements: { where: { companyProfileId: companyId }, select: { list: true, kind: true, quantity: true, factoryDoneAt: true, fieldDoneAt: true, processRoutes: true, work: { where: { companyProfileId: companyId }, select: { stage: true, pieces: true } } } },
    },
  }));
  return new Map(sites.map(site => [site.id, steelTaskTotals(projectSteelTasks(site.treeItems, site.siteElements.map(element => ({ ...element, list: element.list === 'part' ? 'part' as const : 'assembly' as const }))))]));
}
