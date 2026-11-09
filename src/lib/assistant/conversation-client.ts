'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { assistantHistory } from './limits';

export type ClientChatMessage = { id: string; role: 'user' | 'assistant'; content: string; status?: string; redacted?: boolean; truncated?: boolean };
export type ConversationSummary = { id: string; title: string; updatedAt: string; status?: string };
export type ConversationRun = { id: string; clientMessageId: string | null; question: string; answer: string; status: string; createdAt: string; redacted?: boolean; truncated?: boolean; questionRedacted?: boolean; answerRedacted?: boolean; questionTruncated?: boolean; answerTruncated?: boolean };
export type ConversationPage = { conversation: { id: string; title: string }; runs: ConversationRun[]; nextCursor: string | null };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const identifier = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9_-]{1,120}$/i.test(v);
function bounded(v: unknown, max: number) { return typeof v === 'string' && v.length <= max; }
const cursorOf = (v: unknown) => v == null ? null : typeof v === 'string' && /^[a-z0-9_-]{1,300}$/i.test(v) ? v : (() => { throw new Error('Invalid archive cursor'); })();

export function conversationList(value: unknown) {
  if (!object(value) || !Array.isArray(value.conversations) || value.conversations.length > 10) throw new Error('Invalid conversation list');
  const conversations = value.conversations.map(row => {
    if (!object(row) || !identifier(row.id) || !bounded(row.title, 500) || !bounded(row.updatedAt, 50)) throw new Error('Invalid conversation summary');
    return { id: row.id, title: row.title as string, updatedAt: row.updatedAt as string, ...(typeof row.status === 'string' ? { status: row.status.slice(0, 40) } : {}) };
  });
  return { conversations, nextCursor: cursorOf(value.nextCursor) };
}
export function conversationPage(value: unknown): ConversationPage {
  if (!object(value) || !object(value.conversation) || !identifier(value.conversation.id) || !bounded(value.conversation.title, 500) || !Array.isArray(value.runs) || value.runs.length > 50) throw new Error('Invalid conversation page');
  const runs = value.runs.map(row => {
    if (!object(row) || !identifier(row.id) || row.clientMessageId != null && !identifier(row.clientMessageId) || !bounded(row.question, 4_000) || !bounded(row.answer, 131_072) || !bounded(row.status, 40) || !bounded(row.createdAt, 50)) throw new Error('Invalid stored run');
    return { ...row, clientMessageId: typeof row.clientMessageId === 'string' ? row.clientMessageId : null } as unknown as ConversationRun;
  });
  return { conversation: { id: value.conversation.id, title: value.conversation.title as string }, runs, nextCursor: cursorOf(value.nextCursor) };
}
export function archiveMessages(runs: ConversationRun[], emptyAnswer: string, pendingAnswer = emptyAnswer): ClientChatMessage[] {
  return runs.flatMap(run => [{ id: `${run.id}:question`, role: 'user' as const, content: run.question, ...(run.questionRedacted ? { redacted: true } : {}), ...(run.questionTruncated ? { truncated: true } : {}) },
    { id: `${run.id}:answer`, role: 'assistant' as const, content: run.answer || (['running', 'pending', 'queued', 'streaming'].includes(run.status.toLowerCase()) ? pendingAnswer : emptyAnswer), status: run.status,
      ...(run.redacted || run.answerRedacted ? { redacted: true } : {}), ...(run.truncated || run.answerTruncated ? { truncated: true } : {}) }]);
}
export function withPartialAnswer(partial: string, fallback: string) {
  if (!partial.trim()) return fallback;
  return partial.includes(fallback) ? partial : `${partial}\n\n${fallback}`;
}
export function canonicalAnswer(partial: string, answer: string, status: string, fallback: string, redacted = false) {
  if (redacted || ['complete', 'completed', 'success', 'succeeded'].includes(status.toLowerCase()) || !partial.trim()) return answer || fallback;
  if (answer && answer.includes(partial)) return answer;
  return withPartialAnswer(partial, answer || fallback);
}
export function mergeConversations(existing: ConversationSummary[], incoming: ConversationSummary[]) {
  const merged = new Map(existing.map(c => [c.id, c]));
  for (const item of incoming) merged.set(item.id, item);
  return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

const text = {
  en: { history: 'Conversations', newChat: 'New chat', more: 'More conversations', older: 'Older messages', newer: 'Newer messages', latest: 'Latest messages', retry: 'Retry', loading: 'Loading history…', historyError: 'History could not be loaded. Retry before sending.', unconfirmed: 'I could not confirm this answer in the saved history. Refresh the conversation.', cancelled: 'Stopped. Any received text is kept.', failed: 'The answer could not be completed.', pending: 'Still processing or saving.', interrupted: 'Incomplete answer', archive: 'Saved history', latestHint: 'Return to the latest messages to continue.', refresh: 'Refresh history', remove: 'Delete conversation', removeAsk: 'Delete this conversation for good?', removeFailed: 'The conversation could not be deleted.' },
  sq: { history: 'Bisedat', newChat: 'Bisedë e re', more: 'Biseda të tjera', older: 'Mesazhe më të vjetra', newer: 'Mesazhe më të reja', latest: 'Mesazhet e fundit', retry: 'Provo sërish', loading: 'Po ngarkohet historiku…', historyError: 'Historiku nuk u ngarkua. Provo sërish para dërgimit.', unconfirmed: 'Nuk arrita ta konfirmoj përgjigjen në historikun e ruajtur. Rifresko bisedën.', cancelled: 'U ndal. Teksti i marrë ruhet në pamje.', failed: 'Përgjigjja nuk u përfundua.', pending: 'Ende po përpunohet ose ruhet.', interrupted: 'Përgjigje e paplotë', archive: 'Historiku i ruajtur', latestHint: 'Kthehu te mesazhet e fundit për të vazhduar.', refresh: 'Rifresko historikun', remove: 'Fshi bisedën', removeAsk: 'Ta fshij përfundimisht këtë bisedë?', removeFailed: 'Biseda nuk u fshi.' },
  de: { history: 'Gespräche', newChat: 'Neuer Chat', more: 'Weitere Gespräche', older: 'Ältere Nachrichten', newer: 'Neuere Nachrichten', latest: 'Neueste Nachrichten', retry: 'Erneut versuchen', loading: 'Verlauf wird geladen…', historyError: 'Verlauf konnte nicht geladen werden. Vor dem Senden erneut versuchen.', unconfirmed: 'Die Antwort konnte im gespeicherten Verlauf nicht bestätigt werden. Gespräch aktualisieren.', cancelled: 'Gestoppt. Empfangener Text bleibt sichtbar.', failed: 'Die Antwort konnte nicht abgeschlossen werden.', pending: 'Wird noch verarbeitet oder gespeichert.', interrupted: 'Unvollständige Antwort', archive: 'Gespeicherter Verlauf', latestHint: 'Zum Fortsetzen zu den neuesten Nachrichten wechseln.', refresh: 'Verlauf aktualisieren', remove: 'Gespräch löschen', removeAsk: 'Dieses Gespräch endgültig löschen?', removeFailed: 'Das Gespräch konnte nicht gelöscht werden.' },
} as const;
export const conversationCopy = (language: string) => text[language as keyof typeof text] ?? text.en;
export function conversationStatus(status: string | undefined, copy: ReturnType<typeof conversationCopy>) {
  const key = status?.toLowerCase();
  if (!key || ['complete', 'completed', 'success', 'succeeded'].includes(key)) return '';
  if (['cancelled', 'canceled', 'aborted'].includes(key)) return copy.cancelled;
  if (['pending', 'queued', 'running', 'streaming'].includes(key)) return copy.pending;
  return copy.interrupted;
}
export function conversationContentNotice(message: Pick<ClientChatMessage, 'redacted' | 'truncated'>, language: string) {
  const labels = language === 'sq' ? ['Përmbajtje e mbrojtur e lënë jashtë', 'Përmbajtje e shkurtuar'] : language === 'de' ? ['Geschützter Inhalt ausgelassen', 'Inhalt gekürzt'] : ['Protected content omitted', 'Content shortened'];
  return [message.redacted ? labels[0] : '', message.truncated ? labels[1] : ''].filter(Boolean).join(' · ');
}
type Setter<T> = Dispatch<SetStateAction<T>>;
type Attempt = { clientMessageId: string; question: string; conversationId: string | null; runId?: string; userId: string; answerId: string; history: Array<{ role: 'user' | 'assistant'; content: string }> };

/** Admin archive only. No legacy generic browser cache is read, written or deleted. */
export function useAdminConversations(input: { enabled: boolean; language: string; setMessages: Setter<ClientChatMessage[]>; setInput: Setter<string>; setLoading: Setter<boolean> }) {
  const { enabled, language, setMessages, setInput, setLoading } = input;
  const copy = conversationCopy(language);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]), [conversationId, setConversationId] = useState<string | null>(null);
  const [ready, setReady] = useState(!enabled), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [nextList, setNextList] = useState<string | null>(null), [nextRuns, setNextRuns] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0), [canRetry, setCanRetry] = useState(false);
  const current = useRef<string | null>(null), drafts = useRef(new Map<string, string>()), pages = useRef<Array<string | null>>([null]);
  const epoch = useRef(0), requestAbort = useRef<AbortController | null>(null), historyAbort = useRef<AbortController | null>(null), attempt = useRef<Attempt | null>(null);

  const cancel = useCallback(() => { epoch.current++; requestAbort.current?.abort(); historyAbort.current?.abort(); requestAbort.current = null; historyAbort.current = null; }, []);
  const json = useCallback(async (url: string, signal?: AbortSignal) => {
    const response = await fetch(url, { signal, cache: 'no-store', headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('Archive unavailable');
    return response.json() as Promise<unknown>;
  }, []);
  const showPage = useCallback((page: ConversationPage, cursor: string | null, index: number) => {
    current.current = page.conversation.id; setConversationId(page.conversation.id); setNextRuns(page.nextCursor); setPageIndex(index);
    pages.current = index === 0 ? [null] : [...pages.current.slice(0, index), cursor];
    setMessages(archiveMessages(page.runs, copy.failed, copy.pending)); setInput(drafts.current.get(page.conversation.id) ?? '');
  }, [copy.failed, copy.pending, setInput, setMessages]);
  const select = useCallback(async (id: string, cursor: string | null = null, index = 0) => {
    cancel(); const version = epoch.current, controller = new AbortController(); historyAbort.current = controller;
    setBusy(true); setLoading(false); setNotice(''); setCanRetry(false); attempt.current = null;
    try {
      const page = conversationPage(await json(`/api/assistant/conversations/${encodeURIComponent(id)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, controller.signal));
      if (version !== epoch.current) return;
      showPage(page, cursor, index); setReady(true);
    } catch { if (version === epoch.current && !controller.signal.aborted) setNotice(copy.historyError); }
    finally { if (version === epoch.current) { setBusy(false); historyAbort.current = null; } }
  }, [cancel, copy.historyError, json, setLoading, showPage]);
  const initialize = useCallback(async () => {
    cancel(); const version = epoch.current, controller = new AbortController(); historyAbort.current = controller;
    setBusy(true); setReady(false); setLoading(false); setNotice('');
    try {
      const list = conversationList(await json('/api/assistant/conversations', controller.signal));
      if (version !== epoch.current) return;
      setConversations(list.conversations); setNextList(list.nextCursor);
      if (list.conversations[0]) {
        const page = conversationPage(await json(`/api/assistant/conversations/${encodeURIComponent(list.conversations[0].id)}`, controller.signal));
        if (version !== epoch.current) return;
        showPage(page, null, 0);
      } else { current.current = null; setConversationId(null); setMessages([]); setInput(drafts.current.get('new') ?? ''); }
      setReady(true);
    } catch { if (version === epoch.current && !controller.signal.aborted) setNotice(copy.historyError); }
    finally { if (version === epoch.current) { setBusy(false); historyAbort.current = null; } }
  }, [cancel, copy.historyError, json, setInput, setLoading, setMessages, showPage]);
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    queueMicrotask(() => { if (mounted) void initialize(); });
    return () => { mounted = false; cancel(); };
  }, [enabled, initialize, cancel]);

  const rememberDraft = useCallback((draft: string) => { drafts.current.set(current.current ?? 'new', draft); }, []);
  const newChat = useCallback(() => {
    cancel(); current.current = null; attempt.current = null; pages.current = [null]; setConversationId(null); setMessages([]); setInput(drafts.current.get('new') ?? '');
    setNextRuns(null); setPageIndex(0); setLoading(false); setNotice(''); setCanRetry(false);
  }, [cancel, setInput, setLoading, setMessages]);
  const moreConversations = useCallback(async () => {
    if (!nextList || busy) return;
    const version = epoch.current, controller = new AbortController(); historyAbort.current = controller; setBusy(true);
    try { const list = conversationList(await json(`/api/assistant/conversations?cursor=${encodeURIComponent(nextList)}`, controller.signal));
      if (version === epoch.current) { setConversations(prev => mergeConversations(prev, list.conversations)); setNextList(list.nextCursor); }
    } catch { if (version === epoch.current && !controller.signal.aborted) setNotice(copy.historyError); }
    finally { if (version === epoch.current) { setBusy(false); historyAbort.current = null; } }
  }, [busy, copy.historyError, json, nextList]);

  const perform = useCallback(async (item: Attempt) => {
    if (!ready || busy || requestAbort.current) return;
    const version = epoch.current, controller = new AbortController(); requestAbort.current = controller;
    setLoading(true); setNotice(''); setCanRetry(false); let partial = '', streamEnded = false, confirmedConversation = item.conversationId;
    const update = (content: string, status?: string) => { if (version === epoch.current) setMessages(prev => prev.map(m => m.id === item.answerId ? { ...m, content, status } : m)); };
    try {
      const response = await fetch('/api/assistant', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: item.history, ...(item.conversationId ? { conversationId: item.conversationId } : {}), clientMessageId: item.clientMessageId }) });
      // Persisted/replayed failures also carry these identifiers; read them before status handling.
      const headerConversation = response.headers.get('X-Assistant-Conversation-Id');
      const headerRun = response.headers.get('X-Assistant-Run-Id');
      if (identifier(headerRun)) item.runId = headerRun;
      if (identifier(headerConversation)) {
        if (!item.conversationId && drafts.current.has('new')) { drafts.current.set(headerConversation, drafts.current.get('new')!); drafts.current.delete('new'); }
        confirmedConversation = headerConversation; item.conversationId = headerConversation;
        if (version === epoch.current) { current.current = headerConversation; setConversationId(headerConversation); } }
      if (!response.ok || !response.body) {
        const failure = await response.json().catch(() => null);
        throw new Error(object(failure) && typeof failure.error === 'string' ? failure.error.slice(0, 300) : copy.failed);
      }
      const reader = response.body.getReader(), decoder = new TextDecoder(); let lastFlush = 0;
      try { while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        partial += decoder.decode(chunk.value, { stream: true });
        if (performance.now() - lastFlush >= 60) { update(partial, 'streaming'); lastFlush = performance.now(); }
      } partial += decoder.decode(); } finally { reader.releaseLock(); }
      streamEnded = true; update(partial || copy.failed, partial.trim() ? 'completed' : 'failed');
      if (!confirmedConversation && version === epoch.current) setNotice(copy.unconfirmed);
    } catch (failure) {
      if (version === epoch.current) {
        const fallback = controller.signal.aborted ? copy.cancelled : failure instanceof Error ? failure.message : copy.failed;
        update(withPartialAnswer(partial, fallback), controller.signal.aborted ? 'cancelled' : 'failed');
        if (!confirmedConversation && !controller.signal.aborted) { setCanRetry(true); setNotice(fallback); }
      }
    } finally {
      if (version === epoch.current) {
        if (confirmedConversation) {
          const canonicalAbort = new AbortController(); historyAbort.current = canonicalAbort;
          try {
            const page = conversationPage(await json(`/api/assistant/conversations/${encodeURIComponent(confirmedConversation)}`, canonicalAbort.signal));
            if (version !== epoch.current) return;
            const stored = page.runs.find(run => run.clientMessageId === item.clientMessageId || run.id === item.runId);
            if (stored && ['pending', 'queued', 'running', 'streaming'].includes(stored.status.toLowerCase())) { update(partial || copy.pending, stored.status); setNotice(streamEnded ? copy.unconfirmed : copy.pending); }
            else if (stored) {
              showPage({ ...page, runs: page.runs.map(run => run.id === stored.id ? { ...run, answer: canonicalAnswer(partial, run.answer, run.status, copy.failed, run.redacted || run.answerRedacted) } : run) }, null, 0);
              attempt.current = null; setCanRetry(false);
            } else setNotice(copy.unconfirmed);
            setConversations(prev => mergeConversations(prev, [{ id: page.conversation.id, title: page.conversation.title, updatedAt: new Date().toISOString() }]));
          } catch { if (version === epoch.current && !canonicalAbort.signal.aborted) setNotice(copy.unconfirmed); }
          finally { if (version === epoch.current) historyAbort.current = null; }
        }
        if (version === epoch.current) { requestAbort.current = null; setLoading(false); }
      }
    }
  }, [busy, copy.cancelled, copy.failed, copy.pending, copy.unconfirmed, json, ready, setLoading, setMessages, showPage]);
  const send = useCallback((question: string, messages: ClientChatMessage[]) => {
    if (!ready || busy || pageIndex !== 0 || requestAbort.current) return;
    const item: Attempt = { clientMessageId: crypto.randomUUID(), conversationId: current.current, question,
      userId: crypto.randomUUID(), answerId: crypto.randomUUID(), history: assistantHistory([...messages, { role: 'user', content: question }]) };
    attempt.current = item; drafts.current.delete(current.current ?? 'new'); setInput('');
    setMessages(prev => [...prev, { id: item.userId, role: 'user', content: question }, { id: item.answerId, role: 'assistant', content: '', status: 'running' }]);
    void perform(item);
  }, [busy, pageIndex, perform, ready, setInput, setMessages]);
  const remove = useCallback(async () => {
    const id = current.current;
    if (!id || busy || requestAbort.current) return false;
    setBusy(true); setNotice('');
    try {
      const response = await fetch(`/api/assistant/conversations/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { accept: 'application/json' } });
      if (!response.ok && response.status !== 404) throw new Error('delete failed');
      drafts.current.delete(id);
      setConversations(prev => prev.filter(item => item.id !== id));
      newChat();
      return true;
    } catch { setNotice(copy.removeFailed); return false; }
    finally { setBusy(false); }
  }, [busy, copy.removeFailed, newChat]);
  return { copy, conversations, conversationId, ready, busy, notice, nextList, nextRuns, pageIndex, canRetry,
    rememberDraft, newChat, initialize, select, moreConversations, remove,
    older: () => current.current && nextRuns ? select(current.current, nextRuns, pageIndex + 1) : undefined,
    newer: () => current.current && pageIndex > 0 ? select(current.current, pages.current[pageIndex - 1], pageIndex - 1) : undefined,
    latest: () => current.current ? select(current.current) : initialize(),
    retry: () => attempt.current ? perform(attempt.current) : initialize(),
    stop: () => { requestAbort.current?.abort(); historyAbort.current?.abort(); }, send };
}
