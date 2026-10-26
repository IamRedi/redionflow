"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/ui/cn";
import { formatCount } from "@/lib/workzone/date-utils";
import { saveReportNoteOffline } from "@/lib/workzone/offline/offline-actions";
import { saveReportNoteAction } from "../hr-actions";

type ChatMessage = {
  id: string;
  authorName: string;
  authorRole: "Admin" | "Worker" | "System";
  text: string;
  createdAt: string;
};

function parseMessages(note: string, lang: string): ChatMessage[] {
  if (!note.trim()) return [];
  const fallbackAuthor = t("workzone.noteFallback", lang);

  try {
    const parsed = JSON.parse(note);
    const messages = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.messages) ? parsed.messages : [];
    return (messages as unknown[])
      .filter((message: any) => typeof message?.text === "string" && message.text.trim())
      .map((message: any, index: number) => ({
        id: String(message.id ?? `message-${index}`),
        authorName: String(message.authorName ?? fallbackAuthor),
        authorRole: ["Admin", "Worker", "System"].includes(message.authorRole) ? message.authorRole : "System",
        text: String(message.text).trim(),
        createdAt: String(message.createdAt ?? ""),
      }));
  } catch {
    return [
      {
        id: "legacy-note",
        authorName: fallbackAuthor,
        authorRole: "System",
        text: note.trim(),
        createdAt: "",
      },
    ];
  }
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

export function ReportNoteForm({
  workerId,
  type,
  periodKey,
  initialNote,
  companyProfileId,
}: {
  workerId: string;
  type: "DAILY" | "MONTHLY";
  periodKey: string;
  initialNote: string;
  /** When provided, the form uses offline-aware submission (workers only). */
  companyProfileId?: string;
}) {
  const { currentLang } = useLanguage();
  const router = useRouter();
  const messages = useMemo(() => parseMessages(initialNote, currentLang), [currentLang, initialNote]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <section className="space-y-3 print:hidden">
      <div className="rounded-md border bg-muted/20 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t("workzone.communication", currentLang)}</h2>
          <span className="text-xs text-muted-foreground">
            {t("workzone.messagesCount", currentLang).replace("{count}", formatCount(messages.length, currentLang))}
          </span>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{t("workzone.noMessagesYet", currentLang)}</p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[86%] rounded-lg border px-3 py-2 text-sm shadow-sm",
                  message.authorRole === "Admin" ? "ml-auto border-brand-green/30 bg-brand-green/10" : "bg-background",
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold">{message.authorName}</span>
                  <span className="text-muted-foreground">{timeLabel(message.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            rows={2}
            placeholder={t("workzone.writeMessage", currentLang)}
            className="min-h-16 resize-none"
          />
          <Button
            type="button"
            disabled={isPending || !draft.trim()}
            className="self-end"
            onClick={() => {
              const note = draft;
              startTransition(async () => {
                const result = companyProfileId
                  ? await saveReportNoteOffline({ workerId, companyProfileId, type, periodKey, note })
                  : await saveReportNoteAction({ workerId, type, periodKey, note });
                setStatus(result.message === "offline_queued" ? t("workzone.messageOfflineQueued", currentLang) : result.message);
                if (result.ok) {
                  setDraft("");
                  if (!("queued" in result)) router.refresh();
                }
              });
            }}
          >
            <Send className="size-4" />
            {t("common.send", currentLang)}
          </Button>
        </div>
        {status ? <p className="mt-2 text-xs text-muted-foreground">{status}</p> : null}
      </div>
    </section>
  );
}
