"use client";

import { motion } from "framer-motion";

import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/lib/i18n";

export function WorkingBadge({ workers, quiet = false }: { workers: string[]; quiet?: boolean }) {
  const { currentLang } = useLanguage();
  if (workers.length === 0) return null;
  return (
    <motion.div
      data-studio-working-badge={quiet ? "true" : undefined}
      initial={{ opacity: quiet ? 1 : 0.7 }}
      animate={quiet ? { opacity: 1 } : { opacity: [0.6, 1, 0.6] }}
      transition={quiet ? { duration: 0 } : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      className="min-w-0 max-w-full rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800 dark:border-green-900/40 dark:bg-green-950/10 dark:text-green-200"
    >
      <span className="font-semibold">{t("workzone.workingNow", currentLang)}</span>
      <span className="ml-2 break-words text-emerald-700 dark:text-green-200/80">{workers.join(", ")}</span>
    </motion.div>
  );
}

