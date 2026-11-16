'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { MessageCircle, Send, X, ArrowUp, ArrowDown } from 'lucide-react';
import { useLanguage } from '@/components/i18n/language-provider';
import { companyChatCopy } from '@/lib/company-chat/copy';
import { CHAT_MESSAGE_LIMIT, type ChatPerson, type ChatSnapshot } from '@/lib/company-chat/contract';
import s from './company-chat.module.css';

type ChatControl = { owner: string; open: () => void; expanded: boolean; unread: number; title: string; unreadLabel: string };
function createChatStore() {
  let value: ChatControl | null = null;
  const listeners = new Set<() => void>();
  return {
    snapshot: () => value,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    publish: (next: ChatControl) => { if (value !== next) { value = next; listeners.forEach(listener => listener()); } },
    clear: (owner: string) => { if (value?.owner === owner) { value = null; listeners.forEach(listener => listener()); } },
  };
}
type ChatStore = ReturnType<typeof createChatStore>;
const ChatContext = createContext<{ store: ChatStore; owner: string } | null>(null);
const noChat = () => null, noSubscription = () => () => {};
export function CompanyChatTrigger({ className = '' }: { className?: string }) {
  const context = useContext(ChatContext);
  const chat = useSyncExternalStore(context?.store.subscribe ?? noSubscription, context?.store.snapshot ?? noChat, noChat);
  if (!chat || chat.owner !== context?.owner) return null;
  return <button type="button" onClick={chat.open} className={`${s.trigger} ${className}`} title={chat.title} aria-label={`${chat.title}${chat.unread ? ` · ${chat.unread} ${chat.unreadLabel}` : ''}`} aria-expanded={chat.expanded} aria-haspopup="dialog" data-testid="company-chat-trigger"><MessageCircle size={19} aria-hidden="true" />{chat.unread > 0 && <span className={s.badge} aria-label={`${chat.unread} ${chat.unreadLabel}`} data-testid="company-chat-unread">{chat.unread > 99 ? '99+' : chat.unread}</span>}</button>;
}

export function CompanyChatProvider({ actor, children }: { actor: ChatPerson | null; children: ReactNode }) {
  const path = usePathname();
  const [store] = useState(createChatStore);
  const interactive = actor?.demo || path === '/workzone' || path.startsWith('/workzone/') || path === '/app' || path.startsWith('/app/');
  const enabled = actor && interactive, owner = actor ? `${actor.key}:${actor.context ?? ''}` : '';
  // Disabled installations do not create effects, UI, or requests.
  // Keep the application children in one stable position: resolving a persona
  // must never remount its forms, search, media panels or scene transitions.
  return <ChatContext.Provider value={enabled ? { store, owner } : null}>{children}{enabled && <EnabledCompanyChat key={owner} actor={actor} owner={owner} store={store}/>}</ChatContext.Provider>;
}

