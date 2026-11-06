import { prisma } from '@/lib/db/prisma';
import { safeCompanyLogo } from '@/lib/company-logo';

/** Public install identity only for an explicitly provisioned dedicated company.
 * Never return provisioning contacts, credentials or an arbitrary first tenant. */
export async function installationBrand() {
  try {
    const companyId = process.env.INSTALLATION_COMPANY_ID?.trim();
    let where: { id: string } | { legalName: string };
    if (companyId) {
      if (!/^[a-z0-9_-]{1,128}$/i.test(companyId)) return null;
      where = { id: companyId };
    } else {
      const value: unknown = JSON.parse(process.env.PROVISION_COMPANY_JSON ?? 'null');
      if (!value || typeof value !== 'object' || !('legalName' in value) || typeof value.legalName !== 'string' || value.legalName.length > 200 || !value.legalName.trim()) return null;
      where = { legalName: value.legalName.trim() };
    }
    const companies = await prisma.companyProfile.findMany({ where, take: 2,
      select: { displayName: true, logoDataUrl: true, country: true } });
    if (companies.length !== 1) return null;
    const company = companies[0], logo = safeCompanyLogo(company.logoDataUrl);
    if (!logo) return null;
    return { name: company.displayName, logo, lang: company.country === 'AL' ? 'sq' : 'de' };
  } catch { return null; }
}
