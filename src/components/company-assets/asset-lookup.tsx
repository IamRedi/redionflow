"use client";

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ScanLine } from 'lucide-react';
import { ScanGatewayDialog } from '@/components/inventory/scan-gateway-dialog';
import { getAssetSnapshotAction } from '@/app/(workzone)/workzone/asset-operations-actions';
import type { AssetRef, AssetSummary } from '@/lib/company-assets/types';
import type { AssetCopy } from './copy';
import { AssetFeedback, AssetLoading, AssetPicture, assetButton, assetIdentity } from './shared';

/** Lookup never reports or changes an asset. Nonunique scans always require an explicit choice. */
export function AssetLookup({ c, onSelect }: { c: AssetCopy; onSelect: (asset: AssetRef) => void }) {
  const [open,setOpen]=useState(false);
  const [value,setValue]=useState('');
  const [rows,setRows]=useState<AssetSummary[]|null>(null);
  const [page,setPage]=useState(1);
  const [more,setMore]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const epoch=useRef(0);
  const opener=useRef<HTMLElement|null>(null);
  useEffect(()=>()=>{epoch.current++;},[]);
  function select(asset:AssetRef) { epoch.current++;setOpen(false);onSelect(asset); }
  async function find(nextPage=1) {
    const own=++epoch.current;
    if(!value.trim())return;
    setLoading(true);setError(null);
    try {
      const result=await getAssetSnapshotAction({query:value.trim(),page:nextPage});
      if(own!==epoch.current)return;
      if(!result.ok){setError(result.message||c.loadError);setRows(null);return;}
      const data=result.data;
      const normal=(s:string|null)=>s?.toLocaleLowerCase().replace(/\s+/g,'')||'';
      const exact=data.assets.filter(asset=>[normal(asset.code),normal(asset.plate)].includes(normal(value)));
      if(nextPage===1&&data.total===1&&exact.length===1){select(exact[0]);return;}
      setRows(data.assets);setPage(data.page);setMore(data.hasMore);
    }catch{if(own===epoch.current){setError(c.loadError);setRows(null);}}
    finally{if(own===epoch.current)setLoading(false);}
  }
  return <>
    <button type="button" className={assetButton} onClick={()=>{setValue('');setRows(null);setError(null);setLoading(false);setOpen(true);}}><ScanLine size={18}/>{c.scan}</button>
    <Dialog.Root open={open} onOpenChange={next=>{if(!next)epoch.current++;setOpen(next);}}><Dialog.Portal><Dialog.Content asChild aria-describedby={undefined} onOpenAutoFocus={()=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;}} onCloseAutoFocus={event=>{event.preventDefault();if(opener.current?.isConnected)opener.current.focus({preventScroll:true});}}><div className="fixed inset-0 z-[1700]"><Dialog.Title className="sr-only">{c.scan}</Dialog.Title><ScanGatewayDialog open={open} title={c.scan} description={c.scanHint} value={value} onDetected={input=>{epoch.current++;setValue(input);setRows(null);setError(null);setLoading(false);}} onCancel={()=>{epoch.current++;setOpen(false);}} onConfirm={()=>void find()} confirmLabel={c.find} confirmDisabled={loading||!value.trim()} normalizeValue={input=>input.trim()}>
      {loading?<AssetLoading label={c.loading}/>:null}<AssetFeedback message={error} failed/>
      {rows?<div className="space-y-2"><p className="text-sm text-muted-foreground">{rows.length?c.matchHint:c.empty}</p><div className="no-scrollbar grid max-h-[35dvh] gap-2 overflow-y-auto">{rows.map(asset=><button type="button" key={asset.key} onClick={()=>select(asset)} className="flex min-h-16 min-w-0 items-center gap-3 rounded-xl border bg-card p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><span className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-muted"><AssetPicture asset={asset}/></span><span className="min-w-0"><span className="block break-words text-sm font-semibold">{asset.name}</span><span className="block break-words font-mono text-xs text-muted-foreground">{assetIdentity(asset)}</span></span></button>)}</div><div className="flex gap-2">{page>1?<button type="button" disabled={loading} className={assetButton} onClick={()=>void find(page-1)}>{c.previous}</button>:null}{more?<button type="button" disabled={loading} className={assetButton} onClick={()=>void find(page+1)}>{c.next}</button>:null}</div></div>:null}
    </ScanGatewayDialog></div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </>;
}
