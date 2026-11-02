"use client";

import { FileUp } from "lucide-react";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";

import { useLanguage } from "@/components/i18n/language-provider";
import { SteelPhaseArt, SteelSiteArt } from "@/components/steel/steel-art";
import { batchState, currentStepIndex } from "@/lib/factory/production";
import { t } from "@/lib/i18n";

import { OrderImportSheet } from "./production/order-import";
import { artKey, BatchCard, BELT_STYLE, type FactoryBatchView } from "./production/production-ui";

export type { FactoryBatchView } from "./production/production-ui";

/**
 * The factory on the field board: only to look at. It shows what is on the
 * line, at which station and for which construction site. The steps are moved
 * on the site itself, by the person responsible. The office uploads supplier
 * orders here; their material lands on the line for its site.
 */
export function FactoryPanel({
  factoryName,
  factoryAddress,
  batches,
  sites,
  canManage,
}: {
  factoryName: string;
  factoryAddress: string;
  batches: FactoryBatchView[];
  sites: Array<{ id: string; name: string }>;
  canManage: boolean;
}) {
  const { currentLang: lang } = useLanguage();
  const [importing, setImporting] = useState(false);
  const items = batches;
  const stepKeys = items[0]?.steps.map((step) => step.key) ?? ["cutting", "laser", "assembly", "final"];
  const counts = {
    line: items.filter((item) => batchState(item.steps) !== "ready").length,
    blocked: items.filter((item) => batchState(item.steps) === "blocked").length,
    ready: items.filter((item) => batchState(item.steps) === "ready").length,
  };
  const siteCount = new Set(items.filter((item) => batchState(item.steps) !== "ready").map((item) => item.siteId)).size;
  const stationOf = (item: FactoryBatchView) => currentStepIndex(item.steps);
  const href = (item: FactoryBatchView) => `/workzone/baustellen/${item.siteId}#prodhimi`;

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
            {siteCount > 0 ? (
              <span className="rounded-full border bg-background/70 px-2.5 py-1 text-xs font-semibold">
                {t("factory.forSites", lang).replace("{n}", String(siteCount))}
              </span>
            ) : null}
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
                onClick={() => setImporting(true)}
                className="ml-auto inline-flex h-11 items-center gap-2 rounded-full bg-orange-600 px-4 text-sm font-bold text-white shadow-md shadow-orange-600/20 active:scale-95"
              >
                <FileUp className="size-5" /> {t("factory.importOrder", lang)}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* The production line: stations left to right, ready dock at the end. Tap a group to open its site. */}
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
                    <BatchCard key={item.id} item={item} lang={lang} href={href(item)} />
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
                  <BatchCard key={item.id} item={item} lang={lang} href={href(item)} />
                ))}
              {counts.ready === 0 ? <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-green-500/30 py-4 text-xs text-muted-foreground">{t("factory.emptyStation", lang)}</div> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
        {items.length === 0 ? <span className="font-medium text-foreground">{t("factory.empty", lang)} </span> : null}
        {t("factory.overviewHint", lang)}
      </div>

      <AnimatePresence>{importing ? <OrderImportSheet key="import" sites={sites} onClose={() => setImporting(false)} /> : null}</AnimatePresence>
    </section>
  );
}
