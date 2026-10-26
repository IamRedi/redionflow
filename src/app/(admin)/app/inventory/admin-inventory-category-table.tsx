"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  generateAdminInventoryBarcodeAction,
  updateAdminInventoryItemAction,
} from "@/app/(workzone)/workzone/inventory-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleDialog } from "@/components/ui/simple-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { barcodeStatusLabel } from "@/lib/inventory/barcode";
import { t, type Language } from "@/lib/i18n";
import { cn } from "@/lib/ui/cn";

type InventoryCategory = "WORK_TOOL" | "CLOTHING" | "SITE_EQUIPMENT";

type InventoryItemRow = {
  id: string;
  itemCode: string;
  name: string;
  sizeLabel: string | null;
  barcode: string | null;
  note: string | null;
  isActive: boolean;
  assignedWorkerName: string | null;
};

function variantLabel(category: InventoryCategory, lang: Language) {
  return category === "CLOTHING" ? t("admin.inventorySize", lang) : t("admin.inventoryModel", lang);
}

function statusLabel(status: string, lang: Language) {
  if (status === "PRIVATE") return t("admin.inventoryStatusPrivate", lang);
  if (status === "ASSIGNED") return t("admin.inventoryStatusAssigned", lang);
  return t("admin.inventoryStatusInStock", lang);
}

