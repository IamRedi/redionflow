"use client";

import { ChevronRight, Factory } from "lucide-react";
import Link from "next/link";

import { useLanguage } from "@/components/i18n/language-provider";
import { SteelPhaseArt } from "@/components/steel/steel-art";
import { factoryProcessPercent, totalOutput, type SiteFactoryOutput } from "@/lib/elements/factory-output";
import { FACTORY_STEP_KEYS, formatAmount } from "@/lib/factory/production";
import { t } from "@/lib/i18n";

import { artKey } from "./production-ui";

const amount = (value: number) => formatAmount(Math.round(value));
const percentLabel = (value: number) => `${value > 0 && value < 1 ? "<1" : Math.floor(value)}%`;
const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
export type FactoryProcessDefinition = { key: string; label: string };
const processKeys = (output: Pick<SiteFactoryOutput, "stages">, definitions: FactoryProcessDefinition[]) =>
  [...new Set([...definitions.map(definition => definition.key), ...Object.keys(output.stages)])].filter(key => output.stages[key]?.eligibleMarks > 0);
function processLabel(key: string, definitions: FactoryProcessDefinition[], lang: string) {
  return definitions.find(definition => definition.key === key)?.label.trim()
    || ((FACTORY_STEP_KEYS as readonly string[]).includes(key) ? t(`factory.steps.${key}`, lang) : t("steel.task", lang));
}

