import { NoAccessHere } from '@/components/access/no-access';
import { AssetWarehouse } from '@/components/company-assets/asset-warehouse';
import { currentCompanyActor } from '@/lib/site-files/actor';
import { assetActor } from '@/lib/company-assets/access';
import { normalizeScanCode, validScanCode } from '@/lib/inventory/scan-code';

export default async function WarehousePage({searchParams}:{searchParams:Promise<{scan?:string}>}) {
  const actor=await assetActor(),params=await searchParams;
  if(actor.workerId&&!(await currentCompanyActor(actor.companyId))?.allows('warehouse.view'))return <NoAccessHere backHref="/workzone"/>;
  const scan=typeof params.scan==='string'?normalizeScanCode(params.scan):'';
  return <AssetWarehouse initialFactoryCode={actor.canManage&&validScanCode(scan)?scan:undefined}/>;
}
