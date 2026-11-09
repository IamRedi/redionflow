'use client';

import { KeyRound, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { getWorkerAccessAction, setWorkerAccessLevelAction } from '@/app/(workzone)/workzone/access-actions';
import { useLanguage } from '@/components/i18n/language-provider';
import { accessCopy } from '@/lib/access/copy';
import type { AccessLevel, AccessPlace, GrantLevel } from '@/lib/access/rules';

type Summary = { id: string; level: AccessLevel; levelSet: boolean; crewRole: string | null; fromRole: AccessPlace[]; grants: { place: AccessPlace; scopeId: string; scopeName: string | null; level: GrantLevel }[] };
type Result = { ok: true; data: Summary } | { ok: false; message: string };

/** Admin view of one person's access: level (Bazë / Shikim i plotë) and the list "Ku ka akses". */
export function WorkerAccessPanel({ workerId }: { workerId: string }) {
  const { currentLang } = useLanguage();
  const c = accessCopy(currentLang);
  const router = useRouter();
  const [state, setState] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setState(await getWorkerAccessAction(workerId) as Result); } catch { setState({ ok: false, message: c.failed }); } }, [workerId, c.failed]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  async function setLevel(level: AccessLevel) {
    if (busy || (state?.ok && state.data.level === level && state.data.levelSet)) return;
    setBusy(true);
    try { const r = await setWorkerAccessLevelAction({ workerId, level }) as Result; setState(r); if (r.ok) router.refresh(); } catch { setState({ ok: false, message: c.failed }); } finally { setBusy(false); }
  }
  if (!state) return <section className="rounded-2xl border bg-card p-4"><p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />{c.loading}</p></section>;
  if (!state.ok) return <section className="rounded-2xl border bg-card p-4"><p className="text-sm text-red-700 dark:text-red-300">{state.message || c.failed}</p></section>;
  const d = state.data;
  const option = (level: AccessLevel, label: string, hint: string) => <button type="button" disabled={busy} onClick={() => void setLevel(level)} aria-pressed={d.level === level}
    className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm transition disabled:opacity-60 ${d.level === level ? 'border-orange-600 bg-orange-50 dark:border-orange-400 dark:bg-orange-950/30' : 'bg-background hover:bg-muted'}`}>
    <span className="block font-semibold">{label}</span><span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{hint}</span></button>;
  return <section className="space-y-4 rounded-2xl border bg-card p-4" data-testid="worker-access-panel">
    <h2 className="flex items-center gap-2 text-base font-semibold"><KeyRound size={18} className="text-orange-600 dark:text-orange-400" />{c.access}</h2>
    <div><p className="mb-2 text-sm font-medium">{c.level}</p><div className="grid gap-2 sm:grid-cols-2">{option('BASE', c.base, c.baseHint)}{option('FULL_VIEW', c.full, c.fullHint)}</div></div>
    <div>
      <p className="mb-2 text-sm font-medium">{c.where}</p>
      {d.grants.length || d.fromRole.length ? <ul className="space-y-1.5 text-sm">
        {d.grants.map(g => <li key={`${g.place}:${g.scopeId}`} className="flex flex-wrap items-center gap-x-2 rounded-lg bg-muted/60 px-3 py-2"><span className="font-medium">{c.place(g.place)}{g.scopeName ? ` · ${g.scopeName}` : g.place === 'site' ? ` · ${c.wholePlace}` : ''}</span><span className="text-xs text-muted-foreground">{g.level === 'act' ? c.acts : g.level === 'view' ? c.sees : c.removed}</span></li>)}
        {d.fromRole.filter(place => !d.grants.some(g => g.place === place && !g.scopeId)).map(place => <li key={`role:${place}`} className="flex flex-wrap items-center gap-x-2 rounded-lg bg-muted/60 px-3 py-2"><span className="font-medium">{c.place(place)}</span><span className="text-xs text-muted-foreground">{c.acts} · {c.fromRole}</span></li>)}
      </ul> : <p className="text-sm text-muted-foreground">{c.noGrants}</p>}
    </div>
  </section>;
}
