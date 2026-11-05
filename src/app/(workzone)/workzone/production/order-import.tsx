"use client";

import { FileText, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import type { OrderDraft, OrderLine } from "@/lib/factory/order-parse";
import { formatAmount, PRODUCTION_UNITS, type ProductionUnit } from "@/lib/factory/production";
import { t } from "@/lib/i18n";

import { importOrderAction, parseOrderAction } from "../site-file-actions";
import { Sheet } from "./production-ui";

type EditLine = { title: string; quantity: string; unit: ProductionUnit; price: number | null };

function toEdit(line: OrderLine): EditLine {
  return { title: line.title, quantity: line.quantity === null ? "" : String(line.quantity).replace(".", ","), unit: line.unit, price: line.price };
}

const NEW_SITE = "__new__";

/**
 * Office: upload a supplier order PDF, check what was read, save. The material
 * goes on the factory line for its site; a missing site is created from the order.
 */
export function OrderImportSheet({ sites, onClose }: { sites: Array<{ id: string; name: string }>; onClose: () => void }) {
  const { currentLang: lang } = useLanguage();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [siteId, setSiteId] = useState<string>(NEW_SITE);
  const [lines, setLines] = useState<EditLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function read(selected: File) {
    setFile(selected);
    setError(null);
    const form = new FormData();
    form.set("file", selected);
    startTransition(async () => {
      const result = await parseOrderAction(form);
      if (!result.ok) {
        setError(result.message || t("factory.error", lang));
        return;
      }
      setDraft(result.draft);
      setSiteId(result.matchedSiteId ?? NEW_SITE);
      setLines(result.draft.lines.length ? result.draft.lines.map(toEdit) : [{ title: "", quantity: "", unit: "t", price: null }]);
    });
  }

  const cleanLines = lines
    .map((line) => {
      const qty = Number(line.quantity.replace(",", "."));
      return { title: line.title.trim(), quantity: line.quantity.trim() && Number.isFinite(qty) && qty > 0 ? qty : null, unit: line.unit, price: line.price };
    })
    .filter((line) => line.title);
  const valid = Boolean(draft && file && cleanLines.length > 0 && (siteId !== NEW_SITE || draft.siteName.trim()));

  function save() {
    if (!draft || !file || !valid) return;
    const form = new FormData();
    form.set("file", file);
    form.set(
      "draft",
      JSON.stringify({
        siteId: siteId === NEW_SITE ? null : siteId,
        siteName: draft.siteName,
        address: draft.address,
        client: draft.client,
        supplier: draft.supplier,
        reference: draft.reference,
        total: draft.total,
        currency: draft.currency,
        lines: cleanLines,
      }),
    );
    setError(null);
    startTransition(async () => {
      const result = await importOrderAction(form);
      if (!result.ok || !result.siteId) {
        setError(result.message || t("factory.error", lang));
        return;
      }
      onClose();
      router.push(`/workzone/baustellen/${result.siteId}#prodhimi`);
    });
  }

  const field = "h-12 w-full rounded-xl border-2 bg-card px-3 text-base outline-none focus:border-orange-500";

  return (
    <Sheet onClose={onClose} label={t("factory.importOrder", lang)} closeLabel={t("factory.close", lang)}>
      {!draft ? (
        <div className="space-y-4">
          <p className="text-base text-muted-foreground">{t("factory.importHint", lang)}</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-orange-500/50 bg-orange-500/[0.05] p-6 text-center active:scale-[0.99] disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-10 animate-spin text-orange-600" /> : <UploadCloud className="size-12 text-orange-600" />}
            <span className="text-lg font-bold">{pending ? t("factory.reading", lang) : t("factory.choosePdf", lang)}</span>
            {file ? <span className="text-sm text-muted-foreground">{file.name}</span> : null}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) read(selected);
              event.target.value = "";
            }}
          />
          {error ? <p className="font-medium text-red-600">{error}</p> : null}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-3">
            <FileText className="size-8 shrink-0 text-orange-600" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{file?.name}</div>
              <div className="text-sm text-muted-foreground">{t("factory.checkRead", lang)}</div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">{t("factory.forSite", lang)}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSiteId(NEW_SITE)}
                className={`min-h-14 rounded-xl border-2 px-4 text-left text-base font-semibold active:scale-[0.98] ${siteId === NEW_SITE ? "border-orange-500 bg-orange-500/10" : "bg-card"}`}
              >
                + {t("factory.newSite", lang)}
              </button>
              {sites.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => setSiteId(site.id)}
                  className={`min-h-14 rounded-xl border-2 px-4 text-left text-base font-semibold active:scale-[0.98] ${siteId === site.id ? "border-orange-500 bg-orange-500/10" : "bg-card"}`}
                >
                  {site.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-semibold">{t("factory.siteName", lang)}</span>
              <input value={draft.siteName} onChange={(event) => setDraft({ ...draft, siteName: event.target.value.slice(0, 160) })} className={field} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-semibold">{t("factory.siteAddress", lang)}</span>
              <input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value.slice(0, 240) })} className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">{t("factory.supplier", lang)}</span>
              <input value={draft.supplier} onChange={(event) => setDraft({ ...draft, supplier: event.target.value.slice(0, 120) })} className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">{t("factory.orderNo", lang)}</span>
              <input value={draft.reference} onChange={(event) => setDraft({ ...draft, reference: event.target.value.slice(0, 60) })} className={field} />
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-semibold">{t("factory.orderLines", lang)}</span>
              {draft.total !== null ? (
                <span className="text-sm text-muted-foreground">
                  {t("factory.total", lang)}: <b className="text-foreground">{formatAmount(draft.total)} {draft.currency === "EUR" ? "€" : "lek"}</b>
                </span>
              ) : null}
            </div>
            <ul className="space-y-2">
              {lines.map((line, index) => (
                <li key={index} className="rounded-2xl border-2 bg-card p-3">
                  <div className="flex gap-2">
                    <input
                      value={line.title}
                      onChange={(event) => setLines(lines.map((item, i) => (i === index ? { ...item, title: event.target.value.slice(0, 160) } : item)))}
                      placeholder={t("factory.materialPlaceholder", lang)}
                      className="h-12 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => setLines(lines.filter((_, i) => i !== index))}
                      className="grid size-12 shrink-0 place-items-center rounded-xl border text-red-600 active:scale-95"
                      aria-label={t("factory.removeLine", lang)}
                    >
                      <Trash2 className="size-5" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={line.quantity}
                      inputMode="decimal"
                      onChange={(event) => setLines(lines.map((item, i) => (i === index ? { ...item, quantity: event.target.value.replace(/[^0-9.,]/g, "").slice(0, 12) } : item)))}
                      className="h-11 w-24 rounded-xl border bg-background px-3 text-base tabular-nums outline-none focus:border-orange-500"
                      aria-label={t("factory.quantity", lang)}
                    />
                    {PRODUCTION_UNITS.map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => setLines(lines.map((item, i) => (i === index ? { ...item, unit } : item)))}
                        className={`h-11 min-w-11 rounded-xl border-2 px-2 text-sm font-semibold active:scale-95 ${line.unit === unit ? "border-orange-500 bg-orange-500/10" : "bg-card"}`}
                      >
                        {t(`factory.units.${unit}`, lang)}
                      </button>
                    ))}
                    {line.price !== null ? <span className="ml-auto text-sm tabular-nums text-muted-foreground">{formatAmount(line.price)}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setLines([...lines, { title: "", quantity: "", unit: "t", price: null }])}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-semibold active:scale-[0.99]"
            >
              <Plus className="size-4" /> {t("factory.addLine", lang)}
            </button>
          </div>

          {error ? <p className="font-medium text-red-600">{error}</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setFile(null);
              }}
              className="h-16 rounded-2xl border-2 bg-card text-lg font-semibold active:scale-[0.98]"
            >
              {t("factory.otherPdf", lang)}
            </button>
            <button
              type="button"
              disabled={!valid || pending}
              onClick={save}
              className="h-16 rounded-2xl bg-orange-600 text-lg font-bold text-white shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              {pending ? <Loader2 className="mx-auto size-6 animate-spin" /> : t("factory.saveOrder", lang)}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
