import { NoAccessHere } from '@/components/access/no-access';
import { WorkshopWorkspace } from '@/components/company-assets/workshop-workspace';
import { assetActor } from '@/lib/company-assets/access';
import { currentCompanyActor } from '@/lib/site-files/actor';
import { isMusterOperationsCompany } from '@/lib/demo/muster-operations';

export default async function WorkshopPage() {
  const asset = await assetActor();
  if (asset.workerId && !(await currentCompanyActor(asset.companyId))?.allows('workshop.view')) return <NoAccessHere backHref="/workzone" />;
  return <WorkshopWorkspace muster={isMusterOperationsCompany(asset.companyId)} />;
}
