"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { MachineArt, machineKind } from '@/components/steel/machine-art';
import type { MachineSideItem } from '@/app/(workzone)/workzone/machine-sidebar';
import { AssetWorkspaceDialog } from './workspace-dialog';
import { AssetOperationalStatusBadge } from './shared';
import { assetCopy } from './copy';
import { useLanguage } from '@/components/i18n/language-provider';
import type { AssetOperationalStatus } from '@/lib/company-assets/types';
import { AccessKeyButton } from '@/components/access/access-key-button';

function searchable(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function FleetThumbnail({ machine }: { machine: MachineSideItem }) {
  const [failed, setFailed] = useState<string | null>(null);
  return machine.imageUrl && failed !== machine.imageUrl ? <img src={machine.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(machine.imageUrl)} /> : <MachineArt kind={machineKind(machine)} animate={false} className="h-full w-full p-1.5" />;
}

export function FleetPicker({ open, onOpenChange, machines, onSelect, title, searchLabel, emptyLabel, focusMachineId, statusFor }: {
  open: boolean; onOpenChange: (open: boolean) => void; machines: MachineSideItem[]; onSelect: (id: string) => void;
  title: string; searchLabel: string; emptyLabel: string; focusMachineId?: string | null;
  statusFor?: (id: string) => AssetOperationalStatus | null | undefined;
}) {
  const { currentLang } = useLanguage();
  const c = assetCopy(currentLang);
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);
  const rows = useMemo(() => {
    const needle = searchable(query);
    return machines.filter(machine => !needle || searchable([machine.name, machine.nickname, machine.model, machine.targe].filter(Boolean).join(' ')).includes(needle));
  }, [machines, query]);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      if (grid.current) grid.current.scrollTop = scrollTop.current;
      const previous = focusMachineId ? [...(grid.current?.querySelectorAll<HTMLButtonElement>('[data-machine-id]') ?? [])].find(button => button.dataset.machineId === focusMachineId) : null;
      (previous ?? search.current)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, focusMachineId]);
  return <AssetWorkspaceDialog open={open} onOpenChange={onOpenChange} title={title}>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="fleet-picker">
      <div className="flex shrink-0 items-center gap-2 px-3 pb-3 sm:px-5">
        <label className="relative block w-full min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
          <input data-studio-input ref={search} data-testid="fleet-search" type="search" value={query} onChange={event => { setQuery(event.target.value); scrollTop.current = 0; }} aria-label={searchLabel} placeholder={searchLabel} className="h-11 w-full min-w-0 rounded-xl border bg-card pl-10 pr-3 text-base outline-none focus:border-orange-500 focus-visible:ring-1 focus-visible:ring-orange-500" />
        </label>
        <AccessKeyButton place="fleet_gps" />
      </div>
      <div ref={grid} onScroll={event => { scrollTop.current = event.currentTarget.scrollTop; }} className="no-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5">
        <div className="grid min-w-0 grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 xl:grid-cols-7" data-testid="fleet-card-grid">
          {rows.map(machine => <button key={machine.id} type="button" data-machine-id={machine.id} onClick={() => onSelect(machine.id)} className="group flex min-h-[148px] min-w-0 flex-col overflow-hidden rounded-2xl border bg-card text-left transition hover:border-orange-500/60 hover:bg-orange-500/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset">
            <span className="relative block aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-orange-50 to-slate-100 dark:from-slate-800 dark:to-slate-950">
              <FleetThumbnail machine={machine} />
              {!statusFor && !machine.isActive ? <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-background" /> : null}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1 p-2">
              <span className="line-clamp-2 min-h-[2.5em] text-[11px] font-semibold leading-tight [overflow-wrap:anywhere] sm:text-sm">{machine.nickname || machine.name}</span>
              <span className="block font-mono text-[10px] font-medium leading-tight text-muted-foreground [overflow-wrap:anywhere] sm:text-xs">{machine.targe || '—'}</span>
              {statusFor ? <AssetOperationalStatusBadge status={statusFor(machine.id)} c={c} compact className="mt-0.5" /> : null}
            </span>
          </button>)}
        </div>
        {!rows.length ? <p className="py-10 text-center text-sm text-muted-foreground" role="status">{emptyLabel}</p> : null}
      </div>
    </div>
  </AssetWorkspaceDialog>;
}
