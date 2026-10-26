"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Camera, Keyboard, Nfc, ScanLine } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { CameraBarcodeScanner } from "@/components/inventory/camera-barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleDialog } from "@/components/ui/simple-dialog";
import { t } from "@/lib/i18n";
import { normalizeBarcodeInput } from "@/lib/inventory/barcode";

type NdefReadingEvent = Event & {
  message?: {
    records?: Array<{
      data?: BufferSource;
      encoding?: string;
      recordType?: string;
      id?: string;
    }>;
  };
};

type NdefReaderLike = {
  scan(): Promise<void>;
  onreading: ((event: NdefReadingEvent) => void) | null;
  onreadingerror: (() => void) | null;
};

type NdefReaderCtor = new () => NdefReaderLike;

type ScanMode = "choice" | "camera" | "nfc" | "manual";

function decodeNfcEvent(event: NdefReadingEvent) {
  const record = event.message?.records?.[0];
  if (!record?.data) return record?.id ?? "";
  try {
    return new TextDecoder(record.encoding || "utf-8").decode(record.data);
  } catch {
    return record.id ?? "";
  }
}

export function ScanGatewayDialog({
  open,
  title,
  description,
  value,
  onDetected,
  onCancel,
  onConfirm,
  confirmLabel,
  confirmDisabled,
  normalizeValue = normalizeBarcodeInput,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  value: string;
  onDetected: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  normalizeValue?: (value: string) => string;
  children?: ReactNode;
}) {
  const { currentLang } = useLanguage();
  const [mode, setMode] = useState<ScanMode>("choice");
  const [message, setMessage] = useState<string>();

  function reset() {
    setMode("choice");
    setMessage(undefined);
  }

  async function startNfc() {
    setMode("nfc");
    setMessage(undefined);
    const Reader = (window as Window & { NDEFReader?: NdefReaderCtor }).NDEFReader;
    if (!Reader) {
      setMessage(t("admin.scanNfcUnsupported", currentLang));
      return;
    }

    try {
      const reader = new Reader();
      reader.onreading = (event) => {
        const next = normalizeValue(decodeNfcEvent(event));
        if (next) onDetected(next);
      };
      reader.onreadingerror = () => setMessage(t("admin.scanNfcReadFailed", currentLang));
      await reader.scan();
      setMessage(t("admin.scanNfcHoldPhone", currentLang));
    } catch {
      setMessage(t("admin.scanNfcStartFailed", currentLang));
    }
  }

  return (
    <SimpleDialog
      open={open}
      title={title}
      description={description}
      confirmLabel={confirmLabel ?? t("admin.scanConfirmApply", currentLang)}
      cancelLabel={t("common.close", currentLang)}
      confirmDisabled={confirmDisabled ?? !value}
      onCancel={() => {
        reset();
        onCancel();
      }}
      onConfirm={() => {
        reset();
        onConfirm();
      }}
    >
      <div className="space-y-3">
        {!value ? (
          <>
            {mode === "choice" ? (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="h-16 flex-col gap-1" onClick={startNfc}>
                  <Nfc className="size-5" />
                  <span className="text-xs">{t("admin.scanNfc", currentLang)}</span>
                </Button>
                <Button type="button" variant="outline" className="h-16 flex-col gap-1" onClick={() => setMode("camera")}>
                  <ScanLine className="size-5" />
                  <span className="text-xs">{t("admin.scanCodeQr", currentLang)}</span>
                </Button>
              </div>
            ) : null}

            {mode === "camera" ? (
              <>
                <CameraBarcodeScanner active={open && mode === "camera" && !value} onDetected={onDetected} onError={setMessage} normalizeValue={normalizeValue} />
                <div className="relative">
                  <Input value={value} onChange={(event) => onDetected(normalizeValue(event.currentTarget.value))} placeholder={t("admin.scanCodeManualPlaceholder", currentLang)} />
                  <Camera className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </>
            ) : null}

            {mode === "nfc" ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Nfc className="size-4" />
                  {t("admin.scanNfcTitle", currentLang)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{message ?? t("admin.scanNfcHoldPhone", currentLang)}</p>
              </div>
            ) : null}

            {mode === "manual" ? (
              <div className="relative">
                <Input value={value} onChange={(event) => onDetected(normalizeValue(event.currentTarget.value))} placeholder={t("admin.scanCodeManualPlaceholder", currentLang)} />
                <Keyboard className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {mode !== "choice" ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setMode("choice")}>
                  {t("common.back", currentLang)}
                </Button>
              ) : null}
              {mode !== "manual" ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setMode("manual")}>
                  <Keyboard className="size-4" />
                  {t("admin.scanManual", currentLang)}
                </Button>
              ) : null}
            </div>
            {message && mode !== "nfc" ? <p className="text-xs text-amber-700">{message}</p> : null}
          </>
        ) : (
          children
        )}
      </div>
    </SimpleDialog>
  );
}
