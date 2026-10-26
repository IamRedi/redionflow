"use client";
import { parseManagedReference } from "@/lib/storage/managed-reference";

import { DragEvent, useMemo, useRef, useState, useTransition } from "react";
import { FileText, Printer, Send, UploadCloud, X } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/ui/cn";
import { deleteBaustelleDocumentAction } from "../../actions";
import { uploadBaustelleDocumentOffline } from "@/lib/workzone/offline/offline-actions";

type BaustelleDocumentationModalProps = {
  baustelleId: string;
  baustelleName: string;
  documents: string[];
  actorId: string;
  actorKind: "WORKER" | "ADMIN";
  companyProfileId: string;
};

type ParsedDocument = {
  id: string;
  label: string;
  url: string | null;
};

function parseDocument(ref: string): ParsedDocument {
  const trimmed = ref.trim();
  const normalized = trimmed.replace(/\\/g, "/");
  const last = parseManagedReference(trimmed)?.fileName ?? (normalized.split("/").pop() || trimmed);
  const cleanName = last.replace(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}-/i, "").replace(/^\d+-/, "");
  const isHttp = /^https?:\/\//i.test(normalized);
  const isUploadPath = normalized.startsWith("/");
  return {
    id: ref,
    label: decodeURIComponent(cleanName),
    url: isHttp || isUploadPath ? normalized : null,
  };
}

export function BaustelleDocumentationModal({
  baustelleId,
  baustelleName,
  documents,
  actorId,
  actorKind,
  companyProfileId,
}: BaustelleDocumentationModalProps) {
  const { currentLang } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const parsedDocuments = useMemo(() => documents.map(parseDocument), [documents]);

  function printDocument(url: string) {
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) return;
    popup.addEventListener("load", () => {
      popup.print();
    });
  }

  async function sendDocument(url: string, label: string) {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${baustelleName} - ${label}`,
          text: t("workzone.documentShareText", currentLang).replace("{site}", baustelleName).replace("{label}", label),
          url,
        });
        setMessage(t("workzone.shareDocumentSuccess", currentLang));
        return;
      }
    } catch {
      setMessage(t("workzone.shareDocumentCancelled", currentLang));
      return;
    }

    const subject = encodeURIComponent(t("workzone.documentShareSubject", currentLang).replace("{site}", baustelleName).replace("{label}", label));
    const body = encodeURIComponent(t("workzone.documentShareBody", currentLang).replace("{url}", url));
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank", "noopener,noreferrer");
    setMessage(t("workzone.shareMailOpened", currentLang));
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    upload(file);
  }

  function upload(file: File) {
    startTransition(async () => {
      const result = await uploadBaustelleDocumentOffline({
        baustelleId,
        workerId: actorId,
        actorKind,
        companyProfileId,
        file,
      });
      setMessage(result.queued ? t("workzone.offlineQueued", currentLang) : result.message);
    });
  }

  function removeDocument(documentRef: string) {
    const formData = new FormData();
    formData.set("baustelleId", baustelleId);
    formData.set("documentRef", documentRef);
    startTransition(async () => {
      const result = await deleteBaustelleDocumentAction(formData);
      setMessage(result.message);
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <FileText className="mr-2 h-4 w-4" />
        {t("workzone.documentation", currentLang)}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-xl border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{t("workzone.documentation", currentLang)}</div>
                <div className="text-xs text-muted-foreground">{baustelleName}</div>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 px-4 py-4">
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
                  "flex cursor-pointer items-center justify-center gap-3 rounded-md border border-dashed px-3 py-4 transition hover:bg-muted/30",
                  dragging ? "border-brand-green bg-brand-green/10" : "border-border",
                  isPending ? "pointer-events-none opacity-70" : "",
                )}
              >
                <UploadCloud className="h-5 w-5 text-brand-green" />
                <div className="text-sm">
                  <span className="font-medium">{isPending ? t("workzone.uploadPending", currentLang) : t("workzone.addDocument", currentLang)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{t("workzone.allowedDocumentTypes", currentLang)}</span>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) upload(file);
                  event.currentTarget.value = "";
                }}
              />

              <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                {parsedDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("workzone.noSiteDocuments", currentLang)}</p>
                ) : (
                  parsedDocuments.map((document) => (
                    <div key={document.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-brand-green" />
                      <span className="min-w-0 flex-1 truncate" title={document.label}>
                        {document.label}
                      </span>
                      {(() => {
                        const docUrl = document.url;
                        const hasFile = Boolean(docUrl);
                        const disabledTitle = hasFile ? undefined : t("workzone.missingFileReupload", currentLang);
                        return (
                          <>
                            {hasFile ? (
                              <a href={docUrl!} target="_blank" rel="noreferrer">
                                <Button type="button" size="sm" variant="outline">
                                  {t("common.open", currentLang)}
                                </Button>
                              </a>
                            ) : (
                              <Button type="button" size="sm" variant="outline" disabled title={disabledTitle}>
                                {t("common.open", currentLang)}
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!hasFile}
                              title={disabledTitle}
                              onClick={hasFile ? () => printDocument(docUrl!) : undefined}
                            >
                              <Printer className="h-4 w-4" />
                              <span className="ml-1">{t("common.print", currentLang)}</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!hasFile}
                              title={disabledTitle}
                              onClick={hasFile ? () => void sendDocument(docUrl!, document.label) : undefined}
                            >
                              <Send className="h-4 w-4" />
                              <span className="ml-1">{t("common.send", currentLang)}</span>
                            </Button>
                            {!hasFile ? <span className="text-xs text-muted-foreground">{t("workzone.nameOnly", currentLang)}</span> : null}
                          </>
                        );
                      })()}
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => removeDocument(document.id)}
                        disabled={isPending}
                      >
                        {t("common.remove", currentLang)}
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
