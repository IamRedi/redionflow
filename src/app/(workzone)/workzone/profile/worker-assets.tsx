"use client";

import { DragEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileImage, FileSpreadsheet, FileText, FolderOpen, type LucideIcon, Plus, UploadCloud, X } from "lucide-react";

import { SimpleDialog } from "@/components/ui/simple-dialog";
import { AssetWorkspaceDialog } from "@/components/company-assets/workspace-dialog";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { cn } from "@/lib/ui/cn";
import { deleteWorkerDocumentAction, uploadWorkerAssetAction } from "../hr-actions";

type WorkerDocument = {
  id: string;
  label: string;
  type: string;
  url: string;
  filename: string;
  uploadedAt: string;
};

function documentLabel(type: string, currentLang: Language) {
  if (type === "contract") return t("workzone.documentContract", currentLang);
  if (type === "certificate") return t("workzone.documentCertificate", currentLang);
  if (type === "school") return t("workzone.documentTraining", currentLang);
  if (type === "license") return t("workzone.documentLicense", currentLang);
  return t("workzone.documentFallback", currentLang);
}

function fileBaseName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || name;
}

function fileKind(document: WorkerDocument): { Icon: LucideIcon; ext: string; tone: string } {
  const name = (document.filename || document.label || "").toLowerCase();
  const ext = (name.match(/\.([a-z0-9]{2,4})$/)?.[1] ?? (document.url.match(/\.([a-z0-9]{2,4})(?:$|[?#])/i)?.[1] ?? "")).toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "heic", "gif"].includes(ext)) return { Icon: FileImage, ext: ext || "img", tone: "bg-sky-500/12 text-sky-600 dark:text-sky-300" };
  if (["xls", "xlsx", "csv"].includes(ext)) return { Icon: FileSpreadsheet, ext, tone: "bg-green-500/12 text-green-600 dark:text-green-300" };
  if (["doc", "docx"].includes(ext)) return { Icon: FileText, ext, tone: "bg-blue-500/12 text-blue-600 dark:text-blue-300" };
  return { Icon: FileText, ext: ext || "pdf", tone: "bg-red-500/12 text-red-600 dark:text-red-300" };
}

function shortDate(value: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function UploadMessage({ message }: { message?: string }) {
  return message ? <p className="text-xs text-muted-foreground">{message}</p> : null;
}

export function WorkerAssets({
  workerId,
  documents,
  currentLang,
}: {
  workerId: string;
  documents: WorkerDocument[];
  currentLang: Language;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [documentToDelete, setDocumentToDelete] = useState<WorkerDocument | null>(null);

  function uploadFiles(files: FileList | File[]) {
    const file = Array.from(files)[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("workerId", workerId);
    formData.set("kind", "document");
    formData.set("label", fileBaseName(file.name));
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadWorkerAssetAction(formData);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    uploadFiles(event.dataTransfer.files);
  }

  function deleteDocument(document: WorkerDocument) {

    const formData = new FormData();
    formData.set("workerId", workerId);
    formData.set("documentId", document.id);
    startTransition(async () => {
      const result = await deleteWorkerDocumentAction(formData);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="worker-documents-open"
      >
        <FolderOpen className="size-4 text-primary" strokeWidth={1.8} />
        {t("workzone.documentsTitle", currentLang)}
        {documents.length ? <span className="text-muted-foreground tabular-nums">{documents.length}</span> : null}
      </button>
      <AssetWorkspaceDialog open={open} onOpenChange={setOpen} title={t("workzone.documentsTitle", currentLang)} compact scrollBody layer={1000} returnFocusRef={triggerRef}>
      <div className="space-y-3" data-testid="worker-documents">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,image/*"
        className="hidden"
        onChange={(event) => {
          if (event.currentTarget.files) uploadFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      {/* Documents as small tiles: an icon and a short name. Type and date show on hover. */}
      <div className="flex flex-wrap gap-2.5">
        {documents.map((document) => {
          const kind = fileKind(document);
          return (
            <div key={document.id} className="group relative w-[88px]">
              <a
                href={document.url}
                target="_blank"
                rel="noreferrer"
                title={[document.label, documentLabel(document.type, currentLang), shortDate(document.uploadedAt)].filter(Boolean).join(" · ")}
                className="flex flex-col items-center gap-1.5 rounded-2xl border bg-card p-2.5 text-center transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <span className={cn("relative grid h-12 w-10 place-items-center rounded-lg", kind.tone)}>
                  <kind.Icon className="size-5" strokeWidth={1.8} />
                  <span className="absolute -bottom-1 rounded bg-background px-1 font-mono text-[8px] font-bold uppercase leading-3 text-foreground/70 ring-1 ring-border">
                    {kind.ext}
                  </span>
                </span>
                <span className="line-clamp-2 w-full break-words text-[11px] font-medium leading-tight">{document.label}</span>
                <span className="pointer-events-none absolute inset-x-1 -bottom-1 translate-y-full rounded-md bg-foreground px-1.5 py-1 text-[10px] leading-tight text-background opacity-0 shadow-lg transition group-hover:opacity-100">
                  {documentLabel(document.type, currentLang)}
                  {shortDate(document.uploadedAt) ? ` · ${shortDate(document.uploadedAt)}` : ""}
                </span>
              </a>
              <button
                type="button"
                title={t("workzone.deleteDocument", currentLang)}
                aria-label={t("workzone.deleteDocument", currentLang)}
                disabled={isPending}
                onClick={() => setDocumentToDelete(document)}
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-sm transition hover:text-destructive group-hover:opacity-100 focus:opacity-100 disabled:opacity-40 max-md:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}

        <div
          role="button"
          tabIndex={0}
          title={t("workzone.documentUploadTypes", currentLang)}
          aria-label={t("workzone.clickDrag", currentLang)}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") fileRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex w-[88px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed p-2.5 text-center transition hover:border-primary/50 hover:bg-primary/5",
            documents.length === 0 ? "min-h-[104px]" : "",
            dragging ? "border-primary bg-primary/10" : "border-border",
            isPending ? "pointer-events-none opacity-70" : "",
          )}
        >
          <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
            {isPending ? <UploadCloud className="size-5 animate-pulse" /> : <Plus className="size-5" />}
          </span>
          <span className="text-[11px] font-medium leading-tight text-muted-foreground">{isPending ? t("workzone.uploading", currentLang) : t("workzone.addDocumentShort", currentLang)}</span>
        </div>
      </div>
      <UploadMessage message={message} />
      <SimpleDialog
        open={Boolean(documentToDelete)}
        title={t("common.confirm", currentLang)}
        description={documentToDelete ? t("workzone.confirmDeleteProfileDocument", currentLang).replace("{label}", documentToDelete.label) : null}
        confirmLabel={t("common.delete", currentLang)}
        cancelLabel={t("common.cancel", currentLang)}
        confirmVariant="destructive"
        onCancel={() => setDocumentToDelete(null)}
        onConfirm={() => {
          if (!documentToDelete) return;
          void deleteDocument(documentToDelete);
          setDocumentToDelete(null);
        }}
      />
      </div>
      </AssetWorkspaceDialog>
    </>
  );
}
