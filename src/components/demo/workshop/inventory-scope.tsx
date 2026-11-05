"use client";
import Link from "next/link";
import { useState } from "react";
import { Package, Plus, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { activeJob, availability } from "@/lib/workshop/demo-model";
import { siteInventory, workerInventory } from "@/lib/workshop/inventory-flow";
import { workshopCopy } from "@/lib/workshop/copy";
import { action, control, Field, Status } from "./workshop-ui";
import { useWorkshopDemo } from "./use-workshop-demo";

export function InventoryScope({ scope, identity, compact = false, now }: { scope: "site" | "worker"; identity: string; compact?: boolean; now: string }) {
  const { state, hydrated, directory, pending, status, dispatch } = useWorkshopDemo();
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang);
  const [editing, setEditing] = useState(false), [message, setMessage] = useState("");
  const assets = scope === "site" ? siteInventory(state, identity) : workerInventory(state, identity);
  const locked = assets.filter(a => activeJob(state, a.id));
  const href = `/demo/workshop?tab=tools&${scope}=${encodeURIComponent(identity)}`;
  if (compact) return <Link href={href} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><Package className="size-4 shrink-0" /><span>{c.siteInventory}: {hydrated ? assets.length : "…"}{locked.length ? ` · ${c.workshop}: ${locked.length}` : ""}</span><ArrowUpRight className="size-4 shrink-0" /></Link>;
  return <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-label={c.siteInventory}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><Package className="size-5 text-primary" />{c.siteInventory}</h2><Link href={href} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2">{c.manage}</Link></div>
    {!hydrated ? <p role="status" className="text-sm text-muted-foreground">{status === "connection" ? c.connection : c.loading}</p> : assets.length ? <ul className="divide-y">{assets.map(asset => {
      const job = activeJob(state, asset.id), value = availability(state, asset, now);
      return <li key={asset.id}><Link href={`/demo/workshop?tab=${job ? "orders" : "tools"}&asset=${asset.id}&detail=1`} className="flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-lg py-3 focus-visible:outline focus-visible:outline-2"><span className="min-w-0"><strong className="block text-sm">{asset.name} · {asset.code}</strong><span className="text-xs text-muted-foreground">{job ? c.workshopFromSite : asset.holder || c.onSite}</span></span><Status tone={job || value === "inspection" ? "amber" : "blue"}>{job ? c[job.status] : value === "inspection" ? c.inspectionDue : c.issued}</Status></Link></li>;
    })}</ul> : <p className="text-sm text-muted-foreground">{c.noEquipment}</p>}
    {scope === "site" && !editing && <Button className={action} variant="outline" disabled={!hydrated || status !== "ready"} onClick={() => setEditing(true)}><Plus />{c.assignHere}</Button>}
    {editing && <form className="grid gap-3 border-t pt-4 sm:grid-cols-2" onSubmit={async e => {
      e.preventDefault(); const data = new FormData(e.currentTarget);
      setMessage("");
      try { await dispatch({ type: "assign", assetId: String(data.get("asset")), siteKey: identity, ...(data.get("workerKey") ? { workerKey: String(data.get("workerKey")) } : {}) }); setEditing(false); setMessage(c.saved); }
      catch (error) { setMessage(error instanceof Error && error.message === "conflict" ? c.conflict : c.unavailable); }
    }}>
      <Field label={c.chooseAsset}><select name="asset" required className={control} defaultValue=""><option value="">—</option>{state.assets.filter(a => availability(state, a, now) === "available").map(a => <option key={a.id} value={a.id}>{a.name} · {a.code}</option>)}</select></Field>
      <Field label={c.worker}><select name="workerKey" className={control}><option value="">—</option>{directory.workers.filter(w => w.available).map(w => <option key={w.key} value={w.key}>{w.name}</option>)}</select></Field><div className="flex gap-2 sm:col-span-2"><Button disabled={pending || status !== "ready"} className={action}>{c.assign}</Button><Button variant="outline" type="button" className={action} onClick={() => setEditing(false)}>{c.cancel}</Button></div>
    </form>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
