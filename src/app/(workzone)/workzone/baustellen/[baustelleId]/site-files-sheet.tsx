"use client";

import { AnimatePresence } from "framer-motion";
import { Camera, FileText, FolderOpen, ImagePlus, Loader2, MapPin, Pencil, Receipt, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { formatAmount, formatShortDate } from "@/lib/factory/production";
import { t } from "@/lib/i18n";

import { deleteSiteFileAction, updateSiteInfoAction, uploadSiteFileAction } from "../../site-file-actions";
import { Sheet } from "../../production/production-ui";
import { AccessKeyButton } from "@/components/access/access-key-button";

export type SiteFileView = {
  id: string;
  kind: string;
  fileName: string;
  mime: string;
  size: number;
  amount: number | null;
  currency: string | null;
  supplier: string | null;
  reference: string | null;
  uploadedByName: string;
  createdAt: string;
};

type Tab = "docs" | "photos" | "costs";

/** Phone photos are shrunk before upload: long side 1600 px, JPEG. */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 400_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function money(value: number, currency: string | null) {
  const text = formatAmount(value);
  return currency === "EUR" ? `${text} €` : `${text} lek`;
}

export function SiteFilesButton({
  site,
  files,
  isAdmin,
  canSeeCosts = isAdmin,
  canUpload,
}: {
  site: { id: string; name: string; address: string; description: string };
  files: SiteFileView[];
  isAdmin: boolean;
  /** Office, or a key-button grant on costs. */
  canSeeCosts?: boolean;
  canUpload: boolean;
}) {
  const { currentLang: lang } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("docs");
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState(site.address);
  const [description, setDescription] = useState(site.description);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const docInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const invoiceInput = useRef<HTMLInputElement>(null);

  const docs = files.filter((file) => file.kind === "document");
  const photos = files.filter((file) => file.kind === "photo");
  const costs = files.filter((file) => file.kind === "order" || file.kind === "invoice");
  const costTotal = costs.reduce((sum, file) => sum + (file.amount ?? 0), 0);

  function upload(selected: FileList | null, kind: "document" | "photo" | "invoice") {
    if (!selected || selected.length === 0) return;
    setMessage(null);
    const list = Array.from(selected).slice(0, 10);
    startTransition(async () => {
      for (const raw of list) {
        const file = kind === "photo" ? await shrinkImage(raw) : raw;
        const form = new FormData();
        form.set("baustelleId", site.id);
        form.set("kind", kind);
        form.set("file", file);
        if (kind === "invoice" && invoiceAmount.trim()) form.set("amount", invoiceAmount.trim());
        const result = await uploadSiteFileAction(form);
        if (!result.ok) {
          setMessage(result.message || t("siteFiles.error", lang));
          break;
        }
      }
      if (kind === "invoice") setInvoiceAmount("");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteSiteFileAction({ id });
      if (!result.ok) setMessage(result.message || t("siteFiles.error", lang));
      router.refresh();
    });
  }

  function saveInfo() {
    startTransition(async () => {
      const result = await updateSiteInfoAction({ baustelleId: site.id, address, description });
      if (!result.ok) {
        setMessage(result.message || t("siteFiles.error", lang));
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: "docs", label: t("siteFiles.docs", lang), count: docs.length },
    { key: "photos", label: t("siteFiles.photos", lang), count: photos.length },
    ...(canSeeCosts ? [{ key: "costs" as const, label: t("siteFiles.costs", lang), count: costs.length }] : []),
  ];

  const fileRow = (file: SiteFileView, icon: React.ReactNode) => (
    <li key={file.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">{icon}</span>
      <a href={`/api/site-files/${file.id}`} target="_blank" rel="noopener" className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold">{file.fileName}</div>
        <div className="truncate text-xs text-muted-foreground">
          {[file.supplier, file.reference, file.uploadedByName, formatShortDate(file.createdAt)].filter(Boolean).join(" · ")}
        </div>
      </a>
      {file.amount !== null ? <span className="shrink-0 text-sm font-bold tabular-nums">{money(file.amount, file.currency)}</span> : null}
      {isAdmin ? (
        <button type="button" disabled={pending} onClick={() => remove(file.id)} className="grid size-10 shrink-0 place-items-center rounded-xl text-red-600 active:scale-95" aria-label={t("siteFiles.delete", lang)}>
          <Trash2 className="size-4.5" />
        </button>
      ) : null}
    </li>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-full border bg-background/90 px-4 text-sm font-semibold shadow-sm backdrop-blur active:scale-95"
      >
        <FolderOpen className="size-5 text-orange-600" /> {t("siteFiles.button", lang)}
        {docs.length + photos.length > 0 ? <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{docs.length + photos.length}</span> : null}
      </button>
      <AnimatePresence>
        {open ? (
          <Sheet key="files" onClose={() => setOpen(false)} label={`${t("siteFiles.button", lang)} · ${site.name}`} closeLabel={t("factory.close", lang)}>
            {/* Address and details of the site */}
            <div className="rounded-2xl border bg-card p-4">
              {editing ? (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-sm font-semibold">{t("factory.siteAddress", lang)}</span>
                    <input value={address} onChange={(event) => setAddress(event.target.value.slice(0, 240))} className="h-12 w-full rounded-xl border-2 bg-background px-3 text-base outline-none focus:border-orange-500" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-semibold">{t("siteFiles.details", lang)}</span>
                    <textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 2000))} rows={3} className="w-full resize-none rounded-xl border-2 bg-background p-3 text-base outline-none focus:border-orange-500" />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setEditing(false)} className="h-12 rounded-xl border-2 bg-card font-semibold">
                      {t("factory.cancel", lang)}
                    </button>
                    <button type="button" disabled={pending} onClick={saveInfo} className="h-12 rounded-xl bg-orange-600 font-bold text-white disabled:opacity-50">
                      {t("factory.save", lang)}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-orange-600" />
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold">{site.address || t("siteFiles.noAddress", lang)}</div>
                    {site.description ? <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{site.description}</p> : null}
                  </div>
                  {isAdmin ? (
                    <button type="button" onClick={() => setEditing(true)} className="grid size-10 shrink-0 place-items-center rounded-xl border active:scale-95" aria-label={t("siteFiles.edit", lang)}>
                      <Pencil className="size-4" />
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto">
              {tabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`h-12 shrink-0 rounded-full border-2 px-4 text-base font-semibold active:scale-95 ${tab === item.key ? "border-orange-500 bg-orange-500/10 text-orange-800 dark:text-orange-200" : "bg-card"}`}
                >
                  {item.label} <span className="ml-1 tabular-nums text-muted-foreground">{item.count}</span>
                </button>
              ))}
            </div>
            {message ? <p className="font-medium text-red-600">{message}</p> : null}
            {pending ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {t("siteFiles.working", lang)}
              </p>
            ) : null}

            {tab === "docs" ? (
              <div className="space-y-3">
                {canUpload ? (
                  <button type="button" disabled={pending} onClick={() => docInput.current?.click()} className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-orange-500/50 bg-orange-500/[0.05] text-lg font-bold active:scale-[0.99] disabled:opacity-50">
                    <UploadCloud className="size-6 text-orange-600" /> {t("siteFiles.addDoc", lang)}
                  </button>
                ) : null}
                <input ref={docInput} type="file" multiple accept="application/pdf,.pdf,image/*,.docx,.xlsx" className="hidden" onChange={(event) => { upload(event.target.files, "document"); event.target.value = ""; }} />
                <ul className="space-y-2">{docs.map((file) => fileRow(file, <FileText className="size-5" />))}</ul>
                {docs.length === 0 ? <p className="text-center text-sm text-muted-foreground">{t("siteFiles.noDocs", lang)}</p> : null}
              </div>
            ) : null}

            {tab === "photos" ? (
              <div className="space-y-3">
                {canUpload ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" disabled={pending} onClick={() => cameraInput.current?.click()} className="flex h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-orange-600 text-base font-bold text-white shadow-md active:scale-[0.98] disabled:opacity-50">
                      <Camera className="size-7" /> {t("siteFiles.takePhoto", lang)}
                    </button>
                    <button type="button" disabled={pending} onClick={() => photoInput.current?.click()} className="flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-card text-base font-bold active:scale-[0.98] disabled:opacity-50">
                      <ImagePlus className="size-7 text-orange-600" /> {t("siteFiles.uploadPhoto", lang)}
                    </button>
                  </div>
                ) : null}
                <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { upload(event.target.files, "photo"); event.target.value = ""; }} />
                <input ref={photoInput} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { upload(event.target.files, "photo"); event.target.value = ""; }} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {photos.map((file) => (
                    <div key={file.id} className="group relative aspect-square overflow-hidden rounded-2xl border bg-muted">
                      <a href={`/api/site-files/${file.id}`} target="_blank" rel="noopener">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/site-files/${file.id}`} alt={file.fileName} loading="lazy" className="h-full w-full object-cover" />
                      </a>
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-[11px] text-white">
                        {file.uploadedByName} · {formatShortDate(file.createdAt)}
                      </span>
                      {isAdmin ? (
                        <button type="button" disabled={pending} onClick={() => remove(file.id)} className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-full bg-black/55 text-white active:scale-95" aria-label={t("siteFiles.delete", lang)}>
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {photos.length === 0 ? <p className="text-center text-sm text-muted-foreground">{t("siteFiles.noPhotos", lang)}</p> : null}
              </div>
            ) : null}

            {tab === "costs" && canSeeCosts ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border-2 border-orange-500/40 bg-orange-500/[0.06] p-4">
                  <div>
                    <div className="text-sm font-semibold">{t("siteFiles.costTotal", lang)}</div>
                    <div className="text-xs text-muted-foreground">{t("siteFiles.costHint", lang)}</div>
                  </div>
                  <AccessKeyButton place="costs" compact />
                  <div className="text-2xl font-bold tabular-nums">{money(costTotal, costs[0]?.currency ?? "ALL")}</div>
                </div>
                <div className="flex gap-2">
                  <input
                    value={invoiceAmount}
                    onChange={(event) => setInvoiceAmount(event.target.value.replace(/[^0-9.,]/g, "").slice(0, 14))}
                    inputMode="decimal"
                    placeholder={t("siteFiles.amount", lang)}
                    className="h-14 w-40 rounded-xl border-2 bg-card px-3 text-base tabular-nums outline-none focus:border-orange-500"
                  />
                  <button type="button" disabled={pending} onClick={() => invoiceInput.current?.click()} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 text-base font-bold text-white active:scale-[0.98] disabled:opacity-50">
                    <Receipt className="size-5" /> {t("siteFiles.addInvoice", lang)}
                  </button>
                </div>
                <input ref={invoiceInput} type="file" accept="application/pdf,.pdf,image/*" className="hidden" onChange={(event) => { upload(event.target.files, "invoice"); event.target.value = ""; }} />
                <ul className="space-y-2">{costs.map((file) => fileRow(file, file.kind === "order" ? <FileText className="size-5" /> : <Receipt className="size-5" />))}</ul>
                {costs.length === 0 ? <p className="text-center text-sm text-muted-foreground">{t("siteFiles.noCosts", lang)}</p> : null}
              </div>
            ) : null}
          </Sheet>
        ) : null}
      </AnimatePresence>
    </>
  );
}
