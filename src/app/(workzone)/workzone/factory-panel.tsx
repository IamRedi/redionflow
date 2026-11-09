"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { SteelSiteArt } from "@/components/steel/steel-art";
import { totalOutput, type SiteFactoryOutput } from "@/lib/elements/factory-output";
import { formatAmount } from "@/lib/factory/production";
import { t } from "@/lib/i18n";

import { NewProjectButton } from "./new-project";
import { AllSitesFactoryView } from "./production/factory-output-view";
import { AssetPhoto } from "@/components/asset-photo";
import { AccessKeyButton } from "@/components/access/access-key-button";

export type { FactoryBatchView } from "./production/production-ui";

/**
 * The factory on the field board: only to look at. Per process and per
 * construction site it shows what was produced and what still waits; the
 * steps and finished pieces are confirmed on each site's factory list. The
 * office starts a new project here from its documents.
 */
export function FactoryPanel({
  factoryName,
  factoryId,
  photoUrl,
  canEditPhoto=false,
  factoryAddress,
  siteOutput,
  canManage,
  processDefinitions,
}: {
  factoryName: string;
  factoryId: string;
  photoUrl?: string|null;
  canEditPhoto?: boolean;
  factoryAddress: string;
  siteOutput: SiteFactoryOutput[];
  canManage: boolean;
  processDefinitions?: Array<{ key: string; label: string }>;
}) {
  const { currentLang: lang } = useLanguage();
  const total = totalOutput(siteOutput);
  const pcs = t("elements.pieceShort", lang);
  const inFactory = total.pieces - total.donePieces;
  const pct = total.pieces > 0 ? Math.round((total.donePieces / total.pieces) * 100) : 0;

  return (
    <section id="fabrika" className="scroll-mt-4 overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="relative overflow-hidden border-b">
        <div className="absolute inset-0"><AssetPhoto key={`${factoryId}:${photoUrl}`} kind="site" id={factoryId} src={photoUrl} alt={factoryName} canEdit={canEditPhoto}><SteelSiteArt type="STEEL_WORKSHOP" pct={pct} live={inFactory > 0} fit="meet" className="absolute inset-0 h-full w-full" /></AssetPhoto></div>
        <div className="absolute inset-0 bg-gradient-to-r from-card via-card/85 to-transparent" />
        <div className="relative flex min-h-[150px] flex-col justify-end gap-2 p-4 sm:p-6">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600 dark:text-orange-400">{t("factory.title", lang)}</span>
          <h2 className="text-2xl font-bold tracking-tight">{factoryName}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{factoryAddress || t("factory.subtitle", lang)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-orange-700 dark:text-orange-300">
              {t("elements.inFactory", lang)}: {formatAmount(inFactory)} {pcs}
            </span>
            {siteOutput.length > 0 ? (
              <span className="rounded-full border bg-background/70 px-2.5 py-1 text-xs font-semibold">{t("factory.forSites", lang).replace("{n}", String(siteOutput.length))}</span>
            ) : null}
            <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-green-700 dark:text-green-300">
              {t("elements.produced", lang)}: {formatAmount(total.donePieces)} {pcs}
            </span>
            <AccessKeyButton place="factory" compact />
            {canManage ? (
              <span className="ml-auto flex items-center gap-2">
                <AccessKeyButton place="new_project" compact />
                <NewProjectButton />
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <AllSitesFactoryView sites={siteOutput} processDefinitions={processDefinitions} />
    </section>
  );
}