export function AdminInventoryCategoryTable({
  category,
  currentLang,
  items,
}: {
  category: InventoryCategory;
  currentLang: Language;
  items: InventoryItemRow[];
}) {
  const router = useRouter();
  const [sortMode, setSortMode] = useState<"default" | "stock">("default");
  const [variantFilter, setVariantFilter] = useState<string>("");
  const [message, setMessage] = useState<string>();
  const [editingItem, setEditingItem] = useState<InventoryItemRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableVariantCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      if (item.assignedWorkerName) continue;
      const key = item.sizeLabel?.trim() || t("admin.inventoryNoValue", currentLang);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [currentLang, items]);

  const filteredItems = useMemo(() => {
    const rows = items.filter((item) => {
      if (!variantFilter) return true;
      if (variantFilter === "__EMPTY__") return !(item.sizeLabel?.trim() || "");
      return (item.sizeLabel?.trim() || "") === variantFilter;
    });
    const getAvailableCount = (item: InventoryItemRow) => availableVariantCounts.get(item.sizeLabel?.trim() || t("admin.inventoryNoValue", currentLang)) ?? 0;

    return rows.slice().sort((a, b) => {
      const assignmentRank = Number(Boolean(a.assignedWorkerName)) - Number(Boolean(b.assignedWorkerName));
      if (assignmentRank !== 0) return assignmentRank;

      if (sortMode === "stock") {
        const countDiff = getAvailableCount(b) - getAvailableCount(a);
        if (countDiff !== 0) return countDiff;
      }

      const variantDiff = (a.sizeLabel ?? "").localeCompare(b.sizeLabel ?? "", "de");
      if (variantDiff !== 0) return variantDiff;

      const nameDiff = a.name.localeCompare(b.name, "de");
      if (nameDiff !== 0) return nameDiff;

      return a.itemCode.localeCompare(b.itemCode, "de");
    });
  }, [availableVariantCounts, currentLang, items, sortMode, variantFilter]);

  const variantOptions = useMemo(
    () =>
      Array.from(availableVariantCounts.entries()).sort((a, b) => {
        const countDiff = b[1] - a[1];
        if (countDiff !== 0) return countDiff;
        return a[0].localeCompare(b[0], "de");
      }),
    [availableVariantCounts],
  );

  function saveEditingItem() {
    if (!editingItem) return;

    const formData = new FormData();
    formData.set("id", editingItem.id);
    formData.set("itemCode", editingItem.itemCode);
    formData.set("name", editingItem.name);
    formData.set("sizeLabel", editingItem.sizeLabel ?? "");
    formData.set("note", editingItem.note ?? "");
    formData.set("isActive", editingItem.isActive ? "on" : "off");
    if (!editingItem.barcode) formData.set("barcode", "");

    startTransition(async () => {
      const result = await updateAdminInventoryItemAction(formData);
      setMessage(result.message ?? (result.ok ? t("validation.saved", currentLang) : t("common.error", currentLang)));
      if (result.ok) {
        setEditingItem(null);
        router.refresh();
      }
    });
  }

  function generateBarcodeForEditingItem() {
    if (!editingItem) return;
    const formData = new FormData();
    formData.set("id", editingItem.id);

    startTransition(async () => {
      const result = await generateAdminInventoryBarcodeAction(formData);
      setMessage(result.message ?? (result.ok ? t("admin.inventoryGenerateBarcode", currentLang) : t("common.error", currentLang)));
      if (result.ok) {
        setEditingItem(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/10 px-2 py-2">
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-[11px] font-normal"
          variant={sortMode === "default" ? "secondary" : "ghost"}
          onClick={() => setSortMode("default")}
        >
          {t("admin.inventoryDefaultSort", currentLang)}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-[11px] font-normal"
          variant={sortMode === "stock" ? "secondary" : "ghost"}
          onClick={() => setSortMode("stock")}
        >
          {t("admin.inventoryStockSort", currentLang)}
        </Button>
        <div className="ml-1 text-[11px] text-muted-foreground">
          {t("admin.inventoryFreeVariant", currentLang).replace("{variant}", variantLabel(category, currentLang))}
        </div>
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-[11px] font-normal"
          variant={!variantFilter ? "secondary" : "ghost"}
          onClick={() => setVariantFilter("")}
        >
          {t("admin.inventoryAll", currentLang)}
        </Button>
        {variantOptions.map(([variant, count]) => (
          <Button
            key={variant}
            type="button"
            size="sm"
            className="h-7 px-2 text-[11px] font-normal"
            variant={variantFilter === (variant === t("admin.inventoryNoValue", currentLang) ? "__EMPTY__" : variant) ? "secondary" : "ghost"}
            onClick={() => setVariantFilter(variant === t("admin.inventoryNoValue", currentLang) ? "__EMPTY__" : variant)}
          >
            {variant} ({count})
          </Button>
        ))}
      </div>

      {message ? <p className="text-[11px] text-muted-foreground">{message}</p> : null}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.inventoryArticle", currentLang)}</TableHead>
              <TableHead>{variantLabel(category, currentLang)}</TableHead>
              <TableHead>{t("admin.inventoryBarcode", currentLang)}</TableHead>
              <TableHead>{t("admin.inventoryStatus", currentLang)}</TableHead>
              <TableHead>{t("admin.inventoryWorker", currentLang)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  {t("admin.inventoryNoMatchingEntries", currentLang)}
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow
                  key={item.id}
                  className={cn(
                    "cursor-pointer transition hover:bg-muted/30",
                    item.assignedWorkerName ? "bg-muted/10 text-muted-foreground" : "",
                    !item.isActive ? "opacity-60" : "",
                  )}
                  onClick={() => setEditingItem(item)}
                >
                  <TableCell>
                    <div className="text-sm font-normal">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground">{item.itemCode}</div>
                  </TableCell>
                  <TableCell className="text-sm">{item.sizeLabel ?? "-"}</TableCell>
                  <TableCell className="font-mono text-[11px]">{item.barcode ?? "-"}</TableCell>
                  <TableCell className="text-sm">{statusLabel(barcodeStatusLabel({ isPrivate: false, assignedWorkerName: item.assignedWorkerName }), currentLang)}</TableCell>
                  <TableCell className="text-sm">{item.assignedWorkerName ?? "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <SimpleDialog
        open={Boolean(editingItem)}
        title={editingItem ? t("admin.inventoryEditNamedTitle", currentLang).replace("{name}", editingItem.name) : t("admin.inventoryEditTitle", currentLang)}
        description={t("admin.inventoryEditDescription", currentLang)}
        confirmLabel={t("common.save", currentLang)}
        cancelLabel={t("common.close", currentLang)}
        confirmDisabled={!editingItem || isPending}
        onCancel={() => setEditingItem(null)}
        onConfirm={saveEditingItem}
      >
        {editingItem ? (
          <div className="space-y-3">
            <div className="grid gap-2">
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">{t("admin.inventoryShortId", currentLang)}</span>
                <Input
                  value={editingItem.itemCode}
                  onChange={(event) => setEditingItem((current) => (current ? { ...current, itemCode: event.currentTarget.value } : current))}
                />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">{t("admin.inventoryArticle", currentLang)}</span>
                <Input
                  value={editingItem.name}
                  onChange={(event) => setEditingItem((current) => (current ? { ...current, name: event.currentTarget.value } : current))}
                />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">{variantLabel(category, currentLang)}</span>
                <Input
                  value={editingItem.sizeLabel ?? ""}
                  onChange={(event) => setEditingItem((current) => (current ? { ...current, sizeLabel: event.currentTarget.value } : current))}
                />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">{t("common.note", currentLang)}</span>
                <Input
                  value={editingItem.note ?? ""}
                  onChange={(event) => setEditingItem((current) => (current ? { ...current, note: event.currentTarget.value } : current))}
                />
              </label>
              <div className="rounded-md border bg-muted/20 px-3 py-2">
                <div className="text-xs font-semibold text-muted-foreground">{t("admin.inventoryBarcode", currentLang)}</div>
                <div className="mt-1 font-mono text-sm">{editingItem.barcode ?? t("admin.inventoryNoBarcodeYet", currentLang)}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!editingItem.barcode ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] font-normal"
                  disabled={isPending}
                  onClick={generateBarcodeForEditingItem}
                >
                  {t("admin.inventoryGenerateBarcode", currentLang)}
                </Button>
              ) : null}
              <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11px] font-normal">
                <Link href={`/app/admin/inventory/print?ids=${encodeURIComponent(editingItem.id)}&copies=1`}>{t("admin.inventoryPrint", currentLang)}</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </SimpleDialog>
    </div>
  );
}
