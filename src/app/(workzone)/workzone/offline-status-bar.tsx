"use client";

import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/lib/i18n";
import { getAllOutboxActions } from "@/lib/workzone/offline/outbox";
import { useOnlineStatus } from "@/lib/workzone/offline/use-online-status";
import type { WorkzonePendingAction } from "@/lib/workzone/offline/types";

const POLL_INTERVAL_MS = 5_000;

function countByStatus(actions: WorkzonePendingAction[]) {
  let pending = 0;
  let syncing = 0;
  let conflict = 0;
  let failed = 0;

  for (const action of actions) {
    if (action.status === "pending") pending++;
    else if (action.status === "syncing") syncing++;
    else if (action.status === "conflict") conflict++;
    else if (action.status === "failed") failed++;
  }

  return { pending, syncing, conflict, failed };
}

export function OfflineStatusBar() {
  const { currentLang } = useLanguage();
  const isOnline = useOnlineStatus();
  const [actions, setActions] = useState<WorkzonePendingAction[]>([]);
  const [mounted, setMounted] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refreshActions() {
    try {
      const all = await getAllOutboxActions();
      setActions(all);
    } catch {
      // IndexedDB unavailable (e.g. private browsing with strict settings)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      void refreshActions();
    });
    pollRef.current = setInterval(() => void refreshActions(), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Refresh immediately when coming back online
  useEffect(() => {
    if (isOnline) queueMicrotask(() => void refreshActions());
  }, [isOnline]);

  const counts = countByStatus(actions);
  const unresolvedCount = counts.pending + counts.syncing + counts.conflict + counts.failed;
  const hasConflicts = counts.conflict > 0;

  const showOfflineBanner = !isOnline;
  const showPendingBanner = isOnline && unresolvedCount > 0;

  // Skip render before mount so SSR (which always sees "online + no outbox")
  // does not clash with the client's real navigator.onLine + IndexedDB state.
  if (!mounted) return null;
  if (!showOfflineBanner && !showPendingBanner) return null;

  if (showOfflineBanner) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
      >
        <WifiOff className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className="min-w-0">
          <span className="font-semibold">{t("workzone.offlineBannerTitle", currentLang)}</span>
          {unresolvedCount > 0 ? (
            <span className="ml-2 text-amber-800/80 dark:text-amber-300/80">
              {t("workzone.pendingSyncCount", currentLang).replace("{count}", String(unresolvedCount))}
            </span>
          ) : null}
          <p className="mt-0.5 text-xs text-amber-800/70 dark:text-amber-300/70">
            {t("workzone.offlineBannerDetail", currentLang)}
          </p>
        </div>
      </div>
    );
  }

  // Online but with unresolved actions
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm ${
        hasConflicts
          ? "border-red-500/40 bg-red-500/10 text-red-900 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200"
          : "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200"
      }`}
    >
      {counts.syncing > 0 ? (
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-sky-500" aria-hidden="true" />
      ) : (
        <span
          className={`size-2 shrink-0 rounded-full ${hasConflicts ? "bg-red-500" : "bg-amber-500"}`}
          aria-hidden="true"
        />
      )}
      <span className="font-medium">
        {counts.syncing > 0
          ? t("workzone.syncingNow", currentLang)
          : hasConflicts
            ? (counts.conflict === 1
                ? t("workzone.conflictCount", currentLang)
                : t("workzone.conflictsCount", currentLang)
              ).replace("{count}", String(counts.conflict))
            : t("workzone.pendingSyncCount", currentLang).replace("{count}", String(unresolvedCount))}
      </span>
    </div>
  );
}
