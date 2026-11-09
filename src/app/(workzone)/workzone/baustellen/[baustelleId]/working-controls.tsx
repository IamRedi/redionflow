"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { workDateTimeInput, parseWorkDateTime } from '@/lib/workzone/date-utils';
import { startWorkOffline, stopWorkOffline } from "@/lib/workzone/offline/offline-actions";

type CurrentWorker = {
  id: string;
  firstName: string;
  lastName: string;
  isTemporary: boolean;
  level: string;
  companyProfileId: string;
} | null;

function toDatetimeLocal(date: Date) {
  return workDateTimeInput(date);
}

function defaultBreakMinutes(startIso: string, endLocal: string) {
  const start = new Date(startIso);
  const end = parseWorkDateTime(endLocal);
  if (!end) return 0;
  const rawHours = (end.getTime() - start.getTime()) / 3_600_000;
  return rawHours > 4 ? 30 : 0;
}

export function WorkingControls({
  baustelleId,
  currentWorker,
  activeWorkerIds,
  activeSession,
  compact = false,
}: {
  compact?: boolean;
  baustelleId: string;
  currentWorker: CurrentWorker;
  activeWorkerIds: string[];
  activeSession: { startTime: string; baustelleId: string | null } | null;
}) {
  const { currentLang } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [startOpen, setStartOpen] = useState(false);
  const [startTime, setStartTime] = useState(toDatetimeLocal(new Date()));
  const isActiveOnThisBaustelle = useMemo(
    () => (currentWorker ? activeWorkerIds.includes(currentWorker.id) || activeSession?.baustelleId === baustelleId : false),
    [activeSession?.baustelleId, activeWorkerIds, baustelleId, currentWorker],
  );

  if (!currentWorker) {
    return (
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        {t("workzone.sessionLoginRequiredPrefix", currentLang)}{" "}
        <Link className="underline underline-offset-4" href="/workzone/login">
          {t("form.loginToProfile", currentLang)}
        </Link>
        .
      </div>
    );
  }

  async function startAt(selectedStartTime: string) {
    if (!currentWorker) return;
    setBusy(true);
    setMessage(undefined);
    const result = await startWorkOffline({
      baustelleId,
      workerId: currentWorker.id,
      companyProfileId: currentWorker.companyProfileId,
      startTime: selectedStartTime,
    });
    setMessage(
      result.message === "offline_queued"
        ? t("workzone.offlineActionQueued", currentLang)
        : result.message,
    );
    setBusy(false);
    if (result.ok && !("queued" in result)) setStartOpen(false);
  }

  async function stopAt(selectedEndTime: string, selectedBreakMinutes: number) {
    if (!currentWorker) return;
    setBusy(true);
    setMessage(undefined);
    const result = await stopWorkOffline({
      baustelleId,
      workerId: currentWorker.id,
      companyProfileId: currentWorker.companyProfileId,
      endTime: selectedEndTime,
      breakMinutes: selectedBreakMinutes,
    });
    setMessage(
      result.message === "offline_queued"
        ? t("workzone.offlineActionQueued", currentLang)
        : result.message,
    );
    setBusy(false);
  }

  function prepareStart() {
    if (activeSession) {
      void startAt(toDatetimeLocal(new Date()));
      return;
    }
    setStartTime(toDatetimeLocal(new Date()));
    setStartOpen(true);
  }

  function prepareStop() {
    if (!activeSession) return;
    const now = toDatetimeLocal(new Date());
    void stopAt(now, defaultBreakMinutes(activeSession.startTime, now));
  }

  if (compact) {
    // On a site card: start/stop only, for people who do not open the site.
    return (
      <div className="space-y-2" data-testid="card-work-controls" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
        <div className="grid gap-1.5">
          <Button type="button" size="sm" className="h-auto min-h-9 whitespace-normal py-1.5 leading-tight" disabled={busy || isActiveOnThisBaustelle} onClick={prepareStart}>{t("workzone.workHere", currentLang)}</Button>
          <Button type="button" size="sm" variant="secondary" className="h-auto min-h-9 whitespace-normal py-1.5 leading-tight" disabled={busy || !isActiveOnThisBaustelle} onClick={prepareStop}>{t("workzone.stopWork", currentLang)}</Button>
        </div>
        {message ? <div className="text-[11px] text-muted-foreground">{message}</div> : null}
        {startOpen ? (
          <div className="space-y-1.5 rounded-md border bg-background p-2 text-xs shadow-sm">
            <div className="font-semibold">{t("workzone.whenDidWorkStart", currentLang)}</div>
            <Input aria-label={t("common.time", currentLang)} type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.currentTarget.value)} className="h-9" />
            <div className="grid gap-1.5">
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => startAt(toDatetimeLocal(new Date()))}>{t("common.now", currentLang)}</Button>
              <Button type="button" size="sm" disabled={busy} onClick={() => startAt(startTime)}>{t("workzone.selectedTime", currentLang)}</Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 px-3 py-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{t("workzone.workerActive", currentLang)}</div>
          <div className="text-sm font-medium">
            {currentWorker.firstName} {currentWorker.lastName}
            {currentWorker.isTemporary ? <span className="ml-2 text-xs text-amber-500">{t("workzone.externalShort", currentLang)}</span> : null}
          </div>
          {message ? <div className="mt-1 text-xs text-muted-foreground">{message}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" disabled={busy || isActiveOnThisBaustelle} onClick={prepareStart}>
            {t("workzone.workHere", currentLang)}
          </Button>
          <Button type="button" variant="secondary" disabled={busy || !isActiveOnThisBaustelle} onClick={prepareStop}>
            {t("workzone.stopWork", currentLang)}
          </Button>
        </div>
      </div>

      {startOpen ? (
        <div className="rounded-md border bg-background p-3 text-sm shadow-sm">
          <div className="mb-2 font-semibold">{t("workzone.whenDidWorkStart", currentLang)}</div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="startTime">
                {t("common.time", currentLang)}
              </label>
              <Input id="startTime" type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.currentTarget.value)} />
            </div>
            <Button type="button" variant="outline" disabled={busy} onClick={() => startAt(toDatetimeLocal(new Date()))}>
              {t("common.now", currentLang)}
            </Button>
            <Button type="button" disabled={busy} onClick={() => startAt(startTime)}>
              {t("workzone.selectedTime", currentLang)}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
