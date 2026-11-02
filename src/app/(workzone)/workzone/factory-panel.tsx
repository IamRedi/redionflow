"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, MapPin, PenLine, Play, Plus, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useLanguage } from "@/components/i18n/language-provider";
import { SteelPhaseArt, SteelSiteArt, type SteelArtKey } from "@/components/steel/steel-art";
import {
  applyStepCommand,
  batchState,
  currentStepIndex,
  formatQuantity,
  PRODUCTION_UNITS,
  type BatchState,
  type FactoryStep,
  type StepCommand,
} from "@/lib/factory/production";
import { t } from "@/lib/i18n";

import { createProductionBatchAction, updateProductionStepAction } from "./factory-actions";

export type FactoryBatchView = {
  id: string;
  title: string;
  quantity: number | null;
  unit: string;
  siteId: string;
  siteName: string;
  steps: FactoryStep[];
  events: Array<{ id: string; action: string; stepKey: string | null; note: string | null; actorName: string; createdAt: string }>;
};

const ART_KEYS = new Set(["cutting", "laser", "assembly", "final"]);

function artKey(key: string): SteelArtKey {
  return (ART_KEYS.has(key) ? key : "cutting") as SteelArtKey;
}

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, String(value)), template);
}

const STATE_STYLE: Record<BatchState, string> = {
  waiting: "border-border",
  inProgress: "border-orange-500/70",
  blocked: "border-amber-500",
  ready: "border-green-500/70",
};

const STEP_CHIP: Record<FactoryStep["status"], string> = {
  todo: "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-200",
  active: "border-orange-500/50 bg-orange-500/12 text-orange-700 dark:text-orange-300",
  done: "border-green-500/50 bg-green-500/12 text-green-700 dark:text-green-300",
  blocked: "border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-200",
};

const BELT_STYLE = `
.fx-belt{background-image:repeating-linear-gradient(90deg,rgba(100,116,139,.55) 0 12px,rgba(148,163,184,.25) 12px 24px);background-size:24px 100%;animation:fx-belt 1.1s linear infinite}
@keyframes fx-belt{to{background-position:24px 0}}
@media (prefers-reduced-motion: reduce){.fx-belt{animation:none}}
`;

function StepDots({ steps }: { steps: FactoryStep[] }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {steps.map((step) => (
        <span
          key={step.key}
          className={`h-1.5 flex-1 rounded-full ${
            step.status === "done" ? "bg-green-500" : step.status === "active" ? "animate-pulse bg-orange-500" : step.status === "blocked" ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-700"
          }`}
        />
      ))}
    </span>
  );
}

function Sheet({ children, onClose, label, closeLabel }: { children: ReactNode; onClose: () => void; label: string; closeLabel: string }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 28 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="fixed inset-0 z-[1200] flex flex-col bg-background"
    >
      <div className="flex items-center gap-2 border-b px-3 py-2 sm:px-6">
        <button type="button" onClick={onClose} className="grid size-12 place-items-center rounded-full border bg-card active:scale-95" aria-label={closeLabel}>
          <X className="size-6" />
        </button>
        <div className="min-w-0 flex-1 truncate text-center text-sm font-medium text-muted-foreground">{label}</div>
        <span className="size-12" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">{children}</div>
      </div>
    </motion.div>,
    document.body,
  );
}

