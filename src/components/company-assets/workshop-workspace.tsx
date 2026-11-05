"use client";

import { useMemo, useState } from 'react';
import { ArrowRight, Wrench } from 'lucide-react';
import { useLanguage } from '@/components/i18n/language-provider';
import type { AssetRef, AssetRepairView, RepairPhase } from '@/lib/company-assets/types';
import { assetCopy } from './copy';
import { AssetDetailDialog } from './asset-detail-panel';
import { AssetLookup } from './asset-lookup';
import { AssetFeedback, AssetLoading, AssetPicture, AssetSearch, assetButton, assetIdentity, assetTime, useAssetSnapshot } from './shared';

const phases: Exclude<RepairPhase,'cancelled'>[]=['reported','received','repairing','ready'];
export function WorkshopWorkspace({initialAsset}: {initialAsset?:AssetRef}) {
  const {currentLang:language}=useLanguage();
  const c=assetCopy(language);
  const data=useAssetSnapshot({page:1},c);
  const [selected,setSelected]=useState<AssetRef|null>(initialAsset??null);
  const [phase,setPhase]=useState<Exclude<RepairPhase,'cancelled'>>('reported');
  const [query,setQuery]=useState('');
  const rows=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase();
    return (data.snapshot?.repairs??[]).filter(repair=>!needle||[repair.name,repair.code,repair.plate,repair.provider].filter(Boolean).join(' ').toLocaleLowerCase().includes(needle));
  },[data.snapshot?.repairs,query]);
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="workshop-workspace">
    <div className="flex shrink-0 flex-wrap items-center gap-3 px-3 pb-3 sm:px-5"><h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold"><Wrench size={21} className="text-orange-600 dark:text-orange-400"/>{c.workshop}</h1><div className="min-w-[min(100%,14rem)] flex-1"><AssetSearch value={query} onChange={setQuery} label={c.search}/></div><AssetLookup c={c} onSelect={setSelected}/></div>
    <div role="tablist" aria-label={c.workshop} className="flex shrink-0 flex-wrap gap-2 px-3 pb-3 md:hidden">{phases.map(key=><button type="button" key={key} role="tab" aria-selected={phase===key} aria-controls={`workshop-phase-${key}`} onClick={()=>setPhase(key)} className={`${assetButton} flex-1 ${phase===key?'border-orange-500 bg-orange-500/10 text-orange-800 dark:text-orange-300':''}`}>{c[key]}</button>)}</div>
    <div className="no-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5">
      {data.error?<div className="space-y-3"><AssetFeedback message={data.error} failed/><button type="button" className={assetButton} onClick={()=>void data.reload()}>{c.retry}</button></div>:null}
      {data.snapshot?.queueHasMore?.repairs?<p role="status" className="mb-3 text-sm text-muted-foreground">{c.queueLimit}</p>:null}
      {data.loading?<AssetLoading label={c.loading}/>:null}
      {!data.loading&&data.snapshot?<div className="grid min-w-0 gap-3 md:grid-cols-4">{phases.map(key=><section key={key} id={`workshop-phase-${key}`} aria-label={c[key]} className={`min-w-0 rounded-2xl border bg-card/40 p-3 ${phase===key?'block':'hidden md:block'}`}><h2 className="mb-3 hidden min-h-11 items-center border-b pb-3 text-sm font-semibold md:flex">{c[key]}</h2><div className="space-y-3">{rows.filter(repair=>repair.phase===key).map(repair=><RepairCard key={repair.id} repair={repair} language={language} onOpen={()=>setSelected(repair.asset)} detailLabel={c.details} externalLabel={c.external}/>)}{!rows.some(repair=>repair.phase===key)?<p className="py-6 text-sm text-muted-foreground">{c.noRepair}</p>:null}</div></section>)}</div>:null}
    </div>
    <AssetDetailDialog asset={selected} onClose={()=>{setSelected(null);void data.reload();}}/>
  </div>;
}
function RepairCard({repair,language,onOpen,detailLabel,externalLabel}: {repair:AssetRepairView;language:string;onOpen:()=>void;detailLabel:string;externalLabel:string}) {
  return <button type="button" onClick={onOpen} className="flex w-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-left transition hover:border-orange-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><span className="block aspect-[16/8] w-full overflow-hidden bg-gradient-to-br from-orange-50 to-slate-100 dark:from-slate-800 dark:to-slate-950"><AssetPicture asset={{name:repair.name,photoUrl:repair.photoUrl,category:repair.asset.kind==='machine'?'vehicle':'tool'}}/></span><span className="flex min-w-0 flex-col gap-2 p-3"><span className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{repair.name}</span><span className="break-words font-mono text-xs text-muted-foreground">{assetIdentity({...repair,size:null})||'—'}</span><span className="line-clamp-3 break-words text-sm text-muted-foreground">{repair.problem}</span>{repair.location==='external'?<span className="break-words text-xs text-orange-800 dark:text-orange-300">{externalLabel}{repair.provider?` · ${repair.provider}`:''}</span>:null}<span className="text-xs text-muted-foreground">{assetTime(repair.updatedAt,language)}</span><span className="flex min-h-11 items-center justify-between gap-2 text-sm font-semibold text-orange-800 dark:text-orange-300">{detailLabel}<ArrowRight size={17}/></span></span></button>;
}
