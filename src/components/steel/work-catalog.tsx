"use client";

/* eslint-disable @next/next/no-img-element */
import * as Dialog from "@radix-ui/react-dialog";
import { Archive, ArrowLeft, Camera, Check, ImagePlus, Loader2, PenLine, Plus, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition, type RefObject } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { SteelPhaseArt } from "@/components/steel/steel-art";
import { workCatalogCopy } from "@/components/steel/work-catalog-copy";
import { steelWorkArtKey, steelWorkLabel } from "@/components/steel/work-catalog-label";
import { FIELD_STAGES, sideOfStage } from "@/lib/elements/stages";
import { t } from "@/lib/i18n";
import { STEEL_PHASE_GROUPS, steelPhaseGroup, type SteelPhaseGroup, type SteelWorkDefinitionView } from "@/lib/steel-work/types";
import {
  archiveSteelWorkDefinitionAction,
  getSteelWorkCatalogAction,
  saveSteelWorkDefinitionAction,
  setSteelTaskSelectionAction,
} from "@/app/(workzone)/workzone/steel-catalog-actions";
import { generateSteelWorkVisualAction, uploadSteelWorkVisualAction } from "@/app/(workzone)/workzone/steel-visual-actions";

type Kind = "site" | "factory" | "field";
type Editor = { definition: SteelWorkDefinitionView | null; label: string; inheritedLabel: string | null; description: string; linkedProcessKey: string; linkedList: "assembly" | "part" | "all"; linkedKind: string; phaseGroup: SteelPhaseGroup };
type CatalogProps = {
  open: boolean; onOpenChange: (open: boolean) => void; kind: Kind; siteId?: string; definitions?: SteelWorkDefinitionView[];
  canManage?: boolean; initialDefinitionId?: string | null; onChanged?: () => void;
  /** Site tasks: the window (Punime b/a, Prodhimi, Montimi) the catalog was opened from. */
  group?: SteelPhaseGroup | null;
  returnFocusRef?: RefObject<HTMLElement | null>;
};
const control = "h-11 rounded-xl border bg-card px-3 text-sm font-semibold outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50";
const iconControl = "grid size-[44px] shrink-0 place-items-center rounded-xl outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50";
const input = "min-h-11 w-full min-w-0 rounded-xl border-2 bg-background px-3 text-base outline-none focus:border-orange-500 disabled:opacity-50";

export function steelWorkVisualUrl(definition: Pick<SteelWorkDefinitionView, "id" | "visualUpdatedAt">) {
  return definition.visualUpdatedAt ? `/api/steel-work-visuals/${definition.id}?v=${new Date(definition.visualUpdatedAt).getTime()}` : null;
}

/** Photo or trusted generated image; the existing steel drawing is always a safe fallback. */
export function SteelWorkVisual({ definition, fallback, src, animate = false, className = "h-full w-full", imageClassName }: {
  definition?: SteelWorkDefinitionView | null; fallback?: string; src?: string | null; animate?: boolean; className?: string; imageClassName?: string;
}) {
  const url = src ?? (definition ? steelWorkVisualUrl(definition) : null);
  const { currentLang } = useLanguage();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const fit = src || definition?.visualStatus === "photo" ? "object-cover" : "object-contain";
  return <div className={`relative isolate overflow-hidden ${className}`} data-steel-work-visual>
    {url && failedUrl !== url ? <img src={url} alt={definition ? steelWorkLabel(definition, currentLang) : ""} onError={() => setFailedUrl(url)} className={imageClassName ?? `h-full w-full ${fit}`} /> : <SteelPhaseArt phase={steelWorkArtKey(definition?.linkedProcessKey ?? fallback ?? definition?.key)} animate={animate} className="h-full w-full p-[8px]" />}
  </div>;
}

function processLabel(key: string, lang: string) {
  return t((FIELD_STAGES as readonly string[]).includes(key) ? `elements.fieldStages.${key}` : `factory.steps.${key}`, lang);
}

export function SteelWorkCatalog(props: CatalogProps) {
  return props.open ? <SteelWorkCatalogSession {...props} /> : null;
}

