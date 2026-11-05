import { getCurrentCompanyId } from '@/lib/db/tenant';
import { currentCompanyActor } from '@/lib/site-files/actor';

/** Never accept company or uploader identity from the browser. Mixed sessions deny. */
export async function fleetActor() {
  const companyId = await getCurrentCompanyId();
  const actor = companyId ? await currentCompanyActor(companyId) : null;
  if (!companyId || !actor) throw new Error('FLEET_UNAUTHORIZED');
  return { ...actor, companyId };
}
