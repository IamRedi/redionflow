import { AssetWarehouse } from '@/components/company-assets/asset-warehouse';
import { assetActor } from '@/lib/company-assets/access';

export default async function WarehousePage() {
  await assetActor();
  return <AssetWarehouse />;
}