export function FactoryPanel({
  factoryName,
  factoryAddress,
  batches,
  sites,
  canManage,
  canEdit,
}: {
  factoryName: string;
  factoryAddress: string;
  batches: FactoryBatchView[];
  sites: Array<{ id: string; name: string }>;
  canManage: boolean;
  canEdit: boolean;
}) {
  const { currentLang: lang } = useLanguage();
  const router = useRouter();
  const [items, setItems] = useState(batches);
  const [synced, setSynced] = useState(batches);
  if (synced !== batches) {
    setSynced(batches);
    setItems(batches);
  }
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editor, setEditor] = useState<{ index: number; kind: "block" | "note" } | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const stepKeys = items[0]?.steps.map((step) => step.key) ?? ["cutting", "laser", "assembly", "final"];
  const open = items.find((item) => item.id === openId) ?? null;
  const counts = {
    line: items.filter((item) => batchState(item.steps) !== "ready").length,
    blocked: items.filter((item) => batchState(item.steps) === "blocked").length,
    ready: items.filter((item) => batchState(item.steps) === "ready").length,
  };
  const stationOf = (item: FactoryBatchView) => currentStepIndex(item.steps);

  function closeAll() {
    setOpenId(null);
    setCreating(false);
    setEditor(null);
    setError(null);
  }

  function run(batch: FactoryBatchView, index: number, command: StepCommand) {
    if (!canEdit) return;
    let next: FactoryStep[];
    try {
      next = applyStepCommand(batch.steps, index, command, "…", new Date()).steps;
    } catch {
      return;
    }
    const before = items;
    setItems((list) => list.map((item) => (item.id === batch.id ? { ...item, steps: next } : item)));
    setEditor(null);
    setError(null);
    startTransition(async () => {
      const result = await updateProductionStepAction({
        batchId: batch.id,
        stepIndex: index,
        command: command.kind,
        text: command.kind === "block" || command.kind === "note" ? command.text : "",
      });
      if (!result.ok) {
        setItems(before);
        setError(t("factory.error", lang));
        return;
      }
      router.refresh();
    });
  }

  return (
    <section id="fabrika" className="scroll-mt-4 overflow-hidden rounded-3xl border bg-card shadow-sm">
      <style>{BELT_STYLE}</style>
      <div className="relative overflow-hidden border-b">
        <SteelSiteArt type="STEEL_WORKSHOP" pct={items.length ? Math.round((counts.ready / items.length) * 100) : 0} live={counts.line > 0} fit="meet" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-card via-card/85 to-transparent" />
        <div className="relative flex min-h-[150px] flex-col justify-end gap-2 p-4 sm:p-6">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600 dark:text-orange-400">{t("factory.title", lang)}</span>
          <h2 className="text-2xl font-bold tracking-tight">{factoryName}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{factoryAddress || t("factory.subtitle", lang)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300">
              {t("factory.inLine", lang)}: {counts.line}
            </span>
            {counts.blocked > 0 ? (
              <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
                {t("factory.blocked", lang)}: {counts.blocked}
              </span>
            ) : null}
            <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-700 dark:text-green-300">
              {t("factory.ready", lang)}: {counts.ready}
            </span>
            {canManage ? (
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setError(null);
                }}
                className="ml-auto inline-flex h-11 items-center gap-2 rounded-full bg-orange-600 px-4 text-sm font-bold text-white shadow-md shadow-orange-600/20 active:scale-95"
              >
                <Plus className="size-5" /> {t("factory.addBatch", lang)}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* The production line: stations left to right, ready dock at the end. */}
      <div className="relative overflow-x-auto">
        <div className="fx-belt pointer-events-none absolute left-4 right-4 top-[7.25rem] h-2 rounded-full" />
        <div className="grid min-w-max auto-cols-[minmax(180px,1fr)] grid-flow-col gap-3 p-4 sm:min-w-0">
          {stepKeys.map((key, stationIndex) => {
            const here = items.filter((item) => stationOf(item) === stationIndex);
            return (
              <div key={key} className="relative flex flex-col rounded-2xl border bg-muted/30">
                <div className="relative h-28 overflow-hidden rounded-t-2xl bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950">
                  <SteelPhaseArt phase={artKey(key)} animate={here.some((item) => item.steps[stationIndex]?.status === "active")} className="absolute inset-0 h-full w-full p-1.5" />
                  <span className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">{String(stationIndex + 1).padStart(2, "0")}</span>
                  <span className="absolute right-2 top-2 grid min-w-7 place-items-center rounded-full bg-background/90 px-1.5 text-xs font-bold tabular-nums shadow-sm">{here.length}</span>
                </div>
                <div className="px-3 pb-1 pt-2">
                  <div className="text-sm font-semibold">{t(`factory.steps.${key}`, lang)}</div>
                  <div className="text-[11px] text-muted-foreground">{t(`factory.stepHints.${key}`, lang)}</div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {here.map((item) => (
                    <BatchCard key={item.id} item={item} lang={lang} onOpen={() => setOpenId(item.id)} />
                  ))}
                  {here.length === 0 ? <div className="grid flex-1 place-items-center rounded-xl border border-dashed py-4 text-xs text-muted-foreground">{t("factory.emptyStation", lang)}</div> : null}
                </div>
              </div>
            );
          })}
          <div className="relative flex flex-col rounded-2xl border-2 border-green-500/40 bg-green-500/[0.06]">
            <div className="relative h-28 overflow-hidden rounded-t-2xl bg-gradient-to-br from-green-50 to-slate-50 dark:from-green-950/40 dark:to-slate-950">
              <SteelPhaseArt phase="final" animate={counts.ready > 0} className="absolute inset-0 h-full w-full p-1.5" />
              <span className="absolute right-2 top-2 grid min-w-7 place-items-center rounded-full bg-green-600 px-1.5 text-xs font-bold tabular-nums text-white shadow-sm">{counts.ready}</span>
            </div>
            <div className="px-3 pb-1 pt-2">
              <div className="text-sm font-semibold text-green-700 dark:text-green-300">{t("factory.readyDock", lang)}</div>
              <div className="text-[11px] text-muted-foreground">{t("factory.readyHint", lang)}</div>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {items
                .filter((item) => stationOf(item) === -1)
                .map((item) => (
                  <BatchCard key={item.id} item={item} lang={lang} onOpen={() => setOpenId(item.id)} />
                ))}
              {counts.ready === 0 ? <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-green-500/30 py-4 text-xs text-muted-foreground">{t("factory.emptyStation", lang)}</div> : null}
            </div>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="border-t px-4 py-5 text-center">
          <p className="font-medium">{t("factory.empty", lang)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("factory.emptyHint", lang)}</p>
        </div>
      ) : null}

      <AnimatePresence>
        {open ? (
          <Sheet key="batch" onClose={closeAll} label={`${open.title} · ${open.siteName}`} closeLabel={t("factory.close", lang)}>
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{open.title}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" /> {open.siteName}
                </span>
                {open.quantity !== null ? (
                  <span className="font-semibold text-foreground">
                    {formatQuantity(open.quantity, lang)} {t(`factory.units.${open.unit}`, lang)}
                  </span>
                ) : null}
              </p>
            </div>
            {batchState(open.steps) === "ready" ? (
              <div className="flex items-center gap-3 rounded-2xl border-2 border-green-500/60 bg-green-500/10 p-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-green-600 text-white">
                  <Check className="size-7" strokeWidth={3} />
                </span>
                <div>
                  <div className="text-lg font-bold text-green-800 dark:text-green-200">{t("factory.readyBanner", lang)}</div>
                  <div className="text-sm text-green-800/80 dark:text-green-200/80">{t("factory.readyHint", lang)}</div>
                </div>
              </div>
            ) : null}
            {error ? <p className="font-medium text-red-600">{error}</p> : null}
            {!canEdit ? <p className="rounded-xl border bg-muted/40 p-4 text-center text-sm text-muted-foreground">{t("factory.needsLogin", lang)}</p> : null}

            <ol className="space-y-3">
              {open.steps.map((step, index) => {
                const current = currentStepIndex(open.steps);
                const isCurrent = index === current;
                const isLastDone = step.status === "done" && open.steps.slice(index + 1).every((later) => later.status === "todo");
                const editing = editor?.index === index ? editor.kind : null;
                return (
                  <li
                    key={step.key}
                    className={`overflow-hidden rounded-2xl border-2 bg-card ${
                      isCurrent ? (step.status === "blocked" ? "border-amber-500" : "border-orange-500/70 shadow-md") : step.status === "done" ? "border-green-500/40" : "border-border opacity-80"
                    }`}
                  >
                    <div className="flex gap-3 p-3">
                      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-orange-50 dark:from-slate-800 dark:to-slate-950">
                        <SteelPhaseArt phase={artKey(step.key)} animate={step.status === "active"} className="absolute inset-0 h-full w-full" />
                        {step.status === "done" ? (
                          <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-green-600 text-white">
                            <Check className="size-4" strokeWidth={3} />
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-medium text-muted-foreground">{fill(t("factory.stepOf", lang), { n: index + 1, total: open.steps.length })}</div>
                        <div className="text-lg font-semibold leading-tight">{t(`factory.steps.${step.key}`, lang)}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STEP_CHIP[step.status]}`}>
                            {step.status === "done" ? t("factory.stepDone", lang) : step.status === "active" ? t("factory.inProgress", lang) : step.status === "blocked" ? t("factory.stepBlock", lang) : t("factory.waiting", lang)}
                          </span>
                          {step.by && step.by !== "…" ? <span className="text-[11px] text-muted-foreground">{fill(t("factory.by", lang), { name: step.by })}</span> : null}
                        </div>
                        {step.note ? <p className={`mt-1 text-sm ${step.status === "blocked" ? "font-semibold text-amber-800 dark:text-amber-200" : "text-sky-800 dark:text-sky-200"}`}>{step.status === "blocked" ? "⚠ " : "✎ "}{step.note}</p> : null}
                      </div>
                    </div>

                    {canEdit && editing ? (
                      <div className="space-y-2 border-t p-3">
                        <textarea
                          autoFocus
                          value={text}
                          onChange={(event) => setText(event.target.value.slice(0, 500))}
                          rows={2}
                          placeholder={t(editing === "block" ? "factory.blockPlaceholder" : "factory.notePlaceholder", lang)}
                          className="w-full resize-none rounded-xl border-2 bg-background p-3 text-base outline-none focus:border-orange-500"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setEditor(null)} className="h-14 rounded-xl border-2 bg-card font-semibold active:scale-[0.98]">
                            {t("factory.cancel", lang)}
                          </button>
                          <button
                            type="button"
                            disabled={pending || (editing === "block" && !text.trim())}
                            onClick={() => run(open, index, editing === "block" ? { kind: "block", text } : { kind: "note", text })}
                            className={`h-14 rounded-xl font-bold text-white active:scale-[0.98] disabled:opacity-50 ${editing === "block" ? "bg-amber-500" : "bg-sky-600"}`}
                          >
                            {t("factory.save", lang)}
                          </button>
                        </div>
                      </div>
                    ) : canEdit && (isCurrent || isLastDone) ? (
                      <div className="grid grid-cols-2 gap-2 border-t p-3 sm:grid-cols-4">
                        {isCurrent && step.status === "todo" ? (
                          <ActionButton tone="orange" icon={<Play className="size-5" />} label={t("factory.stepStart", lang)} disabled={pending} onClick={() => run(open, index, { kind: "start" })} />
                        ) : null}
                        {isCurrent && step.status === "blocked" ? (
                          <ActionButton tone="orange" icon={<Play className="size-5" />} label={t("factory.stepUnblock", lang)} disabled={pending} onClick={() => run(open, index, { kind: "unblock" })} />
                        ) : null}
                        {isCurrent && step.status !== "blocked" ? (
                          <ActionButton tone="green" icon={<Check className="size-5" strokeWidth={3} />} label={t("factory.stepDone", lang)} disabled={pending} onClick={() => run(open, index, { kind: "done" })} />
                        ) : null}
                        {isCurrent ? (
                          <ActionButton
                            tone="sky"
                            icon={<PenLine className="size-5" />}
                            label={t("factory.stepNote", lang)}
                            disabled={pending}
                            onClick={() => {
                              setEditor({ index, kind: "note" });
                              setText(step.note);
                            }}
                          />
                        ) : null}
                        {isCurrent && step.status !== "blocked" ? (
                          <ActionButton
                            tone="amber"
                            icon={<AlertTriangle className="size-5" />}
                            label={t("factory.stepBlock", lang)}
                            disabled={pending}
                            onClick={() => {
                              setEditor({ index, kind: "block" });
                              setText("");
                            }}
                          />
                        ) : null}
                        {isLastDone ? (
                          <ActionButton tone="plain" icon={<RotateCcw className="size-5" />} label={t("factory.stepReopen", lang)} disabled={pending} onClick={() => run(open, index, { kind: "reopen" })} />
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            {open.events.length > 0 ? (
              <details className="rounded-2xl border bg-card">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{t("factory.history", lang)}</summary>
                <ul className="divide-y border-t text-sm">
                  {open.events.map((event) => (
                    <li key={event.id} className="flex flex-wrap gap-x-2 px-4 py-2">
                      <span className="text-muted-foreground tabular-nums">{new Date(event.createdAt).toLocaleString(lang, { dateStyle: "short", timeStyle: "short" })}</span>
                      <span className="font-medium">{event.actorName}</span>
                      <span>
                        {t(`factory.actions.${event.action}`, lang)}
                        {event.stepKey ? ` · ${t(`factory.steps.${event.stepKey}`, lang)}` : ""}
                      </span>
                      {event.note ? <span className="w-full text-muted-foreground">{event.note}</span> : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Sheet>
        ) : null}
        {creating ? (
          <Sheet key="create" onClose={closeAll} label={t("factory.addBatch", lang)} closeLabel={t("factory.close", lang)}>
            <CreateBatchForm
              sites={sites}
              lang={lang}
              pending={pending}
              error={error}
              onCancel={closeAll}
              onSubmit={(values) => {
                setError(null);
                startTransition(async () => {
                  const result = await createProductionBatchAction(values);
                  if (!result.ok) {
                    setError(result.message || t("factory.error", lang));
                    return;
                  }
                  closeAll();
                  router.refresh();
                });
              }}
            />
          </Sheet>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function BatchCard({ item, lang, onOpen }: { item: FactoryBatchView; lang: string; onOpen: () => void }) {
  const state = batchState(item.steps);
  const blockedStep = item.steps.find((step) => step.status === "blocked");
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full rounded-xl border-2 bg-card p-3 text-left shadow-sm transition active:scale-[0.98] hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/40 ${STATE_STYLE[state]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</span>
        {state === "ready" ? (
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-green-600 text-white">
            <Check className="size-4" strokeWidth={3} />
          </span>
        ) : state === "blocked" ? (
          <AlertTriangle className="size-5 shrink-0 text-amber-500" />
        ) : null}
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="size-3.5 shrink-0" />
        <span className="truncate">{item.siteName}</span>
        {item.quantity !== null ? (
          <span className="ml-auto shrink-0 font-semibold tabular-nums text-foreground">
            {formatQuantity(item.quantity, lang)} {t(`factory.units.${item.unit}`, lang)}
          </span>
        ) : null}
      </div>
      {blockedStep?.note ? <div className="mt-1 line-clamp-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">⚠ {blockedStep.note}</div> : null}
      <div className="mt-2">
        <StepDots steps={item.steps} />
      </div>
    </button>
  );
}

function ActionButton({ tone, icon, label, onClick, disabled }: { tone: "orange" | "green" | "sky" | "amber" | "plain"; icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  const toneClass = {
    orange: "bg-orange-600 text-white shadow-md shadow-orange-600/20",
    green: "bg-green-600 text-white shadow-md shadow-green-600/20",
    sky: "border-2 border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200",
    amber: "border-2 border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200",
    plain: "border-2 bg-card",
  }[tone];
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex h-14 items-center justify-center gap-2 rounded-xl text-base font-bold active:scale-[0.98] disabled:opacity-50 ${toneClass}`}>
      {icon} {label}
    </button>
  );
}

function CreateBatchForm({
  sites,
  lang,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  sites: Array<{ id: string; name: string }>;
  lang: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: { baustelleId: string; title: string; quantity?: number; unit: string }) => void;
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<string>("t");
  const qty = Number(quantity.replace(",", "."));
  const valid = Boolean(siteId && title.trim()) && (quantity.trim() === "" || (Number.isFinite(qty) && qty > 0));

  if (sites.length === 0) return <p className="rounded-xl border bg-muted/40 p-4 text-center text-sm text-muted-foreground">{t("factory.noSites", lang)}</p>;

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onSubmit({ baustelleId: siteId, title: title.trim(), quantity: quantity.trim() ? qty : undefined, unit });
      }}
    >
      <div>
        <div className="mb-2 text-sm font-semibold">{t("factory.forSite", lang)}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {sites.map((site) => (
            <button
              key={site.id}
              type="button"
              onClick={() => setSiteId(site.id)}
              className={`flex min-h-14 items-center gap-2 rounded-xl border-2 px-4 text-left text-base font-semibold active:scale-[0.98] ${siteId === site.id ? "border-orange-500 bg-orange-500/10" : "bg-card"}`}
            >
              <MapPin className="size-5 shrink-0 text-orange-600" /> {site.name}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">{t("factory.material", lang)}</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value.slice(0, 160))}
          placeholder={t("factory.materialPlaceholder", lang)}
          className="h-14 w-full rounded-xl border-2 bg-card px-4 text-lg outline-none focus:border-orange-500"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">{t("factory.quantity", lang)}</span>
          <input
            value={quantity}
            onChange={(event) => setQuantity(event.target.value.replace(/[^0-9.,]/g, "").slice(0, 12))}
            inputMode="decimal"
            className="h-14 w-full rounded-xl border-2 bg-card px-4 text-lg tabular-nums outline-none focus:border-orange-500"
          />
        </label>
        <div>
          <span className="mb-2 block text-sm font-semibold">{t("factory.unit", lang)}</span>
          <div className="flex gap-2">
            {PRODUCTION_UNITS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setUnit(value)}
                className={`h-14 min-w-14 rounded-xl border-2 px-3 text-base font-semibold active:scale-95 ${unit === value ? "border-orange-500 bg-orange-500/10" : "bg-card"}`}
              >
                {t(`factory.units.${value}`, lang)}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error ? <p className="font-medium text-red-600">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onCancel} className="h-16 rounded-2xl border-2 bg-card text-lg font-semibold active:scale-[0.98]">
          {t("factory.cancel", lang)}
        </button>
        <button type="submit" disabled={!valid || pending} className="h-16 rounded-2xl bg-orange-600 text-lg font-bold text-white shadow-md active:scale-[0.98] disabled:opacity-50">
          {t("factory.create", lang)}
        </button>
      </div>
    </form>
  );
}
