"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Send, Sparkles, Trash2 } from "lucide-react";

import { AppBrand } from "@/components/branding/AppBrand";
import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/lib/i18n";

const ADMIN_ASSISTANT_STORAGE_KEY = "team-assistant:chat-state";
const ADMIN_ASSISTANT_PANEL_STORAGE_KEY = "team-assistant:panel-state";
const WORKER_ASSISTANT_PANEL_STORAGE_KEY = "worker-assistant:panel-state";

function canUseSpeech() {
  return typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
}

const subscribeNever = () => () => {};

// Minimal Web Speech API surface; the DOM lib does not ship these types.
type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0?: { transcript: string } }>;
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  start: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

function readAssistantChatState(storageKey: string) {
  if (typeof window === "undefined") return { messages: [] as ChatMessage[], input: "" };
  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) return { messages: [] as ChatMessage[], input: "" };
  try {
    const saved = JSON.parse(raw) as { messages?: ChatMessage[]; input?: string };
    return {
      messages: Array.isArray(saved.messages) ? saved.messages : [],
      input: typeof saved.input === "string" ? saved.input : "",
    };
  } catch {
    return { messages: [] as ChatMessage[], input: "" };
  }
}

function readAssistantPanelState(storageKey: string) {
  if (typeof window === "undefined") return { open: false, panelPosition: null as { top: number; left: number } | null };
  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) return { open: false, panelPosition: null as { top: number; left: number } | null };
  try {
    const saved = JSON.parse(raw) as { open?: boolean; top?: number; left?: number };
    return {
      open: Boolean(saved.open),
      panelPosition:
        typeof saved.top === "number" && typeof saved.left === "number"
          ? { top: saved.top, left: saved.left }
          : null,
    };
  } catch {
    return { open: false, panelPosition: null as { top: number; left: number } | null };
  }
}

type AssistantChatProps = {
  compact?: boolean;
  endpoint: string;
  title: string;
  description: string;
  emptyState: string;
  noAccessMessage: string;
  errorMessage: string;
  inputPlaceholder: string;
  emptyHelpText: string;
  storageKey?: string;
  clearLabel?: string;
  sendLabel?: string;
  stopLabel?: string;
  lastAnswerLabel?: string;
  voiceHint?: string;
  speechLang?: string;
};

