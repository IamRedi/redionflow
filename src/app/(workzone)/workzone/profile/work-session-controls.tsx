"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Square } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import { plannedStartToday, type PlannedSchedule } from '@/lib/workzone/planned-schedule';
import { dateKey, parseWorkDateTime, workDateTimeInput } from '@/lib/workzone/date-utils';
import { startWorkerSessionAction, startWorkSessionPauseAction, stopWorkerSessionAction, stopWorkSessionPauseAction } from "../hr-actions";

function toDatetimeLocal(date: Date) {
  return workDateTimeInput(date);
}

function hoursPreview(startIso: string, endLocal: string, breakMinutes: number) {
  const start = new Date(startIso);
  const end = parseWorkDateTime(endLocal);
  if (!end) return "0.00";
  const raw = (end.getTime() - start.getTime()) / 1000 / 60 / 60;
  return Math.max(0, raw - breakMinutes / 60).toFixed(2);
}

function defaultBreakMinutes(startIso: string, endLocal: string) {
  const start = new Date(startIso);
  const end = parseWorkDateTime(endLocal);
  if (!end) return 0;
  const rawHours = (end.getTime() - start.getTime()) / 1000 / 60 / 60;
  return rawHours > 4 ? 30 : 0;
}

/** Time since the shift started, ticking once a minute. */
function LiveClock({ startIso, paused }: { startIso: string; paused: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  const minutes = now === null ? 0 : Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 60_000));
  const label = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 font-mono text-sm font-semibold tabular-nums">
      <span className={`size-2 rounded-full ${paused ? "bg-amber-500" : "animate-pulse bg-green-500"}`} />
      {label}
    </span>
  );
}

