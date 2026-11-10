"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, PackageCheck, PackageX, PenLine, Plus, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { useLanguage } from "@/components/i18n/language-provider";
import { SteelProgressRing } from "@/components/steel/steel-art";
import { SteelWorkCatalog, SteelWorkVisual } from "@/components/steel/work-catalog";
import { workCatalogCopy } from "@/components/steel/work-catalog-copy";
import { t } from "@/lib/i18n";
import type { SteelWorkDefinitionView } from "@/lib/steel-work/types";
import {
  applySteelPhaseCommand,
  type SteelPhaseCommand,
  type SteelPhaseKey,
  type SteelPhaseMeta,
  type SteelPhaseStatus,
} from "@/lib/workzone/steel-phases";

import { updateSteelPhaseAction } from "../../steel-phase-actions";

export type SteelPhaseView = {
  id: string;
  key: SteelPhaseKey;
  status: SteelPhaseStatus;
  meta: SteelPhaseMeta;
  definitionId?: string;
  /** Who put this phase on the site. */
  addedBy?: string;
  automatic?: boolean;
  percent?: number | null;
  completedPieces?: number;
  requiredPieces?: number;
};

type Editor = "note" | "missing" | null;

const STATUS_STYLE: Record<SteelPhaseStatus, { chip: string; bar: string; dot: string }> = {
  todo: {
    chip: "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-200",
    bar: "bg-slate-300 dark:bg-slate-700",
    dot: "border-slate-300 bg-card text-slate-500 dark:border-slate-600",
  },
  done: {
    chip: "border-green-500/40 bg-green-500/12 text-green-700 dark:text-green-300",
    bar: "bg-green-500",
    dot: "border-green-500 bg-green-500 text-white",
  },
  blocked: {
    chip: "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
    dot: "border-amber-500 bg-amber-500 text-white",
  },
};

function statusLabel(status: SteelPhaseStatus, lang: string) {
  if (status === "done") return t("steel.statusDone", lang);
  if (status === "blocked") return t("steel.statusBlocked", lang);
  return t("steel.statusTodo", lang);
}

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, String(value)), template);
}

function phaseName(item: SteelPhaseView, lang: string) {
  return item.meta.label.trim() || t(item.key === "task" ? "steel.task" : `steel.${item.key}`, lang);
}

function phasePercent(item: SteelPhaseView) {
  return item.automatic ? Math.min(100, Math.max(0, Number.isFinite(item.percent) ? item.percent! : 0)) : item.status === "done" ? 100 : 0;
}

function phaseHint(item: SteelPhaseView, lang: string) {
  if (item.key === "task" && item.addedBy) return fill(t("steel.addedBy", lang), { name: item.addedBy });
  return t(item.key === "task" ? "steel.taskHint" : `steel.${item.key}Hint`, lang);
}

