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

export function AssetRegister({ open, onClose, code = "", asset, onSaved }: { open: boolean; onClose: () => void; code?: string; asset?: WorkshopAsset; onSaved?: (id: string) => void }) {
  const { dispatch, pending, actor, upload } = useWorkshopDemo();
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang);
  const [message, setMessage] = useState("");
  const [assetId] = useState(() => asset?.id || crypto.randomUUID());
  const [registered, setRegistered] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget), file = data.get("photo");
    const details = { category: String(data.get("category")) as "tool" | "vehicle" | "ppe" | "equipment", manufacturer: String(data.get("manufacturer") || ""), model: String(data.get("model") || ""), serial: String(data.get("serial") || ""), note: String(data.get("note") || "") };
    try {
      if (!registered) {
        if (asset) await dispatch({ type: "edit-asset", assetId: asset.id, name: String(data.get("name")), details });
        else await dispatch({ type: "register", assetId, name: String(data.get("name")), code: String(data.get("code") || ""), inspection: String(data.get("inspection")), details });
        setRegistered(true);
      }
      // Registration is already durable. A failed photo never repeats creation.
      if (file instanceof File && file.size) {
        try { await upload(file, { kind: "asset", target: assetId }); } catch { setMessage(`${c.created} · ${c.fileError}`); return; }
      }
      if (onSaved) onSaved(assetId); else onClose();
    } catch (e) { setMessage(e instanceof Error && e.message === "duplicate" ? c.codeUsed : flowError(e, c)); }
  }
  return <WorkshopDialog open={open && actor.role === "admin"} title={asset ? c.edit : c.register} description={c.generated} closeLabel={c.close} onClose={onClose}>
    <form className="space-y-4" onSubmit={e => void submit(e)}><fieldset disabled={registered} className="space-y-4 disabled:opacity-60">
      <Field label={c.name}><input className={control} name="name" required maxLength={120} defaultValue={asset?.name} autoComplete="off" /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label={c.category}><select className={control} name="category" defaultValue={asset?.details?.category || (asset?.kind === "fleet" ? "vehicle" : "tool")}><option value="tool">{c.tool}</option><option value="vehicle">{c.vehicle}</option><option value="ppe">{c.ppe}</option><option value="equipment">{c.equipment}</option></select></Field>{!asset && <Field label={c.inspection}><input className={control} type="date" name="inspection" required /></Field>}</div>
      {!asset && <Field label={c.code}><input className={control} name="code" defaultValue={code} maxLength={80} pattern="[A-Za-z0-9 .$\/+%\-]+" placeholder={c.autoCode} autoComplete="off" /></Field>}
      <details className="rounded-xl border px-3"><summary className="flex min-h-11 cursor-pointer items-center font-medium text-sm">{c.specifications}</summary><div className="grid gap-4 pb-4 sm:grid-cols-2">{([ ["manufacturer", c.manufacturer], ["model", c.model], ["serial", c.serial] ] as const).map(([key,label]) => <Field key={key} label={label}><input name={key} className={control} maxLength={100} defaultValue={asset?.details?.[key]} /></Field>)}<Field label={c.note}><textarea className={`${control} h-24 py-3`} name="note" maxLength={2000} defaultValue={asset?.details?.note} /></Field></div></details>
      </fieldset><Field label={c.photos}><input className="min-h-11 w-full min-w-0 rounded-xl border p-2 text-sm" name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></Field>
      {message && <p role="alert" className="rounded-xl border p-3 text-sm">{message}</p>}
      <Button className={`${action} w-full`} disabled={pending}>{asset ? <Save /> : <PackagePlus />}{asset || registered ? c.save : c.register}</Button>
    </form>
  </WorkshopDialog>;
}
