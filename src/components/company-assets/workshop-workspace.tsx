"use client";

import { useMemo, useState } from 'react';
import { RefreshCw, Wrench } from 'lucide-react';
import { useLanguage } from '@/components/i18n/language-provider';
import type { AssetRef, AssetRepairView, RepairPhase } from '@/lib/company-assets/types';
import { assetCopy, type AssetCopy } from './copy';
import { AssetDetailDialog } from './asset-detail-panel';
import { AssetLookup } from './asset-lookup';
import { WorkshopBayArt } from './workshop-bay-art';
import { AssetFeedback, AssetLoading, AssetPicture, AssetSearch, assetButton, assetIdentity, assetTime, useAssetSnapshot } from './shared';

const phases: Exclude<RepairPhase, 'cancelled'>[] = ['reported', 'received', 'repairing', 'ready'];

export function WorkshopWorkspace({ initialAsset, embedded = false }: { initialAsset?: AssetRef; embedded?: boolean }) {
  const { currentLang: language } = useLanguage();
  const c = assetCopy(language);
  const data = useAssetSnapshot({ page: 1 }, c);
  const [selected, setSelected] = useState<{asset:AssetRef;repairId?:string} | null>(initialAsset ? {asset:initialAsset} : null);
  const [phase, setPhase] = useState<Exclude<RepairPhase, 'cancelled'> | null>(null);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (data.snapshot?.repairs ?? []).filter(repair => !needle || [repair.name, repair.code, repair.plate, repair.provider, repair.problem].filter(Boolean).join(' ').toLocaleLowerCase().includes(needle));
  }, [data.snapshot?.repairs, query]);
  const visiblePhase = phase ?? phases.find(key => rows.some(repair => repair.phase === key)) ?? 'reported';

  return <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="workshop-workspace" aria-busy={data.loading}>
    <div className="no-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5" data-testid="workshop-scroll">
    <div className="flex min-w-0 flex-wrap items-center gap-2 pb-3 sm:gap-3">
      {!embedded ? <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold"><Wrench size={21} className="text-orange-600 dark:text-orange-400" />{c.workshop}</h1> : null}
      <div className="min-w-[min(100%,12rem)] flex-1"><AssetSearch value={query} onChange={value => { setQuery(value); setPhase(null); }} label={c.search} /></div>
      <button type="button" className={`${assetButton} shrink-0 px-0`} onClick={() => void data.reload()} disabled={data.loading} aria-label={c.refresh}><RefreshCw size={18} className={data.loading ? 'animate-spin' : ''} /></button>
      <AssetLookup c={c} onSelect={asset => setSelected({asset})} compact />
    </div>
    <div aria-label={c.workshop} className="grid grid-cols-2 gap-2 pb-3 sm:grid-cols-4 xl:hidden">
      {phases.map(key => <button type="button" key={key} aria-pressed={visiblePhase === key} aria-controls={`workshop-phase-${key}`} onClick={() => setPhase(key)} className={`${assetButton} justify-between text-left ${visiblePhase === key ? 'border-orange-500 bg-orange-500/10 text-orange-800 dark:text-orange-300' : ''}`}>
        <span className="min-w-0 break-words">{c[key]}</span><span className="tabular-nums text-xs">{data.snapshot ? rows.filter(repair => repair.phase === key).length : '—'}</span>
      </button>)}
    </div>
      {data.error ? <div className="space-y-3"><AssetFeedback message={data.error} failed /><button type="button" className={assetButton} onClick={() => void data.reload()}>{c.retry}</button></div> : null}
      {data.snapshot?.queueHasMore?.repairs ? <p role="status" className="mb-3 text-sm text-muted-foreground">{c.queueLimit}</p> : null}
      {data.loading && !data.snapshot ? <AssetLoading label={c.loading} /> : null}
      {data.snapshot ? <div className="grid min-w-0 items-start gap-4 xl:grid-cols-4">
        {phases.map(key => {
          const repairs = rows.filter(repair => repair.phase === key);
          return <section key={key} id={`workshop-phase-${key}`} aria-label={c[key]} className={`min-w-0 overflow-hidden rounded-2xl border bg-card ${visiblePhase === key ? 'block' : 'hidden xl:block'}`}>
            <WorkshopBayArt phase={key}/>
            <h2 className="mx-3 mb-3 flex min-h-11 items-center justify-between gap-2 border-b px-1 pb-2 text-sm font-semibold">
              <span className="min-w-0 break-words">{c[key]}{key === 'ready' ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{c.history}</span> : null}</span>
              <span className="grid min-w-7 shrink-0 place-items-center rounded-lg bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground">{repairs.length}</span>
            </h2>
            <div className="grid min-w-0 grid-cols-2 items-start gap-2 px-3 pb-3 xl:grid-cols-1 2xl:grid-cols-2">
              {repairs.map(repair => <RepairCard key={repair.id} repair={repair} language={language} c={c} onOpen={() => setSelected({asset:repair.asset,repairId:repair.id})} />)}
              {!repairs.length ? <p className="col-span-full px-2 py-5 text-center text-xs text-muted-foreground">{query.trim() ? c.empty : c.noRepair}</p> : null}
            </div>
          </section>;
        })}
      </div> : null}
    </div>
    <AssetDetailDialog asset={selected?.asset ?? null} repairId={selected?.repairId} mode="service" onClose={() => { setSelected(null); void data.reload(); }} />
  </div>;
}

function RepairCard({ repair, c, onOpen, language }: { repair: AssetRepairView; c: AssetCopy; language: string; onOpen: () => void }) {
  const identity = assetIdentity({ ...repair, size: null });
  return <button type="button" onClick={onOpen} data-testid="workshop-repair-card" data-repair-id={repair.id} aria-label={`${repair.name} · ${identity} · ${c[repair.phase]} · ${repair.problem}`} className="group flex w-full min-w-0 flex-col overflow-hidden rounded-xl border bg-background text-left transition hover:border-orange-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset">
    <span className="block h-20 w-full overflow-hidden bg-gradient-to-br from-orange-50 to-slate-100 dark:from-slate-800 dark:to-slate-950"><AssetPicture asset={{ name: repair.name, photoUrl: repair.photoUrl, category: repair.category }} /></span>
    <span className="block w-full min-w-0 p-2.5">
      <span className="line-clamp-2 block break-words text-sm font-semibold leading-snug [overflow-wrap:anywhere]">{repair.name}</span>
      {identity && !repair.name.includes(identity) ? <span className="mt-1 block break-words font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{identity}</span> : null}
      {repair.phase === 'ready' ? <time dateTime={repair.updatedAt} className="mt-1 block text-[11px] text-muted-foreground">{assetTime(repair.updatedAt,language)}</time> : null}
      {repair.location === 'external' ? <span className="mt-1 block text-xs font-medium text-orange-800 dark:text-orange-300">{c.external}</span> : null}
    </span>
  </button>;
}
