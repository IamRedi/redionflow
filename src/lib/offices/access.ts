import { cache } from 'react';
import { getCurrentAdmin } from '@/lib/auth/admin-session';
import { getCurrentWorker } from '@/lib/workzone/worker-session';
import { getCurrentCompanyId } from '@/lib/db/tenant';
import { withTenantContext } from '@/lib/db/tenant-context';
import { officeSeat } from './policy';

/** Request-local only: fresh session epoch, active account and tenant on every request. */
export const currentOfficeAccess = cache(async () => {
  const raw = process.env.VIRTUAL_OFFICE_ACCESS_JSON;
  if (!raw) return null;
  const [admin, worker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  if ((!admin && !worker) || (admin && worker)) return null;
  const companyId = await getCurrentCompanyId();
  const account = admin ?? worker;
  if (!companyId || !account || account.companyProfileId !== companyId) return null;
  const kind = admin ? 'admin' as const : 'worker' as const;
  const seat = officeSeat(raw, { kind, id: account.id, companyId });
  if(seat)return { seat, kind, id: account.id, companyId };
  if(process.env.VIRTUAL_OFFICE_TEAM_ENABLED!=='true')return null;
  const member=await withTenantContext(companyId,tx=>tx.officeMember.findFirst({where:{companyProfileId:companyId,enabled:true,...(kind==='admin'?{userId:account.id}:{workerId:account.id})}}));
  return member?{seat:'staff' as const,kind,id:account.id,companyId}:null;
});
