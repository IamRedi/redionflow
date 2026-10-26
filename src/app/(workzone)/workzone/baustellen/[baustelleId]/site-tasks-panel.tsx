"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { t } from "@/lib/i18n";
import { addManualTaskOffline, clearManualTaskOffline } from "@/lib/workzone/offline/offline-actions";
import type { BaustelleTask, CurrentWorker } from "./tree-list-model";

/** "Site needs attention" notes: add a flagged task and clear the open ones (works offline). */
export function SiteTasksPanel({
  baustelleId,
  currentWorker,
  openTasks,
  statusMessage,
  lang,
}: {
  baustelleId: string;
  currentWorker: CurrentWorker | null;
  openTasks: BaustelleTask[];
  statusMessage?: string;
  lang: string;
}) {
  const router = useRouter();
  const [siteNote, setSiteNote] = useState("");
  const [siteNoteMessage, setSiteNoteMessage] = useState<string | null>(null);
  const [siteNoteBusy, setSiteNoteBusy] = useState(false);

  return (
    <form
      className="flex w-full min-w-0 flex-col gap-2 rounded-md border bg-muted/20 p-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!currentWorker) return;
        setSiteNoteMessage(null);
        setSiteNoteBusy(true);
        const result = await addManualTaskOffline({
          baustelleId: baustelleId,
          workerId: currentWorker.id,
          companyProfileId: currentWorker.companyProfileId,
          description: siteNote,
        });
        setSiteNoteBusy(false);
        setSiteNoteMessage(
          result.message === "offline_queued"
            ? t("workzone.offlineActionQueued", lang)
            : (result.message ?? null),
        );
        if (result.ok && !("queued" in result)) {
          setSiteNote("");
          router.refresh();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-medium">{t("workzone.siteNeedsAttentionTitle", lang)}</div>
        {openTasks.length > 0 ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
            {t("workzone.siteNeedsAttentionBadge", lang).replace("{count}", String(openTasks.length))}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
          placeholder={t("workzone.siteNeedsAttentionPlaceholder", lang)}
          value={siteNote}
          onChange={(event) => setSiteNote(event.target.value)}
          disabled={!currentWorker || siteNoteBusy}
        />
        <button
          type="submit"
          className="h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-60"
          disabled={!currentWorker || siteNoteBusy || siteNote.trim().length === 0}
        >
          {t("workzone.markSiteTask", lang)}
        </button>
      </div>
      {!currentWorker ? (
        <div className="text-xs text-muted-foreground">{t("workzone.manualTaskPermission", lang)}</div>
      ) : null}
      {siteNoteMessage ? <span className="text-xs text-muted-foreground">{siteNoteMessage}</span> : null}
      {statusMessage ? <span className="text-xs text-muted-foreground">{statusMessage}</span> : null}
      {openTasks.length > 0 ? (
        <ul className="space-y-1">
          {openTasks.slice(0, 3).map((task) => {
            const author =
              task.worker
                ? `${task.worker.firstName} ${task.worker.lastName}`.trim()
                : task.user?.name ?? task.user?.email ?? t("common.unknown", lang);
            return (
              <li key={task.id} className="flex items-start justify-between gap-2 rounded-md border bg-background px-2 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{task.description}</div>
                  <div className="mt-0.5 text-muted-foreground">
                    {author} · {new Date(task.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-md border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-60"
                  disabled={!currentWorker || siteNoteBusy}
                  onClick={async () => {
                    if (!currentWorker) return;
                    setSiteNoteBusy(true);
                    setSiteNoteMessage(null);
                    const result = await clearManualTaskOffline({
                      taskId: task.id,
                      workerId: currentWorker.id,
                      companyProfileId: currentWorker.companyProfileId,
                      baustelleId: baustelleId,
                    });
                    setSiteNoteBusy(false);
                    setSiteNoteMessage(
                      result.message === "offline_queued"
                        ? t("workzone.offlineActionQueued", lang)
                        : (result.message ?? null),
                    );
                    if (result.ok && !("queued" in result)) router.refresh();
                  }}
                >
                  {t("workzone.clearSiteTask", lang)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </form>
  );
}
