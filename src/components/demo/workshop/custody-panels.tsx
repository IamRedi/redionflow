"use client";
import { assetIdentity } from "@/lib/workshop/asset-identity";

import { useState, type FormEvent } from "react";
import { ArrowRight, ArrowRightLeft, Check, Clock3, PackageCheck, Undo2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";
import { workshopCopy } from "@/lib/workshop/copy";
import { availability, type WorkshopAsset } from "@/lib/workshop/demo-model";
import { action, control, Field, Status } from "./workshop-ui";
import { useWorkshopDemo, type DemoInventoryCommand } from "./use-workshop-demo";

export function flowError(error: unknown, c: ReturnType<typeof workshopCopy>) {
  const code = error instanceof Error ? error.message : "error";
  return ({ permission: c.permission, pending: c.reservation, unavailable: c.unavailable, transition: c.transition, conflict: c.conflict, connection: c.connection, duplicate: c.duplicate, required: c.required, inspectionRequired: c.inspectionRequired, blocked: c.blocked, storage: c.storage, busy: c.busy, fileError: c.fileError } as Record<string, string>)[code] || c.error;
}
export function HandoverPanel({ id }: { id: string }) {
  const { state, actor, directory, pending, dispatch } = useWorkshopDemo();
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang);
  const [message, setMessage] = useState("");
  const h = state.custody.handovers.find(h => h.id === id);
  if (!h) return <p>{c.empty}</p>;
  const asset = state.assets.find(a => a.id === h.assetId)!;
  const name = (key: string) => key === "admin" ? c.office : directory.workers.find(w => w.key === key)?.name || (h.from?.workerKey === key ? h.from.workerName : h.to?.workerName) || h.createdBy.name;
  const canConfirm = h.status === "pending" && h.required.includes(actor.key) && !h.confirmations.some(v => v.actorKey === actor.key);
  async function change(command: DemoInventoryCommand) { try { await dispatch(command); setMessage(c.saved); } catch (e) { setMessage(flowError(e, c)); } }
  return <div className="space-y-4">
    <div><h3 className="font-semibold">{asset.name}</h3><p className="text-sm text-muted-foreground">{assetIdentity(asset)}</p></div>
    <Status tone={h.status === "completed" ? "green" : "amber"}>{h.status === "pending" ? c.pending : c[h.status]}</Status>
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border bg-muted/20 p-3 text-sm"><div className="min-w-0"><p className="text-xs text-muted-foreground">{c.from}</p><p className="break-words font-medium">{h.from?.workerName || c.storagePlace}</p>{h.from?.siteName && <p className="mt-1 break-words text-xs text-muted-foreground">{h.from.siteName}</p>}</div><ArrowRight className="size-4 text-primary" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{c.to}</p><p className="break-words font-medium">{h.to?.workerName || c.storagePlace}</p>{h.to?.siteName && <p className="mt-1 break-words text-xs text-muted-foreground">{h.to.siteName}</p>}</div></div>
    <div><p className="text-xs font-medium text-muted-foreground">{c.requiredPeople}</p><ul className="mt-2 space-y-2">{h.required.map(key => { const confirmed = h.confirmations.find(v => v.actorKey === key); return <li key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"><span className="flex items-center gap-2"><UserRound className="size-4" />{name(key)}</span><span className="flex items-center gap-1 text-xs text-muted-foreground">{confirmed ? <Check className="size-4 text-primary" /> : <Clock3 className="size-4" />}{confirmed ? confirmed.mode === "policy" ? c.automatic : c.explicit : c.pending}</span></li>; })}</ul></div>
    {h.reason && <p className="break-words text-sm">{h.reason}</p>}
    {canConfirm && <div className="flex flex-wrap gap-2"><Button className={action} disabled={pending} onClick={() => void change({ type: "confirm-handover", handoverId: h.id })}><Check />{c.confirm}</Button><Button variant="outline" className={action} disabled={pending} onClick={() => void change({ type: "decline-handover", handoverId: h.id, reason: "" })}><X />{c.decline}</Button></div>}
    {h.status === "pending" && (actor.key === h.createdBy.key || actor.role === "admin") && <Button variant="ghost" className={action} disabled={pending} onClick={() => void change({ type: "cancel-handover", handoverId: h.id })}>{c.cancelRequest}</Button>}
    {message && <p role="status" className="text-sm">{message}</p>}
    <details className="rounded-xl border p-3 text-xs"><summary className="flex min-h-11 cursor-pointer items-center">{c.history}</summary><p>{h.createdBy.name} · {new Date(h.at).toLocaleString(currentLang, { timeZone: "Europe/Berlin" })} · {h.method}</p>{h.confirmations.map(v => <p className="mt-2" key={v.actorKey}>{name(v.actorKey)} · {new Date(v.at).toLocaleString(currentLang, { timeZone: "Europe/Berlin" })} · {v.mode === "policy" ? `${c.automatic} · ${name(v.by)}` : c.explicit}</p>)}</details>
  </div>;
}
export function HandoverRequestForm({ asset, kind, siteKey, method = "selection", onDone }: { asset: WorkshopAsset; kind: "take" | "issue" | "return" | "transfer"; siteKey?: string; method?: "scan" | "selection"; onDone?: () => void }) {
  const { actor, directory, state, pending, dispatch, status } = useWorkshopDemo();
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang);
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const data = new FormData(e.currentTarget); setMessage(""); try { await dispatch({ type: "handover", assetId: asset.id, kind, method, ...(data.get("workerKey") ? { workerKey: String(data.get("workerKey")) } : {}), ...(data.get("siteKey") ? { siteKey: String(data.get("siteKey")) } : {}) }); setMessage(c.requestSaved); onDone?.(); } catch (e) { setMessage(flowError(e, c)); } }
  return <form className="space-y-4" onSubmit={e => void submit(e)}>
    <div className="rounded-xl border bg-muted/20 p-3"><p className="font-semibold">{asset.name}</p><p className="text-sm text-muted-foreground">{assetIdentity(asset)} · {asset.holder || asset.location}</p></div>
    {kind !== "take" && kind !== "return" && <Field label={c.chooseWorker}><select name="workerKey" className={control} required defaultValue=""><option value="">—</option>{directory.workers.filter(w => w.available && (kind !== "transfer" || w.key !== asset.placement?.workerKey)).map(w => <option value={w.key} key={w.key}>{w.name}</option>)}</select></Field>}
    {kind !== "return" && <Field label={c.siteOptional}><select name="siteKey" className={control} defaultValue={siteKey || asset.placement?.siteKey || ""}><option value="">—</option>{directory.sites.filter(s => s.active).map(s => <option key={s.key} value={s.key}>{s.name}</option>)}</select></Field>}
    <p className="text-sm text-muted-foreground">{c.confirmationHint}</p>
    {state.custody.autoConfirm && kind !== "transfer" && <p className="text-xs text-muted-foreground">{c.autoHint}</p>}
    <Button className={`${action} w-full`} disabled={pending || status !== "ready"}><ArrowRightLeft />{kind === "take" ? `${c.confirm} · ${actor.name}` : c.send}</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
export function CustodyAssetActions({ asset, now, method = "selection" }: { asset: WorkshopAsset; now: string; method?: "scan" | "selection" }) {
  const { state, actor } = useWorkshopDemo(), { currentLang } = useLanguage(), c = workshopCopy(currentLang);
  const [kind, setKind] = useState<"take" | "issue" | "return" | "transfer" | null>(null), [review, setReview] = useState(false);
  const h = state.custody.handovers.find(h => h.assetId === asset.id && h.status === "pending");
  const value = availability(state, asset, now), mine = asset.placement?.workerKey === actor.key;
  const record = h || state.custody.handovers.find(h => h.assetId === asset.id);
  if (kind) return <div className="rounded-xl border p-3"><Button variant="ghost" className={`${action} mb-3`} onClick={() => setKind(null)}>{c.back}</Button><HandoverRequestForm asset={asset} kind={kind} method={method} onDone={() => { setKind(null); setReview(true); }} /></div>;
  if (review && record) return <div className="rounded-xl border p-3"><Button variant="ghost" className={`${action} mb-3`} onClick={() => setReview(false)}>{c.back}</Button><HandoverPanel id={record.id} /></div>;
  return <div className="space-y-3">
    {h ? <Button className={`${action} w-full`} variant="outline" onClick={() => setReview(true)}><Clock3 />{c.pending}</Button> : <div className="flex flex-wrap gap-2">
      {value === "available" && <Button className={action} onClick={() => setKind(actor.role === "worker" ? "take" : "issue")}><PackageCheck />{actor.role === "worker" ? c.take : c.give}</Button>}
      {value === "issued" && (actor.role === "admin" || mine) && <Button className={action} onClick={() => setKind("transfer")}><ArrowRightLeft />{c.transfer}</Button>}
      {(asset.placement || asset.holder) && (actor.role === "admin" || mine) && value !== "workshop" && <Button className={action} variant="outline" onClick={() => setKind("return")}><Undo2 />{c.returnToStore}</Button>}
    </div>}
  </div>;
}