function EnabledCompanyChat({ actor, owner, store }: { actor: ChatPerson; owner: string; store: ChatStore }) {
  const { currentLang: lang } = useLanguage(), c = companyChatCopy(lang);
  const [open, setOpen] = useState(false), [snapshot, setSnapshot] = useState<ChatSnapshot | null>(null), [before, setBefore] = useState<string | null>(null);
  const [draft, setDraft] = useState(''), [sending, setSending] = useState(false), [loadError, setLoadError] = useState(''), [sendError, setSendError] = useState(''), [toast, setToast] = useState(false);
  const error = sendError || loadError;
  const list = useRef<HTMLDivElement>(null), nearBottom = useRef(true), pending = useRef<{ text: string; id: string } | null>(null);
  const panel = useRef<HTMLDivElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  const generation = useRef(0), baseline = useRef<{ latest: string; unread: number } | null>(null), readThrough = useRef('0');
  const endpoint = `${actor.context === 'office' ? '/api/demo/baumdienst/offices/chat' : actor.demo ? '/api/demo/baumdienst/chat' : '/api/company-chat'}${actor.demo ? '?demo=1' : ''}`;
  const errorText = useCallback((code: string) => code === 'rate' ? c.rate : code === 'profile' ? c.profile : code === 'storage' ? c.storage : c.error, [c.error, c.profile, c.rate, c.storage]);
  const refresh = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    const ticket = ++generation.current;
    const params = new URLSearchParams(actor.demo ? { demo: '1' } : {});
    if (!open) params.set('summary', '1');
    if (before && open) params.set('before', before);
    try {
      const response = await fetch(`${endpoint.split('?')[0]}?${params}`, { cache: 'no-store' });
      const data = await response.json();
      if (ticket !== generation.current) return;
      if (!response.ok) throw new Error(data.error);
      if (data.actor?.key !== actor.key) throw new Error('profile');
      const value = data as ChatSnapshot;
      if (baseline.current && value.unread > baseline.current.unread && value.latest !== baseline.current.latest) setToast(true);
      baseline.current = { latest: value.latest, unread: value.unread };
      setSnapshot(value); setLoadError('');
    } catch (e) { if (ticket === generation.current) setLoadError(errorText(e instanceof Error ? e.message : '')); }
  }, [actor.demo, actor.key, before, endpoint, errorText, open]);
  const invalidate = useCallback(() => { generation.current += 1; }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), open ? 5000 : 30000);
    const resume = () => void refresh();
    window.addEventListener('company-chat-update', resume); window.addEventListener('online', resume); window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume);
    return () => { invalidate(); clearTimeout(initial); clearInterval(timer); window.removeEventListener('company-chat-update', resume); window.removeEventListener('online', resume); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  }, [invalidate, open, refresh]);
  useEffect(() => { const timer = setTimeout(() => { if (new URLSearchParams(window.location.search).get('teamChat') === '1') setOpen(true); }, 0); return () => clearTimeout(timer); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(false), 6500); return () => clearTimeout(timer); }, [toast]);
  const post = useCallback(async (command: object) => {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...command, actorKey: actor.key }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
  }, [actor.key, endpoint]);
  const markRead = useCallback(async () => {
    if (!open || before || !nearBottom.current || document.visibilityState !== 'visible') return;
    const through = snapshot?.messages.at(-1)?.seq;
    if (!through || through === readThrough.current) return;
    const previous = readThrough.current; readThrough.current = through;
    try {
      await post({ type: 'read', through });
      setSnapshot(value => value?.latest === through ? { ...value, unread: 0 } : value);
      if (baseline.current?.latest === through) baseline.current.unread = 0;
    } catch { readThrough.current = previous; }
  }, [before, open, post, snapshot]);
  const lastId = snapshot?.messages.at(-1)?.id;
  useEffect(() => {
    if (!open || before || !nearBottom.current) return;
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
    void markRead();
  }, [before, lastId, markRead, open]);
  const show = useCallback(() => {
    const active = document.activeElement;
    returnFocus.current = active instanceof HTMLElement && active.dataset.testid === 'company-chat-trigger' ? active : document.querySelector<HTMLElement>('[data-testid=office-floating-nav] [data-testid=company-chat-trigger], [data-testid=muster-offices] nav [data-testid=company-chat-trigger]') ?? document.querySelector<HTMLElement>('[data-testid=company-chat-trigger]');
    nearBottom.current = true; setBefore(null); setOpen(true); setToast(false);
  }, []);
  const control = useMemo(() => ({ owner, open: show, expanded: open, unread: snapshot?.unread ?? 0, title: c.title, unreadLabel: c.unread }), [owner, show, open, snapshot?.unread, c.title, c.unread]);
  useEffect(() => { store.publish(control); }, [store, control]);
  useEffect(() => () => store.clear(owner), [store, owner]);
  async function send() {
    const body = draft.trim(); if (!body || sending) return;
    if (!pending.current || pending.current.text !== body) pending.current = { text: body, id: crypto.randomUUID() };
    setSending(true); setSendError('');
    try { await post({ type: 'send', body, requestId: pending.current.id }); pending.current = null; setDraft(''); nearBottom.current = true; setBefore(null); await refresh(); }
    catch (e) { setSendError(errorText(e instanceof Error ? e.message : '')); }
    finally { setSending(false); }
  }
  return <>
    {toast && !open && <button type="button" className={s.toast} onClick={show} role="status" data-testid="company-chat-toast"><MessageCircle size={18} aria-hidden="true" /><span>{c.fresh}</span></button>}
    <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal><Dialog.Overlay className={s.overlay}/><Dialog.Content ref={panel} tabIndex={-1} className={s.panel} data-testid="company-chat-dialog" onOpenAutoFocus={e => { e.preventDefault(); panel.current?.focus(); }} onCloseAutoFocus={e => { e.preventDefault(); if (returnFocus.current?.isConnected) returnFocus.current.focus(); }}>
      <header className={s.heading}><MessageCircle size={22} aria-hidden="true"/><div><Dialog.Title>{c.title}</Dialog.Title><Dialog.Description>{c.hint}</Dialog.Description></div><Dialog.Close className={s.icon} aria-label={c.close}><X size={20}/></Dialog.Close></header>
      <div className={s.identity}>{actor.name}{actor.demo && <span>{c.demo}</span>}</div>
      <div className={s.messages} ref={list} tabIndex={0} aria-label={c.title} onScroll={() => { const el = list.current; if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48; if (nearBottom.current) void markRead(); }} data-testid="company-chat-messages">
        {open && !snapshot ? <p role="status">{c.loading}</p> : null}
        {snapshot?.older && <button className={s.history} type="button" onClick={() => { nearBottom.current = false; setBefore(snapshot.older); }}><ArrowUp size={15}/>{c.older}</button>}
        {snapshot && !snapshot.messages.length && <p className={s.empty}>{c.empty}</p>}
        {snapshot?.messages.map(message => <article key={message.id} className={s.message} data-own={message.authorKey === actor.key || undefined} data-message-id={message.id}><div><strong>{message.authorName}</strong><time dateTime={message.at}>{new Intl.DateTimeFormat(lang, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(message.at))}</time></div><p>{message.body}</p></article>)}
      </div>
      {before && <button className={s.history} type="button" onClick={() => { nearBottom.current = true; setBefore(null); }}><ArrowDown size={15}/>{c.latest}{snapshot?.unread ? ` · ${snapshot.unread}` : ''}</button>}
      {error && <div className={s.error} role="alert">{error}<button type="button" onClick={() => void refresh()}>{c.retry}</button></div>}
      <form className={s.composer} onSubmit={e => { e.preventDefault(); void send(); }}><textarea aria-label={c.placeholder} placeholder={c.placeholder} value={draft} maxLength={CHAT_MESSAGE_LIMIT} rows={2} onChange={e => setDraft(e.target.value)} disabled={sending}/><button type="submit" className={s.icon} aria-label={c.send} disabled={sending || !draft.trim()}><Send size={20}/></button></form>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </>;
}
