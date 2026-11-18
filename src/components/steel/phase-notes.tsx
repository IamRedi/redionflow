'use client';
import { CalendarDays, PenLine, RotateCcw, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/components/i18n/language-provider';
import { getSteelPhaseNotesAction } from '@/app/(workzone)/workzone/steel-phase-actions';
import type { PhaseNotesPage } from '@/lib/steel-work/phase-notes';
import { phaseNotesCopy } from './phase-notes-copy';

export function SteelPhaseNotes({ phaseItemId, refreshKey }: { phaseItemId: string; refreshKey: string }) {
 const { currentLang } = useLanguage(), c = phaseNotesCopy(currentLang);
 const [day, setDay] = useState(''), [author, setAuthor] = useState(''), [retry, setRetry] = useState(0);
 const [visible, setVisible] = useState(3), [moreBusy, setMoreBusy] = useState(false);
 const [result, setResult] = useState<{ key: string; page?: PhaseNotesPage; error?: boolean } | null>(null);
 const key = JSON.stringify([phaseItemId, refreshKey, day, author, retry]);
 useEffect(() => {
  let cancelled = false;
  getSteelPhaseNotesAction({ phaseItemId, ...(day ? { day } : {}), ...(author ? { author } : {}) }).then(response => {
   if (!cancelled) setResult(response.ok && response.page ? { key, page: response.page } : { key, error: true });
  }).catch(() => { if (!cancelled) setResult({ key, error: true }); });
  return () => { cancelled = true; };
 }, [phaseItemId, refreshKey, day, author, retry, key]);
 const ready = result?.key === key, page = ready ? result.page : undefined;
 const authors = result?.page?.authors ?? [];
 const changeFilter = (kind: 'day' | 'author', value: string) => { setVisible(3); if (kind === 'day') setDay(value); else setAuthor(value); };
 async function more() {
  if (!page || moreBusy) return;
  if (visible < page.entries.length) { setVisible(count => count + 3); return; }
  setMoreBusy(true);
  try {
   const response = await getSteelPhaseNotesAction({ phaseItemId, ...(day ? { day } : {}), ...(author ? { author } : {}), cursor: page.nextCursor! });
   setResult(current => current?.key !== key ? current : response.ok && response.page ? { key, page: { ...response.page, entries: [...page.entries, ...response.page.entries] } } : { ...current, error: true });
   if (response.ok) setVisible(count => count + 3);
  } catch { setResult(current => current?.key === key ? { ...current, error: true } : current); }
  finally { setMoreBusy(false); }
 }
 return <section data-studio-phase-notes aria-label={c.title} className="min-w-0 space-y-2.5">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="inline-flex items-center gap-1.5 text-sm font-semibold"><PenLine className="size-4" />{c.title}</h3>{day || author ? <button type="button" onClick={() => { setDay(''); setAuthor(''); setVisible(3); }} aria-label={c.reset} title={c.reset} className="grid size-11 place-items-center rounded-xl border bg-card"><RotateCcw className="size-4" /></button> : null}</div>
  <div className="grid min-w-0 grid-cols-2 gap-2">
   <label className="min-w-0 space-y-1 text-xs font-medium"><span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{c.date}</span><input data-studio-input type="date" aria-label={c.date} value={day} onChange={e => changeFilter('day', e.target.value)} className="h-11 w-full min-w-0 max-w-full rounded-xl border bg-card px-2 text-base sm:text-sm" /></label>
   <label className="min-w-0 space-y-1 text-xs font-medium"><span className="flex items-center gap-1"><UserRound className="size-3.5" />{c.person}</span><select data-studio-input aria-label={c.person} value={author} onChange={e => changeFilter('author', e.target.value)} className="h-11 w-full min-w-0 truncate rounded-xl border bg-card px-2 text-base sm:text-sm"><option value="">{c.all}</option>{authors.map(a => <option key={a.key} value={a.key}>{a.name || c.unknown}{a.key.startsWith('legacy:') ? ` · ${c.legacy}` : ''}</option>)}</select></label>
  </div>
  {!ready ? <p role="status" className="text-xs text-muted-foreground">{c.loading}</p> : result?.error ? <div role="alert" className="text-xs"><button type="button" onClick={() => setRetry(n => n + 1)} className="min-h-11 rounded-xl border bg-card px-3 font-semibold">{c.retry}</button></div> : page && !page.entries.length ? <p className="py-2 text-xs text-muted-foreground">{c.empty}</p> : null}
  {page?.entries.length ? <ol className="space-y-2">{page.entries.slice(0, visible).map(note => <li key={note.id} data-studio-surface className="min-w-0 rounded-2xl border bg-card p-3"><div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs"><strong className="break-words font-semibold">{note.authorName || c.unknown}</strong>{note.writtenAt ? <time dateTime={note.writtenAt} className="text-muted-foreground">{new Intl.DateTimeFormat(currentLang === 'sq' ? 'sq-AL' : currentLang, { timeZone: page.zone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(note.writtenAt))}</time> : <span className="text-muted-foreground">{c.unknownDate}</span>}</div><p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{note.text}</p>{note.legacy ? <span className="mt-1 block text-[10px] text-muted-foreground">{c.legacy}</span> : null}</li>)}</ol> : null}
  {page && (visible < page.entries.length || page.hasMore) ? <button type="button" disabled={moreBusy} onClick={more} className="min-h-11 rounded-xl border bg-card px-3 text-xs font-semibold disabled:opacity-50">{c.more}</button> : null}
 </section>;
}
