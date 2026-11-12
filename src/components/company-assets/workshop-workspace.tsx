"use client";
import { useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ClipboardCheck, RefreshCw, Wrench } from 'lucide-react';
import { useLanguage } from '@/components/i18n/language-provider';
import type { AssetRef, AssetRepairView, RepairPhase } from '@/lib/company-assets/types';
import { assetCopy, type AssetCopy } from './copy';
import { AssetDetailDialog } from './asset-detail-panel';
import { AssetLookup } from './asset-lookup';
import { AssetWorkspaceDialog } from './workspace-dialog';
import { WorkshopWorkPresence } from './workshop-presence';
import { AssetFeedback, AssetLoading, AssetPicture, AssetSearch, assetButton, assetIdentity, assetTime, useAssetSnapshot } from './shared';
import { AccessKeyButton } from '@/components/access/access-key-button';
const phases=['reported','received','repairing'] as const;
type Phase=Exclude<RepairPhase,'cancelled'>;
export function WorkshopWorkspace({ initialAsset, embedded = false }: { initialAsset?: AssetRef; embedded?: boolean }) {
 const { currentLang: language } = useLanguage(),c=assetCopy(language),data=useAssetSnapshot({page:1},c,30000);
 const [selected,setSelected]=useState<{asset:AssetRef;repairId?:string}|null>(initialAsset?{asset:initialAsset}:null);
 const [phase,setPhase]=useState<typeof phases[number]|null>(null),[expanded,setExpanded]=useState<Phase|null>(null),[query,setQuery]=useState('');
 const historyButton=useRef<HTMLButtonElement>(null);
 const rows=useMemo(()=>{const needle=query.trim().toLocaleLowerCase();return (data.snapshot?.repairs??[]).filter(r=>!needle||[r.name,r.code,r.plate,r.provider,r.problem].filter(Boolean).join(' ').toLocaleLowerCase().includes(needle));},[data.snapshot?.repairs,query]);
 const visiblePhase=phase??phases.find(key=>rows.some(r=>r.phase===key))??'reported',ready=rows.filter(r=>r.phase==='ready');
 const open=(repair:AssetRepairView)=>setSelected({asset:repair.asset,repairId:repair.id});
 return <div data-workshop-compact data-testid="workshop-workspace" data-workshop-state={data.snapshot?(rows.some(r=>r.phase!=='cancelled')?'populated':'empty'):'loading'} className="flex min-h-0 min-w-0 flex-1 flex-col" aria-busy={data.loading}>
  <div data-testid="workshop-scroll" className="no-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
   <header className="flex min-w-0 flex-wrap items-center gap-2 pb-3">
    <div className="mr-auto flex min-w-0 flex-wrap items-center gap-2 sm:gap-4">
     {!embedded?<h1 className="flex items-center gap-2 text-xl font-semibold"><Wrench size={20} className="text-orange-600 dark:text-orange-300"/>{c.workshop}</h1>:null}
     <WorkshopWorkPresence c={c}/>
    </div>
    <div className="ml-auto flex min-w-0 max-w-full items-center gap-2">
    <div data-testid="workshop-search" className="w-48 min-w-0 sm:w-64"><AssetSearch value={query} onChange={value=>{setQuery(value);setPhase(null);}} label={c.search}/></div>
    <button type="button" className={`${assetButton} shrink-0 px-0`} disabled={data.loading} onClick={()=>void data.reload()} aria-label={c.refresh}><RefreshCw size={16} className={data.loading?'animate-spin':''}/></button>
    <AssetLookup c={c} onSelect={asset=>setSelected({asset})} compact/>
    <AccessKeyButton place="workshop" compact/>
    </div>
   </header>
   {data.error?<div className="mb-3"><AssetFeedback message={data.error} failed/><button type="button" className={assetButton} onClick={()=>void data.reload()}>{c.retry}</button></div>:null}
   {data.loading&&!data.snapshot?<AssetLoading label={c.loading}/>:null}
   <nav aria-label={c.workshop} className="mb-3 grid grid-cols-3 gap-2 lg:hidden">{phases.map(key=><button type="button" key={key} aria-pressed={visiblePhase===key} onClick={()=>setPhase(key)} className={`${assetButton} min-w-0 justify-between gap-1 px-2 text-xs ${visiblePhase===key?'border-orange-400/70 bg-orange-500/10':''}`}><span className="truncate">{c[key]}</span><span className="tabular-nums">{data.snapshot?rows.filter(r=>r.phase===key).length:'—'}</span></button>)}</nav>
   {data.snapshot&&query.trim()&&!rows.length?<p data-workshop-search-empty role="status" className="mb-3 hidden text-xs text-muted-foreground">{c.empty}</p>:null}
   {data.snapshot?<>
    <div className="grid min-w-0 gap-3 lg:grid-cols-3" data-testid="workshop-active-bays">
     {phases.map(key=>{const repairs=rows.filter(r=>r.phase===key);return <section key={key} data-studio-workshop-phase={key} data-workshop-empty={!repairs.length} aria-label={c[key]} className={`min-w-0 overflow-hidden rounded-2xl border bg-card ${visiblePhase===key?'block':'hidden lg:block'}`}>
      <h2 className="m-3 flex min-h-11 items-center justify-between gap-2 border-b pb-2 text-sm font-semibold"><span className="flex min-w-0 items-center gap-2">{key==='repairing'?<Wrench size={16}/>:<ClipboardCheck size={16}/>}<span className="truncate">{c[key]}</span></span><span className="text-xs tabular-nums text-muted-foreground">{repairs.length}</span></h2>
      <div className="grid min-w-0 items-start gap-2 px-3 pb-3" style={{gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,8rem),1fr))"}}>{repairs.slice(0,6).map(r=><RepairCard key={r.id} repair={r} language={language} c={c} onOpen={()=>open(r)}/>)}{!repairs.length?<p className="col-span-full px-2 py-6 text-center text-xs text-muted-foreground">{query.trim()?c.empty:c.noRepair}</p>:null}</div>
      {repairs.length>6?<button type="button" onClick={()=>setExpanded(key)} className={`${assetButton} mx-3 mb-3 gap-2 text-xs`}>{c.showMore} · {repairs.length}<ArrowUpRight size={14}/></button>:null}
     </section>;})}
    </div>
    <section data-studio-workshop-phase="ready" data-testid="workshop-history-preview" data-workshop-empty={!ready.length} className="mt-3 min-w-0 rounded-2xl border bg-card p-3">
     <div data-testid="workshop-history-heading" className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold"><ClipboardCheck size={16} className="text-green-600 dark:text-green-300"/>{c.history}<span className="text-xs font-normal text-muted-foreground">{c.ready} · {ready.length}</span></h2><button ref={historyButton} type="button" className={`${assetButton} shrink-0 gap-1.5 px-3 text-xs`} onClick={()=>setExpanded('ready')} aria-label={c.openHistory}>{c.all}<ArrowUpRight size={14}/></button></div>
     <div data-testid="workshop-history-grid" className="grid grid-cols-3 gap-2">{ready.slice(0,3).map(r=><RepairCard compact key={r.id} repair={r} language={language} c={c} onOpen={()=>open(r)}/>)}{!ready.length?<p className="px-1 py-2 text-xs text-muted-foreground">{query.trim()?c.empty:c.noRepair}</p>:null}</div>
    </section>
    {data.snapshot.queueHasMore?.repairs?<p role="status" className="mt-2 text-xs text-muted-foreground">{c.queueLimit}</p>:null}
   </>:null}
  </div>
  <AssetWorkspaceDialog open={!!expanded} onOpenChange={value=>{if(!value)setExpanded(null);}} title={expanded==='ready'?c.serviceHistory:expanded?c[expanded]:c.workshop} scrollBody layer={1550} returnFocusRef={expanded==='ready'?historyButton:undefined}>
   <div className="grid gap-2 p-3" style={{gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,12rem),1fr))"}}>{rows.filter(r=>r.phase===expanded).map(r=><RepairCard key={r.id} repair={r} language={language} c={c} onOpen={()=>open(r)}/>)}</div>
   {!rows.some(r=>r.phase===expanded)?<p className="p-4 text-sm text-muted-foreground">{c.empty}</p>:null}
   {data.snapshot?.queueHasMore?.repairs?<p role="status" className="px-4 pb-4 text-xs text-muted-foreground">{c.queueLimit}</p>:null}
  </AssetWorkspaceDialog>
  <AssetDetailDialog asset={selected?.asset??null} repairId={selected?.repairId} mode="service" onClose={()=>{setSelected(null);void data.reload();}}/>
 </div>;
}

