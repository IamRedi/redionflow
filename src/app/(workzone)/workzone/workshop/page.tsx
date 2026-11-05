import { WorkshopWorkspace } from '@/components/company-assets/workshop-workspace';
import { assetActor } from '@/lib/company-assets/access';

export default async function WorkshopPage() {
  await assetActor();
  return <WorkshopWorkspace />;
}
