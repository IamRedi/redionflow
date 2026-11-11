import { cache } from 'react';
import { getCurrentAdmin } from '@/lib/auth/admin-session';
import { getCurrentWorker } from '@/lib/workzone/worker-session';
import { getCurrentCompanyId } from '@/lib/db/tenant';
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
  return seat ? { seat, kind, id: account.id, companyId } : null;
});