function RepairCard({ repair, c, onOpen, language, compact=false }: { compact?:boolean;repair: AssetRepairView; c: AssetCopy; language: string; onOpen: () => void }) {
  const identity = assetIdentity({ ...repair, size: null });
  return <button type="button" onClick={onOpen} data-testid="workshop-repair-card" data-repair-id={repair.id} aria-label={`${repair.name} · ${identity} · ${c[repair.phase]} · ${repair.problem}`} className={`group flex w-full min-w-0 items-center overflow-hidden rounded-xl border bg-background text-left transition hover:border-orange-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset ${compact?"flex-col sm:flex-row":""}`}>
    <span className={`m-1.5 block shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-orange-50 to-slate-100 dark:from-slate-800 dark:to-slate-950 ${compact?"h-10 w-12":"h-11 w-11"}`}><AssetPicture asset={{ name: repair.name, photoUrl: repair.photoUrl, category: repair.category }} /></span>
    <span className={`block min-w-0 flex-1 py-2 pr-2 ${compact?"w-full px-2 sm:w-auto":""}`}>
      <span className="line-clamp-2 break-words text-xs font-semibold leading-snug [overflow-wrap:anywhere]">{repair.name}</span>
      {identity && !repair.name.includes(identity) ? <span className="mt-1 block break-words font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{identity}</span> : null}
      {repair.phase === 'ready' ? <time dateTime={repair.updatedAt} className="mt-1 block text-[11px] text-muted-foreground">{assetTime(repair.updatedAt,language)}</time> : null}
      {repair.location === 'external' ? <span className="mt-1 block text-xs font-medium text-orange-800 dark:text-orange-300">{c.external}</span> : null}
    </span>
  </button>;
}