function AssistantChat({
  compact = false,
  endpoint,
  title,
  description,
  emptyState,
  noAccessMessage,
  errorMessage,
  inputPlaceholder,
  emptyHelpText,
  storageKey,
  clearLabel,
  sendLabel = "Senden",
  stopLabel = "Stop",
  lastAnswerLabel = "Letzte Antwort",
  voiceHint = "Double-click = voice",
  speechLang = "de-DE",
}: AssistantChatProps) {
  // false on the server, the real capability after hydration.
  const speechSupported = useSyncExternalStore(subscribeNever, canUseSpeech, () => false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [storageReady, setStorageReady] = useState(!storageKey);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    const saved = readAssistantChatState(storageKey);
    // Restoring from localStorage has to wait until after hydration, so this
    // one-time sync from an external store stays in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(saved.messages);
    setInput(saved.input);
    setStorageReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    if (!storageReady) return;
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        messages,
        input,
      }),
    );
  }, [messages, input, storageKey, storageReady]);

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    if (storageKey && typeof window !== "undefined") {
      window.sessionStorage.removeItem(storageKey);
    }
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const lastAssistant = useMemo(() => {
    const m = [...messages].reverse().find((x) => x.role === "assistant");
    return m?.content ?? "";
  }, [messages]);

  function startVoiceToText() {
    if (!speechSupported) return;
    const speechWindow = window as WindowWithSpeech;
    const Ctor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = speechLang;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = "";
    rec.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const t = res?.[0]?.transcript ?? "";
        if (res.isFinal) finalText += t;
        else text += t;
      }
      setInput(`${finalText}${text}`.trimStart());
    };
    rec.start();
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    try {
      const payload = {
        messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
      };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(
          res.status === 403 ? noAccessMessage : errorMessage,
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: full } : m)));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : errorMessage;
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: message } : m)),
      );
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }

  return (
    <div className={compact ? "flex h-full min-h-0 flex-col gap-3" : "mx-auto max-w-3xl space-y-4"}>
      {!compact ? (
        <div className="rounded-md border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{description}</div>
            </div>
            {clearLabel ? (
              <button
                type="button"
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={clearChat}
              >
                {clearLabel}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-background via-background to-muted/30 shadow-inner">
        <div
          ref={scrollRef}
          className={compact ? "min-h-0 flex-1 space-y-3 overflow-y-auto p-4" : "max-h-[62dvh] space-y-3 overflow-y-auto p-4"}
        >
          {messages.length === 0 ? (
            <div className="flex h-full min-h-40 items-center justify-center">
              <div className="grid justify-items-center gap-2 text-center">
                <span className="inline-flex size-10 items-center justify-center rounded-full border border-brand-green/25 bg-brand-green/10 text-brand-green shadow-sm">
                  <Sparkles className="size-4" />
                </span>
                <div className="text-sm font-medium text-foreground/80">{emptyState}</div>
                <div className="max-w-64 text-xs leading-relaxed text-muted-foreground">
                  {emptyHelpText}
                </div>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                    m.role === "user"
                      ? "rounded-br-md bg-brand-green text-white shadow-brand-green/10"
                      : "rounded-bl-md border border-border/70 bg-card/95 text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
        </div>

        <form
          className="flex items-center gap-2 border-t border-border/70 bg-card/80 p-3 backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
        >
          <button
            type="button"
            className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-transparent shadow-sm transition before:absolute before:size-3.5 before:rounded-[2px] before:bg-muted-foreground before:content-[''] hover:border-red-400/40 hover:bg-red-500/10 hover:before:bg-red-600 disabled:opacity-40"
            title={stopLabel}
            onClick={() => abortRef.current?.abort()}
            disabled={!isLoading}
            aria-label={stopLabel}
          >
            ■
          </button>

          <input
            className="h-11 min-w-0 flex-1 rounded-full border border-border/80 bg-background px-4 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground/80 focus:border-brand-green/50 focus:ring-2 focus:ring-brand-green/15"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={speechSupported ? `${inputPlaceholder} (${voiceHint})` : inputPlaceholder}
            onDoubleClick={() => startVoiceToText()}
          />

          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-brand-green px-4 text-sm font-semibold text-white shadow-sm shadow-brand-green/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
            disabled={isLoading || !input.trim()}
          >
            <Send className="size-4" />
            {sendLabel}
          </button>
        </form>
      </div>

      {!compact && lastAssistant ? (
        <div className="text-xs text-muted-foreground">
          {lastAnswerLabel}: {lastAssistant.slice(0, 140)}
          {lastAssistant.length > 140 ? "..." : ""}
        </div>
      ) : null}
    </div>
  );
}

export function TeamAssistantChat({ compact = false }: { compact?: boolean }) {
  const { currentLang } = useLanguage();
  return (
    <AssistantChat
      compact={compact}
      endpoint="/api/assistant"
      title={t("admin.aiAssistantTitle", currentLang)}
      description={t("admin.aiAssistantDescription", currentLang)}
      emptyState={t("admin.aiAssistantEmpty", currentLang)}
      emptyHelpText={t("admin.aiAssistantEmptyHelp", currentLang)}
      noAccessMessage={t("admin.aiAssistantNoAccess", currentLang)}
      errorMessage={t("admin.aiAssistantError", currentLang)}
      inputPlaceholder={t("admin.aiAssistantPrompt", currentLang)}
      storageKey={ADMIN_ASSISTANT_STORAGE_KEY}
      clearLabel={t("admin.aiAssistantClear", currentLang)}
      sendLabel={t("common.send", currentLang)}
      stopLabel={t("common.stop", currentLang)}
      lastAnswerLabel={t("workzone.aiHelperLastAnswer", currentLang)}
      voiceHint={t("admin.aiAssistantVoiceHint", currentLang)}
      speechLang={currentLang === "en" ? "en-US" : currentLang === "it" ? "it-IT" : currentLang === "sq" ? "sq-AL" : "de-DE"}
    />
  );
}

export function WorkerAssistantChat({ compact = false }: { compact?: boolean }) {
  const { currentLang } = useLanguage();
  return (
    <AssistantChat
      compact={compact}
      endpoint="/api/assistant/worker"
      title={t("workzone.aiHelperButton", currentLang)}
      description={t("workzone.aiHelperDescription", currentLang)}
      emptyState={t("workzone.aiHelperEmpty", currentLang)}
      emptyHelpText={t("workzone.aiHelperEmptyHelp", currentLang)}
      noAccessMessage={t("workzone.aiHelperNoAccess", currentLang)}
      errorMessage={t("workzone.aiHelperError", currentLang)}
      inputPlaceholder={t("workzone.aiHelperPrompt", currentLang)}
      clearLabel={t("workzone.clear", currentLang)}
      sendLabel={t("common.send", currentLang)}
      stopLabel={t("workzone.stopWork", currentLang)}
      lastAnswerLabel={t("workzone.aiHelperLastAnswer", currentLang)}
      voiceHint={t("admin.aiAssistantVoiceHint", currentLang)}
      speechLang={currentLang === "en" ? "en-US" : currentLang === "it" ? "it-IT" : currentLang === "sq" ? "sq-AL" : "de-DE"}
    />
  );
}

export function TeamAssistantLogoTrigger({
  compact = false,
  className,
  mode,
}: {
  compact?: boolean;
  className?: string;
  mode?: import("@/lib/mode-config").CompanyMode;
}) {
  const { currentLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [chatResetKey, setChatResetKey] = useState(0);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number } | null>(null);
  const [panelStorageReady, setPanelStorageReady] = useState(false);

  useEffect(() => {
    const saved = readAssistantPanelState(ADMIN_ASSISTANT_PANEL_STORAGE_KEY);
    queueMicrotask(() => {
      setPanelPosition(saved.panelPosition);
      setOpen(saved.open);
      setPanelStorageReady(true);
    });
  }, []);

  useEffect(() => {
    if (!panelStorageReady) return;
    if (typeof window === "undefined") return;
    if (!open) {
      window.sessionStorage.setItem(ADMIN_ASSISTANT_PANEL_STORAGE_KEY, JSON.stringify({ open: false }));
      return;
    }
    window.sessionStorage.setItem(
      ADMIN_ASSISTANT_PANEL_STORAGE_KEY,
      JSON.stringify({
        open: true,
        top: panelPosition?.top ?? 16,
        left: panelPosition?.left ?? 16,
      }),
    );
  }, [open, panelPosition, panelStorageReady]);

  function togglePanel() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    const panelWidth = Math.min(440, window.innerWidth - 32);
    const top = rect ? Math.max(16, Math.min(rect.bottom + 10, window.innerHeight - 240)) : 16;
    const left = rect ? Math.max(16, Math.min(rect.left, window.innerWidth - panelWidth - 16)) : 16;
    setPanelPosition({ top, left });
    setOpen(true);
  }

  function clearAdminChat() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(ADMIN_ASSISTANT_STORAGE_KEY);
    }
    setChatResetKey((key) => key + 1);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="rounded-full text-left outline-none ring-offset-background transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        title={t("admin.aiAssistantOpen", currentLang)}
        aria-label={t("admin.aiAssistantOpen", currentLang)}
        onClick={togglePanel}
      >
        <AppBrand compact={compact} className={className} aiBadge mode={mode} logoAlt={t("common.companyLogoAlt", currentLang)} />
      </button>

      {open ? (
        <div className="pointer-events-none fixed inset-0 z-[2500] print:hidden">
          <div
            className="pointer-events-auto fixed flex w-[min(460px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl shadow-black/30"
            style={{
              top: panelPosition?.top ?? 16,
              left: panelPosition?.left ?? 16,
              maxHeight: `calc(100dvh - ${(panelPosition?.top ?? 16) + 16}px)`,
              height: "min(720px, calc(100dvh - 2rem))",
            }}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-gradient-to-r from-brand-green/12 via-background to-background px-4 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-brand-green/25 bg-brand-green/10 text-brand-green">
                    <Sparkles className="size-4" />
                  </span>
                  <span>{t("admin.aiAssistantTitle", currentLang)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{t("admin.aiAssistantReadOnlyHint", currentLang)}</div>
              </div>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-600"
                onClick={clearAdminChat}
              >
                <Trash2 className="size-3.5" />
                {t("admin.aiAssistantClear", currentLang)}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-muted/20 p-3">
              <TeamAssistantChat key={chatResetKey} compact />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function WorkerAssistantTrigger({
  compact = false,
  mode,
}: {
  compact?: boolean;
  mode?: import("@/lib/mode-config").CompanyMode;
}) {
  const { currentLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number } | null>(null);
  const [panelStorageReady, setPanelStorageReady] = useState(false);

  useEffect(() => {
    const saved = readAssistantPanelState(WORKER_ASSISTANT_PANEL_STORAGE_KEY);
    queueMicrotask(() => {
      setPanelPosition(saved.panelPosition);
      setOpen(saved.open);
      setPanelStorageReady(true);
    });
  }, []);

  useEffect(() => {
    if (!panelStorageReady) return;
    if (typeof window === "undefined") return;
    if (!open) {
      window.sessionStorage.setItem(WORKER_ASSISTANT_PANEL_STORAGE_KEY, JSON.stringify({ open: false }));
      return;
    }
    window.sessionStorage.setItem(
      WORKER_ASSISTANT_PANEL_STORAGE_KEY,
      JSON.stringify({
        open: true,
        top: panelPosition?.top ?? 16,
        left: panelPosition?.left ?? 16,
      }),
    );
  }, [open, panelPosition, panelStorageReady]);

  function togglePanel() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    const panelWidth = Math.min(420, window.innerWidth - 32);
    const top = rect ? Math.max(16, Math.min(rect.bottom + 10, window.innerHeight - 240)) : 16;
    const left = rect ? Math.max(16, Math.min(rect.left, window.innerWidth - panelWidth - 16)) : 16;
    setPanelPosition({ top, left });
    setOpen(true);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="rounded-full border bg-background/80 p-1 text-left shadow-sm transition hover:bg-muted"
        title={t("workzone.aiHelperButton", currentLang)}
        aria-label={t("workzone.aiHelperButton", currentLang)}
        onClick={togglePanel}
      >
        <AppBrand compact={compact} aiBadge mode={mode} logoAlt={t("common.companyLogoAlt", currentLang)} />
      </button>

      {open ? (
        <div className="pointer-events-none fixed inset-0 z-[2500] print:hidden">
          <div
            className="pointer-events-auto fixed flex w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl shadow-black/30"
            style={{
              top: panelPosition?.top ?? 16,
              left: panelPosition?.left ?? 16,
              maxHeight: `calc(100dvh - ${(panelPosition?.top ?? 16) + 16}px)`,
              height: "min(680px, calc(100dvh - 2rem))",
            }}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-gradient-to-r from-brand-green/12 via-background to-background px-4 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-brand-green/25 bg-brand-green/10 text-brand-green">
                    <Sparkles className="size-4" />
                  </span>
                  <span>{t("workzone.aiHelperButton", currentLang)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{t("workzone.aiHelperPanelNote", currentLang)}</div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-muted/20 p-3">
              <WorkerAssistantChat compact />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
