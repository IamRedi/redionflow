import { cache } from 'react';
import { getCurrentAdmin } from '@/lib/auth/admin-session';
import { getCurrentWorker } from '@/lib/workzone/worker-session';
import { getCurrentCompanyId } from '@/lib/db/tenant';
import { isMusterOperationsCompany } from '@/lib/demo/muster-operations';
import type { ChatIdentity } from './contract';

/** Installation adapter. Never infer the author/company from request data. */
export const companyChatIdentity = cache(async (demo = false, office = false): Promise<ChatIdentity | null> => {
  if (demo || office) return null;
  const companyId = await getCurrentCompanyId();
  if (!companyId || !isMusterOperationsCompany(companyId)) return null;
  const [admin, worker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  if ((!admin && !worker) || (admin && worker)) return null;
  if (admin?.companyProfileId === companyId) return { companyId, key: `admin:${admin.id}`, name: (admin.name?.trim() || 'Admin').slice(0,160), notificationUserId: admin.id, demo: false };
  if (worker?.companyProfileId === companyId) return { companyId, key: `worker:${worker.id}`, name: `${worker.firstName} ${worker.lastName}`.trim().slice(0,160), notificationUserId: worker.id, demo: false };
  return null;
});