function Bar({ value, total, className = "h-1.5" }: { value: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <span className={`block overflow-hidden rounded-full bg-muted ${className}`}>
      <span className={`block h-full rounded-full ${pct === 100 ? "bg-green-600" : "bg-orange-500"}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

function PartsLine({ output }: { output: Pick<SiteFactoryOutput, "partCutting"> }) {
  const { currentLang: lang } = useLanguage();
  if (!output.partCutting?.eligiblePieces) return null;
  return <p data-testid="factory-part-cutting" className="text-[11px] tabular-nums text-muted-foreground">{fill(t("elements.factoryPartsLine", lang), { done: amount(output.partCutting.pieces), total: amount(output.partCutting.eligiblePieces) })}</p>;
}

/** Out of the factory / still in the factory / finished on site, in pieces and kg. */
function Totals({ output }: { output: Omit<SiteFactoryOutput, "siteId" | "siteName"> }) {
  const { currentLang: lang } = useLanguage();
  const pcs = t("elements.pieceShort", lang);
  const waitingPieces = output.pieces - output.donePieces;
  return (
    <div className="space-y-2"><PartsLine output={output}/>{output.pieces > 0 ? <div className="grid grid-cols-3 gap-1.5 text-[11px] tabular-nums">
      <div className="min-w-0 rounded-xl bg-green-600/10 px-2.5 py-2">
        <div className="truncate font-semibold text-green-800 dark:text-green-300">{t("elements.produced", lang)}</div>
        <div className="text-base font-bold leading-tight">
          {amount(output.donePieces)}
          <span className="text-xs font-semibold text-muted-foreground">/{amount(output.pieces)} {pcs}</span>
        </div>
        {output.kg > 0 ? <div className="truncate text-muted-foreground">{amount(output.doneKg)} {t("factory.units.kg", lang)}</div> : null}
      </div>
      <div className="min-w-0 rounded-xl bg-muted/70 px-2.5 py-2">
        <div className="truncate font-semibold">{t("elements.inFactory", lang)}</div>
        <div className="text-base font-bold leading-tight">
          {amount(waitingPieces)} <span className="text-xs font-semibold text-muted-foreground">{pcs}</span>
        </div>
        {output.kg > 0 ? <div className="truncate text-muted-foreground">{amount(output.kg - output.doneKg)} {t("factory.units.kg", lang)}</div> : null}
      </div>
      <div className="min-w-0 rounded-xl bg-muted/70 px-2.5 py-2">
        <div className="truncate font-semibold">{t("elements.finishedOnSite", lang)}</div>
        <div className="text-base font-bold leading-tight">
          {amount(output.mountedPieces)} <span className="text-xs font-semibold text-muted-foreground">{pcs}</span>
        </div>
        <div className="truncate text-muted-foreground">{fill(t("elements.ofArrived", lang), { n: amount(output.donePieces) })}</div>
      </div>
    </div> : null}</div>
  );
}

/** One tile per factory process: how many elements and pieces went through it. */
function StageTiles({ output, art = false, processDefinitions = [] }: { output: Omit<SiteFactoryOutput, "siteId" | "siteName">; art?: boolean; processDefinitions?: FactoryProcessDefinition[] }) {
  // The wide board shows the six side by side; the narrow site column three by two.
  const { currentLang: lang } = useLanguage();
  return (
    <div className={`grid gap-1.5 ${art ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-3"}`}>
      {processKeys(output, processDefinitions).map((key) => {
        const stage = output.stages[key];
        return (
          <div data-studio-process-card key={key} className="min-w-0 overflow-hidden rounded-xl border bg-background">
            {art ? (
              <div data-studio-process-media className="relative h-16 bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950">
                {(FACTORY_STEP_KEYS as readonly string[]).includes(key)
                  ? <SteelPhaseArt photoPhase={key} phase={artKey(key)} animate={false} className="absolute inset-0 h-full w-full p-1" />
                  : <Factory aria-hidden="true" className="absolute inset-0 m-auto size-9 text-orange-500" />}
              </div>
            ) : null}
            <div className="px-2.5 py-2">
              <div className="flex items-baseline gap-1.5">
                <span className="min-w-0 flex-1 truncate text-xs font-bold">{processLabel(key, processDefinitions, lang)}</span>
              </div>
              <div className="mt-0.5 text-sm font-bold tabular-nums">
                {stage.marks}
                <span className="text-[11px] font-semibold text-muted-foreground">/{stage.eligibleMarks}</span>
              </div>
              <div className="truncate text-[10px] tabular-nums text-muted-foreground">
                {amount(stage.pieces)}/{amount(stage.eligiblePieces)} {t("elements.pieceShort", lang)}
              </div>
              <Bar value={stage.pieces} total={stage.eligiblePieces} className="mt-1 h-1" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** On the site page: what the factory produced for this site. View only. */
export function SiteFactoryView({ output, processDefinitions = [] }: { output: SiteFactoryOutput; processDefinitions?: FactoryProcessDefinition[] }) {
  const { currentLang: lang } = useLanguage();
  const pct = factoryProcessPercent(output);
  return (
    <section id="prodhimi" data-testid="site-factory-output" className="scroll-mt-4 space-y-3 rounded-2xl border bg-card p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-600">
          <Factory className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-tight">{t("factory.siteSection", lang)}</h2>
          <p className="truncate text-xs text-muted-foreground">{t("elements.factoryProcessProgress", lang)} · {t("elements.factoryOutputHint", lang)}</p>
        </div>
        <span data-testid="factory-process-percent" title={t("elements.factoryProcessProgress", lang)} className="shrink-0 text-sm font-bold tabular-nums text-orange-600">
          {percentLabel(pct)}
        </span>
      </div>
      <Bar value={pct} total={100} />
      <Totals output={output} />
      <StageTiles output={output} processDefinitions={processDefinitions} />
    </section>
  );
}

/** On the workzone factory panel: all sites together, then one card per site. */
export function AllSitesFactoryView({ sites, processDefinitions = [] }: { sites: SiteFactoryOutput[]; processDefinitions?: FactoryProcessDefinition[] }) {
  const { currentLang: lang } = useLanguage();
  if (sites.length === 0) return <p className="p-4 text-center text-sm text-muted-foreground">{t("elements.factoryOutputEmpty", lang)}</p>;
  const total = totalOutput(sites);
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">{t("elements.factoryOutputAll", lang)}</h3>
        <span className="text-[11px] text-muted-foreground">{t("elements.factoryOutputHint", lang)}</span>
      </div>
      <Totals output={total} />
      <StageTiles output={total} art processDefinitions={processDefinitions} />

      <h3 className="pt-1 text-sm font-bold">{t("elements.factoryOutput", lang)}</h3>
      <ul className="grid gap-2 md:grid-cols-2">
        {sites.map((site) => {
          const pct = factoryProcessPercent(site);
          return (
            <li key={site.siteId}>
              <Link data-testid="factory-output-site" data-site-id={site.siteId} href={`/workzone/baustellen/${site.siteId}`} className="block space-y-2 rounded-2xl border bg-background p-3 active:scale-[0.99]">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{site.siteName}</span>
                  <span data-testid="factory-process-percent" title={t("elements.factoryProcessProgress", lang)} className={`shrink-0 text-sm font-bold tabular-nums ${pct === 100 ? "text-green-700 dark:text-green-400" : "text-orange-600"}`}>{percentLabel(pct)}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
                <div><p className="mb-1 text-[10px] text-muted-foreground">{t("elements.factoryProcessProgress", lang)}</p><Bar value={pct} total={100} /></div>
                <PartsLine output={site}/>
                {site.pieces > 0 ? <div className="text-[11px] tabular-nums text-muted-foreground">
                  {fill(site.kg > 0 ? t("elements.siteOutputLine", lang) : t("elements.siteOutputLine", lang).replace(/\s*\(\{kg\}[^)]*\)/, ""), {
                    done: amount(site.donePieces),
                    total: amount(site.pieces),
                    kg: amount(site.doneKg),
                    waiting: amount(site.pieces - site.donePieces),
                    mounted: amount(site.mountedPieces),
                  })}
                </div> : null}
                <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
                  {processKeys(site, processDefinitions).map((key) => (
                    <div key={key} className="min-w-0" title={processLabel(key, processDefinitions, lang)}>
                      <div className="truncate text-[9px] font-semibold text-muted-foreground">{processLabel(key, processDefinitions, lang)}</div>
                      <div className="text-[11px] font-bold tabular-nums">
                        {site.stages[key].marks}/{site.stages[key].eligibleMarks}
                      </div>
                      <div className="truncate text-[10px] tabular-nums text-muted-foreground">{amount(site.stages[key].pieces)}/{amount(site.stages[key].eligiblePieces)} {t("elements.pieceShort", lang)}</div>
                      <Bar value={site.stages[key].pieces} total={site.stages[key].eligiblePieces} className="h-1" />
                    </div>
                  ))}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
