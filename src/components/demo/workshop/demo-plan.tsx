"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, ClipboardList, Package } from "lucide-react";
import { DailyPlanBoard, type DailyPlanActions } from "@/app/(workzone)/workzone/daily-plan-board";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/lib/i18n";
import { demoPlanCopy } from "@/lib/workshop/plan-copy";
import { adjacentPlanDay, type DemoPlanCommand, type DemoPlanSnapshot } from "@/lib/workshop/plan-model";
import { workshopCopy } from "@/lib/workshop/copy";
import { useWorkshopDemo } from "./use-workshop-demo";

export function DemoPlanToolbar({ now }: { now: string }) {
  const { currentLang } = useLanguage();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  return <><Button asChild variant="outline" size="icon" className="size-11 bg-card shadow-sm" title={t("workzone.dailyPlan", currentLang)} aria-label={t("workzone.dailyPlan", currentLang)}><Link href={`/demo/plan?date=${date}`}><ClipboardList className="size-4" /></Link></Button><Button asChild variant="outline" size="icon" className="size-11 bg-card shadow-sm" title={t("workzone.calendar", currentLang)} aria-label={t("workzone.calendar", currentLang)}><Link href={`/demo/plan?date=${date}&view=calendar`}><CalendarDays className="size-4" /></Link></Button></>;
}

