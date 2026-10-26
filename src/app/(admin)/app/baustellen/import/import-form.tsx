"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRef, useState, useTransition } from "react";
import { CheckCircle2, FileSpreadsheet, MapPinned, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import type { CompanyMode } from "@/lib/mode-config";
import { importProjectData } from "./actions";

type ImportState =
  | { kind: "idle"; message: string }
  | { kind: "success"; message: string; baustelleId: string }
  | { kind: "error"; message: string };

function FileDropField({
  id,
  name,
  label,
  description,
  accept,
  icon,
  filename,
  onFileChange,
  required,
  browseHint,
}: {
  id: string;
  name: string;
  label: string;
  description: string;
  accept: string;
  icon: ReactNode;
  filename?: string;
  onFileChange: (filename?: string) => void;
  required?: boolean;
  browseHint: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <label
        htmlFor={id}
        className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center transition-colors hover:bg-muted/60"
      >
        <span className="mb-3 flex size-11 items-center justify-center rounded-md border bg-background text-muted-foreground">
          {icon}
        </span>
        <span className="text-sm font-medium">{filename || description}</span>
        <span className="mt-1 text-xs text-muted-foreground">{browseHint}</span>
      </label>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        className="sr-only"
        required={required}
        onChange={(event) => onFileChange(event.currentTarget.files?.[0]?.name)}
      />
    </div>
  );
}

export function ImportForm({
  targetBaustelleId,
  targetName,
  currentLang,
  companyMode,
}: {
  targetBaustelleId?: string;
  targetName?: string;
  currentLang: Language;
  companyMode: CompanyMode;
}) {
  const tx = (path: string) => t(path, currentLang, companyMode);
  const formRef = useRef<HTMLFormElement>(null);
  const [dataFilename, setDataFilename] = useState<string>();
  const [kmlFilename, setKmlFilename] = useState<string>();
  const [state, setState] = useState<ImportState>({
    kind: "idle",
    message: targetBaustelleId
      ? tx("admin.reImportActiveSite").replace("{name}", targetName ?? targetBaustelleId)
      : tx("admin.importIdleMessage"),
  });
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tx("admin.importBaustelleTitle")}</CardTitle>
        <CardDescription>
          {tx("admin.importBaustelleDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            if (targetBaustelleId) formData.set("targetBaustelleId", targetBaustelleId);
            if (targetName) formData.set("targetName", targetName);
            setState({ kind: "idle", message: tx("admin.importProcessing") });
            startTransition(async () => {
              const result = await importProjectData(formData);
              if (result.ok) {
                setState({ kind: "success", message: result.message, baustelleId: result.baustelleId });
                formRef.current?.reset();
                setDataFilename(undefined);
                setKmlFilename(undefined);
              } else {
                setState({ kind: "error", message: result.message });
              }
            });
          }}
        >
          {targetBaustelleId ? <input type="hidden" name="targetBaustelleId" value={targetBaustelleId} /> : null}
          {targetName ? <input type="hidden" name="targetName" value={targetName} /> : null}
          <input type="hidden" name="lang" value={currentLang} />
          <div className="grid gap-4 md:grid-cols-2">
            <FileDropField
              id="dataFile"
              name="dataFile"
              label="Excel / CSV"
              description={tx("admin.treeListFileDescription")}
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              icon={<FileSpreadsheet className="size-5" />}
              filename={dataFilename}
              onFileChange={setDataFilename}
              browseHint={tx("admin.fileDropBrowseHint")}
            />
            <FileDropField
              id="kmlFile"
              name="kmlFile"
              label="KML"
              description={tx("admin.kmlFileDescription")}
              accept=".kml,application/vnd.google-earth.kml+xml,application/xml,text/xml"
              icon={<MapPinned className="size-5" />}
              filename={kmlFilename}
              onFileChange={setKmlFilename}
              browseHint={tx("admin.fileDropBrowseHint")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {tx("admin.importRequirementHint")}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className={
                state.kind === "error"
                  ? "text-sm text-destructive"
                  : state.kind === "success"
                    ? "inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                    : "text-sm text-muted-foreground"
              }
              role={state.kind === "idle" ? "status" : "alert"}
            >
              {state.kind === "success" ? <CheckCircle2 className="size-4" /> : null}
              <span>{state.message}</span>
              {state.kind === "success" ? (
                <Link href={`/workzone/baustellen/${state.baustelleId}`} className="underline underline-offset-4">
                  {tx("admin.openWorkzone")}
                </Link>
              ) : null}
            </div>
            <Button type="submit" disabled={isPending}>
              <UploadCloud className="size-4" />
              {isPending ? tx("admin.importRunning") : tx("admin.importStart")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
