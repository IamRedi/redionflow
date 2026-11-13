"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, LoaderCircle, MessageSquareText, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { officeCopy } from "@/lib/workshop/offices/copy";
import type { OfficeController } from "./use-office";
import s from "./office-assistant.module.css";

function placePanel(el: HTMLDivElement) {
  const viewport = window.visualViewport, width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight;
  const x = viewport?.offsetLeft ?? 0, y = viewport?.offsetTop ?? 0, w = Math.min(420, width - 24), h = Math.min(680, height - 24);
  const monitor = document.querySelector('[data-office-object="assistant"]')?.getBoundingClientRect();
  let left = x + (width - w) / 2;
  if (monitor && width >= 1000) {
    if (monitor.right + 16 + w <= x + width - 12) left = monitor.right + 16;
    else if (monitor.left - 16 - w >= x + 12) left = monitor.left - 16 - w;
  }
  const top = Math.max(y + 12, Math.min(monitor ? monitor.top - 40 : y + 80, y + height - h - 12));
  for (const [key, value] of Object.entries({ left, top, width: w, height: h })) el.style.setProperty(`--chat-${key}`, `${value}px`);
}

/** One role-scoped conversation; the existing controller owns requests and receipts. */
export function OfficeAssistantDrawer({ title, description, closeLabel, onClose, children }: { title: string; description: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null), previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const place = () => { if (panel.current) placePanel(panel.current); };
    place(); window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place); window.visualViewport?.addEventListener("scroll", place);
    return () => { window.removeEventListener("resize", place); window.visualViewport?.removeEventListener("resize", place); window.visualViewport?.removeEventListener("scroll", place); };
  }, []);
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className={s.backdrop} />
    <Dialog.Content ref={el => { panel.current = el; if (el) placePanel(el); }} data-testid="office-assistant-panel" className={s.panel} onOpenAutoFocus={() => { previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { if (previous.current?.isConnected) { event.preventDefault(); previous.current.focus(); } }}>
      <header className={s.header}><MessageSquareText size={20} strokeWidth={1.4} aria-hidden="true" /><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div><Dialog.Close className={s.close} aria-label={closeLabel}><X size={19} aria-hidden="true" /></Dialog.Close></header>
      {children}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}

export function OfficeAssistant({ controller: o, lang }: { controller: OfficeController; lang: string }) {
  const c = officeCopy(lang), [message, setMessage] = useState(""), scroll = useRef<HTMLDivElement>(null), data = o.data!;
  const last = data.turns.at(-1), error = o.error && (o.error in c ? c[o.error as keyof typeof c] : c.error);
  useEffect(() => { const el = scroll.current; if (el) el.scrollTop = el.scrollHeight; }, [last?.id, last?.status, o.pending]);
  return <div className={s.chat} data-testid="office-assistant">
    <div className={s.meta}><details><summary><span>OpenAI · {c.sources}</span><ChevronDown size={13} aria-hidden="true" /></summary><div><p>{c.aiHint}</p><p>{c.aiTransfer}</p><p>{data.asOf} · {c.tasks}, {c.inquiries}, {c.archive}{data.capabilities.staff ? `, ${c.staff}` : ""}</p></div></details><span className={s.quota} aria-label={`${c.remaining}: ${data.ai.used}/${data.ai.limit}`}>{data.ai.used}/{data.ai.limit}</span></div>
    <div ref={scroll} className={s.thread} data-testid="office-chat-thread" tabIndex={0} role="region" aria-label={c.assistant}>
      {!data.ai.enabled && <p className={s.note}>{c.aiUnavailable}</p>}
      {!data.turns.length && <div className={s.empty}><MessageSquareText size={28} strokeWidth={1.2} aria-hidden="true" /><p>{c.aiHint}</p></div>}
      {data.turns.map(t => <article key={t.id} className={s.turn}><p className={s.question} data-chat-message="user">{t.question}</p><p className={s.answer} data-chat-message="assistant">{t.status === "completed" ? t.answer : t.status === "pending" ? c.loading : c.aiFailed}</p></article>)}
      {o.pending && <p role="status" className={s.waiting}><LoaderCircle size={16} className={s.spinner} aria-hidden="true" />{c.loading}</p>}
    </div>
    {error && <div role="alert" className={s.error}><p>{error}</p><button type="button" disabled={o.pending} onClick={() => void o.refresh()}>{c.retry}</button></div>}
    <form className={s.compose} onSubmit={e => { e.preventDefault(); if (!message.trim() || o.pending) return; void o.ask(message, lang).then(() => setMessage("")).catch(() => {}); }}>
      <label className={s.input}><span className="sr-only">{c.question}</span><textarea required maxLength={2000} rows={2} disabled={o.pending} value={message} onChange={e => setMessage(e.target.value)} placeholder={c.question} /></label>
      <button type="submit" className={s.send} aria-label={c.send} disabled={o.pending || !data.ai.enabled || data.ai.used >= data.ai.limit || !message.trim()}>{o.pending ? <LoaderCircle size={19} className={s.spinner} aria-hidden="true" /> : <Send size={19} aria-hidden="true" />}</button>
    </form>
  </div>;
}
