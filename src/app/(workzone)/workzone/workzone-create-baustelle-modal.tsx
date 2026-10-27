"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";

import { createBaustelleWithDocumentsAction } from "@/app/(admin)/app/baustellen/actions";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { CompanyMode } from "@/lib/mode-config";

const BAUSTELLE_TYPES_BY_MODE: Record<CompanyMode, Array<{ value: string; labelKey: string; defaultLabel: string }>> = {
  baumdienst: [
    { value: "CLIMBING", labelKey: "workzone.climbingTree", defaultLabel: "Klettern / Baum" },
    { value: "TRUCK_PLATFORM", labelKey: "workzone.truckPlatform", defaultLabel: "LKW-Bühne" },
    { value: "TRUCK_CRANE", labelKey: "workzone.truckCrane", defaultLabel: "LKW-Kran" },
    { value: "WATERING", labelKey: "workzone.watering", defaultLabel: "Bewässerung" },
    { value: "EXCAVATOR", labelKey: "workzone.excavator", defaultLabel: "Bagger" },
  ],
  bau: [
    { value: "SIGNAGE", labelKey: "workzone.signage", defaultLabel: "Beschilderung / Fixierung" },
    { value: "DRAINAGE", labelKey: "workzone.drainage", defaultLabel: "Kanal / Entwässerung" },
    { value: "WALL", labelKey: "workzone.wall", defaultLabel: "Mauerarbeiten" },
    { value: "PAVING", labelKey: "workzone.paving", defaultLabel: "Hof- und Wegepflasterung" },
    { value: "PAINTING", labelKey: "workzone.painting", defaultLabel: "Anstrich / Malerarbeiten" },
    { value: "RENOVATION", labelKey: "workzone.renovation", defaultLabel: "Sanierung / Renovierung" },
    { value: "EXCAVATOR", labelKey: "workzone.excavator", defaultLabel: "Bagger" },
    { value: "FIBER_TRENCH", labelKey: "workzone.fiberTrench", defaultLabel: "Glasfaser-Trasse" },
    { value: "FIBER_DRILLING", labelKey: "workzone.fiberDrilling", defaultLabel: "Spülbohrung" },
    { value: "FIBER_HOUSE_CONNECTION", labelKey: "workzone.fiberHouseConnection", defaultLabel: "Glasfaser-Hausanschlüsse" },
    { value: "OTHER", labelKey: "workzone.otherType", defaultLabel: "Sonstige" },
  ],
};

export function WorkzoneCreateBaustelleModal({
  companyId,
  triggerClassName,
  iconOnly = false,
  mode = "baumdienst",
}: {
  companyId: string;
  triggerClassName?: string;
  iconOnly?: boolean;
  mode?: CompanyMode;
}) {
  const { currentLang } = useLanguage();
  const typeOptions = BAUSTELLE_TYPES_BY_MODE[mode] ?? BAUSTELLE_TYPES_BY_MODE.baumdienst;
  const defaultType = typeOptions[0]?.value ?? "OTHER";
  const firstItemTypeDefault = t("workzone.treeShort", currentLang, mode);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createFirstItem, setCreateFirstItem] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const modal = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden bg-black/45 p-3 sm:p-4">
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-lg border bg-background shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{t("workzone.addSiteTitle", currentLang, mode)}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("workzone.stayInWorkzone", currentLang, mode)}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setIsOpen(false)}>
            {t("common.close", currentLang, mode)}
          </Button>
        </div>

        <form
          ref={formRef}
          className="grid min-h-0 flex-1 overscroll-contain overflow-y-auto p-4"
          action={(formData) => {
            setMessage(null);
            startTransition(async () => {
              const result = await createBaustelleWithDocumentsAction(formData);
              setMessage(result.message ?? (result.ok ? t("workzone.siteCreated", currentLang, mode) : t("common.saveFailed", currentLang, mode)));
              if (result.ok) {
                formRef.current?.reset();
                setCreateFirstItem(false);
                setIsOpen(false);
              }
            });
          }}
        >
          <div className="grid gap-3">
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="status" value="active" />

            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">{t("common.name", currentLang, mode)}</span>
              <input name="name" required className="h-9 rounded-md border bg-background px-3 text-sm" placeholder={t("workzone.exampleSiteName", currentLang, mode)} />
            </label>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">{t("common.type", currentLang, mode)}</span>
                <select
                  name="type"
                  defaultValue={defaultType}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey, currentLang, mode)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">{t("common.address", currentLang, mode)}</span>
                <input name="address" className="h-9 rounded-md border bg-background px-3 text-sm" placeholder={`${t("common.address", currentLang, mode)} ${t("common.optional", currentLang, mode)}`} />
              </label>
            </div>

            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">{t("workzone.notes", currentLang, mode)}</span>
              <textarea name="description" rows={2} className="rounded-md border bg-background px-3 py-2 text-sm" placeholder={t("workzone.shortDescriptionOptional", currentLang, mode)} />
            </label>

            <label className="flex items-center gap-2 rounded-md border bg-muted/20 p-3 text-xs">
              <input
                type="checkbox"
                name="createFirstTreeItem"
                className="size-4"
                checked={createFirstItem}
                onChange={(event) => setCreateFirstItem(event.currentTarget.checked)}
              />
              <span>{t("workzone.createFirstItem", currentLang, mode)}</span>
            </label>

            {createFirstItem ? (
              <div className="grid gap-2 rounded-md border p-3 md:grid-cols-[0.7fr_1.3fr_0.7fr]">
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">{t("common.id", currentLang, mode)}</span>
                  <input name="firstTreeId" defaultValue="1" className="h-8 rounded-md border bg-background px-2 text-sm" />
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">{t("workzone.workType", currentLang, mode)}</span>
                  <input name="firstTreeSpecies" defaultValue={firstItemTypeDefault} className="h-8 rounded-md border bg-background px-2 text-sm" />
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">{t("workzone.treeDiameter", currentLang, mode)}</span>
                  <input name="firstTreeDiameter" type="number" min="0" defaultValue="0" className="h-8 rounded-md border bg-background px-2 text-sm" />
                </label>
                <label className="grid gap-1 text-xs md:col-span-3">
                  <span className="text-muted-foreground">{t("common.note", currentLang, mode)}</span>
                  <input name="firstTreeNote" className="h-8 rounded-md border bg-background px-2 text-sm" />
                </label>
              </div>
            ) : null}

            {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
          </div>

          <div className="sticky bottom-0 -mx-4 -mb-4 mt-3 flex shrink-0 justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
            <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={() => setIsOpen(false)}>
              {t("common.cancel", currentLang, mode)}
            </Button>
            <Button type="submit" size="sm" className="h-8 px-3 text-xs" disabled={isPending}>
              {isPending ? t("common.saving", currentLang, mode) : t("common.save", currentLang, mode)}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={iconOnly ? "icon" : "sm"}
        className={triggerClassName ?? "h-7 px-2 text-[11px]"}
        onClick={() => setIsOpen(true)}
        title={t("workzone.addBaustelle", currentLang, mode)}
        aria-label={t("workzone.addBaustelle", currentLang, mode)}
      >
        {iconOnly ? <Plus className="size-3.5" /> : t("workzone.addBaustelle", currentLang, mode)}
      </Button>

      {isOpen && typeof document !== "undefined" ? createPortal(modal, document.body) : null}
    </>
  );
}
