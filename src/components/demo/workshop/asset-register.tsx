"use client";

import { useState, type FormEvent } from "react";
import { PackagePlus, Save } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { workshopCopy } from "@/lib/workshop/copy";
import type { WorkshopAsset } from "@/lib/workshop/demo-model";
import { action, control, Field, WorkshopDialog } from "./workshop-ui";
import { useWorkshopDemo } from "./use-workshop-demo";
import { flowError } from "./custody-panels";
import { assetPlate, optionalAssetCode } from "@/lib/workshop/asset-identity";
import { navigationCopy } from "@/lib/workshop/navigation-copy";
import { studioCopy } from "@/lib/workshop/studio-copy";

export function AssetRegister({ open, onClose, code = "", asset, onSaved }: { open: boolean; onClose: () => void; code?: string; asset?: WorkshopAsset; onSaved?: (id: string) => void }) {
  const { dispatch, pending, actor, upload, generateImage, imageGenerationEnabled } = useWorkshopDemo();
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang), studio = studioCopy(currentLang);
  const n = navigationCopy(currentLang);
  const [category, setCategory] = useState(asset?.details?.category || (asset?.kind === "fleet" ? "vehicle" : "tool"));
  const [barcode, setBarcode] = useState(asset?.barcode || "");
  const [message, setMessage] = useState("");
  const [assetId] = useState(() => asset?.id || crypto.randomUUID());
  const [registered, setRegistered] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget), file = data.get("photo");
    const details = { category: String(data.get("category")) as "tool" | "vehicle" | "ppe" | "equipment", manufacturer: String(data.get("manufacturer") || ""), model: String(data.get("model") || ""), serial: String(data.get("serial") || ""), note: String(data.get("note") || "") };
    try {
      const identity = category === "vehicle" ? { plate: String(data.get("plate") || ""), barcode } : {};
      if (!registered) {
        if (asset) await dispatch({ type: "edit-asset", assetId: asset.id, name: String(data.get("name")), ...identity, details });
        else await dispatch({ type: "register", assetId, name: String(data.get("name")), code: String(data.get("code") || ""), inspection: String(data.get("inspection")), ...identity, details });
        setRegistered(true);
      }
      // Registration is already durable. A failed photo never repeats creation.
      if (file instanceof File && file.size) {
        try { await upload(file, { kind: "asset", target: assetId }); } catch { setMessage(`${c.created} · ${c.fileError}`); return; }
      }
      if (!(file instanceof File && file.size) && imageGenerationEnabled && data.get("ai-image") === "on") void generateImage(assetId).catch(() => { /* Separate image status is visible on the durable asset card. */ });
      if (onSaved) onSaved(assetId); else onClose();
    } catch (e) { setMessage(e instanceof Error && e.message === "duplicate" ? c.codeUsed : flowError(e, c)); }
  }
  return <WorkshopDialog open={open && actor.role === "admin"} title={asset ? c.edit : c.register} description={c.generated} closeLabel={c.close} onClose={onClose}>
    <form className="space-y-4" onSubmit={e => void submit(e)}><fieldset disabled={registered} className="space-y-4 disabled:opacity-60">
      <Field label={c.name}><input className={control} name="name" required maxLength={120} defaultValue={asset?.name} autoComplete="off" /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label={c.category}><select className={control} name="category" value={category} onChange={e => setCategory(e.target.value as typeof category)}><option value="tool">{c.tool}</option><option value="vehicle">{c.vehicle}</option><option value="ppe">{c.ppe}</option><option value="equipment">{c.equipment}</option></select></Field>{!asset && <Field label={c.inspection}><input className={control} type="date" name="inspection" required /></Field>}</div>
      {category === "vehicle" && <div className="space-y-3"><Field label={n.plate}><input className={control} name="plate" defaultValue={asset ? assetPlate(asset) : ""} required maxLength={24} autoCapitalize="characters" autoComplete="off" /></Field><p className="text-xs leading-relaxed text-muted-foreground">{n.plateHint}</p><details className="rounded-xl border px-3" open={Boolean(asset?.barcode)}><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">{n.optionalBarcode}</summary><div className="space-y-3 pb-3"><Field label={n.optionalBarcode}><input className={control} value={barcode} onChange={e => setBarcode(e.target.value.toUpperCase())} maxLength={80} pattern="[A-Za-z0-9 .$\/+%\-]+" autoComplete="off" /></Field><Button type="button" variant="outline" className={action} onClick={() => setBarcode(optionalAssetCode(assetId))}>{n.generateBarcode}</Button><p className="text-xs text-muted-foreground">{n.barcodeHint}</p></div></details></div>}
      {!asset && category !== "vehicle" && <Field label={c.code}><input className={control} name="code" defaultValue={code} maxLength={80} pattern="[A-Za-z0-9 .$\/+%\-]+" placeholder={c.autoCode} autoComplete="off" /></Field>}
      <details className="rounded-xl border px-3"><summary className="flex min-h-11 cursor-pointer items-center font-medium text-sm">{c.specifications}</summary><div className="grid gap-4 pb-4 sm:grid-cols-2">{([ ["manufacturer", c.manufacturer], ["model", c.model], ["serial", c.serial] ] as const).map(([key,label]) => <Field key={key} label={label}><input name={key} className={control} maxLength={100} defaultValue={asset?.details?.[key]} /></Field>)}<Field label={c.note}><textarea className={`${control} h-24 py-3`} name="note" maxLength={2000} defaultValue={asset?.details?.note} /></Field></div></details>
      </fieldset><Field label={c.photos}><input className="min-h-11 w-full min-w-0 rounded-xl border p-2 text-sm" name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></Field>
      {imageGenerationEnabled && <div><label className="flex min-h-11 items-center gap-3 text-sm"><input name="ai-image" type="checkbox" defaultChecked={!asset} className="size-5 shrink-0 accent-green-700" />{studio.auto}</label><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{studio.hint}</p></div>}
      {message && <p role="alert" className="rounded-xl border p-3 text-sm">{message}</p>}
      <Button className={`${action} w-full`} disabled={pending}>{asset ? <Save /> : <PackagePlus />}{asset || registered ? c.save : c.register}</Button>
    </form>
  </WorkshopDialog>;
}
