"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, ChevronRight, Factory, HardHat, Loader2, Search, UploadCloud, UserCheck, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { CREW_FOR_SIDE, elementDone, stageProgress, stagesFor, type ElementList, type ElementSide } from "@/lib/elements/stages";
import { formatAmount, formatShortDate } from "@/lib/factory/production";
import { t } from "@/lib/i18n";

import { importElementListsAction, setElementWorkAction } from "../../element-actions";
import { Sheet } from "../../production/production-ui";

export type ElementWorkView = {
  stage: string;
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
  work: ElementWorkView[];
};

export type ElementWorkerOption = { id: string; name: string; crewRole: string | null };

type Filter = "all" | "open" | "COLUMN" | "BEAM";

function stageLabel(stage: string, lang: string) {
  return stage === "mounted" ? t("elements.mounted", lang) : t(`factory.steps.${stage}`, lang);
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

/**
 * Two big buttons on the steel site: the factory list (factory engineer checks
 * who cut, assembled, welded... each element) and the field list (field
 * engineer checks who mounted it). Both open the same full-screen sheet style
 * as the documents and the factory line.
 */
export function ElementListButtons({
  site,
  elements,
  workers,
  can,
}: {
  site: { id: string; name: string };
  elements: ElementView[];
  workers: ElementWorkerOption[];
  can: { factory: boolean; field: boolean; office: boolean };
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
  const factoryDone = assemblies.filter((element) => elementDone(element, "factory")).length;
  const fieldDone = assemblies.filter((element) => elementDone(element, "field")).length;

  if (items.length === 0 && !can.office) return null;

  const buttons: Array<{ side: ElementSide; label: string; done: number; icon: React.ReactNode }> = [
    { side: "factory", label: t("elements.factoryList", lang), done: factoryDone, icon: <Factory className="size-6" /> },
    { side: "field", label: t("elements.fieldList", lang), done: fieldDone, icon: <HardHat className="size-6" /> },
  ];

  return (
    <>
      <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {buttons.map((button) => {
          const pct = assemblies.length > 0 ? Math.round((button.done / assemblies.length) * 100) : 0;
          return (
            <button
              key={button.side}
              type="button"
              onClick={() => setOpen(button.side)}
              className="group relative flex min-h-[64px] min-w-0 items-center gap-3 overflow-hidden rounded-2xl bg-orange-600 px-3 py-2.5 text-left text-white shadow-md active:scale-[0.98]"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15">{button.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold leading-tight">{button.label}</span>
                <span className="block text-xs tabular-nums text-white/85">
                  {assemblies.length > 0 ? t("elements.doneOf", lang).replace("{done}", String(button.done)).replace("{total}", String(assemblies.length)) : t("elements.noList", lang)}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 opacity-80" />
              <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                <span className="block h-full bg-white" style={{ width: `${pct}%` }} />
              </span>
            </button>
          );
        })}
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
            canImport={can.office}
            onClose={() => setOpen(null)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function ElementListSheet({
  side,
  site,
  items,
  setItems,
  workers,
  canEdit,
  canImport,
  onClose,
}: {
  side: ElementSide;
  site: { id: string; name: string };
  items: ElementView[];
  setItems: React.Dispatch<React.SetStateAction<ElementView[]>>;
  workers: ElementWorkerOption[];
  canEdit: boolean;
  canImport: boolean;
  onClose: () => void;
}) {
  const { currentLang: lang } = useLanguage();
  const router = useRouter();
  const [list, setList] = useState<ElementList>("assembly");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [importing, startImport] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  // The crew picked last per stage, offered again on the next element.
  const lastPick = useRef<Record<string, string[]>>({});

  const lists: ElementList[] = side === "factory" ? ["assembly", "part"] : ["assembly"];
  const shown = items.filter((element) => element.list === list);
  const stages = stagesFor(side, list);
  const progress = stageProgress(shown, side);
  const pieces = shown.reduce((sum, element) => sum + element.quantity, 0);
  const totalKg = shown.reduce((sum, element) => sum + (element.weightKg ?? 0) * element.quantity, 0);
  const doneCount = shown.filter((element) => elementDone(element, side)).length;

  const q = query.trim().toLowerCase();
  const visible = shown.filter((element) => {
    if (filter === "open" && elementDone(element, side)) return false;
    if ((filter === "COLUMN" || filter === "BEAM") && element.kind !== filter) return false;
    if (!q) return true;
    return [element.mark, element.profile, element.material, element.kind].some((value) => value?.toLowerCase().includes(q));
  });

  const selected = selectedId ? items.find((element) => element.id === selectedId) ?? null : null;
  const label = `${side === "factory" ? t("elements.factoryList", lang) : t("elements.fieldList", lang)} · ${site.name}`;

  function importFiles(selectedFiles: FileList | null) {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setMessage(null);
    const form = new FormData();
    form.set("baustelleId", site.id);
    for (const file of Array.from(selectedFiles).slice(0, 4)) form.append("file", file);
    startImport(async () => {
      const result = await importElementListsAction(form);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) router.refresh();
    });
  }

  const filters: Array<{ key: Filter; label: string }> = [
    { key: "all", label: t("elements.filterAll", lang) },
    { key: "open", label: t("elements.filterOpen", lang) },
    ...(list === "assembly"
      ? [
          { key: "COLUMN" as const, label: t("elements.columns", lang) },
          { key: "BEAM" as const, label: t("elements.beams", lang) },
        ]
      : []),
  ];

  return (
    <Sheet onClose={onClose} label={selected ? `${selected.mark} · ${label}` : label} closeLabel={t("factory.close", lang)}>
      {selected ? (
        <ElementDetail
          key={selected.id}
          element={selected}
          side={side}
          workers={workers}
          canEdit={canEdit}
          lastPick={lastPick}
          onBack={() => setSelectedId(null)}
          onSaved={(stage, work) =>
            setItems((current) =>
              current.map((element) =>
                element.id === selected.id
                  ? { ...element, work: [...element.work.filter((entry) => entry.stage !== stage), ...(work ? [work] : [])] }
                  : element,
              ),
            )
          }
        />
      ) : (
        <>
          {/* Summary: what this list is and how far each stage is */}
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-600 text-white">
                {side === "factory" ? <Factory className="size-6" /> : <HardHat className="size-6" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold leading-tight">{side === "factory" ? t("elements.factoryList", lang) : t("elements.fieldList", lang)}</div>
                <div className="text-sm text-muted-foreground">
                  {side === "factory" ? t("elements.factoryHint", lang) : t("elements.fieldHint", lang)}
                </div>
              </div>
            </div>
            {shown.length > 0 ? (
              <>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat value={String(shown.length)} label={t("elements.marks", lang)} />
                  <Stat value={formatAmount(pieces)} label={t("elements.pieces", lang)} />
                  <Stat value={`${formatAmount(totalKg)} kg`} label={t("elements.weight", lang)} />
                </div>
                <div className="mt-4 space-y-2">
                  {stages.map((stage) => {
                    const entry = progress[stage] ?? { done: 0, total: 0 };
                    const pct = entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0;
                    return (
                      <div key={stage} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 truncate text-sm font-semibold">{stageLabel(stage, lang)}</span>
                        <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                          <span className={`block h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-orange-500"}`} style={{ width: `${pct}%` }} />
                        </span>
                        <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {entry.done}/{entry.total}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>

          {canImport ? (
            <>
              <button
                type="button"
                disabled={importing}
                onClick={() => fileInput.current?.click()}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-orange-500/50 bg-orange-500/[0.05] text-base font-bold active:scale-[0.99] disabled:opacity-50"
              >
                {importing ? <Loader2 className="size-5 animate-spin text-orange-600" /> : <UploadCloud className="size-5 text-orange-600" />}
                {items.length > 0 ? t("elements.reimport", lang) : t("elements.import", lang)}
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
          {message ? <p className={`text-sm font-medium ${message.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`}>{message.text}</p> : null}

          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{canImport ? t("elements.emptyOffice", lang) : t("elements.empty", lang)}</p>
          ) : (
            <>
              {lists.length > 1 ? (
                <div className="grid grid-cols-2 gap-2">
                  {lists.map((key) => {
                    const count = items.filter((element) => element.list === key).length;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setList(key);
                          setFilter("all");
                        }}
                        className={`h-12 rounded-full border-2 px-4 text-base font-semibold active:scale-95 ${list === key ? "border-orange-500 bg-orange-500/10 text-orange-800 dark:text-orange-200" : "bg-card"}`}
                      >
                        {key === "assembly" ? t("elements.assemblies", lang) : t("elements.parts", lang)} <span className="ml-1 tabular-nums text-muted-foreground">{count}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value.slice(0, 40))}
                    placeholder={t("elements.search", lang)}
                    inputMode="search"
                    className="h-12 w-full rounded-xl border-2 bg-card pl-10 pr-10 text-base outline-none focus:border-orange-500"
                  />
                  {query ? (
                    <button type="button" onClick={() => setQuery("")} className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg" aria-label={t("factory.cancel", lang)}>
                      <X className="size-4" />
                    </button>
                  ) : null}
                </label>
                <div className="flex gap-2 overflow-x-auto pb-0.5">
                  {filters.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFilter(item.key)}
                      className={`h-10 shrink-0 rounded-full border px-3.5 text-sm font-semibold active:scale-95 ${filter === item.key ? "border-orange-500 bg-orange-500 text-white" : "bg-card"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                  <span className="ml-auto shrink-0 self-center pl-2 text-xs tabular-nums text-muted-foreground">
                    {t("elements.doneOf", lang).replace("{done}", String(doneCount)).replace("{total}", String(shown.length))}
                  </span>
                </div>
              </div>

              <ul className="space-y-2">
                {visible.map((element) => (
                  <li key={element.id}>
                    <ElementRow element={element} stages={stages} side={side} onOpen={() => setSelectedId(element.id)} />
                  </li>
                ))}
              </ul>
              {visible.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t("elements.noMatch", lang)}</p> : null}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-2">
      <div className="truncate text-base font-bold tabular-nums">{value}</div>
      <div className="truncate text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ElementRow({ element, stages, side, onOpen }: { element: ElementView; stages: readonly string[]; side: ElementSide; onOpen: () => void }) {
  const { currentLang: lang } = useLanguage();
  const done = elementDone(element, side);
  const total = (element.weightKg ?? 0) * element.quantity;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left active:scale-[0.99] ${done ? "border-emerald-500/50" : ""}`}
    >
      <span className={`grid h-12 min-w-14 shrink-0 place-items-center rounded-xl px-2 text-base font-bold tabular-nums ${done ? "bg-emerald-500 text-white" : "bg-muted"}`}>
        {element.mark}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">
          {[kindLabel(element.kind, lang), element.profile].filter(Boolean).join(" · ") || element.mark}
        </span>
        <span className="block truncate text-xs text-muted-foreground tabular-nums">
          {element.quantity}× {element.weightKg !== null ? `· ${kg(element.weightKg)} kg/${t("elements.pieceShort", lang)} · ${kg(total)} kg` : ""}
          {element.material ? ` · ${element.material}` : ""}
        </span>
        <span className="mt-1.5 flex gap-1">
          {stages.map((stage) => {
            const checked = element.work.some((work) => work.stage === stage);
            return (
              <span
                key={stage}
                title={stageLabel(stage, lang)}
                className={`h-1.5 min-w-0 flex-1 rounded-full ${checked ? "bg-emerald-500" : "bg-muted-foreground/20"}`}
              />
            );
          })}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function ElementDetail({
  element,
  side,
  workers,
  canEdit,
  lastPick,
  onBack,
  onSaved,
}: {
  element: ElementView;
  side: ElementSide;
  workers: ElementWorkerOption[];
  canEdit: boolean;
  lastPick: React.MutableRefObject<Record<string, string[]>>;
  onBack: () => void;
  onSaved: (stage: string, work: ElementWorkView | null) => void;
}) {
  const { currentLang: lang } = useLanguage();
  const [editing, setEditing] = useState<string | null>(null);
  const stages = stagesFor(side, element.list);
  const facts: Array<[string, string]> = [
    [t("elements.quantity", lang), `${element.quantity}×`],
    ...(element.profile ? [[t("elements.profile", lang), element.profile] as [string, string]] : []),
    ...(element.material ? [[t("elements.material", lang), element.material] as [string, string]] : []),
    ...(element.lengthMm !== null ? [[t("elements.length", lang), `${formatAmount(element.lengthMm)} mm`] as [string, string]] : []),
    ...(element.weightKg !== null
      ? [
          [t("elements.weightPiece", lang), `${kg(element.weightKg)} kg`] as [string, string],
          [t("elements.weightTotal", lang), `${kg(element.weightKg * element.quantity)} kg`] as [string, string],
        ]
      : []),
    ...(element.areaM2 !== null ? [[t("elements.area", lang), `${kg(element.areaM2 * element.quantity)} m²`] as [string, string]] : []),
  ];

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold active:scale-95">
        <ArrowLeft className="size-4" /> {t("elements.backToList", lang)}
      </button>

      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className={`grid h-14 min-w-16 place-items-center rounded-xl px-3 text-xl font-bold tabular-nums ${elementDone(element, side) ? "bg-emerald-500 text-white" : "bg-orange-600 text-white"}`}>
            {element.mark}
          </span>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold">{kindLabel(element.kind, lang) ?? (element.list === "part" ? t("elements.part", lang) : t("elements.assembly", lang))}</div>
            <div className="truncate text-sm text-muted-foreground">{element.profile}</div>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {facts.map(([key, value]) => (
            <div key={key} className="rounded-xl bg-muted/60 px-3 py-2">
              <dt className="text-[11px] text-muted-foreground">{key}</dt>
              <dd className="truncate text-sm font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-2">
        {stages.map((stage, index) => {
          const work = element.work.find((entry) => entry.stage === stage) ?? null;
          return (
            <div key={stage} className={`rounded-2xl border-2 bg-card p-3 ${work ? "border-emerald-500/60" : ""}`}>
              <div className="flex items-center gap-3">
                <span className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold ${work ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                  {work ? <Check className="size-5" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold">{stageLabel(stage, lang)}</div>
                  {work ? (
                    <div className="text-sm">
                      <span className="font-semibold">{work.workerNames}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t("elements.confirmedBy", lang).replace("{name}", work.checkedByName).replace("{date}", formatShortDate(work.checkedAt))}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">{t("elements.notChecked", lang)}</div>
                  )}
                </div>
                {canEdit && editing !== stage ? (
                  <button
                    type="button"
                    onClick={() => setEditing(stage)}
                    className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-bold active:scale-95 ${work ? "border-2 bg-card" : "bg-orange-600 text-white shadow-sm"}`}
                  >
                    <UserCheck className="size-4" /> {work ? t("elements.change", lang) : t("elements.pickWorkers", lang)}
                  </button>
                ) : null}
              </div>
              <AnimatePresence initial={false}>
                {editing === stage ? (
                  <motion.div key="picker" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <WorkerPicker
                      element={element}
                      stage={stage}
                      side={side}
                      workers={workers}
                      initial={work?.workerIds ?? []}
                      lastPick={lastPick}
                      onCancel={() => setEditing(null)}
                      onSaved={(next) => {
                        onSaved(stage, next);
                        setEditing(null);
                      }}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      {!canEdit ? <p className="text-center text-sm text-muted-foreground">{side === "factory" ? t("elements.onlyFactoryEngineer", lang) : t("elements.onlyFieldEngineer", lang)}</p> : null}
    </div>
  );
}

function WorkerPicker({
  element,
  stage,
  side,
  workers,
  initial,
  lastPick,
  onCancel,
  onSaved,
}: {
  element: ElementView;
  stage: string;
  side: ElementSide;
  workers: ElementWorkerOption[];
  initial: string[];
  lastPick: React.MutableRefObject<Record<string, string[]>>;
  onCancel: () => void;
  onSaved: (work: ElementWorkView | null) => void;
}) {
  const { currentLang: lang } = useLanguage();
  const [picked, setPicked] = useState<string[]>(initial);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const crew = CREW_FOR_SIDE[side];
  const ownCrew = workers.filter((worker) => worker.crewRole && crew.includes(worker.crewRole));
  // No roles set yet: everybody is offered, nobody is hidden.
  const base = showAll || ownCrew.length === 0 ? workers : ownCrew;
  const q = query.trim().toLowerCase();
  const options = (q ? workers : base).filter((worker) => !q || worker.name.toLowerCase().includes(q));
  const sorted = [...options].sort((a, b) => Number(picked.includes(b.id)) - Number(picked.includes(a.id)) || a.name.localeCompare(b.name));
  const last = (lastPick.current[stage] ?? []).filter((id) => workers.some((worker) => worker.id === id));
  const nameOf = (id: string) => workers.find((worker) => worker.id === id)?.name ?? "";

  function toggle(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((value) => value !== id) : current.length >= 20 ? current : [...current, id]));
  }

  function save(ids: string[]) {
    setError(null);
    startTransition(async () => {
      const result = await setElementWorkAction({ elementId: element.id, stage, workerIds: ids });
      if (!result.ok) {
        setError(result.message || t("factory.error", lang));
        return;
      }
      if (ids.length > 0) lastPick.current[stage] = ids;
      onSaved(
        ids.length > 0
          ? { stage, workerIds: ids, workerNames: ids.map(nameOf).join(", "), checkedByName: result.checkedByName ?? "", checkedAt: new Date().toISOString() }
          : null,
      );
    });
  }

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      {last.length > 0 && last.join() !== picked.join() ? (
        <button
          type="button"
          onClick={() => setPicked(last)}
          className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-orange-500/50 px-3 py-2 text-left text-sm active:scale-[0.99]"
        >
          <Users className="size-4 shrink-0 text-orange-600" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">{t("elements.sameAsLast", lang)}</span> {last.map(nameOf).join(", ")}
          </span>
        </button>
      ) : null}
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, 40))}
            placeholder={t("elements.searchWorker", lang)}
            className="h-11 w-full rounded-xl border-2 bg-background pl-9 pr-3 text-base outline-none focus:border-orange-500"
          />
        </label>
        {ownCrew.length > 0 && ownCrew.length < workers.length ? (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className={`h-11 shrink-0 rounded-xl border-2 px-3 text-sm font-semibold active:scale-95 ${showAll ? "border-orange-500 bg-orange-500/10" : "bg-card"}`}
          >
            {showAll ? (side === "factory" ? t("elements.factoryCrew", lang) : t("elements.fieldCrew", lang)) : t("elements.allWorkers", lang)}
          </button>
        ) : null}
      </div>
      <ul className="grid max-h-[46vh] gap-1.5 overflow-y-auto sm:grid-cols-2">
        {sorted.map((worker) => {
          const on = picked.includes(worker.id);
          return (
            <li key={worker.id}>
              <button
                type="button"
                onClick={() => toggle(worker.id)}
                aria-pressed={on}
                className={`flex h-12 w-full items-center gap-3 rounded-xl border-2 px-3 text-left active:scale-[0.99] ${on ? "border-emerald-500 bg-emerald-500/10" : "bg-background"}`}
              >
                <span className={`grid size-6 shrink-0 place-items-center rounded-md border-2 ${on ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40"}`}>
                  {on ? <Check className="size-4" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{worker.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {sorted.length === 0 ? <p className="text-center text-sm text-muted-foreground">{t("elements.noWorker", lang)}</p> : null}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="h-12 rounded-xl border-2 bg-card font-semibold active:scale-95">
          {t("factory.cancel", lang)}
        </button>
        <button
          type="button"
          disabled={pending || picked.length === 0}
          onClick={() => save(picked)}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white shadow-sm active:scale-95 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-5" />}
          {t("elements.confirm", lang)}
          {picked.length > 0 ? <span className="tabular-nums opacity-85">({picked.length})</span> : null}
        </button>
      </div>
      {initial.length > 0 ? (
        <button type="button" disabled={pending} onClick={() => save([])} className="h-10 w-full rounded-xl text-sm font-semibold text-red-600 active:scale-95 disabled:opacity-50">
          {t("elements.uncheck", lang)}
        </button>
      ) : null}
    </div>
  );
}
