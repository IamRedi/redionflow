import { notFound } from 'next/navigation';
import { assetActor, assetActorKey } from '@/lib/company-assets/access';
import { withTenantContext } from '@/lib/db/tenant-context';
import { BarcodeLabel } from '@/components/inventory/barcode-label';
import { LabelPrintButton } from '@/components/inventory/label-print-button';
import { assetCopy } from '@/components/company-assets/copy';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { assetRefSchema } from '@/lib/company-assets/validation';
import { readOwnedAsset } from '@/lib/company-assets/service';
import styles from './asset-labels.module.css';
export default async function AssetLabelsPage({searchParams}:{searchParams:Promise<{items?:string}>}){
  const actor=await assetActor();if(!actor.canRegister&&!actor.canManage)notFound();
  const raw=(await searchParams).items??'';if(raw.length>14000)notFound();
  const values=[...new Set(raw.split(','))];if(!values.length||values.length>100)notFound();
  const refs=values.map(value=>{const [kind,id,...extra]=value.split(':');const result=assetRefSchema.safeParse({kind,id});if(extra.length||!result.success)notFound();return result.data;});
  const labels=await withTenantContext(actor.companyId,async tx=>{
    const rows=[];
    for(const ref of refs){
      const asset=await readOwnedAsset(tx,actor,ref);
      // Registration-only access prints the person's newly registered items,
      // without granting unrestricted access to existing equipment or vehicles.
      if(!actor.canManage && (ref.kind!=='inventory' || !asset.id || !await tx.companyAssetEvent.findFirst({where:{companyProfileId:actor.companyId,assetId:asset.id,type:'registered',actorKey:assetActorKey(actor)},select:{id:true}})))notFound();
      const generated=asset.id?await tx.companyAssetCode.findFirst({where:{companyProfileId:actor.companyId,assetId:asset.id,kind:'label',revokedAt:null},select:{value:true}}):null;
      const code=generated?.value??asset.code;
      if(!code||code.length>40||!/^[0-9A-Z .$/+%\-]+$/.test(code))notFound();
      rows.push({code,title:asset.name,shortCode:asset.plate??asset.size});
    }return rows;
  });
  const c=assetCopy(await resolveRequestLanguage());
  return <section data-testid="asset-labels" className={`${styles.sheet} min-w-0 space-y-4 p-3 print:bg-white print:p-0 print:text-black`}><h1 className="text-xl font-semibold print:hidden">{c.printLabels}</h1><LabelPrintButton label={c.printLabels}/><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 print:!grid-cols-3">{labels.map((item,index)=><div key={index} className="break-inside-avoid"><BarcodeLabel value={item.code} title={item.title} shortCode={item.shortCode} compact/></div>)}</div></section>;
}
