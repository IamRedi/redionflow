import { getCurrentAdmin } from '@/lib/auth/admin-session';
import { getCurrentWorker } from '@/lib/workzone/worker-session';
import { getCurrentCompanyId } from '@/lib/db/tenant';
import { withTenantContext } from '@/lib/db/tenant-context';
import { isSteelCompany } from '@/lib/dashboard/steel-access';

export type AssetActor = { companyId: string; userId: string | null; workerId: string | null; name: string; canManage: boolean; canRepair: boolean };
export class AssetOperationError extends Error { constructor(readonly code: string) { super(code); this.name = 'AssetOperationError'; } }
export const assetFail = (code: string): never => { throw new AssetOperationError(code); };
export const assetActorKey = (actor: AssetActor) => actor.userId ? `user:${actor.userId}` : `worker:${actor.workerId}`;
/** Resolve an actual fresh identity; never combine sessions or trust browser roles. */
export async function assetActor(): Promise<AssetActor> {
  const [admin, worker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  if ((!admin && !worker) || (admin && worker)) return assetFail('DENIED');
  const companyId = await getCurrentCompanyId();
  if (!companyId || !await isSteelCompany(companyId)) return assetFail('DENIED');
  return withTenantContext(companyId, async tx => {
    if (admin) {
      const user = await tx.user.findFirst({ where: { id: admin.id, companyProfileId: companyId, role: 'ADMIN', isActive: true }, select: { id: true, name: true, email: true } });
      if (!user) return assetFail('DENIED');
      return { companyId, userId: user.id, workerId: null, name: user.name || user.email, canManage: true, canRepair: true };
    }
    const fresh = await tx.worker.findFirst({ where: { id: worker!.id, companyProfileId: companyId, status: 'active' }, select: { id: true, firstName: true, lastName: true, crewRole: true } });
    if (!fresh) return assetFail('DENIED');
    return { companyId, userId: null, workerId: fresh.id, name: `${fresh.firstName} ${fresh.lastName}`.trim(), canManage: fresh.crewRole === 'OFFICE', canRepair: fresh.crewRole === 'OFFICE' || fresh.crewRole === 'MECHANIC' };
  });
}
