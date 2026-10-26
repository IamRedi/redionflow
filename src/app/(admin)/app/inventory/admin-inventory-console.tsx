"use client";

import { useMemo, useState, useTransition } from "react";
import { PackagePlus, ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";

import { ScanGatewayDialog } from "@/components/inventory/scan-gateway-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t, type Language } from "@/lib/i18n";
import { normalizeBarcodeInput } from "@/lib/inventory/barcode";
import { createAdminInventoryItemAction } from "@/app/(workzone)/workzone/inventory-actions";

export function AdminInventoryConsole({ currentLang }: { currentLang: Language }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [barcode, setBarcode] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [category, setCategory] = useState("WORK_TOOL");
  const [name, setName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [sizeLabel, setSizeLabel] = useState("");
  const [note, setNote] = useState("");

  const ready = useMemo(() => barcode.trim().length > 0 && name.trim().length > 0, [barcode, name]);

  function clearForm() {
    setBarcode("");
    setCategory("WORK_TOOL");
    setName("");
    setItemCode("");
    setSizeLabel("");
    setNote("");
  }

  function submit() {
    const formData = new FormData();
    formData.set("barcode", barcode);
    formData.set("category", category);
    formData.set("name", name);
    if (itemCode.trim()) formData.set("itemCode", itemCode.trim());
    if (sizeLabel.trim()) formData.set("sizeLabel", sizeLabel.trim());
    if (note.trim()) formData.set("note", note.trim());

    startTransition(async () => {
      const result = await createAdminInventoryItemAction(formData);
      setMessage(result.message ?? (result.ok ? t("validation.saved", currentLang) : t("common.error", currentLang)));
      if (result.ok) {
        clearForm();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setScanOpen(true)}>
          <ScanLine className="size-4" />
          {t("admin.inventoryScanTitle", currentLang)}
        </Button>
        <Button type="button" variant="outline" onClick={() => setBarcode((current) => current)}>
          <PackagePlus className="size-4" />
          {t("admin.inventoryBarcodeManual", currentLang)}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_0.95fr_1.2fr_0.85fr_0.95fr_1fr_auto]">
        <Input value={barcode} onChange={(event) => setBarcode(normalizeBarcodeInput(event.currentTarget.value))} placeholder={t("admin.inventoryBarcode", currentLang)} />
        <select
          value={category}
          onChange={(event) => setCategory(event.currentTarget.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="WORK_TOOL">{t("admin.inventoryCategoryWorkTool", currentLang)}</option>
          <option value="CLOTHING">{t("admin.inventoryCategoryClothing", currentLang)}</option>
          <option value="SITE_EQUIPMENT">{t("admin.inventoryCategorySiteEquipment", currentLang)}</option>
        </select>
        <Input value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder={t("admin.inventoryArticleName", currentLang)} />
        <Input value={itemCode} onChange={(event) => setItemCode(event.currentTarget.value)} placeholder={t("admin.inventoryShortIdOptional", currentLang)} />
        <Input value={sizeLabel} onChange={(event) => setSizeLabel(event.currentTarget.value)} placeholder={t("admin.inventorySizeModelOptional", currentLang)} />
        <Input value={note} onChange={(event) => setNote(event.currentTarget.value)} placeholder={t("admin.inventoryNoteOptional", currentLang)} />
        <Button type="button" disabled={!ready || isPending} onClick={submit}>
          {t("admin.inventoryToStock", currentLang)}
        </Button>
      </div>

      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}

      <ScanGatewayDialog
        open={scanOpen}
        title={t("admin.inventoryScanTitle", currentLang)}
        description={t("admin.inventoryScanDescription", currentLang)}
        value={barcode}
        onDetected={setBarcode}
        confirmLabel={t("admin.inventoryAccept", currentLang)}
        confirmDisabled={!barcode}
        onCancel={() => {
          setScanOpen(false);
        }}
        onConfirm={() => {
          setScanOpen(false);
        }}
      >
        <div className="rounded-md border bg-background p-3">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{t("admin.inventoryScanCode", currentLang)}</div>
          <div className="mt-1 font-mono text-sm">{barcode}</div>
          <p className="mt-2 text-sm">{t("admin.inventoryScanHint", currentLang)}</p>
        </div>
      </ScanGatewayDialog>
    </div>
  );
}
