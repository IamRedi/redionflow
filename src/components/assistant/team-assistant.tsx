"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Send, Sparkles, Square, Trash2, X } from "lucide-react";

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

  const canSend = !isLoading && Boolean(input.trim());
  const chat = (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        className={`chat-wallpaper min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4 ${compact ? "" : "max-h-[62dvh] min-h-[50dvh] rounded-t-2xl"}`}
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-40 items-start justify-center pt-6">
            <div className="max-w-[18rem] rounded-xl bg-card/90 px-3 py-2 text-center text-[13px] leading-snug text-muted-foreground shadow-sm" title={emptyHelpText}>
              {emptyState}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 text-[14.5px] leading-snug shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${
                  m.role === "user"
                    ? "rounded-tr-sm bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]"
                    : "rounded-tl-sm bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]"
                }`}
              >
                {m.content || (isLoading ? <span className="inline-flex gap-1 py-1"><span className="size-1.5 animate-bounce rounded-full bg-current opacity-60" /><span className="size-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:120ms]" /><span className="size-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:240ms]" /></span> : null)}
              </div>
            </div>
          ))
        )}
      </div>

      <form
        className={`flex shrink-0 items-end gap-2 bg-[#f0f2f5] px-2.5 py-2 dark:bg-[#1f2c34] ${compact ? "pb-[max(0.5rem,env(safe-area-inset-bottom))]" : "rounded-b-2xl"}`}
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage();
        }}
      >
        <input
          className="h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-[15px] text-[#111b21] outline-none placeholder:text-[#667781] dark:bg-[#2a3942] dark:text-[#e9edef] dark:placeholder:text-[#8696a0]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={inputPlaceholder}
          title={speechSupported ? voiceHint : undefined}
          aria-label={inputPlaceholder}
          onDoubleClick={() => startVoiceToText()}
        />
        {isLoading ? (
          <button
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[#00a884] text-white transition active:scale-95"
            title={stopLabel}
            aria-label={stopLabel}
            onClick={() => abortRef.current?.abort()}
          >
            <Square className="size-4 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[#00a884] text-white transition active:scale-95 disabled:opacity-40"
            disabled={!canSend}
            title={sendLabel}
            aria-label={sendLabel}
          >
            <Send className="size-[18px]" />
          </button>
        )}
      </form>
    </div>
  );

  if (compact) return chat;
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-base font-semibold">{title}</div>
          <div className="truncate text-xs text-muted-foreground" title={lastAssistant ? `${lastAnswerLabel}: ${lastAssistant.slice(0, 140)}` : undefined}>{description}</div>
        </div>
        {clearLabel ? (
          <button type="button" onClick={clearChat} title={clearLabel} aria-label={clearLabel} className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground">
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-2xl border">{chat}</div>
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

/**
 * The assistant as a plain chat: full screen on phones, a fixed panel under the logo
 * on larger screens. Rendered into <body> so nothing (fleet bar, sticky header) covers it.
 */
function AssistantSheet({
  title,
  subtitle,
  companyLogo,
  onClose,
  onClear,
  clearLabel,
  closeLabel,
  anchor,
  children,
}: {
  title: string;
  subtitle: string;
  companyLogo?: string | null;
  onClose: () => void;
  onClear?: () => void;
  clearLabel?: string;
  closeLabel: string;
  anchor: { top: number; left: number } | null;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[3000] print:hidden sm:pointer-events-none">
      <div className="absolute inset-0 hidden bg-black/20 sm:pointer-events-auto sm:block" onClick={onClose} />
      <section
        role="dialog"
        aria-label={title}
        className="pointer-events-auto absolute inset-0 flex flex-col overflow-hidden bg-background sm:inset-auto sm:left-[var(--sheet-left,16px)] sm:top-[var(--sheet-top,16px)] sm:h-[min(680px,calc(100dvh-var(--sheet-top,16px)-16px))] sm:w-[400px] sm:rounded-2xl sm:border sm:shadow-2xl sm:shadow-black/40"
        style={anchor ? ({ "--sheet-top": `${anchor.top}px`, "--sheet-left": `${anchor.left}px` } as React.CSSProperties) : undefined}
      >
        <header className="flex shrink-0 items-center gap-3 bg-[#008069] px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white dark:bg-[#202c33]">
          <button type="button" onClick={onClose} title={closeLabel} aria-label={closeLabel} className="grid size-9 place-items-center rounded-full transition hover:bg-white/10 sm:hidden">
            <ArrowLeft className="size-5" />
          </button>
          <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white p-1 sm:ml-1">
            {companyLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={companyLogo} alt="" className="size-full object-contain" />
            ) : (
              <Sparkles className="size-5 text-[#008069]" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold leading-tight">{title}</div>
            <div className="truncate text-xs leading-tight text-white/75">{subtitle}</div>
          </div>
          {onClear ? (
            <button type="button" onClick={onClear} title={clearLabel} aria-label={clearLabel} className="grid size-9 place-items-center rounded-full text-white/85 transition hover:bg-white/10">
              <Trash2 className="size-[18px]" />
            </button>
          ) : null}
          <button type="button" onClick={onClose} title={closeLabel} aria-label={closeLabel} className="hidden size-9 place-items-center rounded-full text-white/85 transition hover:bg-white/10 sm:grid">
            <X className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

export function TeamAssistantLogoTrigger({
  compact = false,
  className,
  mode,
  companyLogo,
}: {
  compact?: boolean;
  className?: string;
  mode?: import("@/lib/mode-config").CompanyMode;
  companyLogo?: string | null;
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
        <AppBrand compact={compact} className={className} aiBadge mode={mode} companyLogo={companyLogo} logoAlt={t("common.companyLogoAlt", currentLang)} />
      </button>

      {open ? (
        <AssistantSheet
          title={t("admin.aiAssistantTitle", currentLang)}
          subtitle={t("admin.aiAssistantReadOnlyHint", currentLang)}
          companyLogo={companyLogo}
          onClose={() => setOpen(false)}
          onClear={clearAdminChat}
          clearLabel={t("admin.aiAssistantClear", currentLang)}
          closeLabel={t("common.close", currentLang)}
          anchor={panelPosition}
        >
          <TeamAssistantChat key={chatResetKey} compact />
        </AssistantSheet>
      ) : null}
    </>
  );
}

export function WorkerAssistantTrigger({
  compact = false,
  mode,
  companyLogo,
}: {
  compact?: boolean;
  mode?: import("@/lib/mode-config").CompanyMode;
  companyLogo?: string | null;
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
        <AppBrand compact={compact} aiBadge mode={mode} companyLogo={companyLogo} logoAlt={t("common.companyLogoAlt", currentLang)} />
      </button>

      {open ? (
        <AssistantSheet
          title={t("workzone.aiHelperButton", currentLang)}
          subtitle={t("workzone.aiHelperPanelNote", currentLang)}
          companyLogo={companyLogo}
          onClose={() => setOpen(false)}
          closeLabel={t("common.close", currentLang)}
          anchor={panelPosition}
        >
          <WorkerAssistantChat compact />
        </AssistantSheet>
      ) : null}
    </>
  );
}
