'use client';

import { KeyRound, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { getPlaceAccessAction, setPlaceAccessAction } from '@/app/(workzone)/workzone/access-actions';
import { AssetWorkspaceDialog } from '@/components/company-assets/workspace-dialog';
import { useLanguage } from '@/components/i18n/language-provider';
import { accessCopy, type AccessCopy } from '@/lib/access/copy';
import type { PlacePerson } from '@/lib/access/manage';
import type { AccessPlace } from '@/lib/access/rules';

type Snapshot = { place: AccessPlace; scopeId: string; scopeName: string; admins: string[]; people: PlacePerson[] };
type Result = { ok: true; data: Snapshot } | { ok: false; message: string };

const chip = 'inline-flex min-h-11 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-semibold shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500';

/**
 * Small key button shown to admins at a place (site, factory line, fleet…).
 * Shows how many people act there; opens who sees and who acts, and lets the
 * admin add or remove people. It stays hidden for everyone else: the server
 * answers only to admins of a steel company.
 */
export function AccessKeyButton({ place, scopeId = '', className = '', compact = false }: { place: AccessPlace; scopeId?: string; className?: string; compact?: boolean }) {
  const { currentLang } = useLanguage();
  const c = accessCopy(currentLang);
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Result | null>(null);
  const load = useCallback(async () => {
    try { setSnapshot(await getPlaceAccessAction(place, scopeId) as Result); } catch { setSnapshot({ ok: false, message: c.failed }); }
  }, [place, scopeId, c.failed]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  const count = snapshot?.ok ? snapshot.data.people.filter(p => p.acts !== 'none').length : null;
  if (!snapshot?.ok && !open) return null;
  const title = `${c.access} · ${snapshot?.ok && snapshot.data.scopeName ? snapshot.data.scopeName : c.place(place)}`;
  return <>
    <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} className={`${chip} ${compact ? 'min-h-9 px-2 text-xs' : ''} ${className}`} aria-label={`${c.access}: ${c.place(place)}`} title={`${c.access}: ${c.place(place)}`} data-testid={`access-key-${place}`}>
      <KeyRound size={compact ? 14 : 16} className="text-orange-600 dark:text-orange-400" />
      {count === null ? null : <span className="tabular-nums">{count}</span>}
    </button>
    <AssetWorkspaceDialog open={open} onOpenChange={setOpen} title={title} scrollBody compact>
      {open ? <AccessSheet c={c} snapshot={snapshot} reload={load} setSnapshot={setSnapshot} place={place} scopeId={scopeId} /> : null}
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
  async function change(workerId: string, level: 'view' | 'act' | null) {
    setBusy(workerId); setMessage(null);
    try {
      const r = await setPlaceAccessAction({ place, scopeId, workerId, level }) as Result;
      if (r.ok) { setSnapshot(r); setPick(''); router.refresh(); } else setMessage(r.message);
    } catch { setMessage(c.failed); } finally { setBusy(null); }
  }
  const acting = people.filter(p => p.acts !== 'none');
  const seeing = people.filter(p => p.acts === 'none' && p.sees);
  const others = people.filter(p => p.grantScope !== 'here');
  const tag = (p: PlacePerson) => {
    if (p.grantScope === 'all') return c.wholePlace;
    if (p.grant) return null;
    if (p.acts === 'some') return `${c.partly}, ${c.fromRole}`;
    if (p.acts === 'all') return c.fromRole;
    return c.full;
  };
  const row = (p: PlacePerson) => <li key={p.id} className="flex min-h-12 items-center gap-2 rounded-xl border bg-card px-3 py-1.5">
    <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{p.name}</span>{tag(p) ? <span className="block text-xs text-muted-foreground">{tag(p)}</span> : null}</span>
    {p.grantScope === 'here' ? <>
      <span role="group" aria-label={p.name} className="inline-flex shrink-0 overflow-hidden rounded-lg border text-xs font-semibold">
        {(['view', 'act'] as const).map(level => <button key={level} type="button" aria-pressed={p.grant === level} disabled={busy !== null || p.grant === level} onClick={() => void change(p.id, level)}
          className={`min-h-10 px-2.5 disabled:cursor-default ${p.grant === level ? 'bg-orange-600 text-white dark:bg-orange-500 dark:text-slate-950' : 'hover:bg-muted'}`}>{level === 'act' ? c.acts : c.sees}</button>)}
      </span>
      <button type="button" disabled={busy !== null} onClick={() => void change(p.id, null)} aria-label={`${c.remove}: ${p.name}`} className="grid size-10 place-items-center rounded-lg border hover:bg-muted disabled:opacity-50">{busy === p.id ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}</button>
    </> : null}
  </li>;
  return <div className="space-y-5 pb-2" data-testid="access-sheet">
    <p className="rounded-xl bg-muted px-3 py-2 text-sm">{c.admins}: <span className="font-medium">{admins.join(', ')}</span></p>
    {message ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{message}</p> : null}
    <section><h3 className="mb-2 text-sm font-semibold">{c.acts} · {acting.length}</h3>{acting.length ? <ul className="space-y-2">{acting.map(row)}</ul> : <p className="text-sm text-muted-foreground">{c.nobody}</p>}</section>
    <section><h3 className="mb-2 text-sm font-semibold">{c.sees} · {seeing.length}</h3>{seeing.length ? <ul className="space-y-2">{seeing.map(row)}</ul> : <p className="text-sm text-muted-foreground">{c.nobody}</p>}</section>
    <section className="space-y-2 border-t pt-4">
      <label className="block text-sm font-semibold" htmlFor={`access-add-${place}`}>{c.add}</label>
      <select id={`access-add-${place}`} value={pick} onChange={e => setPick(e.target.value)} className="min-h-11 w-full rounded-xl border bg-background px-3 text-sm">
        <option value="">{c.choose}</option>
        {others.map(p => <option key={p.id} value={p.id}>{p.name}{p.level === 'FULL_VIEW' ? ` · ${c.full}` : ''}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={!pick || busy !== null} onClick={() => void change(pick, 'view')} className={`${chip} justify-center disabled:opacity-50`} data-testid="access-add-view">+ {c.sees}</button>
        <button type="button" disabled={!pick || busy !== null} onClick={() => void change(pick, 'act')} className={`${chip} justify-center border-orange-700 bg-orange-700 text-white hover:bg-orange-800 disabled:opacity-50 dark:border-orange-500 dark:bg-orange-500 dark:text-slate-950`} data-testid="access-add-act">+ {c.acts}</button>
      </div>
    </section>
  </div>;
}
