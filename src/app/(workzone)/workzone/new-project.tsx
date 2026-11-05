"use client";

import { AnimatePresence } from "framer-motion";
import { FilePlus2, Loader2, MapPin, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/lib/i18n";

import { createSiteFromProjectAction } from "./element-actions";
import { Sheet } from "./production/production-ui";

/**
 * New steel project from its documents: the office drops the Tekla lists (and
 * any drawings or orders), types the site address, and the site is created with
 * its element lists ready to check. The address puts it on the map.
 */
export function NewProjectButton() {
  const { currentLang: lang } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-orange-600 px-3 text-xs font-bold text-white shadow-sm active:scale-95"
      >
        <FilePlus2 className="size-4" /> {t("elements.newProject", lang)}
      </button>
      <AnimatePresence>{open ? <NewProjectSheet key="new-project" onClose={() => setOpen(false)} /> : null}</AnimatePresence>
    </>
  );
}

function NewProjectSheet({ onClose }: { onClose: () => void }) {
  const { currentLang: lang } = useLanguage();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    if (!list) return;
    setFiles((current) => {
      const next = [...current];
      for (const file of Array.from(list)) if (!next.some((entry) => entry.name === file.name && entry.size === file.size)) next.push(file);
      return next.slice(0, 10);
    });
  }

  function submit() {
    setError(null);
    const form = new FormData();
    form.set("name", name.trim());
    form.set("address", address.trim());
    for (const file of files) form.append("file", file);
    startTransition(async () => {
      const result = await createSiteFromProjectAction(form);
      if (!result.ok || !result.siteId) {
        setError(result.message || t("factory.error", lang));
        return;
      }
      router.push(`/workzone/baustellen/${result.siteId}`);
    });
  }

  return (
    <Sheet onClose={onClose} label={t("elements.newProject", lang)} closeLabel={t("factory.close", lang)}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("elements.newProjectHint", lang)}</p>

        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            add(event.dataTransfer.files);
          }}
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-orange-500/50 bg-orange-500/[0.04] p-4 text-left active:scale-[0.99]"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-orange-600 text-white">
            <UploadCloud className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-bold">{t("elements.pickDocuments", lang)}</span>
            <span className="block text-xs text-muted-foreground">{t("elements.pickDocumentsHint", lang)}</span>
          </span>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            add(event.target.files);
            event.target.value = "";
          }}
        />
        {files.length > 0 ? (
          <ul className="space-y-1">
            {files.map((file) => (
              <li key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t("common.fileSizeKb", lang).replace("{size}", String(Math.max(1, Math.round(file.size / 1024))))}</span>
                <button type="button" onClick={() => setFiles((current) => current.filter((entry) => entry !== file))} className="grid size-8 shrink-0 place-items-center rounded-lg" aria-label={t("factory.cancel", lang)}>
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <label className="block space-y-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="size-4 text-orange-600" /> {t("elements.siteAddress", lang)}
          </span>
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value.slice(0, 200))}
            placeholder={t("elements.siteAddressPlaceholder", lang)}
            className="h-12 w-full rounded-xl border-2 bg-card px-3 text-base outline-none focus:border-orange-500"
          />
          <span className="block text-xs text-muted-foreground">{t("elements.siteAddressHint", lang)}</span>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">{t("elements.siteNameOptional", lang)}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 120))}
            placeholder={t("elements.siteNamePlaceholder", lang)}
            className="h-12 w-full rounded-xl border-2 bg-card px-3 text-base outline-none focus:border-orange-500"
          />
        </label>

        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        <button
          type="button"
          disabled={pending || files.length === 0}
          onClick={submit}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 text-base font-bold text-white shadow-md active:scale-[0.99] disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-5 animate-spin" /> : <FilePlus2 className="size-5" />}
          {pending ? t("elements.creatingProject", lang) : t("elements.createProject", lang)}
        </button>
      </div>
    </Sheet>
  );
}
