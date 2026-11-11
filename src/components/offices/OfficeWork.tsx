'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Archive, CalendarDays, Check, FileText, Inbox, ListTodo, LockKeyhole, Mail, Paperclip, Pencil, Plus, RefreshCw, Send, Settings2 } from 'lucide-react';
import type { OfficeSnapshot, OfficeMailThread } from '@/lib/offices/work-service';
import type { TaskInput } from '@/lib/offices/work-policy';
import { MAX_MAIL_FILE_BYTES, MAX_MAIL_TOTAL_BYTES, MAX_MAIL_FILES, officeTimestamp } from '@/lib/offices/work-policy';
import { archiveTaskAction, initializeCategoriesAction, loadOfficeWork, readThreadAction, saveCategoryAction, saveTaskAction, sendMailAction } from '@/lib/offices/work-actions';
import { officeWorkCopy } from '@/lib/offices/work-copy';
import type { SupportedLanguage } from '@/lib/i18n/language';
import s from './work.module.css';
import { dateKey } from '@/lib/workzone/date-utils';

type Task=OfficeSnapshot['tasks'][number];
type Result<T>={ok:true;data:T}|{ok:false;error:string};

export function OfficeWork({initial,view,lang,initialCompose=false}:{initial:OfficeSnapshot;view:'tasks'|'mail';lang:SupportedLanguage;initialCompose?:boolean}){
  const c=officeWorkCopy(lang),[data,setData]=useState(initial),[busy,start]=useTransition();
  const [notice,setNotice]=useState(''),[error,setError]=useState(''),[search,setSearch]=useState('');
  const [filter,setFilter]=useState('all'),[edit,setEdit]=useState<TaskInput|null>(null),[sharing,setSharing]=useState(false),[confirmed,setConfirmed]=useState(false);
  const [thread,setThread]=useState<OfficeMailThread|null>(null),[compose,setCompose]=useState(initialCompose);
  const requestId=useRef<string|null>(null),mailForm=useRef<HTMLFormElement>(null);
  const [category,setCategory]=useState<{id:string|null;name:string;archive:boolean}>({id:null,name:'',archive:false});
  const labels={NOTE:c.note,PERSONAL:c.personal,COMPANY:c.company,TODO:c.todo,DOING:c.doing,DONE:c.done};
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
  function openTask(t?:Task){setError('');setNotice('');setSharing(false);setConfirmed(false);setEdit(t?{id:t.id,version:t.version,kind:t.kind as TaskInput['kind'],title:t.title,body:t.body,status:t.status as TaskInput['status'],ownerId:t.ownerId,categoryId:t.categoryId,priority:t.priority as TaskInput['priority'],dueDate:t.dueDate}:{id:crypto.randomUUID(),version:0,kind:'PERSONAL',title:'',body:'',ownerId:data.self,categoryId:null,status:'TODO',priority:'NORMAL',dueDate:null});}
  function openThread(id:string){run(()=>readThreadAction(id),t=>{setThread(t);setCompose(false);requestId.current=crypto.randomUUID();},'');}
  function submitTask(e:FormEvent){e.preventDefault();if(!edit||sharing&&!confirmed)return;run(()=>saveTaskAction(edit),()=>setEdit(null));}
  function submitMail(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const files=f.getAll('files').filter((v):v is File=>v instanceof File&&v.size>0);if(files.length>MAX_MAIL_FILES||files.some(v=>v.size>MAX_MAIL_FILE_BYTES)||files.reduce((n,v)=>n+v.size,0)>MAX_MAIL_TOTAL_BYTES){setError(c.invalid);return;}if(!requestId.current)requestId.current=crypto.randomUUID();f.set('requestId',requestId.current);f.set('threadId',thread?.id??'');if(thread){f.set('subject',thread.subject);f.set('recipientId',thread.senderId===data.self?thread.recipientId:thread.senderId);}run(()=>sendMailAction(f),({id})=>{requestId.current=null;mailForm.current?.reset();setCompose(false);start(async()=>{const r=await readThreadAction(id);if(r.ok)setThread(r.data);else fail(r.error);});},c.sentOk);}
  const taskRows=data.tasks.filter(t=>(filter==='archive'?!!t.archivedAt:!t.archivedAt)&&(filter==='all'||filter==='archive'||filter==='today'&&t.dueDate===dateKey(new Date())||t.kind===filter||t.status===filter||t.categoryId===filter)&&`${t.title} ${t.body}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const mailRows=data.threads.filter(t=>(filter==='all'||filter==='unread'&&t.unread||filter==='sent'&&t.senderId===data.self||filter==='inbox'&&t.recipientId===data.self)&&`${t.subject} ${name(t.senderId)} ${name(t.recipientId)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const unread=data.threads.filter(t=>t.unread).length;
  return <section className={s.workspace} data-testid="office-work" aria-busy={busy}>
    <nav className={s.nav} aria-label={c.desk}>
      <Link href="/workzone/offices/me"><ArrowLeft size={17}/>{c.desk}</Link>
      <Link href="/workzone/offices">{c.reception}</Link>
      <Link href="/workzone/plan?office=desk"><CalendarDays size={16}/>{c.plan}</Link>
    </nav>
    <header className={s.header}><div><p className={s.overline}>{name(data.self)}</p><h1>{view==='tasks'?c.tasks:c.mail}</h1><p>{view==='tasks'?c.privateHint:c.mailHint}</p></div><div className={s.actions}>
      <Link href={`/workzone/offices/me/${view==='tasks'?'mail':'tasks'}`} className={s.button}>{view==='tasks'?<Mail size={18}/>:<ListTodo size={18}/>}<span>{view==='tasks'?c.mail:c.tasks}</span>{view==='tasks'&&unread>0&&<b className={s.badge}>{unread}</b>}</Link>
      <button type="button" disabled={busy} onClick={()=>run(loadOfficeWork,setData,'')} aria-label={c.refresh} className={s.icon}><RefreshCw size={18}/></button>
    </div></header>
    <div role="status" aria-live="polite" className={s.feedback}>{busy?c.loading:error||notice}</div>
    {view==='tasks'&&edit?<form className={s.editor} onSubmit={submitTask}>
      <div className={s.editorHead}><button type="button" className={s.button} onClick={()=>setEdit(null)} disabled={busy}><ArrowLeft size={17}/>{c.back}</button><span><LockKeyhole size={14}/>{edit.kind==='COMPANY'?c.shared:c.private}</span></div>
      <fieldset disabled={busy}>
        <label>{c.title}<input autoFocus required maxLength={160} value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})}/></label>
        <div className={s.formGrid}><label>{c.type}<select value={edit.kind} disabled={data.tasks.find(t=>t.id===edit.id)?.kind==='COMPANY'} onChange={e=>{const kind=e.target.value as TaskInput['kind'];setSharing(edit.version>0&&kind==='COMPANY'&&data.tasks.find(t=>t.id===edit.id)?.kind!=='COMPANY');setConfirmed(false);setEdit({...edit,kind,ownerId:kind==='COMPANY'?edit.ownerId:data.self,categoryId:kind==='COMPANY'?edit.categoryId:null});}}><option value="NOTE">{c.note}</option><option value="PERSONAL">{c.personal}</option><option value="COMPANY">{c.company}</option></select></label>
          {edit.kind!=='NOTE'&&<label>{c.status}<select aria-label={c.status} value={edit.status} onChange={e=>setEdit({...edit,status:e.target.value as TaskInput['status']})}>{(['TODO','DOING','DONE'] as const).map(k=><option key={k} value={k}>{labels[k]}</option>)}</select></label>}
          {edit.kind==='COMPANY'&&<><label>{c.category}<select required value={edit.categoryId??''} onChange={e=>setEdit({...edit,categoryId:e.target.value||null})}><option value="">{c.choose}</option>{data.categories.filter(x=>!x.archivedAt||x.id===edit.categoryId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>{c.person}<select value={edit.ownerId} onChange={e=>setEdit({...edit,ownerId:e.target.value})}>{data.people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></>}
          {edit.kind!=='NOTE'&&<><label>{c.due}<input type="date" value={edit.dueDate??''} onChange={e=>setEdit({...edit,dueDate:e.target.value||null})}/></label><label>{c.priority}<select value={edit.priority} onChange={e=>setEdit({...edit,priority:e.target.value as TaskInput['priority']})}><option value="NORMAL">{c.normal}</option><option value="HIGH">{c.high}</option></select></label></>}
        </div>
        <label>{c.body}<textarea rows={6} maxLength={8000} value={edit.body} onChange={e=>setEdit({...edit,body:e.target.value})}/></label>
        {edit.kind==='COMPANY'&&<><p className={s.hint}>{c.companyHint}</p>{data.categories.length===0&&<button type="button" onClick={()=>run(initializeCategoriesAction)}>{c.setup}</button>}</>}
        {sharing&&<label className={s.confirm}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{c.shareConfirm}</label>}
        <div className={s.actions}><button className={s.primary} disabled={sharing&&!confirmed}><Check size={17}/>{c.save}</button><button type="button" onClick={()=>setEdit(null)}>{c.cancel}</button></div>
      </fieldset>
    </form>:view==='tasks'?<>
      <div className={s.toolbar}><input type="search" aria-label={c.search} placeholder={c.search} value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label={c.tasks} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{c.all}</option><option value="today">{c.today}</option>{(['NOTE','PERSONAL','COMPANY','TODO','DOING','DONE'] as const).map(k=><option key={k} value={k}>{labels[k]}</option>)}{data.categories.filter(x=>!x.archivedAt).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}<option value="archive">{c.archived}</option></select><button className={s.primary} onClick={()=>openTask()}><Plus size={17}/>{c.newTask}</button></div>
      <div className={s.rows}>{taskRows.length===0?<p className={s.empty}>{c.empty}</p>:taskRows.map(t=><article className={s.row} key={t.id}><span className={s.symbol}>{t.kind==='NOTE'?<FileText size={19}/>:t.status==='DONE'?<Check size={19}/>:<ListTodo size={19}/>}</span><button className={s.rowMain} disabled={!!t.archivedAt} onClick={()=>openTask(t)}><strong>{t.title}</strong><span>{labels[t.kind as TaskInput['kind']]}{t.kind!=='NOTE'&&` · ${labels[t.status as TaskInput['status']]}`}{t.dueDate&&` · ${t.dueDate}`}{t.priority==='HIGH'&&` · ${c.high}`}</span>{t.kind==='COMPANY'&&<span>{name(t.ownerId)} · {data.categories.find(x=>x.id===t.categoryId)?.name}</span>}</button>{t.kind==='NOTE'&&!t.archivedAt&&<button className={s.icon} disabled={busy} aria-label={`${c.toTask}: ${t.title}`} title={c.toTask} onClick={()=>run(()=>saveTaskAction({id:t.id,version:t.version,kind:'PERSONAL',title:t.title,body:t.body,status:'TODO',priority:t.priority,ownerId:t.ownerId,categoryId:null,dueDate:t.dueDate}))}><ListTodo size={17}/></button>}<button className={s.icon} disabled={busy} title={t.archivedAt?c.restore:c.archive} aria-label={`${t.archivedAt?c.restore:c.archive}: ${t.title}`} onClick={()=>run(()=>archiveTaskAction({id:t.id,version:t.version,restore:!!t.archivedAt}))}>{t.archivedAt?<RefreshCw size={17}/>:<Archive size={17}/>}</button></article>)}</div>
      <details className={s.settings}><summary><Settings2 size={17}/>{c.categories}</summary><p className={s.hint}>{c.companyHint}</p>{data.categories.length===0?<button disabled={busy} onClick={()=>run(initializeCategoriesAction)}>{c.setup}</button>:<div className={s.categoryList}>{data.categories.map(x=><button key={x.id} onClick={()=>setCategory({id:x.id,name:x.name,archive:!!x.archivedAt})}><span>{x.name}{x.archivedAt&&` · ${c.archived}`}</span><Pencil size={14}/></button>)}</div>}<form onSubmit={e=>{e.preventDefault();run(()=>saveCategoryAction(category),()=>setCategory({id:null,name:'',archive:false}));}}><label>{c.categoryName}<input required maxLength={100} value={category.name} onChange={e=>setCategory({...category,name:e.target.value})}/></label>{category.id&&<label className={s.confirm}><input type="checkbox" checked={category.archive} onChange={e=>setCategory({...category,archive:e.target.checked})}/>{c.archive}</label>}<div className={s.actions}><button disabled={busy}>{category.id?c.save:c.addCategory}</button>{category.id&&<button type="button" onClick={()=>setCategory({id:null,name:'',archive:false})}>{c.cancel}</button>}</div></form></details>
    </>:thread||compose?<section className={s.editor}>
      <div className={s.editorHead}><button disabled={busy} onClick={()=>{setThread(null);setCompose(false);setError('');}}><ArrowLeft size={17}/>{c.mail}</button><span><LockKeyhole size={14}/>{c.mailHint.split('.')[0]}</span></div>
      {thread&&<><h2>{thread.subject}</h2><p className={s.hint}>{name(thread.senderId)} · {name(thread.recipientId)}</p><div className={s.messages}>{thread.messages.map(m=><article key={m.id} className={`${s.message} ${m.senderId===data.self?s.own:''}`}><header><strong>{name(m.senderId)}</strong><time dateTime={new Date(m.createdAt).toISOString()}>{date(m.createdAt)}</time></header><p>{m.body}</p>{m.attachments.map(f=><a key={f.id} href={`/api/office-files/${f.id}`} download><Paperclip size={16}/><span>{f.fileName}</span><small>{`${Math.ceil(f.size/1024)} KB`}</small><span className={s.sr}>{c.download}</span></a>)}</article>)}</div></>}
      <form ref={mailForm} onSubmit={submitMail} key={thread?.id??'new'}><fieldset disabled={busy}>
        {!thread&&<><label>{c.to}<select name="recipientId" required defaultValue={data.people.find(p=>p.id!==data.self)?.id??''}>{data.people.filter(p=>p.id!==data.self).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}{data.people.length<2&&<option value="">{c.noRecipient}</option>}</select></label><label>{c.subject}<input name="subject" required maxLength={160} autoFocus/></label></>}
        <label>{thread?c.reply:c.message}<textarea name="body" rows={4} maxLength={10000}/></label><label className={s.fileInput}><Paperclip size={16}/>{c.files}<input name="files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx"/></label><p className={s.hint}>{c.fileHint}</p><button className={s.primary} disabled={data.people.length<2}><Send size={17}/>{c.send}</button>
      </fieldset></form>
    </section>:<>
      <div className={s.toolbar}><input type="search" aria-label={c.search} placeholder={c.search} value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label={c.mail} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{c.all}</option><option value="inbox">{c.inbox}</option><option value="sent">{c.sent}</option><option value="unread">{c.unread}</option></select><button className={s.primary} onClick={()=>{requestId.current=crypto.randomUUID();setCompose(true);setError('');}}><Plus size={17}/>{c.compose}</button></div>
      <div className={s.rows}>{mailRows.length===0?<p className={s.empty}><Inbox size={26}/>{c.empty}</p>:mailRows.map(t=><button key={t.id} disabled={busy} className={`${s.mailRow} ${t.unread?s.unread:''}`} onClick={()=>openThread(t.id)}><span className={s.symbol}><Mail size={19}/></span><span className={s.rowMain}><strong>{t.subject}</strong><span>{name(t.senderId===data.self?t.recipientId:t.senderId)} · {date(t.updatedAt)}</span></span>{t.unread&&<span className={s.dot} aria-label={c.unread}/>}<ArrowUpRight size={16}/></button>)}</div>
    </>}
  </section>;
}
