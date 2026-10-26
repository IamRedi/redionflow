"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HardHat, PackagePlus, RotateCcw, ScanLine, Shirt } from "lucide-react";

import { ScanGatewayDialog } from "@/components/inventory/scan-gateway-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleDialog } from "@/components/ui/simple-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { cn } from "@/lib/ui/cn";
import { normalizeBarcodeInput } from "@/lib/inventory/barcode";
import {
  returnWorkerInventoryItemAction,
  scanWorkerInventoryBarcodeAction,
  submitWorkerInventoryAssignmentAction,
} from "../inventory-actions";

type InventoryKind = "CLOTHING" | "EQUIPMENT";

type InventoryItem = {
  id: string;
  kind: InventoryKind;
  itemName: string;
  itemCode: string | null;
  barcode: string | null;
  sizeLabel: string | null;
  isPrivate: boolean;
  note: string | null;
  handedOverAt: Date;
  status: string;
  createdByRole: string;
  createdByName: string | null;
};

type CatalogItem = {
  id: string;
  category: "WORK_TOOL" | "CLOTHING" | "SITE_EQUIPMENT";
  itemCode: string;
  name: string;
  barcode: string | null;
  note: string | null;
  isActive: boolean;
  assignedWorkerId?: string | null;
  assignedWorkerName?: string | null;
};

type MovementItem = {
  id: string;
  action: string;
  actorRole: string | null;
  actorName: string | null;
  barcode: string | null;
  isPrivate: boolean;
  note: string | null;
  createdAt: Date;
  item: { id: string; name: string; itemCode: string } | null;
};

function statusLabel(item: InventoryItem, currentLang: Language) {
  if (item.isPrivate) return t("workzone.inventoryStatusPrivate", currentLang);
  return item.status === "DELETED" ? t("workzone.inventoryStatusReturned", currentLang) : t("workzone.inventoryStatusActive", currentLang);
}

