"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, PackageCheck, PackageX, PenLine, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { useLanguage } from "@/components/i18n/language-provider";
import { SteelPhaseArt, SteelProgressRing } from "@/components/steel/steel-art";
import { t } from "@/lib/i18n";
import {
  applySteelPhaseCommand,
  type SteelPhaseCommand,
  type SteelPhaseKey,
  type SteelPhaseMeta,
  type SteelPhaseStatus,
} from "@/lib/workzone/steel-phases";

import { addSteelTaskAction, removeSteelTaskAction, updateSteelPhaseAction } from "../../steel-phase-actions";

export type SteelPhaseView = {
  id: string;
  key: SteelPhaseKey;
  status: SteelPhaseStatus;
  meta: SteelPhaseMeta;
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
  return item.key === "task" ? item.meta.label || t("steel.task", lang) : t(`steel.${item.key}`, lang);
}

function phaseHint(item: SteelPhaseView, lang: string) {
  return t(item.key === "task" ? "steel.taskHint" : `steel.${item.key}Hint`, lang);
}

export function SteelPhaseBoard({
  phases,
  canEdit,
  canManage = false,
  canReport = false,
  baustelleId,
}: {
  phases: SteelPhaseView[];
  /** Field engineer or office: finish, reopen, note. */
  canEdit: boolean;
  /** Everyone signed in: report missing material. */
  canReport?: boolean;
  /** Office: may add and remove own work steps. */
  canManage?: boolean;
  baustelleId: string;
}) {
  const { currentLang } = useLanguage();
  const router = useRouter();
  const [items, setItems] = useState(phases);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState("");

  function addTask() {
    const label = newTask.trim();
    if (!label) return;
    startTransition(async () => {
      const result = await addSteelTaskAction({ baustelleId, label });
      if (!result.ok) {
        setError(t("steel.error", currentLang));
        return;
      }
      setNewTask("");
      setAdding(false);
      router.refresh();
    });
  }

  function removeTask(id: string) {
    startTransition(async () => {
      const result = await removeSteelTaskAction({ phaseItemId: id });
      if (!result.ok) {
        setError(t("steel.error", currentLang));
        return;
      }
      closeSheet();
      router.refresh();
    });
  }

  // Fresh server data (after router.refresh or a realtime update) replaces the optimistic copy.
  const [syncedPhases, setSyncedPhases] = useState(phases);
  if (syncedPhases !== phases) {
    setSyncedPhases(phases);
    setItems(phases);
  }

  const open = openIndex === null ? null : items[openIndex] ?? null;
  const doneCount = items.filter((item) => item.status === "done").length;
  const pct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

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
    if (!open || (command === "missing" ? !canReport : !canEdit)) return;
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
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">{t("steel.phasesTitle", currentLang)}</h2>
            <span className="text-sm tabular-nums text-muted-foreground">
              {doneCount}/{items.length}
            </span>
          </div>
          <ol className="mt-2 flex items-center">
            {items.map((item, index) => (
              <li key={item.id} className="flex flex-1 items-center last:flex-none">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold transition-colors ${STATUS_STYLE[item.status].dot}`}
                >
                  {item.status === "done" ? <Check className="size-3.5" strokeWidth={3} /> : item.status === "blocked" ? "!" : index + 1}
                </span>
                {index < items.length - 1 ? (
                  <span className="mx-1 h-1 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <span
                      className="block h-full rounded-full bg-green-500 transition-[width] duration-700"
                      style={{ width: item.status === "done" ? "100%" : "0%" }}
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
                <SteelPhaseArt phase={item.key} animate={item.status !== "done"} className="absolute inset-0 h-full w-full p-2" />
                <span className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-white">
                  {String(index + 1).padStart(2, "0")}
                </span>
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
                <span className="text-[15px] font-semibold leading-tight sm:text-base">{phaseName(item, currentLang)}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{phaseHint(item, currentLang)}</span>
                <span className={`mt-auto inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.chip}`}>
                  {statusLabel(item.status, currentLang)}
                </span>
                {item.status === "blocked" && item.meta.material ? (
                  <span className="line-clamp-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">{item.meta.material}</span>
                ) : item.meta.note ? (
                  <span className="line-clamp-1 text-[11px] text-sky-700 dark:text-sky-300">✎ {item.meta.note}</span>
                ) : null}
              </div>
              <span className={`absolute inset-x-0 bottom-0 h-1 ${style.bar}`} />
            </button>
          );
        })}
        {canManage ? (
          adding ? (
            <div className="flex min-h-[200px] flex-col gap-2 rounded-2xl border-2 border-dashed border-orange-500/50 bg-card p-3">
              <span className="text-sm font-semibold">{t("steel.addTask", currentLang)}</span>
              <input
                autoFocus
                value={newTask}
                onChange={(event) => setNewTask(event.target.value.slice(0, 80))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addTask();
                  if (event.key === "Escape") setAdding(false);
                }}
                placeholder={t("steel.taskPlaceholder", currentLang)}
                className="h-12 w-full rounded-xl border-2 bg-background px-3 text-base outline-none focus:border-orange-500"
              />
              <div className="mt-auto grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAdding(false)} className="h-12 rounded-xl border-2 bg-card text-sm font-semibold active:scale-95">
                  {t("steel.cancel", currentLang)}
                </button>
                <button
                  type="button"
                  disabled={pending || !newTask.trim()}
                  onClick={addTask}
                  className="h-12 rounded-xl bg-orange-600 text-sm font-bold text-white active:scale-95 disabled:opacity-50"
                >
                  {t("steel.save", currentLang)}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-muted-foreground transition hover:border-orange-500/60 hover:text-orange-600 active:scale-[0.98]"
            >
              <span className="grid size-12 place-items-center rounded-full border-2 border-current">
                <Plus className="size-6" />
              </span>
              <span className="text-sm font-semibold">{t("steel.addTask", currentLang)}</span>
            </button>
          )
        ) : null}
      </div>

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
                  <SteelPhaseArt phase={open.key} animate={open.status !== "done"} className="mx-auto block h-[30vh] max-h-[300px] min-h-[160px] w-full p-3" />
                  {open.status === "done" ? (
                    <span className="absolute right-3 top-3 grid size-12 place-items-center rounded-full bg-green-500 text-white shadow-lg">
                      <Check className="size-7" strokeWidth={3} />
                    </span>
                  ) : null}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{phaseName(open, currentLang)}</h2>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[open.status].chip}`}>
                      {statusLabel(open.status, currentLang)}
                    </span>
                  </div>
                  <p className="mt-1 text-base text-muted-foreground">{phaseHint(open, currentLang)}</p>
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {open.status === "done" ? (
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
                  {canManage && open.key === "task" && !editor ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => removeTask(open.id)}
                      className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-red-600 active:scale-[0.98] disabled:opacity-50"
                    >
                      <Trash2 className="size-4" /> {t("steel.removeTask", currentLang)}
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
