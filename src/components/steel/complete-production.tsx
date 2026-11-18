'use client';

import { CheckCheck, Loader2, Search } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AssetWorkspaceDialog } from '@/components/company-assets/workspace-dialog';
import { useLanguage } from '@/components/i18n/language-provider';
import { productionCompletionStages, stageRemaining } from '@/lib/elements/stages';
import { completeElementProductionAction } from '@/app/(workzone)/workzone/element-actions';
import type { ElementView, ElementWorkerOption, ElementWorkView } from '@/app/(workzone)/workzone/baustellen/[baustelleId]/element-lists';
import type { SteelWorkDefinitionView } from '@/lib/steel-work/types';
import { t } from '@/lib/i18n';
import { productionShortcutCopy } from './production-shortcut-copy';
import { productionDeliveryCopy } from './production-delivery';
import { orderedProcessKeys } from '@/lib/steel-work/process-order';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-3 text-sm font-semibold disabled:opacity-50';

export function CompleteProduction({ element, workers, definitions, lastCrew, onCrew, onCompleted }: {
  element: ElementView; workers: ElementWorkerOption[]; definitions: SteelWorkDefinitionView[];
  lastCrew: string[]; onCrew: (ids: string[]) => void;
  onCompleted: (entries: ElementWorkView[], doneAt: string | null, doneBy: string | null) => void;
}) {
  const { currentLang: lang } = useLanguage(), c = productionShortcutCopy(lang);
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)} className={`${button} bg-orange-600`}><CheckCheck className="size-4" />{c.finish}</button>
    {open ? <CompletionSession element={element} workers={workers} definitions={definitions} lastCrew={lastCrew} onCrew={onCrew} onClose={() => setOpen(false)} onCompleted={onCompleted} /> : null}</>;
}

function CompletionSession({ element, workers, definitions, lastCrew, onCrew, onClose, onCompleted }: {
  element: ElementView; workers: ElementWorkerOption[]; definitions: SteelWorkDefinitionView[];
  lastCrew: string[]; onCrew: (ids: string[]) => void;
  onClose: () => void; onCompleted: (entries: ElementWorkView[], doneAt: string | null, doneBy: string | null) => void;
}) {
  const { currentLang: lang } = useLanguage(), c = productionShortcutCopy(lang), router = useRouter();
  const [snapshot] = useState(element);
  const [common, setCommon] = useState<string[]>([]);
  const [workerQuery, setWorkerQuery] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null), [pending, start] = useTransition();
  const remaining = productionCompletionStages(snapshot).map(stage => ({ stage, pieces: stageRemaining(snapshot, stage) })).filter(row => row.pieces > 0);
  const displayRemaining = orderedProcessKeys(remaining.map(row => row.stage), definitions).map(stage => remaining.find(row => row.stage === stage)!);
  const factoryCrew = workers.filter(w => w.crewRole === 'FACTORY_WORKER' || w.crewRole === 'FACTORY_ENGINEER');
  const choices = factoryCrew.length ? factoryCrew : workers;
  const previousCrew = lastCrew.filter(id => choices.some(worker => worker.id === id));
  const label = (stage: string) => definitions.find(d => d.key === stage)?.label || t(`factory.steps.${stage}`, lang);
  function picker(selected: string[], change: (ids: string[]) => void, query = '') {
    return <div className="grid grid-cols-2 gap-1.5">{choices.filter(worker => !query.trim() || selected.includes(worker.id) || worker.name.toLowerCase().includes(query.trim().toLowerCase())).map(worker => <label key={worker.id} className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl border bg-card px-2.5 text-xs font-semibold">
      <input type="checkbox" aria-label={worker.name} checked={selected.includes(worker.id)} disabled={pending || selected.length >= 20 && !selected.includes(worker.id)} className="size-4 shrink-0 accent-orange-600" onChange={event => change(event.target.checked ? [...selected, worker.id] : selected.filter(id => id !== worker.id))} />
      <span className="break-words">{worker.name}</span></label>)}</div>;
  }
  function save() {
    setError(null); start(async () => {
      try {
        const result = await completeElementProductionAction({ elementId: snapshot.id, expectedRevision: snapshot.processRevision ?? 0,
          expectedQuantity: snapshot.quantity, expectedWorkIds: snapshot.work.map(w => w.id),
          assignments: Object.fromEntries(remaining.map(row => [row.stage, overrides[row.stage] ?? common])) });
        if (!result.ok) { setError(result.code === 'CONFLICT' ? c.conflict : result.message); return; }
        onCrew(common); onCompleted(result.entries, result.doneAt, result.doneBy); router.refresh(); onClose();
      } catch { setError(t('factory.error', lang)); }
    });
  }
  return <AssetWorkspaceDialog open onOpenChange={value => { if (!value && !pending) onClose(); }} title={`${snapshot.mark} · ${c.finish}`} compact scrollBody contentClassName="overflow-hidden">
    <p className="mb-3 text-xs text-muted-foreground">{c.hint} {productionDeliveryCopy(lang).separate}</p>
    <fieldset disabled={pending} className="space-y-3"><legend className="mb-2 text-sm font-semibold">{c.crew}</legend>
      {previousCrew.length && previousCrew.join() !== common.join() ? <button type="button" className={`${button} w-full justify-start text-left text-xs`} onClick={() => setCommon(previousCrew)}>{t('elements.sameAsLast', lang)} · {previousCrew.map(id => workers.find(worker => worker.id === id)?.name).join(', ')}</button> : null}
      {choices.length > 8 ? <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input aria-label={t('elements.searchWorker', lang)} placeholder={t('elements.searchWorker', lang)} value={workerQuery} onChange={event => setWorkerQuery(event.target.value.slice(0, 80))} className="min-h-11 w-full rounded-xl border bg-card pl-9 pr-3 text-sm" /></label> : null}
      {picker(common, setCommon, workerQuery)}
      <ul className="space-y-2">{displayRemaining.map(row => <li key={row.stage} className="rounded-xl border bg-card p-2.5">
        <div className="flex min-w-0 items-center justify-between gap-2"><span className="break-words text-sm font-semibold">{label(row.stage)}</span><span className="shrink-0 text-xs tabular-nums">+{row.pieces} / {snapshot.quantity}</span></div>
        <div className="my-1 text-xs text-muted-foreground">{(overrides[row.stage] ?? common).map(id => workers.find(w => w.id === id)?.name).filter(Boolean).join(', ') || '—'}</div>
        <details onToggle={event => { const open = event.currentTarget.open; setExpanded(all => { const next = new Set(all); if (open) next.add(row.stage); else next.delete(row.stage); return next; }); }}><summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold">{c.different}</summary>
          {expanded.has(row.stage) ? picker(overrides[row.stage] ?? common, ids => setOverrides(all => ({ ...all, [row.stage]: ids }))) : null}
          {overrides[row.stage] ? <button type="button" className={button} onClick={() => setOverrides(all => { const next = { ...all }; delete next[row.stage]; return next; })}>{c.common}</button> : null}
        </details>
      </li>)}</ul>
    </fieldset>
    {error ? <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    <div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" className={button} disabled={pending} onClick={onClose}>{t('factory.cancel', lang)}</button>
      <button type="button" className={`${button} bg-orange-600`} disabled={pending || !remaining.length || remaining.some(row => !(overrides[row.stage] ?? common).length)} onClick={save}>{pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}{c.confirm}</button></div>
  </AssetWorkspaceDialog>;
}