function formatDate(date: Date) {
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function movementLabel(action: string, currentLang: Language) {
  if (action === "TAKE") return t("workzone.inventoryMovementTake", currentLang);
  if (action === "RETURN") return t("workzone.inventoryMovementReturn", currentLang);
  if (action === "CREATE_PRIVATE") return t("workzone.inventoryMovementCreatePrivate", currentLang);
  return action;
}

function inventoryKindForCategory(category: CatalogItem["category"]): InventoryKind {
  return category === "CLOTHING" ? "CLOTHING" : "EQUIPMENT";
}

export function WorkerInventory({
  workerId,
  mode,
  items,
  catalogItems,
  movementHistory,
  currentLang,
}: {
  workerId: string;
  mode: "worker" | "admin";
  items: InventoryItem[];
  catalogItems: CatalogItem[];
  movementHistory: MovementItem[];
  currentLang: Language;
}) {
  const router = useRouter();
  const [activeKind, setActiveKind] = useState<InventoryKind | null>("EQUIPMENT");
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const [manualOpen, setManualOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanValue, setScanValue] = useState("");
  const [privateName, setPrivateName] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [itemToReturn, setItemToReturn] = useState<InventoryItem | null>(null);

  const visibleItems = useMemo(
    () => items.filter((item) => item.status !== "DELETED" && item.kind === activeKind),
    [items, activeKind],
  );
  const availableCatalogItems = useMemo(() => {
    if (activeKind === "CLOTHING") return catalogItems.filter((item) => item.category === "CLOTHING");
    if (activeKind === "EQUIPMENT") return catalogItems.filter((item) => item.category !== "CLOTHING");
    return [];
  }, [activeKind, catalogItems]);
  const detectedCatalogItem = useMemo(
    () => catalogItems.find((item) => normalizeBarcodeInput(item.barcode ?? "") === scanValue),
    [catalogItems, scanValue],
  );
  const scannedAssignedElsewhere =
    detectedCatalogItem?.assignedWorkerId && detectedCatalogItem.assignedWorkerId !== workerId ? detectedCatalogItem : null;
  const visibleMovementHistory = useMemo(() => {
    if (!activeKind) return [];
    const itemIds = new Set(
      catalogItems.filter((item) => inventoryKindForCategory(item.category) === activeKind).map((item) => item.id),
    );
    return movementHistory
      .filter((entry) => (entry.item?.id ? itemIds.has(entry.item.id) : activeKind === "EQUIPMENT"))
      .slice(0, 8);
  }, [activeKind, catalogItems, movementHistory]);

  function refreshWith(result: { ok: boolean; message?: string }) {
    setMessage(result.message ?? (result.ok ? "OK" : t("common.error", currentLang)));
    if (result.ok) router.refresh();
  }

  function submitManual(formData: FormData) {
    formData.set("workerId", workerId);
    formData.set("kind", activeKind ?? "EQUIPMENT");
    const selectedCompanyItemId = String(formData.get("companyInventoryItemId") ?? "").trim();
    const selectedCompanyItem = selectedCompanyItemId
      ? catalogItems.find((item) => item.id === selectedCompanyItemId)
      : null;
    startTransition(async () => {
      const result = await submitWorkerInventoryAssignmentAction(formData);
      refreshWith(result);
      if (result.ok) {
        if (selectedCompanyItem) {
          setActiveKind(inventoryKindForCategory(selectedCompanyItem.category));
        }
        setManualOpen(false);
        setManualBarcode("");
      }
    });
  }

  function confirmScan() {
    const formData = new FormData();
    formData.set("workerId", workerId);
    formData.set("barcode", scanValue);
    formData.set("kind", activeKind ?? "EQUIPMENT");
    if (!detectedCatalogItem) formData.set("itemName", privateName || `${t("workzone.inventoryPrivate", currentLang)} ${scanValue}`);

    startTransition(async () => {
      const result = await scanWorkerInventoryBarcodeAction(formData);
      refreshWith(result);
      if (result.ok) {
        setActiveKind(
          detectedCatalogItem
            ? inventoryKindForCategory(detectedCatalogItem.category)
            : activeKind === "CLOTHING"
              ? "CLOTHING"
              : "EQUIPMENT",
        );
        setScanOpen(false);
        setScanValue("");
        setPrivateName("");
      }
    });
  }

  function returnItem(item: InventoryItem) {
    const formData = new FormData();
    formData.set("itemId", item.id);
    startTransition(async () => {
      const result = await returnWorkerInventoryItemAction(formData);
      refreshWith(result);
    });
  }

  return (
    <div className="mt-5 border-t pt-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={activeKind === "CLOTHING" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveKind(activeKind === "CLOTHING" && mode !== "admin" ? null : "CLOTHING")}
        >
          <Shirt className="size-4" />
          {t("workzone.inventoryClothing", currentLang)}
        </Button>
        <Button
          type="button"
          variant={activeKind === "EQUIPMENT" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveKind(activeKind === "EQUIPMENT" && mode !== "admin" ? null : "EQUIPMENT")}
        >
          <HardHat className="size-4" />
          {t("workzone.inventoryEquipment", currentLang)}
        </Button>
      </div>

      {activeKind ? (
        <div className="mt-4 space-y-3 rounded-md border bg-muted/20 p-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => setScanOpen(true)}>
              <ScanLine className="size-4" />
              {t("workzone.inventoryScan", currentLang)}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setManualOpen(true)}>
              <PackagePlus className="size-4" />
              {t("workzone.inventoryAddManual", currentLang)}
            </Button>
          </div>

          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("workzone.inventoryArticle", currentLang)}</TableHead>
                  <TableHead>{t("common.id", currentLang)}</TableHead>
                  <TableHead>{t("workzone.inventoryBarcode", currentLang)}</TableHead>
                  <TableHead>{t("workzone.inventorySize", currentLang)}</TableHead>
                  <TableHead>{t("workzone.inventoryStatus", currentLang)}</TableHead>
                  <TableHead>{t("common.note", currentLang)}</TableHead>
                  <TableHead>{t("report.date", currentLang)}</TableHead>
                  <TableHead className="text-right">{t("form.action", currentLang)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      {t("workzone.inventoryNoEntries", currentLang)}
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.itemName}
                        {item.isPrivate ? <div className="text-xs text-muted-foreground">{t("workzone.inventoryPrivate", currentLang)}</div> : null}
                      </TableCell>
                      <TableCell>{item.itemCode ?? "-"}</TableCell>
                      <TableCell>{item.barcode ?? "-"}</TableCell>
                      <TableCell>{item.sizeLabel ?? "-"}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded-full px-2 py-1 text-xs font-medium",
                            item.isPrivate ? "bg-sky-500/15 text-sky-700" : "bg-emerald-500/15 text-emerald-700",
                          )}
                        >
                          {statusLabel(item, currentLang)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">{item.note ?? "-"}</TableCell>
                      <TableCell>{formatDate(item.handedOverAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setItemToReturn(item)}>
                          <RotateCcw className="size-4" />
                          {t("workzone.inventoryReturn", currentLang)}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-md border bg-background p-3">
            <div className="text-sm font-semibold">{t("workzone.inventoryMovementHistory", currentLang)}</div>
            <div className="mt-2 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("form.action", currentLang)}</TableHead>
                    <TableHead>{t("workzone.inventoryArticle", currentLang)}</TableHead>
                    <TableHead>{t("workzone.inventoryBarcode", currentLang)}</TableHead>
                    <TableHead>{t("admin.auditColumnActor", currentLang)}</TableHead>
                    <TableHead>{t("workzone.inventoryWhen", currentLang)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMovementHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        {t("workzone.inventoryNoMovements", currentLang)}
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleMovementHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{movementLabel(entry.action, currentLang)}</TableCell>
                        <TableCell>{entry.item?.name ?? entry.note ?? t("workzone.inventoryPrivate", currentLang)}</TableCell>
                        <TableCell>{entry.barcode ?? "-"}</TableCell>
                        <TableCell>{entry.actorName ?? entry.actorRole ?? "-"}</TableCell>
                        <TableCell>{formatDate(entry.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : null}

      <SimpleDialog
        open={manualOpen}
        title={t("workzone.inventoryManualTitle", currentLang)}
        description={t("workzone.inventoryManualDescription", currentLang)}
        confirmLabel={t("common.save", currentLang)}
        cancelLabel={t("common.cancel", currentLang)}
        onCancel={() => setManualOpen(false)}
        onConfirm={() => {
          const form = document.getElementById("worker-manual-inventory-form") as HTMLFormElement | null;
          form?.requestSubmit();
        }}
      >
        <form id="worker-manual-inventory-form" action={submitManual} className="grid gap-2">
          <select name="companyInventoryItemId" defaultValue="" className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">{t("workzone.inventoryPrivateManual", currentLang)}</option>
            {availableCatalogItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.itemCode} - {item.name}
              </option>
            ))}
          </select>
          <Input name="itemName" placeholder={t("workzone.inventoryPrivateNamePlaceholder", currentLang)} />
          <div className="grid grid-cols-2 gap-2">
            <Input name="itemCode" placeholder={t("workzone.inventoryShortId", currentLang)} />
            <Input
              name="barcode"
              placeholder={t("workzone.inventoryBarcode", currentLang)}
              value={manualBarcode}
              onChange={(event) => setManualBarcode(normalizeBarcodeInput(event.currentTarget.value))}
            />
          </div>
          <Input name="sizeLabel" placeholder={t("workzone.inventorySizeOptional", currentLang)} />
          <Input name="note" placeholder={t("common.note", currentLang)} />
        </form>
      </SimpleDialog>

      <ScanGatewayDialog
        open={scanOpen}
        title={t("workzone.inventoryScanTitle", currentLang)}
        description={t("workzone.inventoryScanDescription", currentLang)}
        value={scanValue}
        onDetected={setScanValue}
        confirmLabel={scannedAssignedElsewhere ? t("workzone.inventoryAlreadyAssigned", currentLang) : detectedCatalogItem ? t("workzone.inventoryAccept", currentLang) : t("workzone.inventorySavePrivate", currentLang)}
        confirmDisabled={!scanValue || Boolean(scannedAssignedElsewhere) || (!detectedCatalogItem && !privateName.trim()) || isPending}
        onCancel={() => {
          setScanOpen(false);
          setScanValue("");
          setPrivateName("");
        }}
        onConfirm={confirmScan}
      >
        <div className="space-y-2 rounded-md border bg-background p-3">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{t("workzone.inventoryScanCode", currentLang)}</div>
          <div className="font-mono text-sm">{scanValue}</div>
          {scannedAssignedElsewhere ? (
            <p className="text-sm text-amber-700">
              {t("workzone.inventoryAssignedElsewhere", currentLang).replace("{name}", scannedAssignedElsewhere.assignedWorkerName ?? t("workzone.inventoryAnotherWorker", currentLang))}
            </p>
          ) : detectedCatalogItem ? (
            <p className="text-sm">{t("workzone.inventoryFoundInStock", currentLang)}</p>
          ) : (
            <>
              <p className="text-sm">{t("workzone.inventoryCodeNotFound", currentLang)}</p>
              <Input value={privateName} onChange={(event) => setPrivateName(event.currentTarget.value)} placeholder={t("workzone.inventoryPrivateNamePlaceholder", currentLang)} />
            </>
          )}
        </div>
      </ScanGatewayDialog>

      <SimpleDialog
        open={Boolean(itemToReturn)}
        title={t("workzone.inventoryReturnConfirmTitle", currentLang)}
        description={itemToReturn ? t("workzone.inventoryReturnConfirmDescription", currentLang).replace("{name}", itemToReturn.itemName) : null}
        confirmLabel={t("workzone.inventoryReturn", currentLang)}
        cancelLabel={t("common.cancel", currentLang)}
        onCancel={() => setItemToReturn(null)}
        onConfirm={() => {
          if (!itemToReturn) return;
          void returnItem(itemToReturn);
          setItemToReturn(null);
        }}
      />
    </div>
  );
}
