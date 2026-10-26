"use client";

import { DragEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, Trash2, UploadCloud } from "lucide-react";

import { SimpleDialog } from "@/components/ui/simple-dialog";
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

function UploadMessage({ message }: { message?: string }) {
  return message ? <p className="text-xs text-muted-foreground">{message}</p> : null;
}

export function WorkerPhotoButton({ workerId, currentLang }: { workerId: string; currentLang: Language }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function upload(file: File | undefined) {
    if (!file) return;
    const formData = new FormData();
    formData.set("workerId", workerId);
    formData.set("kind", "photo");
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadWorkerAssetAction(formData);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => upload(event.currentTarget.files?.[0])} />
      <button
        type="button"
        title={message ?? t("workzone.uploadProfilePhoto", currentLang)}
        disabled={isPending}
        onClick={() => fileRef.current?.click()}
        className="absolute bottom-1 right-1 flex size-8 items-center justify-center rounded-full border border-background bg-brand-green text-white shadow-sm hover:brightness-110 disabled:opacity-60"
      >
        <Camera className="size-4" />
      </button>
    </>
  );
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
    <div className="space-y-3">
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
      <div className="grid gap-3 md:grid-cols-[1fr_8.5rem] md:items-start">
        <div className="flex min-h-24 flex-wrap content-start gap-2">
          {documents.length === 0 ? <p className="text-sm text-muted-foreground">{t("workzone.noDocumentsYet", currentLang)}</p> : null}
          {documents.map((document) => (
            <div key={document.id} className="group flex max-w-full items-center gap-1 rounded-md border bg-background px-2 py-1.5 text-sm shadow-sm">
              <a href={document.url} target="_blank" rel="noreferrer" title={document.label} className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-brand-green" />
                <span className="max-w-36 truncate font-medium">{document.label}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">{documentLabel(document.type, currentLang)}</span>
              </a>
              <button
                type="button"
                title={t("workzone.deleteDocument", currentLang)}
                disabled={isPending}
                onClick={() => setDocumentToDelete(document)}
                className="ml-1 rounded p-1 text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-40"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-2 text-center transition hover:bg-muted/40",
            dragging ? "border-brand-green bg-brand-green/10" : "border-border",
            isPending ? "pointer-events-none opacity-70" : "",
          )}
        >
          <UploadCloud className="mb-1 size-5 text-brand-green" />
          <div className="text-xs font-semibold">{isPending ? t("workzone.uploading", currentLang) : t("workzone.clickDrag", currentLang)}</div>
          <div className="mt-1 text-[11px] leading-tight text-muted-foreground">{t("workzone.documentUploadTypes", currentLang)}</div>
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
  );
}
