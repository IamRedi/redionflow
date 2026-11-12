'use client';

import { KeyRound, Loader2, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { getPlaceAccessAction, setPlaceAccessAction } from '@/app/(workzone)/workzone/access-actions';
import { AssetWorkspaceDialog } from '@/components/company-assets/workspace-dialog';
import { useLanguage } from '@/components/i18n/language-provider';
import { accessCopy, type AccessCopy } from '@/lib/access/copy';
import type { PlacePerson } from '@/lib/access/manage';
import { grantChoices, type AccessPlace, type GrantLevel } from '@/lib/access/rules';

type Snapshot = { place: AccessPlace; scopeId: string; scopeName: string; admins: string[]; people: PlacePerson[] };
type Result = { ok: true; data: Snapshot } | { ok: false; message: string };

const chip = 'inline-flex min-h-11 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-semibold shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500';

/**
 * Small key button shown to admins at a place (site, factory line, fleet…).
 * Shows how many people act there; opens who sees and who acts, and lets the
 * admin add or remove people. It stays hidden for everyone else: the server
 * answers only to admins of a steel company.
 */
export function AccessKeyButton({ place, scopeId = '', className = '', compact = false, label }: { place: AccessPlace; scopeId?: string; className?: string; compact?: boolean; label?: string }) {
  const { currentLang } = useLanguage();
  const c = accessCopy(currentLang);
  const [open, setOpen] = useState(false);
  // A site key can also set the choice for all sites at once.
  const [everywhere, setEverywhere] = useState(false);
  const scope = everywhere ? '' : scopeId;
  const [snapshot, setSnapshot] = useState<Result | null>(null);
  const load = useCallback(async () => {
    try { setSnapshot(await getPlaceAccessAction(place, scope) as Result); } catch { setSnapshot({ ok: false, message: c.failed }); }
  }, [place, scope, c.failed]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  const count = snapshot?.ok ? snapshot.data.people.filter(p => p.acts !== 'none').length : null;
  if (!snapshot?.ok && !open) return null;
  const name = label ?? c.place(place);
  const where = everywhere ? c.allSites : snapshot?.ok && snapshot.data.scopeName ? snapshot.data.scopeName : '';
  const title = label ? `${c.access} · ${label}${where ? ` · ${where}` : ''}` : `${c.access} · ${where || name}`;
  return <>
    <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} className={`${chip} ${compact ? 'min-h-9 px-2 text-xs' : ''} ${className}`} aria-label={`${c.access}: ${name}`} title={`${c.access}: ${name}`} data-testid={`access-key-${place}`}>
      <KeyRound size={compact ? 14 : 16} className="text-orange-600 dark:text-orange-400" />
      {count === null ? null : <span className="tabular-nums">{count}</span>}
    </button>
    <AssetWorkspaceDialog open={open} onOpenChange={next => { setOpen(next); if (!next && everywhere) { setEverywhere(false); setSnapshot(null); } }} title={title} scrollBody compact>
      {open && scopeId ? <div role="group" aria-label={c.access} className="mb-4 grid grid-cols-2 overflow-hidden rounded-xl border text-sm font-semibold">
        {([false, true] as const).map(all => <button key={String(all)} type="button" aria-pressed={everywhere === all} disabled={everywhere === all} onClick={() => { setSnapshot(null); setEverywhere(all); }} data-testid={`access-scope-${all ? 'all' : 'here'}`}
          className={`min-h-11 px-3 disabled:cursor-default ${everywhere === all ? 'bg-orange-700 text-white dark:bg-orange-500 dark:text-slate-950' : 'hover:bg-muted'}`}>{all ? c.allSites : c.thisSite}</button>)}
      </div> : null}
      {open ? <AccessSheet key={scope} c={c} snapshot={snapshot} reload={load} setSnapshot={setSnapshot} place={place} scopeId={scope} /> : null}
    </AssetWorkspaceDialog>
  </>;
}

function AccessSheet({ c, snapshot, reload, setSnapshot, place, scopeId }: { c: AccessCopy; snapshot: Result | null; reload: () => Promise<void>; setSnapshot: (r: Result) => void; place: AccessPlace; scopeId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [pick, setPick] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  if (!snapshot) return <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 size={18} className="animate-spin" />{c.loading}</p>;
  if (!snapshot.ok) return <div className="space-y-3 py-4"><p className="text-sm text-red-700 dark:text-red-300">{snapshot.message || c.failed}</p><button type="button" className={chip} onClick={() => void reload()}>{c.failed}</button></div>;
  const { people, admins } = snapshot.data;
  async function change(workerId: string, level: GrantLevel | null) {
    setBusy(workerId); setMessage(null);
    try {
      const r = await setPlaceAccessAction({ place, scopeId, workerId, level }) as Result;
      if (r.ok) { setSnapshot(r); setPick(''); router.refresh(); } else setMessage(r.message);
    } catch { setMessage(c.failed); } finally { setBusy(null); }
  }
  const acting = people.filter(p => p.acts !== 'none');
  const seeing = people.filter(p => p.acts === 'none' && p.sees);
  const removed = people.filter(p => !p.sees && p.grant === 'none');
  const others = people.filter(p => p.grantScope !== 'here' && !p.sees && p.grant !== 'none');
  const state = (p: PlacePerson) => p.grant === 'register' ? 'register' : p.acts !== 'none' ? 'act' : p.sees ? 'view' : 'none';
  const tag = (p: PlacePerson) => {
    if (p.grantScope === 'all') return c.wholePlace;
    if (p.grantScope === 'here') return null;
    if (p.acts === 'some') return `${c.partly}, ${c.fromRole}`;
    if (p.acts === 'all') return c.fromRole;
    return c.full;
  };
  const row = (p: PlacePerson) => <li key={p.id} className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-1.5">
    <span className={place === 'warehouse' ? 'min-w-0 flex-1' : 'min-w-0 basis-full sm:basis-auto sm:flex-1'}><span className="block break-words text-sm font-medium">{p.name}</span>{tag(p) ? <span className="block text-xs text-muted-foreground">{tag(p)}</span> : null}</span>
    <span role="group" aria-label={p.name} className={`${place === 'warehouse' ? 'order-last grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))]' : 'inline-flex shrink-0'} overflow-hidden rounded-lg border text-xs font-semibold`}>
      {grantChoices(place).map(level => <button key={level} type="button" aria-pressed={state(p) === level} disabled={busy !== null || state(p) === level} onClick={() => void change(p.id, level)} data-testid={`access-set-${level}`}
        className={`min-h-11 px-2 sm:px-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500 disabled:cursor-default ${state(p) === level ? (level === 'none' ? 'bg-red-600 text-white dark:bg-red-500 dark:text-slate-950' : 'bg-orange-700 text-white dark:bg-orange-500 dark:text-slate-950') : 'hover:bg-muted'}`}>{level === 'act' ? c.acts : level === 'register' ? c.registers : level === 'view' ? c.sees : c.remove}</button>)}
    </span>
    {p.grantScope === 'here' ? <button type="button" disabled={busy !== null} onClick={() => void change(p.id, null)} aria-label={`${c.reset}: ${p.name}`} title={c.reset} className="grid size-11 shrink-0 place-items-center rounded-lg border hover:bg-muted disabled:opacity-50">{busy === p.id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}</button> : null}
  </li>;
  return <div className="space-y-5 pb-2" data-testid="access-sheet">
    {place === 'warehouse' ? <p className="text-sm text-muted-foreground">{c.registerHint}</p> : null}
    <p className="rounded-xl bg-muted px-3 py-2 text-sm">{c.admins}: <span className="font-medium">{admins.join(', ')}</span></p>
    {message ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{message}</p> : null}
    <section><h3 className="mb-2 text-sm font-semibold">{c.acts} · {acting.length}</h3>{acting.length ? <ul className="space-y-2">{acting.map(row)}</ul> : <p className="text-sm text-muted-foreground">{c.nobody}</p>}</section>
    <section><h3 className="mb-2 text-sm font-semibold">{c.sees} · {seeing.length}</h3>{seeing.length ? <ul className="space-y-2">{seeing.map(row)}</ul> : <p className="text-sm text-muted-foreground">{c.nobody}</p>}</section>
    {removed.length ? <section><h3 className="mb-2 text-sm font-semibold">{c.removed} · {removed.length}</h3><ul className="space-y-2">{removed.map(row)}</ul></section> : null}
    <section className="space-y-2 border-t pt-4">
      <label className="block text-sm font-semibold" htmlFor={`access-add-${place}`}>{c.add}</label>
      <select id={`access-add-${place}`} value={pick} onChange={e => setPick(e.target.value)} className="min-h-11 w-full rounded-xl border bg-background px-3 text-sm">
        <option value="">{c.choose}</option>
        {others.map(p => <option key={p.id} value={p.id}>{p.name}{p.level === 'FULL_VIEW' ? ` · ${c.full}` : ''}</option>)}
      </select>
      <div className={`grid grid-cols-2 gap-2 ${place === 'warehouse' ? 'sm:grid-cols-3' : ''}`}>
        <button type="button" disabled={!pick || busy !== null} onClick={() => void change(pick, 'view')} className={`${chip} justify-center disabled:opacity-50`} data-testid="access-add-view">+ {c.sees}</button>
        {place === 'warehouse' ? <button type="button" disabled={!pick || busy !== null} onClick={() => void change(pick, 'register')} className={`${chip} order-last col-span-2 justify-center disabled:opacity-50 sm:order-none sm:col-span-1`} data-testid="access-add-register">+ {c.registers}</button> : null}
        <button type="button" disabled={!pick || busy !== null} onClick={() => void change(pick, 'act')} className={`${chip} justify-center border-orange-700 bg-orange-700 text-white hover:bg-orange-800 disabled:opacity-50 dark:border-orange-500 dark:bg-orange-500 dark:text-slate-950`} data-testid="access-add-act">+ {c.acts}</button>
      </div>
    </section>
  </div>;
}
