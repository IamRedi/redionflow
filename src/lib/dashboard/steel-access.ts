import { getCurrentAdmin } from '@/lib/auth/admin-session';
import { getCurrentDisplayUser } from '@/lib/auth/display-session';
import { getCurrentWorker } from '@/lib/workzone/worker-session';
import { withTenantContext } from '@/lib/db/tenant-context';
import { STEEL_TYPES } from './steel-metrics';
/** Never accept a tenant from a URL, combine sessions, or fall back to a first company. */
export async function productionAudience(display = false) {
    const [admin, screen, worker] = await Promise.all([getCurrentAdmin(), getCurrentDisplayUser(), getCurrentWorker()]);
    if (worker || (admin && screen))
        return null;
    const actor = display ? screen ?? admin : admin;
    if (!actor?.companyProfileId)
        return null;
    const company = await withTenantContext(actor.companyProfileId, tx => tx.companyProfile.findUnique({
        where: { id: actor.companyProfileId! }, select: { id: true, displayName: true, mode: true, country: true },
    }));
    return company ? { company, readOnly: display } : null;
}
export async function isSteelCompany(companyId: string) {
    const found = await withTenantContext(companyId, tx => tx.baustelle.findFirst({ where: { companyProfileId: companyId, type: { in: [...STEEL_TYPES] } }, select: { id: true } }));
    return Boolean(found);
}
