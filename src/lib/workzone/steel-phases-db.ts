import { getCurrentCompanyId } from '@/lib/db/tenant';
import { withTenantContext } from '@/lib/db/tenant-context';
import { ensureSteelWorkCatalog } from '@/lib/steel-work/catalog';
import { isSteelSiteType } from './steel-phases';

/**
 * Bind existing steel phase history to the shared catalog. New unchecked
 * choices remain definitions only; viewing a site never creates task rows.
 */
export async function ensureSteelPhases(site: { id: string; type: string }) {
  if (!isSteelSiteType(site.type)) return 0;
  const companyId = await getCurrentCompanyId();
  if (!companyId) return 0;
  return withTenantContext(companyId, async tx => {
    if (!await tx.baustelle.findFirst({ where: { id: site.id, companyProfileId: companyId }, select: { id: true } })) return 0;
    return ensureSteelWorkCatalog(companyId, tx);
  });
}