export function DemoPlanPage({ date, calendar = false }: { date: string; calendar?: boolean }) {
  const { currentLang } = useLanguage(), c = demoPlanCopy(currentLang), w = workshopCopy(currentLang);
  const { actor, status } = useWorkshopDemo();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<DemoPlanSnapshot | null>(null);
  const snapshotRef = useRef<DemoPlanSnapshot | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [version, setVersion] = useState("current");
  const [showCalendar, setShowCalendar] = useState(calendar);
  const accept = useCallback((s: DemoPlanSnapshot) => { snapshotRef.current = s; setSnapshot(s); }, []);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/demo/baumdienst/plans?date=${date}`, { cache: "no-store", signal });
    if (!response.ok) throw new Error("connection");
    const result = await response.json() as DemoPlanSnapshot;
    if (!signal?.aborted) accept(result);
  }, [date, accept]);
  useEffect(() => {
    const abort = new AbortController();
    const read = () => { if (!pending && document.visibilityState === "visible") void refresh(abort.signal).catch(() => { if (!abort.signal.aborted) setMessage(w.connection); }); };
    read(); const timer = window.setInterval(read, 8000); window.addEventListener("focus", read);
    return () => { abort.abort(); clearInterval(timer); window.removeEventListener("focus", read); };
  }, [refresh, actor.key, pending, w.connection]);

  async function send(command: DemoPlanCommand) {
    if (!snapshotRef.current) return { ok: false, message: w.connection };
    setPending(true);
    const body = JSON.stringify({ requestId: crypto.randomUUID(), revision: snapshotRef.current.revision, command });
    try {
      let response: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        try { response = await fetch("/api/demo/baumdienst/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body }); break; }
        catch (error) { if (attempt) throw error; }
      }
      if (!response) throw new Error("connection");
      const result = await response.json();
      if (!response.ok) {
        if (result.error === "plan-confirm") return { ok: false, message: c.confirm, requiresConfirmation: true, warningMessage: c.confirm };
        if (response.status === 409) await refresh();
        const msg = result.error === "plan-asset-unavailable" ? c.blocked : result.error === "permission" ? c.readOnly : result.error === "conflict" ? w.conflict : result.error === "storage" ? w.storage : result.error === "busy" ? w.busy : w.connection;
        setMessage(msg); return { ok: false, message: msg };
      }
      accept(result); setMessage(command.type === "prepare" ? c.prepared : c.saved);
      return { ok: true, message: command.type === "prepare" ? c.prepared : c.saved };
    } catch { setMessage(w.connection); return { ok: false, message: w.connection }; }
    finally { setPending(false); }
  }
  const actions: DailyPlanActions = {
    move: input => send({ type: "move", date, columnId: input.columnId, itemId: input.itemId, kind: input.kind, force: input.force }),
    remove: input => send({ type: "remove", date, assignmentId: input.assignmentId }),
    note: input => send({ type: "note", date, columnId: input.columnId, note: input.note }),
    save: () => send({ type: "save", date }), clear: () => send({ type: "clear", date }),
  };
  const dateHref = (value: string) => `/demo/plan?date=${value}${showCalendar ? "&view=calendar" : ""}`;
  const plan = snapshot?.plans.find(p => p.date === date);
  const editable = actor.role === "admin" && snapshot?.actor.role === "admin" && status === "ready";
  const rows = version === "current" ? plan?.savedRows ?? [] : plan?.versions.find(v => v.id === version)?.rows ?? [];
  const cols = plan?.columns.map(c => ({ id: c.id, title: c.title, note: c.note, baustelleId: c.id, assignments: c.assignments.map(a => ({ id: a.id, kind: a.kind, labelSnapshot: a.label, workerId: a.kind === "WORKER" ? a.itemId : null, machineId: a.kind === "MACHINE" ? a.itemId : null })) })) ?? [];
  return <div className="min-w-0 space-y-5" data-testid="demo-plan-page">
    <header className="space-y-3"><Link href="/demo/workzone" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />{t("workzone.backToWorkzone", currentLang)}</Link><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">{t("workzone.createDailyPlan", currentLang)}</h1><Button variant="outline" className="min-h-11" onClick={() => setShowCalendar(s => !s)}><CalendarDays className="size-4" />{c.calendar}</Button></div><p className="max-w-3xl text-sm text-muted-foreground">{c.hint}</p></header>
    <nav aria-label={t("workzone.selectDay", currentLang)} className="flex flex-wrap items-center gap-2"><Button asChild variant="outline" className="min-h-11"><Link href={dateHref(adjacentPlanDay(date, -1))}>{t("workzone.previousDay", currentLang)}</Link></Button><input aria-label={t("workzone.selectDay", currentLang)} type="date" value={date} onChange={e => { if (e.target.value) router.push(dateHref(e.target.value)); }} className="min-h-11 min-w-0 rounded-xl border bg-card px-3 text-sm" /><Button asChild variant="outline" className="min-h-11"><Link href={dateHref(adjacentPlanDay(date, 1))}>{t("workzone.nextDay", currentLang)}</Link></Button>{snapshot && <Button asChild variant="ghost" className="min-h-11"><Link href={dateHref(snapshot.today)}>{t("common.today", currentLang)}</Link></Button>}</nav>
    <p role="status" className="text-sm text-muted-foreground">{message || (!snapshot ? w.loading : "")}</p>
    {!editable && snapshot && <p className="text-sm text-muted-foreground">{c.readOnly}</p>}
    {editable && !plan && <Button className="min-h-11" disabled={pending} onClick={() => void send({ type: "prepare", date })}><ClipboardList className="size-4" />{c.prepare}</Button>}
    {editable && plan && snapshot && <DailyPlanBoard key={date} date={date} columns={cols} workers={snapshot.workers} machines={snapshot.machines} baustellen={snapshot.sites} savedRows={plan.savedRows} actions={actions} touchLabels={{ choose: c.choose, remove: c.remove }} />}
    {snapshot && <Link href="/demo/workshop?tab=tools" className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm"><Package className="size-4" />{w.tools}</Link>}
    {(showCalendar || !editable) && <section className="space-y-3 rounded-2xl border bg-card p-4" aria-label={c.calendar}><h2 className="text-lg font-semibold">{c.calendar}</h2><p className="text-xs text-muted-foreground">{c.historyHint}</p><div className="flex flex-wrap gap-2">{snapshot?.plans.map(p => <Link key={p.date} className="inline-flex min-h-11 items-center rounded-xl border px-3 text-sm" href={`/demo/plan?date=${p.date}&view=calendar`}>{p.date}</Link>)}</div><select aria-label={t("workzone.currentPlanLabel", currentLang)} value={version} onChange={e => setVersion(e.target.value)} className="min-h-11 max-w-full rounded-xl border bg-background px-3 text-sm"><option value="current">{t("workzone.currentPlanLabel", currentLang)}</option>{plan?.versions.map((v, i) => <option key={v.id} value={v.id}>{t("workzone.versionLabel", currentLang).replace("{version}", String(i + 1))} · {new Date(v.at).toLocaleString(currentLang)}</option>)}</select><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map(r => <article key={r.id} className="min-w-0 space-y-2 rounded-xl border p-4"><h3 className="break-words font-semibold">{r.baustelleName}</h3><p className="break-words text-sm">{r.workerNames || "—"}</p><p className="break-words text-sm text-muted-foreground">{r.machineNames || "—"}</p>{r.note && <p className="break-words text-sm">{r.note}</p>}</article>)}</div>{!rows.length && <p className="text-sm text-muted-foreground">{t("workzone.noSavedPlan", currentLang)}</p>}</section>}
  </div>;
}
