"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Loader2, Settings2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { SteelWorkCatalog, SteelWorkVisual } from "@/components/steel/work-catalog";
import { elementProcessCopy, workCatalogCopy } from "@/components/steel/work-catalog-copy";
import { steelWorkLabel } from "@/components/steel/work-catalog-label";
import { readProcessRoutes, stagesFor, type ElementList, type ElementSide } from "@/lib/elements/stages";
import { t } from "@/lib/i18n";
import type { SteelWorkDefinitionView } from "@/lib/steel-work/types";
import { setElementProcessesAction } from "@/app/(workzone)/workzone/element-actions";

type Material = { id: string; mark: string; list: ElementList; processRoutes?: unknown; processRevision?: number };
type Props = {
  open: boolean; onOpenChange: (open: boolean) => void; siteId: string; side: ElementSide; elements: Material[];
  definitions: SteelWorkDefinitionView[]; onApplied?: (stages: string[], revisions: Record<string, number>) => void;
};
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-3 text-sm font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50";

/** A fresh snapshot per opening keeps optimistic revisions and mixed-route choices honest. */
export function ElementProcessEditor(props: Props) {
  return props.open ? <ElementProcessSession key={`${props.siteId}:${props.side}`} {...props} /> : null;
}

function ElementProcessSession({ open, onOpenChange, siteId, side, elements, definitions, onApplied }: Props) {
  const { currentLang: lang } = useLanguage();
  const c = workCatalogCopy(lang), p = elementProcessCopy(lang), router = useRouter();
  const [snapshot] = useState(() => {
    const materials = [...new Map(elements.map((element) => [element.id, element])).values()];
    const effective = materials.map((element) => [...stagesFor(side, element.list, element.processRoutes)]);
    const signatures = materials.map((element, index) => JSON.stringify([
      readProcessRoutes(element.processRoutes)?.[side] == null ? "legacy" : "configured",
      [...effective[index]].sort(),
    ]));
    return { materials, effective, mixed: new Set(signatures).size > 1, hasLegacy: materials.some((element) => readProcessRoutes(element.processRoutes)?.[side] == null) };
  });
  const [selected, setSelected] = useState<string[]>(() => snapshot.mixed ? [] : snapshot.effective[0] ?? []);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const mounted = useRef(true);
  const opener = useRef<HTMLElement | null>(null);
  const catalogTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const count = snapshot.materials.length;
  const scopeError = count === 0 ? p.noElements : count > 1000 ? p.tooMany : side === "field" && snapshot.materials.some((element) => element.list !== "assembly") ? p.fieldParts : null;
  const currentKeys = new Set(snapshot.effective.flat());
  const catalog = definitions.filter((definition) => definition.kind === side);
  const choices: Array<{ key: string; definition?: SteelWorkDefinitionView }> = catalog
    .filter((definition) => !definition.archivedAt || currentKeys.has(definition.key))
    .map((definition) => ({ key: definition.key, definition }));
  const known = new Set(choices.map((choice) => choice.key));
  for (const key of currentKeys) if (!known.has(key)) choices.push({ key });

  function label(key: string, definition?: SteelWorkDefinitionView) {
    if (definition) return steelWorkLabel(definition, lang);
    const translated = t(side === "field" ? `elements.fieldStages.${key}` : `factory.steps.${key}`, lang);
    return translated.includes(".") ? key : translated;
  }

  function apply() {
    if (pending || scopeError || selected.length > 80 || snapshot.mixed && !replaceConfirmed) return;
    setError(null);
    const stages = [...selected];
    start(async () => {
      try {
        const result = await setElementProcessesAction({
          siteId, side, elementIds: snapshot.materials.map((element) => element.id), stages,
          expectedRevisions: Object.fromEntries(snapshot.materials.map((element) => [element.id, element.processRevision ?? 0])),
        });
        if (!mounted.current) return;
        if (!result.ok || !result.revisions) { setError(result.code === "REVISION_CONFLICT" ? p.conflict : result.message || c.error); return; }
        onApplied?.(stages, result.revisions);
        router.refresh();
        onOpenChange(false);
      } catch { if (mounted.current) setError(c.error); }
    });
  }

  return <Dialog.Root open={open} onOpenChange={(value) => { if (!pending && !catalogOpen) onOpenChange(value); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[1250] bg-black/45" />
      <Dialog.Content className="fixed inset-0 z-[1251] flex min-h-0 flex-col bg-background text-foreground outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(90dvh,900px)] sm:w-[min(680px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:shadow-xl"
        onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
        onCloseAutoFocus={(event) => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); }}
        onEscapeKeyDown={(event) => { if (pending || catalogOpen) event.preventDefault(); }} onInteractOutside={(event) => { if (pending || catalogOpen) event.preventDefault(); }}>
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2 sm:px-5"><div className="min-w-0 flex-1"><Dialog.Title className="text-base font-bold">{p.title}</Dialog.Title><Dialog.Description className="text-xs text-muted-foreground">{side === "factory" ? c.factory : c.field}</Dialog.Description></div><Dialog.Close asChild><button type="button" disabled={pending} aria-label={c.close} className="grid size-11 place-items-center rounded-xl outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50"><X className="size-5" /></button></Dialog.Close></div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); apply(); }}>
            <div><p className="text-sm font-semibold">{p.scope.replace("{count}", String(count))}</p><p className="mt-1 break-words text-xs text-muted-foreground">{snapshot.materials.slice(0, 8).map((element) => element.mark).join(" · ")}{count > 8 ? ` · +${count - 8}` : ""}</p></div>
            {scopeError ? <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">{scopeError}</p> : null}
            {snapshot.mixed ? <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">{p.mixed}</p> : snapshot.hasLegacy ? <p className="text-xs text-muted-foreground">{p.legacy}</p> : null}
            <div className="flex flex-wrap justify-between gap-2"><button ref={catalogTrigger} type="button" disabled={pending} onClick={() => setCatalogOpen(true)} className={button}><Settings2 className="size-4" />{p.manage}</button><button type="button" disabled={pending || selected.length === 0} onClick={() => { setSelected([]); setError(null); }} className={`${button} border-transparent text-muted-foreground`}>{p.clear}</button></div>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {choices.map(({ key, definition }) => {
                const retainedEverywhere = snapshot.effective.every((keys) => keys.includes(key));
                const unavailable = Boolean(definition?.archivedAt) && !retainedEverywhere;
                return <li key={key}><label className={`flex min-h-16 items-center gap-3 p-2 sm:p-3 ${unavailable ? "opacity-60" : "cursor-pointer"}`}>
                  <span className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center"><input type="checkbox" className="size-5 accent-orange-600" checked={selected.includes(key)} disabled={pending || Boolean(scopeError) || unavailable} onChange={(event) => { setSelected((prior) => event.target.checked ? [...prior, key] : prior.filter((stage) => stage !== key)); setError(null); }} /></span>
                  <span className="block h-[48px] w-[64px] shrink-0 overflow-hidden rounded-lg bg-muted"><SteelWorkVisual definition={definition} fallback={key} /></span>
                  <span className="min-w-0 flex-1"><span className="flex items-center gap-2 break-words text-sm font-semibold">{selected.includes(key) ? <span className="grid size-6 shrink-0 place-items-center rounded-full bg-orange-600 text-xs font-bold tabular-nums text-white">{selected.indexOf(key) + 1}</span> : null}<span className="min-w-0">{label(key, definition)}</span></span>{definition?.description ? <span className="block text-xs text-muted-foreground">{definition.description}</span> : null}{definition?.archivedAt ? <span className="block text-xs text-muted-foreground">{unavailable ? p.retained : p.archived}</span> : null}</span>
                </label></li>;
              })}
              {!choices.length ? <li className="p-5 text-center text-sm text-muted-foreground">{c.empty}</li> : null}
            </ul>
            {selected.length === 0 ? <p className="text-sm text-muted-foreground">{p.empty}</p> : null}
            {snapshot.mixed ? <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3"><input type="checkbox" checked={replaceConfirmed} disabled={pending || Boolean(scopeError)} onChange={(event) => setReplaceConfirmed(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-orange-600" /><span className="text-sm font-semibold">{p.replace.replace("{count}", String(count))}</span></label> : null}
            {error ? <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><button type="button" disabled={pending} onClick={() => onOpenChange(false)} className={button}>{c.cancel}</button><button type="submit" disabled={pending || Boolean(scopeError) || selected.length > 80 || snapshot.mixed && !replaceConfirmed} className={`${button} border-orange-600 bg-orange-600 text-white hover:bg-orange-700`}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{pending ? c.saving : p.apply}</button></div>
          </form>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
    <SteelWorkCatalog open={catalogOpen} onOpenChange={setCatalogOpen} kind={side} siteId={siteId} definitions={definitions} onChanged={() => router.refresh()} returnFocusRef={catalogTrigger} />
  </Dialog.Root>;
}
