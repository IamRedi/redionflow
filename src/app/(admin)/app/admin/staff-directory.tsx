'use client';

import { HardHat, Search, Truck, UserCog, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useLanguage } from '@/components/i18n/language-provider';

export type StaffCategory = 'worker' | 'office' | 'fleet';
const LANGS = ['sq', 'en', 'de', 'it', 'pl', 'ro'];
const words = {
  worker: ['Punëtorë', 'Workers', 'Arbeiter', 'Operai', 'Pracownicy', 'Muncitori'],
  office: ['Inxhinierë e administratë', 'Engineers and office', 'Ingenieure und Büro', 'Ingegneri e ufficio', 'Inżynierowie i biuro', 'Ingineri și birou'],
  fleet: ['Flota', 'Fleet', 'Flotte', 'Flotta', 'Flota', 'Flotă'],
  search: ['Kërko emrin', 'Search name', 'Name suchen', 'Cerca nome', 'Szukaj nazwy', 'Caută numele'],
  none: ['Asnjë emër nuk përputhet.', 'No name matches.', 'Kein Name passt.', 'Nessun nome corrisponde.', 'Brak pasującej nazwy.', 'Niciun nume nu se potrivește.'],
  close: ['Mbyll kërkimin', 'Close search', 'Suche schließen', 'Chiudi ricerca', 'Zamknij wyszukiwanie', 'Închide căutarea'],
};
const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const icons = { worker: HardHat, office: UserCog, fleet: Truck } as const;

/**
 * Staff page in three groups (workers / engineers and office / fleet). Only the
 * chosen group shows; the magnifier filters names live while typing.
 * Server-rendered items carry data-staff-cat and data-staff-name.
 */
const STAFF_VISIBILITY_CSS = `[data-staff-view] [data-staff-cat][hidden]{display:none}
[data-staff-view="worker"] [data-staff-cat]:not([data-staff-cat="worker"]),[data-staff-view="office"] [data-staff-cat]:not([data-staff-cat="office"]),
[data-staff-view="fleet"] [data-staff-block="people"],[data-staff-view="worker"] [data-staff-block="fleet"],[data-staff-view="office"] [data-staff-block="fleet"]{display:none}`;

export function StaffDirectory({ counts, children }: { counts: Record<StaffCategory, number>; children: ReactNode }) {
  const { currentLang } = useLanguage();
  const i = Math.max(0, LANGS.indexOf(currentLang));
  const w = Object.fromEntries(Object.entries(words).map(([k, v]) => [k, v[i]])) as Record<keyof typeof words, string>;
  const [category, setCategory] = useState<StaffCategory>('worker');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [empty, setEmpty] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { const saved = localStorage.getItem('staff-category'); if (saved === 'worker' || saved === 'office' || saved === 'fleet') queueMicrotask(() => setCategory(saved)); } catch { /* private mode */ }
  }, []);
  useEffect(() => {
    const el = root.current; if (!el) return;
    const wanted = fold(query);
    let shown = 0;
    el.querySelectorAll<HTMLElement>('[data-staff-cat]').forEach(item => {
      const visible = item.dataset.staffCat === category && (!wanted || fold(item.dataset.staffName ?? '').includes(wanted));
      item.hidden = !visible; if (visible) shown += 1;
    });
    setEmpty(shown === 0 && Boolean(wanted));
  }, [category, query]);

  function choose(next: StaffCategory) {
    setCategory(next);
    try { localStorage.setItem('staff-category', next); } catch { /* private mode */ }
  }

  return <section className="space-y-3" ref={root} data-testid="staff-directory" data-staff-view={category}>
    {/* Groups switch with CSS so the server render already shows only the first group. */}
    <style>{STAFF_VISIBILITY_CSS}</style>
    <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border bg-background/95 p-2 shadow-sm backdrop-blur">
      <div role="tablist" className="grid min-w-0 flex-1 grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
        {(['worker', 'office', 'fleet'] as const).map(key => {
          const Icon = icons[key];
          return <button key={key} type="button" role="tab" aria-selected={category === key} onClick={() => choose(key)} data-testid={`staff-tab-${key}`}
            className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-1 text-xs font-semibold leading-tight transition sm:gap-2 sm:px-3 sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${category === key ? 'border-orange-600 bg-orange-600 text-white dark:border-orange-500 dark:bg-orange-500 dark:text-slate-950' : 'bg-card hover:bg-muted'}`}>
            <Icon className="hidden size-4 shrink-0 sm:block" /><span className="min-w-0 break-words text-center">{w[key]}</span><span className="tabular-nums opacity-80">{counts[key]}</span>
          </button>;
        })}
      </div>
      {searching ? <label className="relative flex basis-full items-center sm:basis-auto sm:flex-none">
        <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <input ref={input} type="text" enterKeyHint="search" autoComplete="off" value={query} onChange={e => setQuery(e.target.value)} placeholder={w.search} aria-label={w.search} data-testid="staff-search"
          className="h-11 w-full rounded-xl border bg-card pl-9 pr-11 text-base outline-none focus-visible:ring-2 focus-visible:ring-orange-500 sm:w-64" />
        <button type="button" onClick={() => { setQuery(''); setSearching(false); }} aria-label={w.close} className="absolute right-1 grid size-9 place-items-center rounded-lg hover:bg-muted"><X className="size-4" /></button>
      </label> : <button type="button" onClick={() => { setSearching(true); queueMicrotask(() => input.current?.focus()); }} aria-label={w.search} title={w.search} data-testid="staff-search-open"
        className="grid size-11 shrink-0 place-items-center rounded-xl border bg-card hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><Search className="size-4" /></button>}
    </div>
    {empty ? <p role="status" className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{w.none}</p> : null}
    {children}
  </section>;
}
