'use client';

import { CalendarDays, Factory, FolderPlus, HardHat, KeyRound, Loader2, MapPin, Navigation, RotateCcw, Users, Wallet, Warehouse, Wrench, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { getWorkerAccessAction, setPlaceAccessAction, setWorkerAccessLevelAction } from '@/app/(workzone)/workzone/access-actions';
import { AssetWorkspaceDialog } from '@/components/company-assets/workspace-dialog';
import { useLanguage } from '@/components/i18n/language-provider';
import { accessCopy, type AccessCopy } from '@/lib/access/copy';
import type { AccessLevel, AccessPlace, GrantLevel } from '@/lib/access/rules';

type PlaceState = { place: AccessPlace; sees: boolean; acts: 'all' | 'some' | 'none'; grant: GrantLevel | null };
type Summary = { id: string; level: AccessLevel; levelSet: boolean; crewRole: string | null; fromRole: AccessPlace[]; grants: { place: AccessPlace; scopeId: string; scopeName: string | null; level: GrantLevel }[]; places: PlaceState[] };
type Result = { ok: true; data: Summary } | { ok: false; message: string };
type Choice = 'act' | 'view' | 'none';

const ICONS: Record<AccessPlace, LucideIcon> = {
  site: MapPin, field: HardHat, factory: Factory, new_project: FolderPlus, fleet_gps: Navigation,
  workshop: Wrench, warehouse: Warehouse, daily_plan: CalendarDays, costs: Wallet, staff: Users,
};

/**
 * Admin, on a person's profile: one small key button. It opens the person's
 * access card: level (Bazë / Shikim i plotë) and every place with
 * Vepron / Shikon / Hiq, editable right there.
 */
export function WorkerAccessPanel({ workerId }: { workerId: string }) {
  const { currentLang } = useLanguage();
  const c = accessCopy(currentLang);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<Result | null>(null);
  const load = useCallback(async () => { try { setState(await getWorkerAccessAction(workerId) as Result); } catch { setState({ ok: false, message: c.failed }); } }, [workerId, c.failed]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  if (!state?.ok && !open) return null;
  const level = state?.ok ? (state.data.level === 'BASE' ? c.base : c.full) : null;
  return <>
    <button type="button" onClick={() => setOpen(true)} data-testid="worker-access-open"
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <KeyRound className="size-4 text-orange-600 dark:text-orange-400" strokeWidth={1.8} />
      {c.access}
      {level ? <span className="text-muted-foreground">· {level}</span> : null}
    </button>
    <AssetWorkspaceDialog open={open} onOpenChange={setOpen} title={c.access} scrollBody compact>
      {open ? <AccessCard c={c} workerId={workerId} state={state} setState={setState} reload={load} /> : null}
    </AssetWorkspaceDialog>
  </>;
}

function AccessCard({ c, workerId, state, setState, reload }: { c: AccessCopy; workerId: string; state: Result | null; setState: (r: Result) => void; reload: () => Promise<void> }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!state) return <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />{c.loading}</p>;
  if (!state.ok) return <p className="py-4 text-sm text-red-700 dark:text-red-300">{state.message || c.failed}</p>;
  const d = state.data;

  async function run(key: string, work: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(key); setMessage(null);
    try { const r = await work(); if (r.ok) { await reload(); router.refresh(); } else setMessage(r.message ?? c.failed); }
    catch { setMessage(c.failed); } finally { setBusy(null); }
  }
  const setLevel = (level: AccessLevel) => run('level', async () => { const r = await setWorkerAccessLevelAction({ workerId, level }) as Result; if (r.ok) setState(r); return r; });
  const setPlace = (place: AccessPlace, scopeId: string, level: Choice | null) => run(`${place}:${scopeId}`, () => setPlaceAccessAction({ place, scopeId, workerId, level }));

  const segment = (key: string, current: Choice, onPick: (level: Choice) => void) => (
    <span role="group" className="inline-flex shrink-0 overflow-hidden rounded-lg border text-xs font-semibold">
      {(['act', 'view', 'none'] as const).map(level => <button key={level} type="button" aria-pressed={current === level} disabled={busy !== null || current === level} onClick={() => onPick(level)} data-testid={`worker-access-${key}-${level}`}
        className={`min-h-10 px-2 sm:px-2.5 disabled:cursor-default ${current === level ? (level === 'none' ? 'bg-red-600 text-white dark:bg-red-500 dark:text-slate-950' : 'bg-orange-600 text-white dark:bg-orange-500 dark:text-slate-950') : 'hover:bg-muted'}`}>
        {level === 'act' ? c.acts : level === 'view' ? c.sees : c.remove}</button>)}
    </span>
  );
  const reset = (key: string, onReset: () => void) => (
    <button type="button" disabled={busy !== null} onClick={onReset} aria-label={c.reset} title={c.reset} className="grid size-10 shrink-0 place-items-center rounded-lg border hover:bg-muted disabled:opacity-50">
      {busy === key ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
    </button>
  );

  return <div className="space-y-5 pb-2" data-testid="worker-access-sheet">
    {message ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{message}</p> : null}
    <section>
      <h3 className="mb-2 text-sm font-semibold">{c.level}</h3>
      <div role="group" className="grid grid-cols-2 overflow-hidden rounded-xl border text-sm font-semibold">
        {(['BASE', 'FULL_VIEW'] as const).map(level => <button key={level} type="button" aria-pressed={d.level === level} disabled={busy !== null || (d.level === level && d.levelSet)} onClick={() => void setLevel(level)}
          className={`min-h-11 px-3 disabled:cursor-default ${d.level === level ? 'bg-orange-600 text-white dark:bg-orange-500 dark:text-slate-950' : 'hover:bg-muted'}`}>{level === 'BASE' ? c.base : c.full}</button>)}
      </div>
      <p className="mt-2 text-xs leading-snug text-muted-foreground">{d.level === 'BASE' ? c.baseHint : c.fullHint}</p>
    </section>
    <section>
      <h3 className="mb-2 text-sm font-semibold">{c.where}</h3>
      <ul className="space-y-2">
        {d.places.map(p => {
          const Icon = ICONS[p.place];
          const current: Choice = p.acts !== 'none' ? 'act' : p.sees ? 'view' : 'none';
          const scoped = d.grants.filter(g => g.place === p.place && g.scopeId);
          const key = `${p.place}:`;
          return <li key={p.place} className="rounded-xl border bg-card px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto sm:flex-1">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-orange-500/10 text-orange-700 dark:text-orange-300"><Icon size={16} /></span>
                <span className="min-w-0"><span className="block text-sm font-medium">{c.place(p.place)}</span>
                  <span className="block text-xs text-muted-foreground">{p.grant ? (scoped.length ? c.allSites : '') : c.fromLevel}{p.acts === 'some' ? `${p.grant ? '' : ', '}${c.partly}` : ''}</span></span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {segment(p.place, current, level => void setPlace(p.place, '', level))}
                {p.grant ? reset(key, () => void setPlace(p.place, '', null)) : null}
              </span>
            </div>
            {scoped.length ? <ul className="mt-2 space-y-1.5 border-t pt-2">
              {scoped.map(g => <li key={g.scopeId} className="flex flex-wrap items-center gap-2 sm:pl-10">
                <span className="flex min-w-0 basis-full items-center gap-1.5 text-sm sm:basis-0 sm:flex-1"><MapPin size={14} className="shrink-0 text-muted-foreground" /><span className="truncate">{g.scopeName ?? '—'}</span></span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {segment(`${p.place}-${g.scopeId}`, g.level === 'act' ? 'act' : g.level === 'view' ? 'view' : 'none', level => void setPlace(p.place, g.scopeId, level))}
                  {reset(`${p.place}:${g.scopeId}`, () => void setPlace(p.place, g.scopeId, null))}
                </span>
              </li>)}
            </ul> : null}
          </li>;
        })}
      </ul>
    </section>
  </div>;
}
