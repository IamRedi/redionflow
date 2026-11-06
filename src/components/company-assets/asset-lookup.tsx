"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { ScanGatewayDialog } from '@/components/inventory/scan-gateway-dialog';
import { getAssetSnapshotAction } from '@/app/(workzone)/workzone/asset-operations-actions';
import { normalizeScanCode } from '@/lib/inventory/scan-code';
import type { AssetRef, AssetSummary } from '@/lib/company-assets/types';
import type { AssetCopy } from './copy';
import { AssetFeedback, AssetLoading, AssetPicture, AssetStatus, assetButton, assetIdentity } from './shared';

export function AssetLookup({c,onSelect,onRegister,compact=false}:{c:AssetCopy;onSelect:(asset:AssetRef)=>void;onRegister?:(code:string)=>void;compact?:boolean}){
  const [open,setOpen]=useState(false),[value,setValue]=useState(''),[rows,setRows]=useState<AssetSummary[]|null>(null),[page,setPage]=useState(1),[more,setMore]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null),[canRegister,setCanRegister]=useState(false);
  const epoch=useRef(0);
  const invalidate=useCallback(()=>{epoch.current++;},[]);
  useEffect(()=>()=>invalidate(),[invalidate]);
  function select(asset:AssetRef){invalidate();setOpen(false);onSelect({kind:asset.kind,id:asset.id});}
  async function find(nextPage=1){
    const own=++epoch.current;if(!value.trim())return;
    setLoading(true);setError(null);
    try{
      const result=await getAssetSnapshotAction({scan:normalizeScanCode(value),includeInactive:true,page:nextPage});
      if(own!==epoch.current)return;
      if(!result.ok){setError(result.message||c.loadError);setRows(null);return;}
      const data=result.data;
      if(nextPage===1&&data.total===1&&data.assets.length===1){select(data.assets[0]);return;}
      setRows(data.assets);setPage(data.page);setMore(data.hasMore);setCanRegister(data.permissions.canManage);
    }catch{if(own===epoch.current){setError(c.loadError);setRows(null);}}
    finally{if(own===epoch.current)setLoading(false);}
  }
  return <>
    <button type="button" className={assetButton+(compact?' shrink-0 px-0':'')} title={compact?c.scan:undefined} onClick={()=>{setValue('');setRows(null);setError(null);setLoading(false);setCanRegister(false);setOpen(true);}}><ScanLine size={18} aria-hidden="true"/><span className={compact?'sr-only':undefined}>{c.scan}</span></button>
    <ScanGatewayDialog open={open} title={c.scan} description={c.scanHint} value={value} onDetected={input=>{invalidate();setValue(input);setRows(null);setError(null);setLoading(false);setCanRegister(false);}} onCancel={()=>{invalidate();setOpen(false);}} onConfirm={()=>void find()} confirmLabel={c.find} confirmDisabled={loading||!value.trim()} normalizeValue={normalizeScanCode}>
      {loading?<AssetLoading label={c.loading}/>:null}<AssetFeedback message={error} failed/>
      {rows?<div className="space-y-2">
        <p className="text-sm text-muted-foreground">{rows.length?c.scanMultiple:c.scanUnknown}</p>
        {!rows.length&&canRegister?(onRegister?<button type="button" className={assetButton} onClick={()=>{invalidate();setOpen(false);onRegister(value);}}>{c.addAsset}</button>:<a className={assetButton} href={'/workzone/inventory?scan='+encodeURIComponent(value)}>{c.addAsset}</a>):null}
        <div className="grid min-w-0 gap-2">{rows.map(asset=><button type="button" key={asset.key} onClick={()=>select(asset)} className="flex min-h-16 min-w-0 items-center gap-3 rounded-xl border bg-card p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><span className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-muted"><AssetPicture asset={asset}/></span><span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{asset.name}</span><span className="block break-words font-mono text-xs text-muted-foreground">{assetIdentity(asset)}</span>{asset.holder?<span className="block break-words text-xs text-muted-foreground">{asset.holder.name}</span>:null}<AssetStatus value={asset.availability} c={c}/></span></button>)}</div>
        <div className="flex gap-2">{page>1?<button type="button" disabled={loading} className={assetButton} onClick={()=>void find(page-1)}>{c.previous}</button>:null}{more?<button type="button" disabled={loading} className={assetButton} onClick={()=>void find(page+1)}>{c.next}</button>:null}</div>
      </div>:null}
    </ScanGatewayDialog>
  </>;
}
