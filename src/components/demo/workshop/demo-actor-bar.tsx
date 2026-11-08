"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, ChevronLeft, UserRound } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { workshopCopy } from "@/lib/workshop/copy";
import { useWorkshopDemo } from "./use-workshop-demo";
import { action, WorkshopDialog } from "./workshop-ui";
import { Button } from "@/components/ui/button";
import { flowError, HandoverPanel } from "./custody-panels";

const demoLabel="Demo";
export function DemoActorBar({ mode = "full" }: { mode?: "full" | "roles" | "notifications" }) {
  const { actor, directory, state, switchActor, pending, hydrated, dispatch } = useWorkshopDemo();
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang);
  const [open, setOpen] = useState(false), [selected, setSelected] = useState(""), [error, setError] = useState(""), [switching, setSwitching] = useState(false);
  const notifications = state.custody.notifications.filter(n => n.recipient === actor.key), unread = notifications.filter(n => !n.readAt);
  async function changeActor(key: string) { setError(""); setSwitching(true); try { await switchActor(key); setSelected(""); } catch (e) { setError(flowError(e, c)); } finally { setSwitching(false); } }
  function showNotifications() { setOpen(true); setSelected(""); if (unread.length && !pending) void dispatch({ type: "read-notifications", ids: unread.slice(0, 100).map(n => n.id) }).catch(e => setError(flowError(e, c))); }
  const worker = directory.workers.find(w => w.key === actor.key);
  return <div className={`flex min-w-0 items-center justify-end gap-2 ${mode === "notifications" ? "shrink-0" : "flex-1"}`}>
    {mode !== "notifications" && <><span className="hidden text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline">{demoLabel}</span>
    <select aria-label={c.testAs} value={actor.key} disabled={!hydrated || pending || switching} onChange={e => void changeActor(e.target.value)} className="h-11 min-w-0 max-w-44 flex-1 rounded-full border bg-card/95 px-3 text-sm font-medium shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:flex-none"><option value="admin">{c.office}</option>{directory.workers.map(w => <option key={w.key} value={w.key}>{w.name}</option>)}</select>
    {worker && <Link href={`/demo/workers/${worker.id}`} aria-label={`${c.profile} · ${actor.name}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border bg-card focus-visible:outline focus-visible:outline-2"><UserRound className="size-4" /></Link>}</>}
    {mode !== "roles" && <button type="button" disabled={!hydrated || switching || pending} onClick={showNotifications} aria-label={`${c.notifications}${unread.length ? ` · ${unread.length}` : ""}`} className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full border bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:ring-ring"><Bell className="size-4" />{unread.length > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground dark:text-black">{unread.length}</span>}</button>}
    {error && !open && <p role="alert" className="max-w-48 text-xs text-amber-700 dark:text-amber-300">{error}</p>}
    <WorkshopDialog open={open} title={c.notifications} description={`${actor.name} · Demo`} closeLabel={c.close} onClose={() => setOpen(false)}>
      {error && <p role="alert" className="mb-3 text-sm">{error}</p>}
      {selected ? <><Button variant="ghost" className={`${action} mb-3`} onClick={() => setSelected("")}><ChevronLeft />{c.back}</Button><HandoverPanel id={selected} /></> : notifications.length ? <ul className="divide-y">{notifications.slice(0, 50).map(n => { const asset = state.assets.find(a => a.id === n.assetId); return <li key={n.id}><button className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl p-3 text-left hover:bg-muted focus-visible:outline focus-visible:outline-2" onClick={() => setSelected(n.handoverId || "")}><span><strong className="block text-sm">{asset?.name || c.identity}</strong><span className="mt-1 block text-xs text-muted-foreground">{c[n.kind]} · {new Date(n.at).toLocaleString(currentLang, { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" })}</span></span><Bell className="size-4 shrink-0 text-primary" /></button></li>; })}</ul> : <p className="text-sm text-muted-foreground">{c.noNotifications}</p>}
    </WorkshopDialog>
  </div>;
}