export function WorkSessionControls({
  workerId,
  workerPhoneGpsEnabled,
  activeSession,
  plannedSchedule = null,
  lastSessionEnd = null,
}: {
  workerId: string;
  workerPhoneGpsEnabled: boolean;
  plannedSchedule?: PlannedSchedule | null;
  lastSessionEnd?: string | null;
  activeSession: {
    id: string;
    startTime: string;
    breakMinutes: number;
    manualPauseMinutes: number;
    hasManualPause: boolean;
    isPaused: boolean;
  } | null;
}) {
  const router = useRouter();
  const { currentLang } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [startOpen, setStartOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [startTime, setStartTime] = useState(toDatetimeLocal(new Date()));
  const [breakMinutes, setBreakMinutes] = useState(activeSession?.breakMinutes ?? 30);
  const [endTime, setEndTime] = useState(toDatetimeLocal(new Date()));
  const lastGpsSentAt = useRef(0);
  const activeSessionId = activeSession?.id;
  const activeSessionIsPaused = activeSession?.isPaused;

  const preview = useMemo(
    () => (activeSession ? hoursPreview(activeSession.startTime, endTime, breakMinutes) : "0.00"),
    [activeSession, breakMinutes, endTime],
  );

  function sevenToday() {
    if (lastSessionEnd && dateKey(new Date(lastSessionEnd)) === dateKey(new Date())) return toDatetimeLocal(new Date());
    if (plannedSchedule) return plannedStartToday(plannedSchedule);
    const date = new Date();
    return `${dateKey(date)}T07:00`;
  }

  function openStart() {
    setStartTime(sevenToday());
    setStartOpen(true);
    setConfirmOpen(false);
  }

  function startWork(selectedStartTime: string) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await startWorkerSessionAction({ workerId, startTime: selectedStartTime });
      setMessage(result.message);
      if (result.ok) {
        setStartOpen(false);
        router.refresh();
      }
    });
  }

  function openStop() {
    const now = toDatetimeLocal(new Date());
    setEndTime(now);
    setBreakMinutes(
      activeSession?.hasManualPause
        ? activeSession.manualPauseMinutes
        : activeSession
          ? defaultBreakMinutes(activeSession.startTime, now)
          : 0,
    );
    setConfirmOpen(true);
  }

  function togglePause() {
    if (!activeSession) return;
    setMessage(undefined);
    startTransition(async () => {
      const action = activeSession.isPaused ? stopWorkSessionPauseAction : startWorkSessionPauseAction;
      const result = await action({ sessionId: activeSession.id });
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  function confirmStop() {
    if (!activeSession) return;
    setMessage(undefined);
    startTransition(async () => {
      const result = await stopWorkerSessionAction({
        sessionId: activeSession.id,
        breakMinutes,
        endTime,
      });
      setMessage(result.message);
      if (result.ok) {
        setConfirmOpen(false);
        router.refresh();
      }
    });
  }

  useEffect(() => {
    if (!activeSessionId || !workerPhoneGpsEnabled || activeSessionIsPaused) return;
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastGpsSentAt.current < 60_000) return;
        lastGpsSentAt.current = now;

        void fetch("/api/workzone/gps", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSessionId,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            speedKmh: position.coords.speed == null ? undefined : position.coords.speed * 3.6,
            headingDeg: position.coords.heading ?? undefined,
            recordedAt: new Date(position.timestamp).toISOString(),
          }),
        }).catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeSessionId, activeSessionIsPaused, workerPhoneGpsEnabled]);

  return (
    <div className="space-y-3">
      {/* Two small buttons the crew uses every day: start and stop. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openStart}
          disabled={isPending || Boolean(activeSession)}
          aria-label={t("workzone.startWork", currentLang)}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-green-600 pl-3 pr-4 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 active:scale-95 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
        >
          <Play className="size-4 fill-current" /> {t("workzone.startShort", currentLang)}
        </button>
        <button
          type="button"
          onClick={openStop}
          disabled={isPending || !activeSession}
          aria-label={t("workzone.stopWork", currentLang)}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-red-600 pl-3 pr-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-95 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
        >
          <Square className="size-3.5 fill-current" /> {t("workzone.stopShort", currentLang)}
        </button>
        {activeSession ? (
          <button
            type="button"
            onClick={togglePause}
            disabled={isPending}
            title={activeSession.isPaused ? t("workzone.endPause", currentLang) : t("workzone.startPause", currentLang)}
            aria-label={activeSession.isPaused ? t("workzone.endPause", currentLang) : t("workzone.startPause", currentLang)}
            className={`grid size-10 place-items-center rounded-full border transition active:scale-95 ${activeSession.isPaused ? "border-amber-500 bg-amber-500/15 text-amber-600" : "bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {activeSession.isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
        ) : null}
        {activeSession ? <LiveClock startIso={activeSession.startTime} paused={activeSession.isPaused} /> : null}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {startOpen && !activeSession ? (
        <div className="max-w-xl rounded-md border bg-card p-3 shadow-sm">
          <div className="mb-3 text-sm font-semibold">{t("workzone.whenDidWorkStart", currentLang)}</div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="startTime">{t("common.startTime", currentLang)}</Label>
              <Input id="startTime" type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.currentTarget.value)} className="h-9" />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => startWork(toDatetimeLocal(new Date()))} disabled={isPending}>
              {t("common.now", currentLang)}
            </Button>
            <Button type="button" size="sm" onClick={() => startWork(startTime)} disabled={isPending}>
              {t("workzone.selectedTime", currentLang)}
            </Button>
          </div>
        </div>
      ) : null}

      {confirmOpen && activeSession ? (
        <div className="rounded-md border bg-card p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">
            {t("workzone.hoursSummary", currentLang).replace("{hours}", preview).replace("{breakMinutes}", String(breakMinutes === 0 ? 0 : breakMinutes))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="breakMinutes">{t("report.break", currentLang)}</Label>
              <select
                id="breakMinutes"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={breakMinutes}
                onChange={(event) => setBreakMinutes(Number(event.currentTarget.value))}
              >
                <option value={0}>{0}</option>
                <option value={15}>{15}</option>
                <option value={30}>{30}</option>
                <option value={60}>{60}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime">{t("common.endTime", currentLang)}</Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={endTime}
                onChange={(event) => setEndTime(event.currentTarget.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("workzone.laterEdit", currentLang)}
            </Button>
            <Button type="button" onClick={confirmStop} disabled={isPending}>
              {t("common.confirm", currentLang)}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
