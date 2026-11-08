"use client";
import { assetIdentity } from "@/lib/workshop/asset-identity";
import Link from "next/link";
import { useState } from "react";
import { Package, Plus, ArrowUpRight, Clock3 } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { activeJob, availability } from "@/lib/workshop/demo-model";
import { siteInventory, workerInventory } from "@/lib/workshop/inventory-flow";
import { workshopCopy } from "@/lib/workshop/copy";
import { action, control, Field, Status, WorkshopDialog } from "./workshop-ui";
import { useWorkshopDemo } from "./use-workshop-demo";
import { HandoverPanel, HandoverRequestForm } from "./custody-panels";

export function InventoryScope({ scope, identity, compact = false, tight = false, now }: { scope: "site" | "worker"; identity: string; compact?: boolean; tight?: boolean; now: string }) {
  const { state, actor, hydrated, pending, status } = useWorkshopDemo();
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang);
  const [editing, setEditing] = useState(false), [assetId, setAssetId] = useState(""), [review, setReview] = useState("");
  const assets = scope === "site" ? siteInventory(state, identity) : workerInventory(state, identity);
  const locked = assets.filter(a => activeJob(state, a.id));
  const requests = state.custody.handovers.filter(h => h.status === "pending" && (scope === "site" ? h.from?.siteKey === identity || h.to?.siteKey === identity : h.from?.workerKey === identity || h.to?.workerKey === identity));
  const href = `/demo/workshop?tab=tools&${scope}=${encodeURIComponent(identity)}`;
  const selected = state.assets.find(a => a.id === assetId);
  const available = state.assets.filter(a => availability(state, a, now) === "available" && !state.custody.handovers.some(h => h.assetId === a.id && h.status === "pending"));
  if (tight) { const label = `${c.siteInventory}: ${hydrated ? assets.length : "…"}${locked.length ? ` · ${c.workshop}: ${locked.length}` : ""}`; return <Link href={href} aria-label={label} title={label} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-1.5 text-[11px] font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><Package className="size-3.5" aria-hidden="true" />{hydrated ? assets.length : "…"}</Link>; }
  if (compact) return <Link href={href} className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><Package className="size-3.5 shrink-0" /><span className="min-w-0 truncate">{c.siteInventory}: {hydrated ? assets.length : "…"}{locked.length ? ` · ${c.workshop}: ${locked.length}` : ""}</span><ArrowUpRight className="size-3.5 shrink-0" /></Link>;
  return <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-label={c.siteInventory}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><Package className="size-5 text-primary" />{c.siteInventory}</h2><Link href={href} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2">{c.manage}</Link></div>
    {!hydrated ? <p role="status" className="text-sm text-muted-foreground">{status === "connection" ? c.connection : c.loading}</p> : assets.length ? <ul className="divide-y">{assets.map(asset => { const job = activeJob(state, asset.id), value = availability(state, asset, now); return <li key={asset.id}><Link href={`/demo/workshop?tab=${job ? "orders" : "tools"}&asset=${asset.id}&detail=1`} className="flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-lg py-3 focus-visible:outline focus-visible:outline-2"><span className="min-w-0"><strong className="block break-words text-sm">{asset.name} · {assetIdentity(asset)}</strong><span className="text-xs text-muted-foreground">{job ? c.workshopFromSite : asset.holder || c.onSite}</span></span><Status tone={job || value === "inspection" ? "amber" : "blue"}>{job ? c[job.status] : value === "inspection" ? c.inspectionDue : c.issued}</Status></Link></li>; })}</ul> : <p className="text-sm text-muted-foreground">{c.noEquipment}</p>}
    {requests.length > 0 && <div className="space-y-2 border-t pt-3"><p className="text-xs font-medium text-muted-foreground">{c.pendingOnSite}</p>{requests.map(h => <Button key={h.id} variant="outline" className={`${action} h-auto w-full justify-start whitespace-normal text-left`} onClick={() => setReview(h.id)}><Clock3 className="shrink-0" />{state.assets.find(a => a.id === h.assetId)?.name} · {c.pending}</Button>)}</div>}
    {scope === "site" && <Button className={action} variant="outline" disabled={!hydrated || pending || status !== "ready"} onClick={() => { setAssetId(""); setEditing(true); }}><Plus />{actor.role === "admin" ? c.assignHere : c.take}</Button>}
    <WorkshopDialog open={editing || !!review} title={review ? c.pending : c.siteInventory} description={c.confirmationHint} closeLabel={c.close} onClose={() => { setEditing(false); setReview(""); }}>
      {review ? <HandoverPanel id={review} /> : <div className="space-y-4"><Field label={c.chooseAsset}><select className={control} value={assetId} onChange={e => setAssetId(e.target.value)}><option value="">—</option>{available.map(a => <option key={a.id} value={a.id}>{a.name} · {assetIdentity(a)}</option>)}</select></Field>{selected && <HandoverRequestForm key={selected.id} asset={selected} kind={actor.role === "admin" ? "issue" : "take"} siteKey={identity} onDone={() => { setEditing(false); setReview(""); }} />}</div>}
    </WorkshopDialog>
  </section>;
}