function SteelWorkCatalogSession({ open, onOpenChange, kind, siteId, definitions = [], canManage = true, initialDefinitionId, onChanged, returnFocusRef, group = null }: CatalogProps) {
  const { currentLang: lang } = useLanguage();
  const c = workCatalogCopy(lang);
  const [items, setItems] = useState(definitions);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [pending, start] = useTransition();
  const epoch = useRef(0);
  const camera = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const clearFile = useCallback(() => { setFile(null); setPreview(null); }, []);

  const edit = useCallback((definition: SteelWorkDefinitionView | null) => {
    const label = definition ? steelWorkLabel(definition, lang) : "";
    setEditor({ definition, label, inheritedLabel: definition && !definition.label.trim() ? label : null, description: definition?.description ?? "", linkedProcessKey: definition?.linkedProcessKey ?? "", linkedList: definition?.linkedProcessKey ? definition.linkedList ?? "all" : "assembly", linkedKind: definition?.linkedKind ?? "", phaseGroup: definition ? steelPhaseGroup(definition.phaseGroup) : group ?? "assembly" });
    clearFile(); setError(null); setNotice(null); setArchiveConfirm(false);
  }, [clearFile, lang, group]);

  const load = useCallback(async (requestEpoch: number) => {
    setLoading(true);
    try {
      const result = await getSteelWorkCatalogAction({ siteId });
      if (requestEpoch !== epoch.current) return null;
      if (!result.ok || !result.definitions) { setLoaded(false); setError(c.loadError); return null; }
      setItems(result.definitions); setLoaded(true);
      return result.definitions;
    } catch {
      if (requestEpoch === epoch.current) { setLoaded(false); setError(c.loadError); }
      return null;
    } finally { if (requestEpoch === epoch.current) setLoading(false); }
  }, [siteId, c.loadError]);

  useEffect(() => {
    const current = ++epoch.current;
    void load(current).then((fresh) => {
      if (fresh && current === epoch.current && initialDefinitionId) {
        const selected = fresh.find((item) => item.id === initialDefinitionId && item.kind === kind);
        if (selected) edit(selected);
      }
    });
    return () => { epoch.current += 1; };
  }, [kind, load, edit, initialDefinitionId]);

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  function choose(selected?: File) {
    if (!selected) return;
    if (!selected.size || selected.size > 12_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(selected.type)) { setError(c.imageInvalid); return; }
    setFile(selected); setPreview(URL.createObjectURL(selected)); setError(null);
  }

  function refreshAfterChange(current: number) {
    onChanged?.();
    return load(current);
  }

  function select(definition: SteelWorkDefinitionView, enabled: boolean) {
    if (!siteId || pending || !loaded) return;
    const current = epoch.current; setError(null); setNotice(null);
    start(async () => {
      try {
        const result = await setSteelTaskSelectionAction({ siteId, definitionId: definition.id, enabled, revision: definition.selectionRevision });
        if (current !== epoch.current) { onChanged?.(); return; }
        if (!result.ok) { setError(result.message || c.error); return; }
        await refreshAfterChange(current);
      } catch { if (current === epoch.current) setError(c.error); }
    });
  }

  function archive(definition: SteelWorkDefinitionView, archived: boolean) {
    const current = epoch.current; setError(null); setNotice(null);
    start(async () => {
      try {
        const result = await archiveSteelWorkDefinitionAction({ definitionId: definition.id, revision: definition.revision, archived });
        if (current !== epoch.current) { onChanged?.(); return; }
        if (!result.ok) { setError(result.message || c.error); return; }
        setEditor(null); setArchiveConfirm(false); clearFile(); setNotice(c.saved);
        await refreshAfterChange(current);
      } catch { if (current === epoch.current) setError(c.error); }
    });
  }

  function save(regenerate = false) {
    if (!editor || !loaded || pending) return;
    const draft = editor, photo = file, current = epoch.current;
    if (!draft.label.trim()) { setError(c.required); return; }
    setError(null); setNotice(null);
    start(async () => {
      try {
        const result = await saveSteelWorkDefinitionAction({
          id: draft.definition?.id, siteId, kind, label: draft.inheritedLabel === draft.label.trim() ? "" : draft.label.trim(), description: draft.description.trim(), revision: draft.definition?.revision,
          ...(kind === "site" ? { linkedProcessKey: draft.linkedProcessKey || null, linkedList: draft.linkedProcessKey ? draft.linkedList : null, linkedKind: draft.linkedProcessKey ? draft.linkedKind || null : null, phaseGroup: draft.phaseGroup } : {}),
        });
        if (!result.ok || !result.definitionId || result.revision === undefined) { if (current === epoch.current) setError(result.message || c.error); return; }
        let mediaNotice: string | null = null;
        if (photo) {
          const form = new FormData(); form.set("definitionId", result.definitionId); form.set("revision", String(result.revision)); form.set("file", photo);
          try { if (!(await uploadSteelWorkVisualAction(form)).ok) mediaNotice = c.imageError; } catch { mediaNotice = c.imageError; }
        } else if ((result.artNeeded || regenerate) && draft.definition?.visualStatus !== "photo") {
          if (current === epoch.current) setNotice(c.imagePending);
          try {
            const visual = await generateSteelWorkVisualAction({ definitionId: result.definitionId, revision: result.revision });
            if (!visual.ok || visual.status === "error" || visual.status === "fallback") mediaNotice = visual.status === "quota" ? visual.message : c.imageFallback;
          } catch { mediaNotice = c.imageFallback; }
        }
        onChanged?.();
        if (current !== epoch.current) return;
        const fresh = await load(current);
        if (current !== epoch.current) return;
        setNotice(mediaNotice ?? c.saved);
        // Keep a failed upload editable; saving again reuses this definition, never creates a duplicate.
        if (mediaNotice === c.imageError) {
          const saved = fresh?.find((item) => item.id === result.definitionId);
          setEditor({ ...draft, definition: saved ?? {
            id: result.definitionId, key: result.key ?? draft.definition?.key ?? "task", kind,
            label: draft.inheritedLabel === draft.label.trim() ? "" : draft.label.trim(), description: draft.description.trim(), sortOrder: draft.definition?.sortOrder ?? 0,
            revision: result.revision, archivedAt: draft.definition?.archivedAt ?? null,
            linkedProcessKey: draft.linkedProcessKey || null, linkedList: draft.linkedProcessKey && draft.linkedList !== "all" ? draft.linkedList : null, linkedKind: draft.linkedProcessKey ? draft.linkedKind || null : null, phaseGroup: draft.phaseGroup,
            visualUpdatedAt: draft.definition?.visualUpdatedAt ?? null, visualStatus: draft.definition?.visualStatus ?? "fallback",
          } });
        } else { setEditor(null); clearFile(); }
      } catch { if (current === epoch.current) setError(c.error); }
    });
  }

  // Chosen phases are numbered in the order they appear on the site board.

  const order = new Map([...items].filter((item) => item.kind === "site" && item.enabled && !item.archivedAt).sort((a, b) => (a.selectionPosition ?? 10_000 + a.sortOrder) - (b.selectionPosition ?? 10_000 + b.sortOrder)).map((item, index) => [item.id, index + 1]));

  const rows = items.filter((item) => item.kind === kind && (kind !== "site" || !group || steelPhaseGroup(item.phaseGroup) === group) && Boolean(item.archivedAt) === showArchived && `${steelWorkLabel(item, lang)} ${item.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const availableProcesses = items.filter((definition) => definition.kind !== "site" && (!definition.archivedAt || definition.key === editor?.linkedProcessKey));
  const availableStages = [...new Set([...availableProcesses.map((definition) => definition.key), ...(editor?.linkedProcessKey ? [editor.linkedProcessKey] : [])])];
  const linkedProcessLabel = (key: string) => {
    const definition = items.find((item) => item.kind !== "site" && item.key === key);
    return definition ? steelWorkLabel(definition, lang) : processLabel(key, lang);
  };
  const isField = editor ? sideOfStage(editor.linkedProcessKey) === "field" : false;
  const heading = kind === "site" ? c.site : kind === "factory" ? c.factory : c.field;

  return <Dialog.Root open={open} onOpenChange={(value) => { if (!pending) onOpenChange(value); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[1300] bg-black/45" />
      <Dialog.Content className="fixed inset-0 z-[1301] flex min-h-0 flex-col bg-background text-foreground outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(90dvh,900px)] sm:w-[min(720px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:shadow-xl"
        onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
        onCloseAutoFocus={(event) => { event.preventDefault(); const target = returnFocusRef?.current?.isConnected ? returnFocusRef.current : opener.current?.isConnected && opener.current !== document.body ? opener.current : null; target?.focus({ preventScroll: true }); }}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }} onInteractOutside={(event) => { if (pending) event.preventDefault(); }}>
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2 sm:px-5">
          {editor ? <button type="button" disabled={pending} onClick={() => { setEditor(null); clearFile(); setError(null); setArchiveConfirm(false); }} aria-label={c.back} className={iconControl}><ArrowLeft className="size-5" /></button> : null}
          <div className="min-w-0 flex-1"><Dialog.Title className="text-base font-bold">{editor ? editor.definition ? c.edit : kind === "site" ? c.add : c.addProcess : heading}</Dialog.Title><Dialog.Description className="text-xs text-muted-foreground">{c.title}</Dialog.Description></div>
          <Dialog.Close asChild><button type="button" disabled={pending} aria-label={c.close} className={iconControl}><X className="size-5" /></button></Dialog.Close>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
          {error ? <div role="alert" className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}{!loaded ? <button type="button" disabled={loading} className="ml-2 min-h-11 underline" onClick={() => { setError(null); void load(epoch.current); }}>{c.retry}</button> : null}</div> : null}
          {notice ? <p role="status" className="mb-3 text-sm text-muted-foreground">{notice}</p> : null}
          {loading && !loaded ? <div className="flex min-h-32 items-center justify-center" role="status"><Loader2 className="size-6 animate-spin" aria-label={c.saving} /></div> : editor ? <form onSubmit={(event) => { event.preventDefault(); save(); }} className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl border bg-gradient-to-br from-slate-100 to-orange-50 dark:from-slate-800 dark:to-slate-950"><SteelWorkVisual definition={editor.definition} src={preview} fallback={editor.linkedProcessKey || editor.definition?.key} /></div>
              {canManage ? <div className="min-w-[min(100%,10rem)] flex-1"><div className="flex flex-wrap gap-1"><button type="button" disabled={pending} onClick={() => camera.current?.click()} className={iconControl} aria-label={c.camera} title={c.camera}><Camera className="size-5" /></button><button type="button" disabled={pending} onClick={() => upload.current?.click()} className={iconControl} aria-label={c.upload} title={c.upload}><ImagePlus className="size-5" /></button>{file ? <button type="button" disabled={pending} onClick={clearFile} className={iconControl} aria-label={c.clearPhoto} title={c.clearPhoto}><X className="size-4" /></button> : editor.definition && editor.definition.visualStatus !== "photo" ? <button type="button" disabled={pending || !loaded || !editor.label.trim()} onClick={() => save(true)} className={iconControl} aria-label={c.generate} title={c.generate}>{pending ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}</button> : null}</div><p className="break-words text-xs text-muted-foreground">{file?.name ?? c.photoHint}</p></div> : null}
            </div>
            <label className="block space-y-1.5"><span className="text-sm font-semibold">{c.name}</span><input autoFocus required maxLength={80} value={editor.label} disabled={pending || !canManage} onChange={(event) => setEditor({ ...editor, label: event.target.value })} className={input} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-semibold">{c.description}</span><textarea maxLength={500} rows={2} value={editor.description} disabled={pending || !canManage} onChange={(event) => setEditor({ ...editor, description: event.target.value })} className={`${input} resize-y py-2`} /></label>
            {kind === "site" ? <label className="block space-y-1.5"><span className="text-sm font-semibold">{t("steel.groupLabel", lang)}</span><select value={editor.phaseGroup} disabled={pending || !canManage} onChange={(event) => setEditor({ ...editor, phaseGroup: steelPhaseGroup(event.target.value) })} className={input}>{STEEL_PHASE_GROUPS.map((key) => <option key={key} value={key}>{t(key === "concrete" ? "steel.groupConcrete" : key === "production" ? "steel.groupProduction" : "steel.groupAssembly", lang)}</option>)}</select></label> : null}
            {kind === "site" ? <div className="space-y-3 border-t pt-4">
              <label className="block space-y-1.5"><span className="text-sm font-semibold">{c.link}</span><select value={editor.linkedProcessKey} disabled={pending || !canManage} onChange={(event) => setEditor({ ...editor, linkedProcessKey: event.target.value, linkedList: sideOfStage(event.target.value) === "field" ? "assembly" : editor.linkedList })} className={input}><option value="">{c.manual}</option>{availableStages.map((stage) => <option key={stage} value={stage}>{c.automatic} · {linkedProcessLabel(stage)}</option>)}</select></label>
              {editor.linkedProcessKey ? <><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block space-y-1.5"><span className="text-sm font-semibold">{c.list}</span><select value={editor.linkedList} disabled={pending || !canManage || isField} onChange={(event) => setEditor({ ...editor, linkedList: event.target.value as "assembly" | "part" | "all" })} className={input}>{!isField ? <option value="all">{c.allLists}</option> : null}<option value="assembly">{c.assembly}</option>{!isField ? <option value="part">{c.part}</option> : null}</select></label><label className="block space-y-1.5"><span className="text-sm font-semibold">{c.kind}</span><select value={editor.linkedKind} disabled={pending || !canManage} onChange={(event) => setEditor({ ...editor, linkedKind: event.target.value })} className={input}><option value="">{c.allKinds}</option><option value="BEAM">{c.beam}</option><option value="COLUMN">{c.column}</option>{editor.linkedKind && !["BEAM", "COLUMN"].includes(editor.linkedKind) ? <option value={editor.linkedKind}>{editor.linkedKind}</option> : null}</select></label></div><p className="text-xs text-muted-foreground">{c.linkHint}</p></> : null}
            </div> : null}
            {canManage ? <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4"><button type="button" disabled={pending} onClick={() => { setEditor(null); clearFile(); }} className={control}>{c.cancel}</button><button type="submit" disabled={pending || !loaded || !editor.label.trim()} className={`${control} inline-flex items-center gap-2 border-orange-600 bg-orange-600 text-white hover:bg-orange-700`}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{pending ? c.saving : c.save}</button></div> : null}
            {editor.definition && canManage ? <div className="border-t pt-3">{archiveConfirm ? <div className="space-y-2 rounded-xl border border-amber-500/40 p-3"><p className="text-sm font-semibold">{c.archiveConfirm}</p><p className="text-xs text-muted-foreground">{c.archiveHint}</p><div className="flex flex-wrap gap-2"><button type="button" disabled={pending} onClick={() => setArchiveConfirm(false)} className={control}>{c.cancel}</button><button type="button" disabled={pending} onClick={() => archive(editor.definition!, true)} className={`${control} text-red-700 dark:text-red-300`}>{c.archive}</button></div></div> : <button type="button" disabled={pending} onClick={() => editor.definition?.archivedAt ? archive(editor.definition, false) : setArchiveConfirm(true)} className={`${control} inline-flex items-center gap-2 border-transparent text-muted-foreground`}>{editor.definition.archivedAt ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}{editor.definition.archivedAt ? c.restore : c.archive}</button>}</div> : null}
          </form> : <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{kind === "site" ? c.hint : c.processHint}</p>
            <div className="flex flex-wrap gap-2"><label className="relative min-w-[min(100%,10rem)] flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.search} aria-label={c.search} className={`${input} pl-9`} /></label>{canManage ? <button type="button" disabled={!loaded || pending} onClick={() => edit(null)} className={`${control} inline-flex items-center gap-2`}><Plus className="size-4" />{kind === "site" ? c.add : c.addProcess}</button> : null}</div>
            <button type="button" onClick={() => setShowArchived(!showArchived)} aria-pressed={showArchived} className={`${control} inline-flex items-center gap-2 ${showArchived ? "border-orange-500 text-orange-700 dark:text-orange-300" : "border-transparent text-muted-foreground"}`}><Archive className="size-4" />{c.archived}</button>
            <ul className="divide-y rounded-2xl border bg-card">
              {rows.map((definition) => <li key={definition.id} className="flex min-w-0 items-center gap-2 p-2 sm:gap-3 sm:p-3">
                {kind === "site" && siteId && !showArchived ? <label className="grid min-h-[44px] min-w-[44px] shrink-0 cursor-pointer place-items-center"><input type="checkbox" checked={Boolean(definition.enabled)} disabled={pending || !loaded || !canManage} onChange={(event) => select(definition, event.target.checked)} aria-label={`${c.select}: ${steelWorkLabel(definition, lang)}`} className="size-5 accent-orange-600" /></label> : null}
                <div className="relative h-10 w-12 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-[56px] sm:w-[74px]"><SteelWorkVisual definition={definition} />{kind === "site" && siteId && definition.enabled && order.has(definition.id) ? <span className="absolute bottom-0 right-0 grid size-5 place-items-center rounded-tl-lg bg-orange-600 text-[10px] font-bold tabular-nums text-white" title={c.select}>{order.get(definition.id)}</span> : null}</div>
                <div className="min-w-0 flex-1"><div className="break-words text-sm font-semibold">{steelWorkLabel(definition, lang)}</div>{definition.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{definition.description}</p> : null}{definition.linkedProcessKey ? <p className="mt-0.5 break-words text-xs text-muted-foreground">{c.fromMaterials} · {linkedProcessLabel(definition.linkedProcessKey)}</p> : null}{definition.visualStatus === "pending" ? <p className="text-xs text-muted-foreground">{c.imagePending}</p> : null}</div>
                {canManage ? <button type="button" disabled={pending || !loaded} onClick={() => edit(definition)} className={iconControl} aria-label={`${c.edit}: ${steelWorkLabel(definition, lang)}`} title={c.edit}><PenLine className="size-4" /></button> : null}
              </li>)}
              {!rows.length ? <li className="p-6 text-center text-sm text-muted-foreground">{query ? c.noResults : c.empty}</li> : null}
            </ul>
            {kind === "site" && siteId ? <p className="text-xs text-muted-foreground">{c.selectionHint}</p> : null}
          </div>}
          <input ref={camera} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ""; }} />
          <input ref={upload} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ""; }} />
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
