'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, CalendarDays, Inbox, ListTodo, LockKeyhole, Mail, Paperclip, Plus, RefreshCw, Send } from 'lucide-react';
import type { OfficeSnapshot, OfficeMailThread } from '@/lib/offices/work-service';
import { MAX_MAIL_FILE_BYTES, MAX_MAIL_TOTAL_BYTES, MAX_MAIL_FILES, officeTimestamp } from '@/lib/offices/work-policy';
import { loadOfficeWork, readThreadAction, sendMailAction } from '@/lib/offices/work-actions';
import { officeWorkCopy } from '@/lib/offices/work-copy';
import type { SupportedLanguage } from '@/lib/i18n/language';
import s from './work.module.css';
import glass from './surfaces.module.css';
import { OfficeTaskJournal } from './OfficeTaskJournal';

type Result<T>={ok:true;data:T}|{ok:false;error:string};

export function OfficeWork({initial,view,lang,initialCompose=false,initialRecipient,initialTask}:{initial:OfficeSnapshot;view:'tasks'|'mail';lang:SupportedLanguage;initialCompose?:boolean;initialRecipient?:string;initialTask?:string}){
  const c=officeWorkCopy(lang),[data,setData]=useState(initial),[busy,start]=useTransition();
  const [notice,setNotice]=useState(''),[error,setError]=useState(''),[search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [thread,setThread]=useState<OfficeMailThread|null>(null),[compose,setCompose]=useState(initialCompose);
  const requestId=useRef<string|null>(null),mailForm=useRef<HTMLFormElement>(null);
  const name=(id:string)=>data.people.find(p=>p.id===id)?.name??'—';
  const date=officeTimestamp;
  function fail(code:string){setError(code==='CONFLICT'?c.conflict:code==='DENIED'||code==='NOT_FOUND'?c.denied:code==='INVALID'?c.invalid:code==='LIMIT'?c.limit:c.failed);}
  async function refresh(){const r=await loadOfficeWork();if(r.ok)setData(r.data);else fail(r.error);}
  function run<T>(action:()=>Promise<Result<T>>,done?:(value:T)=>void,success=c.saved){
    setError('');setNotice('');start(async()=>{try{const r=await action();if(!r.ok){fail(r.error);return;}done?.(r.data);await refresh();setNotice(success);}catch{setError(c.failed);}});
  }
  // Metadata only: private message bodies are loaded when their thread is opened.
  // Poll only a visible page, and never interrupt an editor with refreshed text.
  useEffect(()=>{const poll=async()=>{if(document.visibilityState!=='visible')return;try{const r=await loadOfficeWork();if(r.ok)setData(r.data);}catch{/* keep the last successful snapshot */}};const timer=setInterval(poll,45_000);return()=>clearInterval(timer);},[]);
  function openThread(id:string){run(()=>readThreadAction(id),t=>{setThread(t);setCompose(false);requestId.current=crypto.randomUUID();},'');}
  function submitMail(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const files=f.getAll('files').filter((v):v is File=>v instanceof File&&v.size>0);if(files.length>MAX_MAIL_FILES||files.some(v=>v.size>MAX_MAIL_FILE_BYTES)||files.reduce((n,v)=>n+v.size,0)>MAX_MAIL_TOTAL_BYTES){setError(c.invalid);return;}if(!requestId.current)requestId.current=crypto.randomUUID();f.set('requestId',requestId.current);f.set('threadId',thread?.id??'');if(thread){f.set('subject',thread.subject);f.set('recipientId',thread.senderId===data.self?thread.recipientId:thread.senderId);}run(()=>sendMailAction(f),({id})=>{requestId.current=null;mailForm.current?.reset();setCompose(false);start(async()=>{const r=await readThreadAction(id);if(r.ok)setThread(r.data);else fail(r.error);});},c.sentOk);}
  const mailRows=data.threads.filter(t=>(filter==='all'||filter==='unread'&&t.unread||filter==='sent'&&t.senderId===data.self||filter==='inbox'&&t.recipientId===data.self)&&`${t.subject} ${name(t.senderId)} ${name(t.recipientId)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const unread=data.threads.filter(t=>t.unread).length;
  return <section className={s.workspace} data-testid="office-work" aria-busy={busy}>
    <nav className={`${s.nav} ${glass.backNav}`} aria-label={c.desk}>
      <Link href="/workzone/offices/me"><ArrowLeft size={17}/>{c.desk}</Link>
      <Link href="/workzone/offices">{c.reception}</Link>
      <Link href="/workzone/plan?office=desk"><CalendarDays size={16}/>{c.plan}</Link>
    </nav>
    <header className={s.header}><div><p className={s.overline}>{name(data.self)}</p><h1>{view==='tasks'?(lang==='sq'?'Ditari i detyrave':'Task journal'):c.mail}</h1><p>{view==='tasks'?c.privateHint:c.mailHint}</p></div><div className={s.actions}>
      <Link href={`/workzone/offices/me/${view==='tasks'?'mail':'tasks'}`} className={s.button}>{view==='tasks'?<Mail size={18}/>:<ListTodo size={18}/>}<span>{view==='tasks'?c.mail:c.tasks}</span>{view==='tasks'&&unread>0&&<b className={s.badge}>{unread}</b>}</Link>
      <button type="button" disabled={busy} onClick={()=>run(loadOfficeWork,setData,'')} aria-label={c.refresh} className={s.icon}><RefreshCw size={18}/></button>
    </div></header>
    {(view==='mail'||busy||error||notice)&&<div role="status" aria-live="polite" className={s.feedback}>{busy?c.loading:error||notice}</div>}
    {view==='tasks'?<OfficeTaskJournal data={data} onData={setData} lang={lang} initialTask={initialTask}/>:thread||compose?<section className={s.editor}>
      <div className={s.editorHead}><button disabled={busy} onClick={()=>{setThread(null);setCompose(false);setError('');}}><ArrowLeft size={17}/>{c.mail}</button><span><LockKeyhole size={14}/>{c.mailHint.split('.')[0]}</span></div>
      {thread&&<><h2>{thread.subject}</h2><p className={s.hint}>{name(thread.senderId)} · {name(thread.recipientId)}</p><div className={s.messages}>{thread.messages.map(m=><article key={m.id} className={`${s.message} ${m.senderId===data.self?s.own:''}`}><header><strong>{name(m.senderId)}</strong><time dateTime={new Date(m.createdAt).toISOString()}>{date(m.createdAt)}</time></header><p>{m.body}</p>{m.attachments.map(f=><a key={f.id} href={`/api/office-files/${f.id}`} download><Paperclip size={16}/><span>{f.fileName}</span><small>{`${Math.ceil(f.size/1024)} KB`}</small><span className={s.sr}>{c.download}</span></a>)}</article>)}</div></>}
      <form ref={mailForm} onSubmit={submitMail} key={thread?.id??'new'}><fieldset disabled={busy}>
        {!thread&&<><label>{c.to}<select name="recipientId" required defaultValue={data.people.find(p=>p.id===initialRecipient&&p.id!==data.self)?.id??data.people.find(p=>p.id!==data.self)?.id??''}>{data.people.filter(p=>p.id!==data.self).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}{data.people.length<2&&<option value="">{c.noRecipient}</option>}</select></label><label>{c.subject}<input name="subject" required maxLength={160} autoFocus/></label></>}
        <label>{thread?c.reply:c.message}<textarea name="body" rows={4} maxLength={10000}/></label><label className={s.fileInput}><Paperclip size={16}/>{c.files}<input name="files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx"/></label><p className={s.hint}>{c.fileHint}</p><button className={s.primary} disabled={data.people.length<2}><Send size={17}/>{c.send}</button>
      </fieldset></form>
    </section>:<>
      <div className={s.toolbar}><input type="search" aria-label={c.search} placeholder={c.search} value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label={c.mail} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{c.all}</option><option value="inbox">{c.inbox}</option><option value="sent">{c.sent}</option><option value="unread">{c.unread}</option></select><button className={s.primary} onClick={()=>{requestId.current=crypto.randomUUID();setCompose(true);setError('');}}><Plus size={17}/>{c.compose}</button></div>
      <div className={s.rows}>{mailRows.length===0?<p className={s.empty}><Inbox size={26}/>{c.empty}</p>:mailRows.map(t=><button key={t.id} disabled={busy} className={`${s.mailRow} ${t.unread?s.unread:''}`} onClick={()=>openThread(t.id)}><span className={s.symbol}><Mail size={19}/></span><span className={s.rowMain}><strong>{t.subject}</strong><span>{name(t.senderId===data.self?t.recipientId:t.senderId)} · {date(t.updatedAt)}</span></span>{t.unread&&<span className={s.dot} aria-label={c.unread}/>}<ArrowUpRight size={16}/></button>)}</div>
    </>}
  </section>;
}