export function SteelPhaseBoard({
  phases,
  canEdit,
  canManage = false,
  canReport = false,
  baustelleId,
  definitions = [],
}: {
  phases: SteelPhaseView[];
  /** Field engineer or office: finish, reopen, note. */
  canEdit: boolean;
  /** Everyone signed in: report missing material. */
  canReport?: boolean;
  /** Authorized planners: select tasks and manage shared work definitions. */
  canManage?: boolean;
  baustelleId: string;
  definitions?: SteelWorkDefinitionView[];
}) {
  const { currentLang } = useLanguage();
  const router = useRouter();
  const [items, setItems] = useState(phases);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogInitialId, setCatalogInitialId] = useState<string | null>(null);
  const catalogTrigger = useRef<HTMLButtonElement>(null);
  const c = workCatalogCopy(currentLang);
  const definitionOf = (item: SteelPhaseView) => definitions.find((definition) => definition.id === item.definitionId)
    ?? definitions.find((definition) => definition.phaseItemId === item.id)
    ?? definitions.find((definition) => definition.kind === "site" && (definition.key === item.key || definition.key === `steel-${item.key}`));

  // Fresh server data (after router.refresh or a realtime update) replaces the optimistic copy.
  const [syncedPhases, setSyncedPhases] = useState(phases);
  if (syncedPhases !== phases) {
    setSyncedPhases(phases);
    setItems(phases);
  }

  const open = openIndex === null ? null : items[openIndex] ?? null;
  const doneCount = items.filter((item) => item.status === "done").length;
  const pct = items.length > 0 ? Math.round(items.reduce((sum, item) => sum + phasePercent(item), 0) / items.length) : 0;

  useEffect(() => {
    if (openIndex === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeSheet();
      if (editor) return;
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIndex, editor]);

  function closeSheet() {
    setOpenIndex(null);
    setEditor(null);
    setError(null);
  }

  function move(step: number) {
    setEditor(null);
    setError(null);
    setOpenIndex((index) => (index === null ? index : (index + step + items.length) % items.length));
  }

  function openEditor(kind: Exclude<Editor, null>) {
    if (!open) return;
    setEditor(kind);
    setError(null);
    setText(kind === "note" ? open.meta.note : open.meta.material);
  }

  function run(command: "done" | "reopen" | "note" | "missing" | "materialArrived", value = "") {
    if (!open || (open.automatic && (command === "done" || command === "reopen")) || (command === "missing" ? !canReport : !canEdit)) return;
    const target = open;
    const local: SteelPhaseCommand =
      command === "note" || command === "missing"
        ? { kind: command, actor: "…", text: value.trim() }
        : command === "done"
          ? { kind: "done", actor: "…" }
          : { kind: command };
    const before = items;
    const next = applySteelPhaseCommand({ status: target.status, meta: target.meta }, local, new Date());
    setItems((list) => list.map((item) => (item.id === target.id ? { ...item, ...next } : item)));
    setEditor(null);
    setError(null);
    startTransition(async () => {
      const result = await updateSteelPhaseAction({ phaseItemId: target.id, command, text: value });
      if (!result.ok) {
        setItems(before);
        setError(t("steel.error", currentLang));
        return;
      }
      router.refresh();
    });
  }

  const chips = t("steel.materialChips", currentLang).split(",").map((chip) => chip.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Process track: the phases in work order, like a line in the hall. */}
      <div className="flex items-center gap-4 rounded-2xl border bg-gradient-to-r from-orange-500/[0.07] via-transparent to-transparent p-3 sm:p-4">
        <div className="text-orange-600 dark:text-orange-400">
          <SteelProgressRing pct={pct} size={60} label={`${t("steel.progress", currentLang)} ${pct}%`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t("steel.phasesTitle", currentLang)}</h2>
            <div className="flex items-center gap-2"><span className="text-sm tabular-nums text-muted-foreground">{doneCount}/{items.length}</span>
              {canManage ? <button ref={catalogTrigger} type="button" onClick={() => { setCatalogInitialId(null); setCatalogOpen(true); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><Plus className="size-4" />{t("steel.addTask", currentLang)}</button> : null}
            </div>
          </div>
          <ol className="mt-2 flex flex-wrap items-center gap-y-2">
            {items.map((item, index) => (
              <li key={item.id} className="flex min-w-9 max-w-14 flex-1 items-center last:flex-none">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold transition-colors ${STATUS_STYLE[item.status].dot}`}
                >
                  {item.status === "done" ? <Check className="size-3.5" strokeWidth={3} /> : item.status === "blocked" ? "!" : index + 1}
                </span>
                {index < items.length - 1 ? (
                  <span className="mx-1 h-1 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <span
                      className="block h-full rounded-full bg-green-500 transition-[width] duration-700"
                      style={{ width: `${phasePercent(item)}%` }}
                    />
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">{t("steel.phasesHint", currentLang)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {items.map((item, index) => {
          const style = STATUS_STYLE[item.status];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setOpenIndex(index);
                setEditor(null);
              }}
              className={`group relative flex min-h-[200px] flex-col overflow-hidden rounded-2xl border-2 bg-card text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/40 ${
                item.status === "done" ? "border-green-500/60" : item.status === "blocked" ? "border-amber-500/70" : "border-border"
              }`}
            >
              <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950">
                <SteelWorkVisual definition={definitionOf(item)} fallback={item.key} animate={item.status !== "done"} className="absolute inset-0 h-full w-full" />
                {item.status === "done" ? (
                  <span className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-green-500 text-white shadow-md">
                    <Check className="size-5" strokeWidth={3} />
                  </span>
                ) : item.status === "blocked" ? (
                  <span className="absolute right-2 top-2 grid size-8 animate-pulse place-items-center rounded-full bg-amber-500 text-white shadow-md">
                    <AlertTriangle className="size-4.5" strokeWidth={2.5} />
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <span className="min-w-0 break-words text-[15px] font-semibold leading-tight sm:text-base">{phaseName(item, currentLang)}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{phaseHint(item, currentLang)}</span>
                <span className={`mt-auto inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.chip}`}>
                  {statusLabel(item.status, currentLang)}
                </span>
                {item.automatic ? <span className="text-xs tabular-nums text-muted-foreground">{c.fromMaterials} · {(item.requiredPieces ?? 0) > 0 ? `${item.completedPieces ?? 0}/${item.requiredPieces} ${c.pieces}` : c.noMaterials}</span> : null}
                {item.status === "blocked" && item.meta.material ? (
                  <span className="line-clamp-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">{item.meta.material}</span>
                ) : item.meta.note ? (
                  <span className="line-clamp-1 text-[11px] text-sky-700 dark:text-sky-300">✎ {item.meta.note}</span>
                ) : null}
              </div>
              <span className="absolute inset-x-0 bottom-0 h-1 bg-muted"><span className={`block h-full ${style.bar}`} style={{ width: item.automatic ? `${phasePercent(item)}%` : "100%" }} /></span>
            </button>
          );
        })}

      </div>

      <SteelWorkCatalog open={catalogOpen} onOpenChange={setCatalogOpen} kind="site" siteId={baustelleId} definitions={definitions} canManage={canManage} initialDefinitionId={catalogInitialId} onChanged={() => router.refresh()} returnFocusRef={catalogTrigger} />

      {typeof document !== "undefined"
        ? createPortal(
      <AnimatePresence>
        {open && openIndex !== null ? (
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={phaseName(open, currentLang)}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 28 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-0 z-[1200] flex flex-col bg-background"
          >
            <div className="flex items-center gap-2 border-b px-3 py-2 sm:px-6">
              <button
                type="button"
                onClick={closeSheet}
                className="grid size-12 place-items-center rounded-full border bg-card active:scale-95"
                aria-label={t("steel.close", currentLang)}
              >
                <X className="size-6" />
              </button>
              <div className="min-w-0 flex-1 text-center text-sm font-medium text-muted-foreground">
                {fill(t("steel.step", currentLang), { n: openIndex + 1, total: items.length })}
              </div>
              <button
                type="button"
                onClick={() => move(-1)}
                className="grid size-12 place-items-center rounded-full border bg-card active:scale-95"
                aria-label={t("steel.prev", currentLang)}
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                className="grid size-12 place-items-center rounded-full border bg-card active:scale-95"
                aria-label={t("steel.next", currentLang)}
              >
                <ChevronRight className="size-6" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
                <div
                  className={`relative overflow-hidden rounded-3xl border-2 bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 ${
                    open.status === "done" ? "border-green-500/60" : open.status === "blocked" ? "border-amber-500/70" : "border-transparent"
                  }`}
                >
                  <SteelWorkVisual definition={definitionOf(open)} fallback={open.key} animate={open.status !== "done"} className="mx-auto block h-[30vh] max-h-[300px] min-h-[160px] w-full" />
                  {open.status === "done" ? (
                    <span className="absolute right-3 top-3 grid size-12 place-items-center rounded-full bg-green-500 text-white shadow-lg">
                      <Check className="size-7" strokeWidth={3} />
                    </span>
                  ) : null}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 break-words text-2xl font-bold tracking-tight sm:text-3xl">{phaseName(open, currentLang)}</h2>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[open.status].chip}`}>
                      {statusLabel(open.status, currentLang)}
                    </span>
                  </div>
                  <p className="mt-1 text-base text-muted-foreground">{phaseHint(open, currentLang)}</p>
                  {open.key !== "task" && open.addedBy ? <p className="mt-0.5 text-sm text-muted-foreground">{fill(t("steel.addedBy", currentLang), { name: open.addedBy })}</p> : null}
                  {open.automatic ? <p className="mt-2 text-sm font-semibold tabular-nums text-muted-foreground">{c.fromMaterials} · {(open.requiredPieces ?? 0) > 0 ? `${open.completedPieces ?? 0}/${open.requiredPieces} ${c.pieces}` : c.noMaterials}</p> : null}
                  <div className="mt-3 space-y-2 text-sm">
                    {open.status === "done" && open.meta.doneBy && open.meta.doneBy !== "…" ? (
                      <p className="font-medium text-green-700 dark:text-green-300">{fill(t("steel.doneBy", currentLang), { name: open.meta.doneBy })}</p>
                    ) : null}
                    {open.meta.material ? (
                      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                        <div className="font-semibold text-amber-800 dark:text-amber-200">⚠ {open.meta.material}</div>
                        {open.meta.materialBy && open.meta.materialBy !== "…" ? (
                          <div className="text-xs text-amber-700/80 dark:text-amber-300/80">{fill(t("steel.materialBy", currentLang), { name: open.meta.materialBy })}</div>
                        ) : null}
                      </div>
                    ) : null}
                    {open.meta.note ? (
                      <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
                        <div className="font-medium text-sky-900 dark:text-sky-100">{open.meta.note}</div>
                        {open.meta.noteBy && open.meta.noteBy !== "…" ? (
                          <div className="text-xs text-sky-700/80 dark:text-sky-300/80">{fill(t("steel.noteBy", currentLang), { name: open.meta.noteBy })}</div>
                        ) : null}
                      </div>
                    ) : null}
                    {error ? <p className="font-medium text-red-600">{error}</p> : null}
                  </div>
                </div>

                <div className="mt-auto pb-[env(safe-area-inset-bottom)]">
                  {!canEdit && !canReport ? (
                    <p className="rounded-xl border bg-muted/40 p-4 text-center text-sm text-muted-foreground">{t("steel.needsLogin", currentLang)}</p>
                  ) : editor ? (
                    <div className="space-y-3">
                      <textarea
                        autoFocus
                        value={text}
                        onChange={(event) => setText(event.target.value.slice(0, 500))}
                        rows={3}
                        placeholder={t(editor === "note" ? "steel.notePlaceholder" : "steel.materialPlaceholder", currentLang)}
                        className="w-full resize-none rounded-2xl border-2 bg-card p-4 text-lg outline-none focus:border-orange-500"
                      />
                      {editor === "missing" ? (
                        <div className="flex flex-wrap gap-2">
                          {chips.map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => setText((value) => (value.trim() ? `${value.trim()}, ${chip}` : chip))}
                              className="h-11 rounded-full border-2 border-amber-500/40 bg-amber-500/10 px-4 text-sm font-semibold text-amber-800 active:scale-95 dark:text-amber-200"
                            >
                              + {chip}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setEditor(null)}
                          className="h-16 rounded-2xl border-2 bg-card text-lg font-semibold active:scale-[0.98]"
                        >
                          {t("steel.cancel", currentLang)}
                        </button>
                        <button
                          type="button"
                          disabled={pending || (editor === "missing" && !text.trim())}
                          onClick={() => run(editor, text)}
                          className={`h-16 rounded-2xl text-lg font-bold text-white shadow-md active:scale-[0.98] disabled:opacity-50 ${
                            editor === "missing" ? "bg-amber-500" : "bg-sky-600"
                          }`}
                        >
                          {t("steel.save", currentLang)}
                        </button>
                      </div>
                    </div>
                  ) : !canEdit ? (
                    <div className="space-y-3">
                      {open.status !== "done" && open.status !== "blocked" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => openEditor("missing")}
                          className="flex h-20 w-full items-center justify-center gap-3 rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 text-lg font-semibold text-amber-800 active:scale-[0.98] disabled:opacity-50 dark:text-amber-200"
                        >
                          <PackageX className="size-6" /> {t("steel.missing", currentLang)}
                        </button>
                      ) : null}
                      <p className="rounded-xl border bg-muted/40 p-3 text-center text-sm text-muted-foreground">{t("steel.onlyEngineer", currentLang)}</p>
                    </div>
                  ) : (
                    <div className={`grid grid-cols-1 gap-3 ${open.automatic ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                      {open.automatic ? null : open.status === "done" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run("reopen")}
                          className="flex h-20 items-center justify-center gap-3 rounded-2xl border-2 bg-card text-lg font-semibold active:scale-[0.98] disabled:opacity-50"
                        >
                          <RotateCcw className="size-6" /> {t("steel.reopen", currentLang)}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run("done")}
                          className="flex h-20 items-center justify-center gap-3 rounded-2xl bg-green-600 text-xl font-bold text-white shadow-lg shadow-green-600/25 active:scale-[0.98] disabled:opacity-50"
                        >
                          <Check className="size-7" strokeWidth={3} /> {t("steel.markDone", currentLang)}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => openEditor("note")}
                        className="flex h-20 items-center justify-center gap-3 rounded-2xl border-2 border-sky-500/40 bg-sky-500/10 text-lg font-semibold text-sky-800 active:scale-[0.98] disabled:opacity-50 dark:text-sky-200"
                      >
                        <PenLine className="size-6" /> {t("steel.note", currentLang)}
                      </button>
                      {open.status === "blocked" ? (
                        <button
                          key="arrived"
                          type="button"
                          disabled={pending}
                          onClick={() => run("materialArrived")}
                          className="flex h-20 items-center justify-center gap-3 rounded-2xl border-2 border-green-500/50 bg-green-500/10 text-lg font-semibold text-green-800 active:scale-[0.98] disabled:opacity-50 dark:text-green-200"
                        >
                          <PackageCheck className="size-6" /> {t("steel.arrived", currentLang)}
                        </button>
                      ) : (
                        <button
                          key="missing"
                          type="button"
                          disabled={pending}
                          onClick={() => openEditor("missing")}
                          className="flex h-20 items-center justify-center gap-3 rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 text-lg font-semibold text-amber-800 active:scale-[0.98] disabled:opacity-50 dark:text-amber-200"
                        >
                          <PackageX className="size-6" /> {t("steel.missing", currentLang)}
                        </button>
                      )}
                    </div>
                  )}
                  {canManage && definitionOf(open) && !editor ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => { setCatalogInitialId(definitionOf(open)?.id ?? null); closeSheet(); setCatalogOpen(true); }}
                      className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-[0.98] disabled:opacity-50"
                    >
                      <PenLine className="size-4" /> {c.edit}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}
