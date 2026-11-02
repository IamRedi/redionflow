"use client";

import { AnimatePresence } from "framer-motion";
import { Factory, Plus } from "lucide-react";
import { useState } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { readySummary } from "@/lib/factory/production";
import { t } from "@/lib/i18n";

import { createProductionBatchAction } from "../factory-actions";
import { BatchCard, BatchSheet, CreateBatchForm, Sheet, useProductionRunner, type FactoryBatchView } from "./production-ui";

/**
 * Beside a construction site: the factory steps of the material this site
 * needs. The office, a foreman or a master moves the steps; everybody sees them.
 */
export function SiteProductionPanel({
  site,
  batches,
  canAdvance,
  canManage,
}: {
  site: { id: string; name: string };
  batches: FactoryBatchView[];
  canAdvance: boolean;
  canManage: boolean;
}) {
  const { currentLang: lang } = useLanguage();
  const { items, run, error, setError, pending, startTransition, router } = useProductionRunner(batches, lang, canAdvance);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const open = items.find((item) => item.id === openId) ?? null;
  const summary = readySummary(items);

  return (
    <section id="prodhimi" className="scroll-mt-4 rounded-2xl border bg-card">
      <div className="flex items-center gap-3 border-b p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-600">
          <Factory className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-tight">{t("factory.siteSection", lang)}</h2>
          <p className="text-xs text-muted-foreground">{canAdvance ? t("factory.siteHintEdit", lang) : t("factory.siteHintView", lang)}</p>
        </div>
        {items.length > 0 ? (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              summary.ready === summary.total
                ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300"
                : "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300"
            }`}
          >
            {t("factory.siteSummary", lang).replace("{ready}", String(summary.ready)).replace("{total}", String(summary.total))}
          </span>
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        {items.map((item) => (
          <BatchCard key={item.id} item={item} lang={lang} hideSite onOpen={() => setOpenId(item.id)} />
        ))}
        {items.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">{t("factory.siteEmpty", lang)}</p> : null}
        {canManage ? (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setError(null);
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-semibold text-muted-foreground hover:border-orange-500/60 hover:text-orange-600 active:scale-[0.99]"
          >
            <Plus className="size-4" /> {t("factory.addBatch", lang)}
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {open ? (
          <BatchSheet
            key="batch"
            batch={open}
            lang={lang}
            canEdit={canAdvance}
            pending={pending}
            error={error}
            onRun={run}
            onClose={() => {
              setOpenId(null);
              setError(null);
            }}
          />
        ) : null}
        {creating ? (
          <Sheet key="create" onClose={() => setCreating(false)} label={t("factory.addBatch", lang)} closeLabel={t("factory.close", lang)}>
            <CreateBatchForm
              sites={[site]}
              lang={lang}
              pending={pending}
              error={error}
              onCancel={() => setCreating(false)}
              onSubmit={(values) => {
                setError(null);
                startTransition(async () => {
                  const result = await createProductionBatchAction(values);
                  if (!result.ok) {
                    setError(result.message || t("factory.error", lang));
                    return;
                  }
                  setCreating(false);
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
