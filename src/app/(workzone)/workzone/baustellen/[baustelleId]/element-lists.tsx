"use client";

import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import { ArrowLeft, Check, CheckCheck, ChevronRight, Factory, FileSpreadsheet, HardHat, Loader2, Lock, Minus, RotateCcw, Search, Trash2, UploadCloud, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import Image from 'next/image';
import { SlidersHorizontal } from 'lucide-react';
import { ElementProcessEditor } from '@/components/steel/element-process-editor';
import { AssetWorkspaceDialog } from '@/components/company-assets/workspace-dialog';
import { elementImportCopy } from '@/components/steel/element-import-copy';
import type { SteelWorkDefinitionView } from '@/lib/steel-work/types';
import { readProcessRoutes } from '@/lib/elements/stages';

import { AccessKeyButton } from '@/components/access/access-key-button';
import { useLanguage } from "@/components/i18n/language-provider";
import { capFor, CREW_FOR_SIDE, doneQty, elementStatus, onFieldList, routeClosed, routeStages, sideOfStage, stagePieces, stageProgress, stageRemaining, stagesFor, type ElementList, type ElementSide } from "@/lib/elements/stages";
import { formatAmount, formatShortDate } from "@/lib/factory/production";
import { t } from "@/lib/i18n";

import { addElementWorkAction, deleteElementSourceAction, importElementListsAction, removeElementWorkAction, setElementDoneAction } from "../../element-actions";
import { Sheet } from "../../production/production-ui";

export type ElementWorkView = {
  id: string;
  stage: string;
  pieces: number;
  workerIds: string[];
  workerNames: string;
  checkedByName: string;
  checkedAt: string;
};

export type ElementView = {
  id: string;
  list: ElementList;
  mark: string;
  kind: string | null;
  profile: string | null;
  material: string | null;
  quantity: number;
  lengthMm: number | null;
  weightKg: number | null;
  areaM2: number | null;
  factoryDoneAt: string | null;
  factoryDoneBy: string | null;
  fieldDoneAt: string | null;
  fieldDoneBy: string | null;
  processRoutes?: unknown;
  processRevision?: number;
  /** The drawing-office file this element came from. */
  sourceFile?: string | null;
  work: ElementWorkView[];
};

export type ElementWorkerOption = { id: string; name: string; crewRole: string | null };

type Filter = "all" | "waiting" | "working" | "done" | "factory" | "COLUMN" | "BEAM";
type Status = "waiting" | "working" | "done";

const STATUS_STYLE: Record<Status, { badge: string; pill: string }> = {
  waiting: { badge: "bg-muted text-foreground", pill: "bg-muted text-muted-foreground" },
  working: { badge: "bg-orange-500 text-white", pill: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  done: { badge: "bg-green-600 text-white", pill: "bg-green-600/15 text-green-700 dark:text-green-300" },
};

function stageLabel(stage: string, lang: string, definitions: SteelWorkDefinitionView[] = []) {
  const definition = definitions.find(definition => definition.key === stage);
  return definition?.label || (sideOfStage(stage) === "field" ? t(`elements.fieldStages.${stage}`, lang) : t(`factory.steps.${stage}`, lang));
}

const processButton = (lang: string) => ({ sq: 'Proceset', en: 'Processes', de: 'Prozesse', it: 'Processi', ro: 'Procese', pl: 'Procesy' })[lang] ?? 'Processes';

function statusLabel(status: Status, lang: string) {
  return status === "done" ? t("elements.statusDone", lang) : status === "working" ? t("elements.statusWorking", lang) : t("elements.statusWaiting", lang);
}

function kindLabel(kind: string | null, lang: string) {
  if (!kind) return null;
  if (kind === "COLUMN") return t("elements.column", lang);
  if (kind === "BEAM") return t("elements.beam", lang);
  return kind;
}

function kg(value: number) {
  return value >= 100 ? formatAmount(value) : String(Math.round(value * 10) / 10).replace(".", ",");
}

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);

/**
 * Two buttons on the steel site. Factory list: the factory engineer opens an
 * element, picks a step, picks the factory workers who did it and confirms;
 * when the element needs no more steps they close it. Closed elements move to
 * the field list, where the field engineer does the same for the site work.
 */
export function ElementListButtons({
  site,
  elements,
  workers,
  can,
  definitions = [],
}: {
  site: { id: string; name: string };
  elements: ElementView[];
  workers: ElementWorkerOption[];
  can: { factory: boolean; field: boolean; office: boolean;upload?:boolean; seeFactory?: boolean; seeField?: boolean };
  definitions?: SteelWorkDefinitionView[];
}) {
  const { currentLang: lang } = useLanguage();
  const [open, setOpen] = useState<ElementSide | null>(null);
  const [items, setItems] = useState(elements);
  const [synced, setSynced] = useState(elements);
  if (synced !== elements) {
    setSynced(elements);
    setItems(elements);
  }

  const assemblies = items.filter((element) => element.list === "assembly");
  const sum = (count: (element: ElementView) => number) => assemblies.reduce((total, element) => total + count(element), 0);
  const allPieces = sum((element) => element.quantity);
  const factoryDone = sum((element) => doneQty(element, "factory"));
  const fieldDone = sum((element) => doneQty(element, "field"));

  if (items.length === 0 && !(can.upload??can.office)) return null;

  const buttons: Array<{ side: ElementSide; label: string; sub: string; pct: number; icon: React.ReactNode }> = [
    {
      side: "factory",
      label: t("elements.factoryList", lang),
      sub: assemblies.length ? fill(t("elements.doneOf", lang), { done: factoryDone, total: allPieces }) : t("elements.noList", lang),
      pct: allPieces ? (factoryDone / allPieces) * 100 : 0,
      icon: <Factory className="size-6" />,
    },
    {
      side: "field",
      label: t("elements.fieldList", lang),
      sub: assemblies.length ? fill(t("elements.fieldButton", lang), { done: fieldDone, total: factoryDone, waiting: allPieces - factoryDone }) : t("elements.noList", lang),
      pct: allPieces ? (fieldDone / allPieces) * 100 : 0,
      icon: <HardHat className="size-6" />,
    },
  ];

  const visible = buttons.filter((button) => (button.side === "factory" ? can.seeFactory : can.seeField) !== false);
  if (visible.length === 0) return null;

  return (
    <>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {visible.map((button) => (
          <div key={button.side} className="flex min-w-0 items-stretch gap-1.5">
          <button
            type="button"
            onClick={() => setOpen(button.side)}
            className="relative flex min-h-[64px] min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-2xl bg-orange-600 px-3 py-2.5 text-left text-white shadow-md active:scale-[0.98]"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15">{button.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-bold leading-tight">{button.label}</span>
              <span className="block truncate text-xs tabular-nums text-white/85">{button.sub}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 opacity-80" />
            <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
              <span className="block h-full bg-white" style={{ width: `${Math.round(button.pct)}%` }} />
            </span>
          </button>
          {/* Who sees and who works on this list, at this site (admins only). */}
          <AccessKeyButton place={button.side} scopeId={site.id} label={button.label} className="shrink-0 justify-center" />
          </div>
        ))}
      </div>
      <AnimatePresence>
        {open ? (
          <ElementListSheet
            key={open}
            side={open}
            site={site}
            items={items}
            setItems={setItems}
            workers={workers}
            canEdit={open === "factory" ? can.factory : can.field}
            canImport={can.upload??can.office}
            canDeleteSource={Boolean(can.upload ?? can.office) || can.factory}
            canPlan={can.office || can.factory || can.field}
            definitions={definitions}
            onClose={() => setOpen(null)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

type View = { kind: "list" } | { kind: "element"; id: string } | { kind: "stage"; id: string; stage: string };

/** Exiting views keep their animation, but their previous actions are no longer available. */
function AnimatedElementView({ isList, children }: { isList: boolean; children: ReactNode }) {
  const isPresent = useIsPresent();
  return <motion.div
    inert={!isPresent}
    aria-hidden={!isPresent || undefined}
    initial={{ opacity: 0, x: isList ? -16 : 16 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.16 }}
    className="space-y-3"
  >{children}</motion.div>;
}

function ElementListSheet({
  side,
  site,
  items,
  setItems,
  workers,
  canEdit,
  canImport,
  canDeleteSource,
  canPlan,
  definitions,
  onClose,
}: {
  side: ElementSide;
  site: { id: string; name: string };
  items: ElementView[];
  setItems: React.Dispatch<React.SetStateAction<ElementView[]>>;
  workers: ElementWorkerOption[];
  canEdit: boolean;
  canImport: boolean;
  /** Trash per list file: who may import, or who acts on the factory list (Megi, Silvi). */
  canDeleteSource: boolean;
  canPlan: boolean;
  definitions: SteelWorkDefinitionView[];
  onClose: () => void;
}) {
  const { currentLang: lang } = useLanguage();
  const [view, setView] = useState<View>({ kind: "list" });
  const [list, setList] = useState<ElementList>("assembly");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [processTarget, setProcessTarget] = useState<ElementView[] | null>(null);
  // The crew picked last per step, offered again on the next element.
  const lastPick = useRef<Record<string, string[]>>({});

  const title = side === "factory" ? t("elements.factoryList", lang) : t("elements.fieldList", lang);
  const current = view.kind === "list" ? null : items.find((element) => element.id === view.id) ?? null;
  const label = current ? `${current.mark} · ${title}` : `${title} · ${site.name}`;

  function patch(id: string, change: (element: ElementView) => ElementView) {
    setItems((all) => all.map((element) => (element.id === id ? change(element) : element)));
  }

  return (
    <Sheet onClose={onClose} label={label} closeLabel={t("factory.close", lang)}>
      <AnimatePresence mode="wait" initial={false}>
        <AnimatedElementView
          key={view.kind === "list" ? "list" : view.kind === "element" ? `e-${view.id}` : `s-${view.id}-${view.stage}`}
          isList={view.kind === "list"}
        >
          {view.kind === "list" || !current ? (
            <ListView
              side={side}
              site={site}
              items={items}
              setItems={setItems}
              list={list}
              setList={setList}
              filter={filter}
              setFilter={setFilter}
              query={query}
              setQuery={setQuery}
              canImport={canImport}
              canDeleteSource={canDeleteSource}
              canPlan={canPlan}
              definitions={definitions}
              onProcesses={(elements) => setProcessTarget(elements)}
              onOpen={(id) => setView({ kind: "element", id })}
            />
          ) : view.kind === "element" ? (
            <ElementDetail
              element={current}
              side={side}
              canEdit={canEdit && (side === 'factory' || onFieldList(current))}
              definitions={definitions}
              onProcesses={canPlan ? () => setProcessTarget([current]) : undefined}
              onBack={() => setView({ kind: "list" })}
              onStage={(stage) => setView({ kind: "stage", id: current.id, stage })}
              onDone={(doneAt, doneBy) =>
                patch(current.id, (element) =>
                  side === "factory" ? { ...element, factoryDoneAt: doneAt, factoryDoneBy: doneBy } : { ...element, fieldDoneAt: doneAt, fieldDoneBy: doneBy },
                )
              }
            />
          ) : (
            <StageView
              key={`${current.id}-${view.stage}-${current.work.length}`}
              element={current}
              stage={view.stage}
              side={side}
              canEdit={canEdit && stagesFor(side, current.list, current.processRoutes).includes(view.stage) && (side === 'factory' || onFieldList(current))}
              workers={workers}
              definitions={definitions}
              lastPick={lastPick}
              onBack={() => setView({ kind: "element", id: current.id })}
              onAdded={(work) => {
                patch(current.id, (element) => ({ ...element, work: [...element.work, work] }));
                setView({ kind: "element", id: current.id });
              }}
              onRemoved={(workId) => patch(current.id, (element) => ({ ...element, work: element.work.filter((entry) => entry.id !== workId) }))}
            />
          )}
        </AnimatedElementView>
      </AnimatePresence>
      <ElementProcessEditor open={processTarget !== null} onOpenChange={open => { if (!open) setProcessTarget(null); }} siteId={site.id} side={side}
        elements={(processTarget ?? []).map(target => items.find(item => item.id === target.id) ?? target)} definitions={definitions}
        onApplied={(stages, revisions) => {
          const ids = new Set(processTarget?.map(element => element.id));
          setItems(all => all.map(element => ids.has(element.id) ? { ...element, processRoutes: { ...(readProcessRoutes(element.processRoutes) ?? { v: 1, factory: null, field: null }), [side]: stages }, processRevision: revisions[element.id] ?? element.processRevision } : element));
        }} />
    </Sheet>
  );
}

function ListView({
  side,
  site,
  items,
  setItems,
  list,
  setList,
  filter,
  setFilter,
  query,
  setQuery,
  canImport,
  canDeleteSource,
  canPlan,
  definitions,
  onProcesses,
  onOpen,
}: {
  side: ElementSide;
  site: { id: string; name: string };
  items: ElementView[];
  setItems: React.Dispatch<React.SetStateAction<ElementView[]>>;
  list: ElementList;
  setList: (list: ElementList) => void;
  filter: Filter;
  setFilter: (filter: Filter) => void;
  query: string;
  setQuery: (query: string) => void;
  canImport: boolean;
  canDeleteSource: boolean;
  canPlan: boolean;
  definitions: SteelWorkDefinitionView[];
  onProcesses: (elements: ElementView[]) => void;
  onOpen: (id: string) => void;
}) {
  const { currentLang: lang } = useLanguage();
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [importing, startImport] = useTransition();
  const [configureAfterImport, setConfigureAfterImport] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'snapshot'>('merge');
  const importCopy = elementImportCopy(lang);
  function removeSource(sourceFile: string | null, label: string, count: number) {
    if (!window.confirm(importCopy.removeAsk.replace("{count}", String(count)).replace("{file}", label))) return;
    setMessage(null);
    startImport(async () => {
      const result = await deleteElementSourceAction({ siteId: site.id, sourceFile });
      if (!result.ok) { setMessage({ ok: false, text: result.message || importCopy.removeFailed }); return; }
      setItems((all) => all.filter((element) => (element.sourceFile ?? null) !== sourceFile));
      setMessage({ ok: true, text: importCopy.removed.replace("{count}", String(result.deleted ?? 0)) });
      router.refresh();
    });
  }
  const fileInput = useRef<HTMLInputElement>(null);

  const lists: ElementList[] = side === "factory" ? ["assembly", "part"] : ["assembly"];
  const activeList = side === "field" ? "assembly" : list;
  const ofList = items.filter((element) => element.list === activeList);
  // The field list shows every element; those still in the factory are visible but locked.
  const shown = ofList;
  // Pieces not yet out of the factory (also of elements partly on site).
  const stillInFactory = side === "field" ? ofList.reduce((sum, element) => sum + element.quantity - doneQty(element, "factory"), 0) : 0;
  const stages = [...new Set(shown.flatMap(element => [...stagesFor(side, element.list, element.processRoutes)]))];
  const progress = stageProgress(shown, side);
  const pieces = shown.reduce((sum, element) => sum + element.quantity, 0);
  const totalKg = shown.reduce((sum, element) => sum + (element.weightKg ?? 0) * element.quantity, 0);
  const counts: Record<Status, number> = { waiting: 0, working: 0, done: 0 };
  const isLocked = (element: ElementView) => side === "field" && !onFieldList(element);
  let lockedCount = 0;
  for (const element of shown) {
    if (isLocked(element)) lockedCount += 1;
    else counts[elementStatus(element, side)] += 1;
  }

  const q = query.trim().toLowerCase();
  const visible = shown.filter((element) => {
    if (filter === "factory" && !isLocked(element)) return false;
    if ((filter === "waiting" || filter === "working" || filter === "done") && (isLocked(element) || elementStatus(element, side) !== filter)) return false;
    if ((filter === "COLUMN" || filter === "BEAM") && element.kind !== filter) return false;
    if (!q) return true;
    return [element.mark, element.profile, element.material, element.kind].some((value) => value?.toLowerCase().includes(q));
  });

  function importFiles(selectedFiles: FileList | null) {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setMessage(null);
    const form = new FormData();
    form.set("baustelleId", site.id);
    form.set('importMode', importMode);
    for (const file of Array.from(selectedFiles).slice(0, 4)) form.append("file", file);
    startImport(async () => {
      const result = await importElementListsAction(form);
      setMessage({ ok: result.ok, text: result.message });
      setImportOpen(false);
      if (result.ok) { router.refresh(); setConfigureAfterImport(result.results?.flatMap(row => row.addedIds) ?? []); }
    });
  }

  const filters: Array<{ key: Filter; label: string }> = [
    { key: "all", label: t("elements.filterAll", lang) },
    { key: "waiting", label: `${t("elements.statusWaiting", lang)} ${counts.waiting}` },
    { key: "working", label: `${t("elements.statusWorking", lang)} ${counts.working}` },
    { key: "done", label: `${t("elements.statusDone", lang)} ${counts.done}` },
    ...(side === "field" ? [{ key: "factory" as const, label: `${t("elements.inFactory", lang)} ${lockedCount}` }] : []),
    ...(activeList === "assembly"
      ? [
          { key: "COLUMN" as const, label: t("elements.columns", lang) },
          { key: "BEAM" as const, label: t("elements.beams", lang) },
        ]
      : []),
  ];

  return (
    <>
      {/* Summary: compact, the list is what matters */}
      <div className="rounded-2xl border bg-card p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-600 text-white">
            {side === "factory" ? <Factory className="size-5" /> : <HardHat className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold leading-tight">{side === "factory" ? t("elements.factoryList", lang) : t("elements.fieldList", lang)}</div>
            <div className="truncate text-xs tabular-nums text-muted-foreground">
              {shown.length > 0
                ? `${shown.length} ${t("elements.marks", lang).toLowerCase()} · ${formatAmount(pieces)} ${t("elements.pieces", lang).toLowerCase()} · ${formatAmount(totalKg)} kg`
                : side === "factory"
                  ? t("elements.factoryHint", lang)
                  : t("elements.fieldHint", lang)}
            </div>
          </div>
          {canImport ? (
            <>
              <button
                type="button"
                disabled={importing}
                onClick={() => { setImportMode('merge'); setImportOpen(true); }}
                title={items.length > 0 ? t("elements.reimport", lang) : t("elements.import", lang)}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold active:scale-95 disabled:opacity-50"
              >
                {importing ? <Loader2 className="size-4 animate-spin text-orange-600" /> : <UploadCloud className="size-4 text-orange-600" />}
                <span className="hidden sm:inline">{t("elements.upload", lang)}</span>
              </button>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html"
                className="hidden"
                onChange={(event) => {
                  importFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </>
          ) : null}
          {canPlan ? <button type="button" onClick={() => onProcesses(ofList)} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold"><SlidersHorizontal className="size-4 text-orange-600" />{processButton(lang)}</button> : null}
        </div>
        {shown.length > 0 ? (
          <div className={`mt-3 grid gap-1.5 ${stages.length > 4 ? "grid-cols-3 sm:grid-cols-6" : stages.length > 1 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
            {stages.map((stage) => {
              const entry = progress[stage] ?? { done: 0, total: 0, pieces: 0, totalPieces: 0 };
              const pct = entry.totalPieces > 0 ? Math.round((entry.pieces / entry.totalPieces) * 100) : 0;
              return (
                <div key={stage} className="min-w-0 rounded-lg bg-muted/60 px-2 py-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="truncate text-[11px] font-semibold">{stageLabel(stage, lang, definitions)}</span>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {entry.done}/{entry.total}
                    </span>
                  </div>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-background">
                    <span className={`block h-full rounded-full ${pct === 100 ? "bg-green-600" : "bg-orange-500"}`} style={{ width: `${pct}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
        {stillInFactory > 0 ? <p className="mt-2 text-xs text-muted-foreground">{fill(t("elements.stillInFactory", lang), { n: stillInFactory })}</p> : null}
      </div>
      <AssetWorkspaceDialog open={importOpen} onOpenChange={setImportOpen} title={importCopy.title} compact scrollBody>
        <label className="grid gap-2 text-sm font-medium">{importCopy.mode}
          <select value={importMode} onChange={event => setImportMode(event.target.value as 'merge' | 'snapshot')} className="min-h-11 w-full min-w-0 rounded-xl border bg-background px-3 text-sm">
            <option value="merge">{importCopy.merge}</option><option value="snapshot">{importCopy.snapshot}</option>
          </select>
        </label>
        <p className="mt-3 text-sm text-muted-foreground">{importMode === 'merge' ? importCopy.hint : importCopy.snapshotHint}</p>
        <button type="button" disabled={importing} onClick={() => fileInput.current?.click()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold disabled:opacity-50"><UploadCloud className="size-4 text-orange-600" />{importCopy.choose}</button>
      </AssetWorkspaceDialog>
      {message ? <p className={`text-sm font-medium ${message.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>{message.text}</p> : null}
      {configureAfterImport.length > 0 && canPlan ? <button type="button" onClick={() => { onProcesses(items.filter(row => configureAfterImport.includes(row.id))); setConfigureAfterImport([]); }} className="min-h-11 rounded-xl border border-orange-500/50 bg-orange-500/10 px-4 text-sm font-semibold">{processButton(lang)} · {configureAfterImport.length} {t('elements.marks', lang)}</button> : null}

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{canImport ? t("elements.emptyOffice", lang) : t("elements.empty", lang)}</p>
      ) : (
        <>
          {lists.length > 1 ? (
            <div className="grid grid-cols-2 gap-2">
              {lists.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setList(key);
                    setFilter("all");
                  }}
                  className={`h-10 rounded-full border-2 px-3 text-sm font-semibold active:scale-95 ${activeList === key ? "border-orange-500 bg-orange-500/10 text-orange-800 dark:text-orange-200" : "bg-card"}`}
                >
                  {key === "assembly" ? t("elements.assemblies", lang) : t("elements.parts", lang)}{" "}
                  <span className="ml-1 tabular-nums text-muted-foreground">{items.filter((element) => element.list === key).length}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value.slice(0, 40))}
                placeholder={t("elements.search", lang)}
                inputMode="search"
                className="h-11 w-full rounded-xl border-2 bg-card pl-9 pr-10 text-base outline-none focus:border-orange-500"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg" aria-label={t("factory.cancel", lang)}>
                  <X className="size-4" />
                </button>
              ) : null}
            </label>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {filters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`h-9 shrink-0 rounded-full border px-3 text-xs font-semibold tabular-nums active:scale-95 ${filter === item.key ? "border-orange-500 bg-orange-500 text-white" : "bg-card"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {bySource(visible).map((group) => (
            <section key={group.source} className="space-y-1.5" data-testid="element-source-group">
              {group.label ? (
                <h3 className="sticky top-0 z-[1] flex items-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/[0.07] px-3 py-2 text-sm font-semibold backdrop-blur" title={group.source}>
                  <FileSpreadsheet className="size-4 shrink-0 text-orange-600 dark:text-orange-400" />
                  <span className="min-w-0 flex-1 truncate">{group.label}</span>
                  <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{group.items.length}</span>
                  {canDeleteSource ? (
                    <button type="button" disabled={importing} onClick={() => removeSource(group.source || null, group.label ?? "", items.filter((element) => (element.sourceFile ?? "") === group.source).length)} data-testid="element-source-delete" title={importCopy.removeGroup} aria-label={importCopy.removeGroup} className="grid size-8 shrink-0 place-items-center rounded-lg text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400">
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </h3>
              ) : null}
              <ul className="space-y-1.5">
                {group.items.map((element) => (
                  <li key={element.id}>
                    <ElementRow element={element} stages={stagesFor(side, element.list, element.processRoutes)} definitions={definitions} side={side} locked={side === "field" && !onFieldList(element)} canPlan={canPlan} onOpen={() => onOpen(element.id)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {visible.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t("elements.noMatch", lang)}</p> : null}
        </>
      )}
    </>
  );
}

/**
 * Elements grouped by the document they came from, in list order; each group
 * shows its file name so everyone sees which document the material belongs to.
 */
function bySource(items: ElementView[]) {
  const groups = new Map<string, ElementView[]>();
  for (const element of items) {
    const key = element.sourceFile ?? "";
    groups.set(key, [...(groups.get(key) ?? []), element]);
  }
  const many = groups.size > 1;
  return [...groups].map(([source, list]) => ({
    source,
    label: source ? source.replace(/\.(xlsx?|csv)$/i, "") : many ? "—" : null,
    items: list,
  }));
}

/** Segment per step: full green when every piece passed it, half when some did. */
function stepTone(element: ElementView, stage: string, status: Status) {
  if (status === "done") return "bg-green-600";
  const side = sideOfStage(stage) ?? "factory";
  const through = stagePieces(element, stage);
  const cap = side === "factory" ? element.quantity : capFor(element, "field");
  if (through === 0) return "bg-muted-foreground/20";
  return through >= cap ? "bg-green-600" : "bg-green-600/45";
}

function ElementRow({ element, stages, definitions, side, locked = false, canPlan, onOpen }: { element: ElementView; stages: readonly string[]; definitions: SteelWorkDefinitionView[]; side: ElementSide; locked?: boolean; canPlan: boolean; onOpen: () => void }) {
  const { currentLang: lang } = useLanguage();
  const status = elementStatus(element, side);
  const total = (element.weightKg ?? 0) * element.quantity;
  const done = doneQty(element, side);
  const arrived = capFor(element, side);
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={locked && !canPlan}
      aria-disabled={locked && !canPlan}
      title={locked ? t("elements.lockedInFactory", lang) : undefined}
      className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left ${locked ? "cursor-not-allowed border-dashed bg-muted/40 opacity-60" : "bg-card active:scale-[0.99]"}`}
    >
      <span className={`grid h-11 min-w-14 shrink-0 place-items-center rounded-xl px-2 text-base font-bold tabular-nums ${locked ? "bg-muted text-muted-foreground" : STATUS_STYLE[status].badge}`}>{element.mark}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-semibold">{[kindLabel(element.kind, lang), element.profile].filter(Boolean).join(" · ") || element.mark}</span>
          {locked ? (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              <Lock className="size-3" /> {t("elements.inFactory", lang)}
            </span>
          ) : (
            <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[status].pill}`}>{statusLabel(status, lang)}</span>
          )}
        </span>
        <span className="flex items-center gap-1.5 truncate text-xs tabular-nums text-muted-foreground">
          <span className="truncate">
            {element.quantity}× {element.weightKg !== null ? `· ${kg(total)} kg` : ""}
            {element.material ? ` · ${element.material}` : ""}
          </span>
          {!locked && element.quantity > 1 && status !== "done" && (done > 0 || (side === "field" && arrived < element.quantity)) ? (
            <span className="ml-auto shrink-0 font-semibold text-foreground">
              {side === "field" && arrived < element.quantity
                ? fill(t("elements.piecesArrived", lang), { done, arrived, total: element.quantity })
                : fill(t("elements.piecesDone", lang), { done, total: element.quantity })}
            </span>
          ) : null}
        </span>
        {stages.length > 1 ? (
          <span className="mt-1.5 flex gap-1">
            {stages.map((stage) => (
              <span key={stage} title={stageLabel(stage, lang, definitions)} className={`h-1.5 min-w-0 flex-1 rounded-full ${stepTone(element, stage, status)}`} />
            ))}
          </span>
        ) : null}
      </span>
      {locked ? <Lock className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-5 shrink-0 text-muted-foreground" />}
    </button>
  );
}

/** The element's pieces as small blocks: finished, arrived on site, still in the factory. */
function PieceStrip({ element, side, definitions }: { element: ElementView; side: ElementSide; definitions: SteelWorkDefinitionView[] }) {
  const { currentLang: lang } = useLanguage();
  const total = element.quantity;
  const done = doneQty(element, side);
  // Orange: on site but not finished there yet. In the factory there is no such state.
  const arrived = side === "field" ? capFor(element, side) : done;
  const rest = total - doneQty(element, "factory");
  const waiting = routeStages(element, side).filter((stage) => stagePieces(element, stage) < capFor(element, side));
  const line =
    side === "factory"
      ? done === 0
        ? fill(t("elements.piecesNoneOut", lang), { total })
        : rest > 0
          ? fill(t("elements.piecesSplit", lang), { done, rest })
          : fill(t("elements.piecesAllOut", lang), { total })
      : arrived < total
        ? fill(t("elements.piecesFieldSplit", lang), { done, arrived, rest: total - arrived })
        : fill(t("elements.piecesFieldAll", lang), { done, total });
  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold">{side === "factory" ? t("elements.piecesOut", lang) : t("elements.piecesTitle", lang)}</span>
        <span className="text-sm font-bold tabular-nums">
          {done}
          <span className="text-xs text-muted-foreground">/{total}</span>
        </span>
      </div>
      {total <= 40 ? (
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
              className={`h-5 min-w-5 flex-1 rounded-md ${index < done ? "bg-green-600" : index < arrived ? "bg-orange-500/70" : "bg-muted-foreground/20"}`}
              style={{ maxWidth: 40 }}
            />
          ))}
        </div>
      ) : (
        <span className="block h-3 overflow-hidden rounded-full bg-muted-foreground/20">
          <span className="block h-full bg-green-600" style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </span>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{line}</p>
      {routeClosed(element, side) && waiting.length > 0 ? (
        <p className="mt-1 text-xs font-semibold text-orange-700 dark:text-orange-300">
          {fill(t("elements.piecesWaitFor", lang), { steps: waiting.map((stage) => stageLabel(stage, lang, definitions)).join(", ") })}
        </p>
      ) : null}
    </div>
  );
}

function ElementDetail({
  element,
  side,
  canEdit,
  definitions,
  onProcesses,
  onBack,
  onStage,
  onDone,
}: {
  element: ElementView;
  side: ElementSide;
  canEdit: boolean;
  definitions: SteelWorkDefinitionView[];
  onProcesses?: () => void;
  onBack: () => void;
  onStage: (stage: string) => void;
  onDone: (doneAt: string | null, doneBy: string | null) => void;
}) {
  const { currentLang: lang } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const stages = stagesFor(side, element.list, element.processRoutes);
  const legacyRoute = readProcessRoutes(element.processRoutes)?.[side] == null;
  const historicStages = [...new Set(element.work.filter(work => sideOfStage(work.stage) === side && !stages.includes(work.stage)).map(work => work.stage))];
  const status = elementStatus(element, side);
  const closed = routeClosed(element, side);
  const closedAt = side === "factory" ? element.factoryDoneAt : element.fieldDoneAt;
  const closedBy = side === "factory" ? element.factoryDoneBy : element.fieldDoneBy;
  const route = routeStages(element, side);
  const cap = capFor(element, side);
  const facts = [
    `${element.quantity}×`,
    element.profile,
    element.material,
    element.lengthMm !== null ? `${formatAmount(element.lengthMm)} mm` : null,
    element.weightKg !== null ? `${kg(element.weightKg * element.quantity)} kg` : null,
    element.areaM2 !== null ? `${kg(element.areaM2 * element.quantity)} m²` : null,
  ].filter(Boolean);

  function close(done: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setElementDoneAction({ elementId: element.id, side, done });
      if (!result.ok) {
        setError(result.message || t("factory.error", lang));
        return;
      }
      onDone(done ? new Date().toISOString() : null, done ? result.doneByName ?? "" : null);
    });
  }

  return (
    <>
      <button type="button" onClick={onBack} className="inline-flex h-10 items-center gap-2 rounded-full border bg-card px-3.5 text-sm font-semibold active:scale-95">
        <ArrowLeft className="size-4" /> {t("elements.backToList", lang)}
      </button>

      <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
        <span className={`grid h-14 min-w-16 shrink-0 place-items-center rounded-xl px-3 text-xl font-bold tabular-nums ${STATUS_STYLE[status].badge}`}>{element.mark}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-lg font-bold">{kindLabel(element.kind, lang) ?? (element.list === "part" ? t("elements.part", lang) : t("elements.assembly", lang))}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status].pill}`}>{statusLabel(status, lang)}</span>
          </div>
          <div className="truncate text-xs tabular-nums text-muted-foreground">{facts.join(" · ")}</div>
        </div>
      </div>

      {element.quantity > 1 || side === "field" ? <PieceStrip element={element} side={side} definitions={definitions} /> : null}

      <div className="flex items-baseline justify-between px-1">
        <span className="text-sm font-bold">{side === "factory" ? t("elements.factorySteps", lang) : t("elements.fieldSteps", lang)}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{fill(t("elements.stepsChecked", lang), { done: stages.filter(stage => cap > 0 && stagePieces(element, stage) >= cap).length, total: stages.length })}</span>
        {onProcesses ? <button type="button" onClick={onProcesses} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold"><SlidersHorizontal className="size-4" />{processButton(lang)}</button> : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stages.map((stage) => {
          const entries = element.work.filter((entry) => entry.stage === stage);
          const through = stagePieces(element, stage);
          const full = through >= cap && through > 0;
          const skipped = legacyRoute && entries.length === 0 && closed;
          const definition = definitions.find(definition => definition.key === stage);
          const last = entries[entries.length - 1] ?? null;
          return (
            <button
              key={stage}
              type="button"
              disabled={!canEdit && entries.length === 0}
              onClick={() => onStage(stage)}
              className={`flex min-h-[104px] flex-col rounded-2xl border-2 p-3 text-left transition active:scale-[0.98] disabled:active:scale-100 ${
                full ? "border-green-600/60 bg-green-600/[0.06]" : entries.length > 0 ? "border-orange-500/50 bg-orange-500/[0.05]" : skipped ? "border-dashed bg-muted/40 opacity-70" : `bg-card ${canEdit ? "hover:border-orange-500/60" : ""}`
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${full ? "bg-green-600 text-white" : entries.length > 0 ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"}`}>
                  {full ? <Check className="size-4" /> : skipped ? <Minus className="size-4" /> : side === 'factory' ? <Factory className="size-4" /> : <HardHat className="size-4" />}
                </span>
                <span className={`min-w-0 truncate text-base font-bold ${skipped ? "text-muted-foreground line-through decoration-1" : ""}`}>{stageLabel(stage, lang, definitions)}</span>
              </span>
              {definition?.visualUpdatedAt ? <Image unoptimized src={`/api/steel-work-visuals/${definition.id}?v=${Date.parse(definition.visualUpdatedAt)}`} width={160} height={80} alt="" className="mt-2 h-16 w-full rounded-lg object-cover" /> : null}
              {entries.length > 0 ? (
                <span className="mt-2 min-w-0">
                  <span className={`block text-sm font-bold tabular-nums ${full ? "text-green-700 dark:text-green-400" : "text-orange-700 dark:text-orange-300"}`}>
                    {fill(t("elements.stepPieces", lang), { done: through, total: cap })}
                  </span>
                  <span className="line-clamp-2 text-xs font-semibold">{[...new Set(entries.flatMap((entry) => entry.workerNames.split(", ")))].join(", ")}</span>
                  {last ? <span className="block truncate text-[11px] text-muted-foreground">{fill(t("elements.confirmedBy", lang), { name: last.checkedByName, date: formatShortDate(last.checkedAt) })}</span> : null}
                </span>
              ) : skipped ? (
                <span className="mt-2 text-xs font-semibold text-muted-foreground">{t("elements.stepNotNeeded", lang)}</span>
              ) : (
                <span className="mt-2 text-xs text-muted-foreground">{canEdit ? t("elements.tapToPick", lang) : t("elements.notChecked", lang)}</span>
              )}
            </button>
          );
        })}
      </div>
      {historicStages.length ? <details className="rounded-xl border p-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">{({ sq: 'Historiku i proceseve', en: 'Process history', de: 'Prozessverlauf', it: 'Storico processi', ro: 'Istoric procese', pl: 'Historia procesów' })[lang] ?? 'Process history'}</summary><div className="flex flex-wrap gap-2">{historicStages.map(stage => <button key={stage} type="button" onClick={() => onStage(stage)} className="min-h-11 rounded-lg border px-3 text-sm">{stageLabel(stage, lang, definitions)} · {stagePieces(element, stage)}</button>)}</div></details> : null}

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      {legacyRoute && closed && closedAt ? (
        <div className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${status === "done" ? "border-green-600/50 bg-green-600/10" : "border-orange-500/40 bg-orange-500/[0.06]"}`}>
          <CheckCheck className={`size-6 shrink-0 ${status === "done" ? "text-green-700 dark:text-green-400" : "text-orange-600"}`} />
          <div className="min-w-0 flex-1">
            <div className={`font-bold ${status === "done" ? "text-green-800 dark:text-green-300" : ""}`}>{side === "factory" ? t("elements.factoryDone", lang) : t("elements.fieldDone", lang)}</div>
            <div className="truncate text-xs text-muted-foreground">{fill(t("elements.confirmedBy", lang), { name: closedBy ?? "", date: formatShortDate(closedAt) })}</div>
          </div>
          {canEdit ? (
            <button type="button" disabled={pending} onClick={() => close(false)} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border bg-card px-3 text-xs font-semibold active:scale-95 disabled:opacity-50">
              <RotateCcw className="size-3.5" /> {t("elements.reopen", lang)}
            </button>
          ) : null}
        </div>
      ) : legacyRoute && canEdit && !closed ? (
        <>
          <button
            type="button"
            disabled={pending || route.length === 0}
            onClick={() => close(true)}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-green-600 text-base font-bold text-white shadow-md active:scale-[0.99] disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-5 animate-spin" /> : <CheckCheck className="size-5" />}
            {side === "factory" ? t("elements.finishFactory", lang) : t("elements.finishField", lang)}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            {route.length === 0 ? t("elements.finishNeedsStep", lang) : side === "factory" ? t("elements.finishFactoryHint", lang) : t("elements.finishFieldHint", lang)}
          </p>
        </>
      ) : null}
      {!canEdit ? <p className="text-center text-sm text-muted-foreground">{side === 'field' && !onFieldList(element) ? t('elements.lockedInFactory', lang) : side === "factory" ? t("elements.onlyFactoryEngineer", lang) : t("elements.onlyFieldEngineer", lang)}</p> : null}
    </>
  );
}

/**
 * One step of one element: who did how many pieces so far (each entry on its
 * own line), and a new entry: how many pieces, which workers, confirm.
 */
function StageView({
  element,
  stage,
  side,
  canEdit,
  workers,
  definitions,
  lastPick,
  onBack,
  onAdded,
  onRemoved,
}: {
  element: ElementView;
  stage: string;
  side: ElementSide;
  canEdit: boolean;
  workers: ElementWorkerOption[];
  definitions: SteelWorkDefinitionView[];
  lastPick: React.MutableRefObject<Record<string, string[]>>;
  onBack: () => void;
  onAdded: (work: ElementWorkView) => void;
  onRemoved: (workId: string) => void;
}) {
  const { currentLang: lang } = useLanguage();
  const entries = element.work.filter((entry) => entry.stage === stage);
  const cap = capFor(element, side);
  const through = stagePieces(element, stage);
  const open = stageRemaining(element, stage);
  const [count, setCount] = useState(open);
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const crew = CREW_FOR_SIDE[side];
  const ownCrew = workers.filter((worker) => worker.crewRole && crew.includes(worker.crewRole));
  // Only this side's crew; when no roles are set yet, everybody.
  const base = ownCrew.length > 0 ? ownCrew : workers;
  const q = query.trim().toLowerCase();
  const options = base.filter((worker) => !q || worker.name.toLowerCase().includes(q));
  const last = (lastPick.current[stage] ?? []).filter((id) => workers.some((worker) => worker.id === id));
  const nameOf = (id: string) => workers.find((worker) => worker.id === id)?.name ?? "";

  function toggle(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((value) => value !== id) : current.length >= 20 ? current : [...current, id]));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await addElementWorkAction({ elementId: element.id, stage, workerIds: picked, pieces: count });
      if (!result.ok || !result.workId) {
        setError(result.message || t("factory.error", lang));
        return;
      }
      lastPick.current[stage] = picked;
      onAdded({
        id: result.workId,
        stage,
        pieces: result.pieces ?? count,
        workerIds: picked,
        workerNames: picked.map(nameOf).join(", "),
        checkedByName: result.checkedByName ?? "",
        checkedAt: new Date().toISOString(),
      });
    });
  }

  function remove(workId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeElementWorkAction({ workId });
      if (!result.ok) {
        setError(result.message || t("factory.error", lang));
        return;
      }
      onRemoved(workId);
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="grid size-10 shrink-0 place-items-center rounded-full border bg-card active:scale-95" aria-label={t("elements.backToList", lang)}>
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold leading-tight">
            {element.mark} · {stageLabel(stage, lang, definitions)}
          </div>
          <div className="text-xs tabular-nums text-muted-foreground">{fill(t("elements.stepPieces", lang), { done: through, total: cap })}</div>
        </div>
      </div>

      {/* Done so far: one line per entry, each with its pieces. */}
      {entries.length > 0 ? (
        <ul className="space-y-1.5">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 rounded-xl border-2 border-green-600/40 bg-green-600/[0.06] p-2.5">
              <span className="grid h-11 min-w-12 shrink-0 place-items-center rounded-lg bg-green-600 px-2 text-center text-white">
                <span className="text-base font-bold leading-none tabular-nums">{entry.pieces > 0 ? entry.pieces : element.quantity}</span>
                <span className="text-[9px] font-semibold uppercase leading-none">{t("elements.pieceShort", lang)}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-semibold">{entry.workerNames}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{fill(t("elements.confirmedBy", lang), { name: entry.checkedByName, date: formatShortDate(entry.checkedAt) })}</span>
              </span>
              {canEdit ? (
                <button type="button" disabled={pending} onClick={() => remove(entry.id)} className="grid size-9 shrink-0 place-items-center rounded-lg text-red-600 active:scale-95 disabled:opacity-50" aria-label={t("elements.uncheck", lang)}>
                  <X className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!canEdit ? null : open === 0 ? (
        <p className="rounded-xl bg-green-600/10 px-3 py-2 text-center text-sm font-semibold text-green-800 dark:text-green-300">{t("elements.stepAllPieces", lang)}</p>
      ) : (
        <>
          {/* New entry: 1. how many pieces */}
          <div className="space-y-2 rounded-2xl border bg-card p-3">
            <div className="text-sm font-bold">{t("elements.howManyPieces", lang)}</div>
            <div className="text-xs text-muted-foreground">{fill(t("elements.howManyHint", lang), { open, total: cap })}</div>
            {open <= 12 ? (
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: open }, (_, index) => index + 1).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCount(value)}
                    aria-pressed={count === value}
                    className={`h-11 rounded-xl border-2 text-base font-bold tabular-nums active:scale-95 ${count === value ? "border-green-600 bg-green-600 text-white" : "bg-background"}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCount(Math.max(1, count - 1))} className="grid size-11 place-items-center rounded-xl border-2 bg-background text-2xl font-bold active:scale-95">
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={open}
                  value={count}
                  onChange={(event) => setCount(Math.max(1, Math.min(open, Number(event.target.value) || 1)))}
                  className="h-11 w-full rounded-xl border-2 bg-background text-center text-lg font-bold tabular-nums outline-none focus:border-green-600"
                />
                <button type="button" onClick={() => setCount(Math.min(open, count + 1))} className="grid size-11 place-items-center rounded-xl border-2 bg-background text-2xl font-bold active:scale-95">
                  +
                </button>
              </div>
            )}
          </div>

          {/* 2. who did them */}
          <div className="px-1 text-sm font-bold">{side === "factory" ? t("elements.pickFactoryWorkers", lang) : t("elements.pickFieldWorkers", lang)}</div>
          {last.length > 0 && last.join() !== picked.join() ? (
            <button type="button" onClick={() => setPicked(last)} className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-orange-500/50 px-3 py-2 text-left text-sm active:scale-[0.99]">
              <Users className="size-4 shrink-0 text-orange-600" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold">{t("elements.sameAsLast", lang)}</span> {last.map(nameOf).join(", ")}
              </span>
            </button>
          ) : null}
          {base.length > 8 ? (
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value.slice(0, 40))}
                placeholder={t("elements.searchWorker", lang)}
                className="h-11 w-full rounded-xl border-2 bg-card pl-9 pr-3 text-base outline-none focus:border-orange-500"
              />
            </label>
          ) : null}
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {options.map((worker) => {
              const on = picked.includes(worker.id);
              return (
                <li key={worker.id}>
                  <button
                    type="button"
                    onClick={() => toggle(worker.id)}
                    aria-pressed={on}
                    data-worker
                    className={`flex h-12 w-full items-center gap-3 rounded-xl border-2 px-3 text-left active:scale-[0.99] ${on ? "border-green-600 bg-green-600/10" : "bg-card"}`}
                  >
                    <span className={`grid size-6 shrink-0 place-items-center rounded-md border-2 ${on ? "border-green-600 bg-green-600 text-white" : "border-muted-foreground/40"}`}>{on ? <Check className="size-4" /> : null}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{worker.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {options.length === 0 ? <p className="text-center text-sm text-muted-foreground">{t("elements.noWorker", lang)}</p> : null}
        </>
      )}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 pb-1 pt-3 backdrop-blur sm:-mx-6 sm:px-6">
        {canEdit && open > 0 ? (
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <button type="button" onClick={onBack} className="h-12 rounded-xl border-2 bg-card font-semibold active:scale-95">
              {t("factory.cancel", lang)}
            </button>
            <button
              type="button"
              disabled={pending || picked.length === 0}
              onClick={save}
              className="inline-flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl bg-green-600 px-2 font-bold text-white shadow-sm active:scale-95 disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <Check className="size-5 shrink-0" />}
              <span className="truncate">{fill(t("elements.confirmStepPieces", lang), { step: stageLabel(stage, lang, definitions), n: count })}</span>
            </button>
          </div>
        ) : (
          <button type="button" onClick={onBack} className="h-12 w-full rounded-xl border-2 bg-card font-semibold active:scale-95">
            {t("elements.backToElement", lang)}
          </button>
        )}
      </div>
    </>
  );
}
