import { withTenantContext } from '@/lib/db/tenant-context';
import { cache } from 'react';
import { readCompanyUiIdentity } from './ui-identity';

/** Authenticated company only; the public installation logo is resolved separately. */
export const companyUiIdentity = cache(async (companyId: string | null) => {
  if (!companyId) return null;
  return withTenantContext(companyId, async tx => {
    const company = await tx.companyProfile.findUnique({ where: { id: companyId }, select: { uiIdentity: true } });
    return readCompanyUiIdentity(company?.uiIdentity);
  });
});
