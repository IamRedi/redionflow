'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { Archive, ArrowLeft, ArrowUpRight, Bell, BellRing, CalendarDays, Check, CheckCheck, Circle, Clock3, FileText, Flag, LockKeyhole, Pencil, Plus, RefreshCw, Search, Settings2, X } from 'lucide-react';
import type { OfficeSnapshot } from '@/lib/offices/work-service';
import type { TaskInput } from '@/lib/offices/work-policy';
import { officeTimestamp } from '@/lib/offices/work-policy';
import { journalOrder } from '@/lib/offices/reminder-policy';
import { dateKey, parseWorkDateTime, workDateTimeInput } from '@/lib/workzone/date-utils';
import { archiveTaskAction, initializeCategoriesAction, loadOfficeWork, saveCategoryAction, saveTaskAction } from '@/lib/offices/work-actions';
import { officeWorkCopy } from '@/lib/offices/work-copy';
import type { SupportedLanguage } from '@/lib/i18n/language';
import { NotificationEnableButton } from '@/app/(workzone)/workzone/profile/notification-enable-button';
import j from './task-journal.module.css';

type Task=OfficeSnapshot['tasks'][number];
type Result<T>={ok:true;data:T}|{ok:false;error:string};
const copy={
  sq:{journal:'Ditari i detyrave',new:'Detyrë e re',name:'Emri i detyrës',note:'Shënim',optional:'nëse dëshiron',todo:'Për t’u bërë',doing:'Duke u bërë',done:'U krye',high:'Rëndësi e lartë',normal:'Normale',status:'Gjendja',priority:'Rëndësia',reminder:'Më kujto',at:'Data dhe ora',timeHint:'Ora e firmës · Europe/Tirane',reminderHint:'Kujtesa është vetëm për ty. Në iPhone aktivizo njoftimet nga aplikacioni në Home Screen.',activate:'Aktivizo njoftimet',later:'Kujtesa do të aktivizohet pas publikimit.',invalidTime:'Zgjidh një orë të vlefshme, të paktën një minutë më vonë, brenda një viti.',advanced:'Ndarja dhe afati',created:'Krijuar',order:'Të hapurat të parat · rëndësia, pastaj radha e krijimit',empty:'Një vend i qetë për punët e tua.',emptyHint:'Shto detyrën e parë dhe vazhdo një hap pas tjetrit.',open:'Hap detyrën',pending:'Kujtesë e planifikuar',sent:'Njoftimi u dërgua',noDevice:'Pa pajisje aktive për njoftime',failed:'Njoftimi nuk u dërgua · zgjidh një orar të ri',cancelled:'Kujtesa u anulua',private:'Vetëm ti',saved:'U ruajt.',search:'Kërko në ditar',back:'Kthehu te ditari',reopen:'Hape sërish',showNote:'Shto shënim',showReminder:'Shto kujtesë'},
  en:{journal:'Task journal',new:'New task',name:'Task name',note:'Note',optional:'optional',todo:'To do',doing:'In progress',done:'Done',high:'High importance',normal:'Normal',status:'Status',priority:'Importance',reminder:'Remind me',at:'Date and time',timeHint:'Company time · Europe/Tirane',reminderHint:'Only you receive this reminder. On iPhone, enable notifications in the app installed on your Home Screen.',activate:'Enable notifications',later:'Reminders will be enabled after publication.',invalidTime:'Choose a valid time at least one minute ahead, within one year.',advanced:'Sharing and due date',created:'Created',order:'Open first · importance, then creation order',empty:'A quiet place for your work.',emptyHint:'Add your first task and take it one step at a time.',open:'Open task',pending:'Reminder scheduled',sent:'Notification sent',noDevice:'No active notification device',failed:'Notification not sent · choose a new time',cancelled:'Reminder cancelled',private:'Only you',saved:'Saved.',search:'Search your journal',back:'Back to journal',reopen:'Reopen',showNote:'Add note',showReminder:'Add reminder'},
};

function taskInput(t:Task):TaskInput {
  return {id:t.id,version:t.version,kind:t.kind as TaskInput['kind'],title:t.title,body:t.body,status:t.status as TaskInput['status'],ownerId:t.ownerId,categoryId:t.categoryId,priority:t.priority as TaskInput['priority'],dueDate:t.dueDate};
}

/** Native date picker plus explicit clock segments: no device-timezone parsing. */
function ReminderClock({value,onChange,disabled,lang}:{value:string;onChange:(v:string)=>void;disabled:boolean;lang:SupportedLanguage}) {
  const sq=lang==='sq',today=dateKey(new Date());
  const tomorrow=new Date(Date.parse(`${today}T12:00:00Z`)+86400000).toISOString().slice(0,10);
  const [day='',clock='09:00']=value.split('T'),[hour='09',minute='00']=clock.split(':');
  const pick=(d=day,h=hour,m=minute)=>onChange(d?`${d}T${h}:${m}`:'');
  return <div className={j.clockPicker}>
    <div className={j.chips}>{[[today,sq?'Sot':'Today'],[tomorrow,sq?'Nesër':'Tomorrow']].map(([key,label])=><button type="button" key={key} disabled={disabled} aria-pressed={day===key} onClick={()=>pick(key)}>{label}</button>)}</div>
    <label className={j.datePart}>{sq?'Data':'Date'}<input type="date" required disabled={disabled} value={day} onChange={e=>pick(e.target.value)}/></label>
    <div className={j.timeParts}><label>{sq?'Ora':'Hour'}<select disabled={disabled} value={hour} onChange={e=>pick(day||today,e.target.value)}>{Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(h=><option key={h}>{h}</option>)}</select></label><span aria-hidden="true">:</span><label>{sq?'Minuta':'Minute'}<select disabled={disabled} value={minute} onChange={e=>pick(day||today,hour,e.target.value)}>{Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m}>{m}</option>)}</select></label></div>
  </div>;
}

export function OfficeTaskJournal({data,onData,lang,initialTask}:{data:OfficeSnapshot;onData:(data:OfficeSnapshot)=>void;lang:SupportedLanguage;initialTask?:string}) {
  const c=officeWorkCopy(lang),t=copy[lang==='sq'?'sq':'en'];
  const [busy,start]=useTransition(),[feedback,setFeedback]=useState(''),[error,setError]=useState('');
  const [search,setSearch]=useState(''),[filter,setFilter]=useState('all');
  const [selected,setSelected]=useState<string|null>(initialTask??null),[edit,setEdit]=useState<TaskInput|null>(null);
  const [noteOpen,setNoteOpen]=useState(false),[reminderOpen,setReminderOpen]=useState(false),[when,setWhen]=useState('');
  const [sharing,setSharing]=useState(false),[confirmed,setConfirmed]=useState(false);
  const [category,setCategory]=useState<{id:string|null;name:string;archive:boolean}>({id:null,name:'',archive:false});
  const openingButton=useRef<HTMLButtonElement|null>(null),titleRef=useRef<HTMLInputElement|null>(null);
  const labels={NOTE:c.note,PERSONAL:c.personal,COMPANY:c.company,TODO:t.todo,DOING:t.doing,DONE:t.done};
  const name=(id:string)=>data.people.find(p=>p.id===id)?.name??'—';
  const current=data.tasks.find(x=>x.id===selected);
  function fail(code:string){setError(code==='CONFLICT'?c.conflict:code==='DENIED'||code==='NOT_FOUND'?c.denied:code==='INVALID'?c.invalid:code==='LIMIT'?c.limit:c.failed);}
  function run<T,>(action:()=>Promise<Result<T>>,done?:(value:T)=>void) {
    setError('');setFeedback('');start(async()=>{try{
      const r=await action();if(!r.ok){fail(r.error);return;}
      const fresh=await loadOfficeWork();if(fresh.ok){onData(fresh.data);done?.(r.data);setFeedback(t.saved);}else fail(fresh.error);
    }catch{setError(c.failed);}});
  }
  function close(){setEdit(null);setSelected(null);setError('');requestAnimationFrame(()=>openingButton.current?.focus());}
  function openEditor(row?:Task) {
    setError('');setFeedback('');setSharing(false);setConfirmed(false);
    setEdit(row?taskInput(row):{id:crypto.randomUUID(),version:0,kind:'PERSONAL',title:'',body:'',ownerId:data.self,categoryId:null,status:'TODO',priority:'NORMAL',dueDate:null});
    setNoteOpen(!!row?.body);
    const reminder=row?.reminders[0];
    setReminderOpen(!!reminder&&reminder.status!=='CANCELLED');
    setWhen(reminder&&reminder.status!=='CANCELLED'?workDateTimeInput(new Date(reminder.remindAt)):'');
    requestAnimationFrame(()=>titleRef.current?.focus());
  }
  function submit(e:FormEvent) {
    e.preventDefault();if(!edit||sharing&&!confirmed)return;
    if(reminderOpen&&data.remindersEnabled&&edit.kind!=='NOTE'&&edit.status!=='DONE'&&!when){setError(t.invalidTime);return;}
    let reminderAt:string|null|undefined;
    const old=data.tasks.find(x=>x.id===edit.id)?.reminders[0];
    if(reminderOpen&&when&&edit.status!=='DONE'&&edit.kind!=='NOTE') {
      const date=parseWorkDateTime(when);
      if(!date||date.getTime()-Date.now()<60_000&&date.getTime()!==new Date(old?.remindAt??0).getTime()){setError(t.invalidTime);return;}
      reminderAt=date.toISOString();
    }else if(old||reminderOpen)reminderAt=null;
    run(()=>saveTaskAction({...edit,...(reminderAt!==undefined?{reminderAt}:{})}),({id})=>{setEdit(null);setSelected(id);});
  }
  const rows=journalOrder(data.tasks.filter(row=>(filter==='archive'?!!row.archivedAt:!row.archivedAt)
    &&(filter==='all'||filter==='archive'||filter==='today'&&row.dueDate===dateKey(new Date())||row.kind===filter||row.status===filter||row.categoryId===filter)
    &&`${row.title} ${row.body}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  const reminderLabel=(status:string)=>status==='SENT'?t.sent:status==='NO_DEVICE'?t.noDevice:status==='FAILED'?t.failed:status==='CANCELLED'?t.cancelled:t.pending;
  const reminder=current?.reminders[0];
  return <div className={j.journal} data-testid="office-task-journal" aria-busy={busy}>
    <div className={j.feedback} role="status" aria-live="polite" data-error={!!error}>{busy?c.loading:error||feedback}</div>
    {edit?<form className={j.sheet} onSubmit={submit} data-testid="task-composer">
      <div className={j.sheetTop}><button type="button" onClick={close} disabled={busy}><ArrowLeft size={17}/>{t.back}</button><span><LockKeyhole size={13}/>{edit.kind==='COMPANY'?c.shared:t.private}</span></div>
      <fieldset disabled={busy}>
        <label className={j.titleLabel}>{t.name}<input ref={titleRef} required maxLength={160} placeholder={t.new} value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})}/></label>
        {edit.kind!=='NOTE'&&<div className={j.choices}>
          <div role="group" aria-label={t.status}><span>{t.status}</span><div className={j.chips}>{(['TODO','DOING',...(edit.version?['DONE']:[])] as TaskInput['status'][]).map(k=><button type="button" key={k} aria-pressed={edit.status===k} data-tone={k==='DONE'?'green':'teal'} onClick={()=>setEdit({...edit,status:k})}>{k==='DOING'?<Clock3 size={15}/>:k==='DONE'?<Check size={15}/>:<Circle size={15}/>}{labels[k]}</button>)}</div></div>
          <div role="group" aria-label={t.priority}><span>{t.priority}</span><div className={j.chips}>{(['NORMAL','HIGH'] as const).map(k=><button type="button" key={k} aria-pressed={edit.priority===k} data-tone={k==='HIGH'?'amber':'teal'} onClick={()=>setEdit({...edit,priority:k})}>{k==='HIGH'?<Flag size={15}/>:<span className={j.smallDot}/>}{k==='HIGH'?t.high:t.normal}</button>)}</div></div>
        </div>}
        <div className={j.optionalActions}>
          <button type="button" aria-expanded={noteOpen} onClick={()=>setNoteOpen(!noteOpen)}><Pencil size={15}/>{t.showNote}</button>
          {edit.kind!=='NOTE'&&<button type="button" aria-expanded={reminderOpen} onClick={()=>{if(!reminderOpen&&!when)setWhen(workDateTimeInput(new Date(Date.now()+3600_000)));setReminderOpen(!reminderOpen);}}><Bell size={15}/>{t.showReminder}</button>}
        </div>
        {noteOpen&&<label>{t.note}<textarea rows={3} maxLength={8000} placeholder={t.optional} value={edit.body} onChange={e=>setEdit({...edit,body:e.target.value})}/></label>}
        {reminderOpen&&edit.kind!=='NOTE'&&<div className={j.reminder}>
          <div><BellRing size={18}/><strong>{t.reminder}</strong><small>{t.timeHint}</small></div>
          {data.remindersEnabled?<ReminderClock value={when} onChange={setWhen} disabled={edit.status==='DONE'} lang={lang}/>:<p>{t.later}</p>}
          <p>{t.reminderHint}</p>
          <NotificationEnableButton/>
          <button type="button" className={j.quiet} onClick={()=>{setWhen('');setReminderOpen(false);}}><X size={14}/>{c.cancel}</button>
        </div>}
        <details className={j.advanced} open={edit.kind==='COMPANY'||sharing||undefined}>
          <summary><Settings2 size={15}/>{t.advanced}</summary>
          <div className={j.formGrid}>
            <label>{c.type}<select value={edit.kind} disabled={data.tasks.find(x=>x.id===edit.id)?.kind==='COMPANY'} onChange={e=>{const kind=e.target.value as TaskInput['kind'];setSharing(edit.version>0&&kind==='COMPANY'&&data.tasks.find(x=>x.id===edit.id)?.kind!=='COMPANY');setConfirmed(false);setEdit({...edit,kind,ownerId:kind==='COMPANY'?edit.ownerId:data.self,categoryId:kind==='COMPANY'?edit.categoryId:null});}}><option value="PERSONAL">{c.personal}</option><option value="NOTE">{c.note}</option><option value="COMPANY">{c.company}</option></select></label>
            {edit.kind!=='NOTE'&&<label>{c.due}<input type="date" value={edit.dueDate??''} onChange={e=>setEdit({...edit,dueDate:e.target.value||null})}/></label>}
            {edit.kind==='COMPANY'&&<><label>{c.category}<select required value={edit.categoryId??''} onChange={e=>setEdit({...edit,categoryId:e.target.value||null})}><option value="">{c.choose}</option>{!data.categories.some(x=>x.name==='Tjetër'&&!x.archivedAt)&&<option value="OTHER">{lang==='sq'?'Tjetër':'Other'}</option>}{data.categories.filter(x=>!x.archivedAt||x.id===edit.categoryId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>{c.person}<select value={edit.ownerId} onChange={e=>setEdit({...edit,ownerId:e.target.value})}>{data.people.filter(p=>data.manager||p.id===data.self||p.id===edit.ownerId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></>}
          </div>
          {edit.kind==='COMPANY'&&<p>{c.companyHint}</p>}
          {sharing&&<label className={j.confirm}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{c.shareConfirm}</label>}
        </details>
        <div className={j.sheetBottom}><span><LockKeyhole size={13}/>{edit.kind==='COMPANY'?c.shared:t.private}</span><button className={j.primary} disabled={sharing&&!confirmed}>{edit.version?<Check size={17}/>:<Plus size={17}/>} {edit.version?c.save:c.newTask}</button></div>
      </fieldset>
    </form>:current?<article className={`${j.sheet} ${j.detail}`} data-testid="task-detail" data-done={current.status==='DONE'}>
      <div className={j.sheetTop}><button autoFocus onClick={close}><ArrowLeft size={17}/>{t.back}</button><span>{current.kind==='COMPANY'?c.shared:t.private}</span></div>
      <div className={j.detailMeta}><span className={j.status} data-state={current.status}>{current.status==='DONE'?<CheckCheck size={15}/>:current.status==='DOING'?<Clock3 size={15}/>:<Circle size={15}/>}{labels[current.status as TaskInput['status']]}</span>{current.priority==='HIGH'&&<span className={j.importance}><Flag size={14}/>{t.high}</span>}</div>
      <h2>{current.title}</h2>
      {current.kind==='COMPANY'&&<p className={j.meta}>{name(current.ownerId)} · {data.categories.find(x=>x.id===current.categoryId)?.name}</p>}
      {current.body&&<p className={j.note}>{current.body}</p>}
      {current.dueDate&&<p className={j.meta}><CalendarDays size={15}/>{c.due} · {current.dueDate.split('-').reverse().join('.')}</p>}
      {reminder&&<p className={j.reminderState}><Bell size={15}/><span>{reminderLabel(reminder.status)}<small>{officeTimestamp(reminder.remindAt)}</small></span></p>}
      <p className={j.created}>{t.created} · {officeTimestamp(current.createdAt)}</p>
      <div className={j.detailActions}>
        {!current.archivedAt&&current.kind!=='NOTE'&&<button className={j.primary} disabled={busy} onClick={()=>run(()=>saveTaskAction({...taskInput(current),status:current.status==='DONE'?'TODO':'DONE'}))}><CheckCheck size={18}/>{current.status==='DONE'?t.reopen:t.done}</button>}
        {!current.archivedAt&&current.kind==='NOTE'&&<button className={j.primary} disabled={busy} onClick={()=>run(()=>saveTaskAction({...taskInput(current),kind:'PERSONAL',status:'TODO'}))}><Check size={17}/>{c.toTask}</button>}
        {!current.archivedAt&&<button disabled={busy} onClick={()=>openEditor(current)}><Pencil size={15}/>{c.edit}</button>}
        <button className={j.quiet} disabled={busy} onClick={()=>run(()=>archiveTaskAction({id:current.id,version:current.version,restore:!!current.archivedAt}),close)}>{current.archivedAt?<RefreshCw size={15}/>:<Archive size={15}/>} {current.archivedAt?c.restore:c.archive}</button>
      </div>
    </article>:<>
      <div className={j.toolbar}><label className={j.search}><Search size={16}/><input type="search" aria-label={t.search} placeholder={t.search} value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label={c.tasks} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{c.all}</option><option value="today">{c.today}</option>{(['NOTE','PERSONAL','COMPANY','TODO','DOING','DONE'] as const).map(k=><option key={k} value={k}>{labels[k]}</option>)}{data.categories.filter(x=>!x.archivedAt).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}<option value="archive">{c.archived}</option></select><button className={j.primary} onClick={e=>{openingButton.current=e.currentTarget;openEditor();}}><Plus size={17}/>{c.newTask}</button></div>
      <p className={j.order}>{t.order}</p>
      <div className={j.cards} data-testid="task-cards">
        {rows.map(row=><button key={row.id} className={j.card} data-priority={row.priority} data-done={row.status==='DONE'} onClick={e=>{openingButton.current=e.currentTarget;setSelected(row.id);setError('');setFeedback('');}} aria-label={`${t.open}: ${row.title}`}>
          <span className={j.cardTop}><span className={j.status} data-state={row.status}>{row.kind==='NOTE'?<FileText size={14}/>:row.status==='DONE'?<CheckCheck size={14}/>:row.status==='DOING'?<Clock3 size={14}/>:<Circle size={14}/>}{row.kind==='NOTE'?c.note:labels[row.status as TaskInput['status']]}</span>{row.priority==='HIGH'&&<span className={j.flag} aria-label={t.high}><Flag size={15}/></span>}</span>
          <strong>{row.title}</strong>
          {row.body&&<span className={j.preview}>{row.body}</span>}
          <span className={j.cardFoot}><span>{row.kind==='COMPANY'?name(row.ownerId):t.private}{row.reminders[0]?.status==='PENDING'&&<Bell size={13} aria-label={t.pending}/>}</span><ArrowUpRight size={16}/></span>
        </button>)}
        {rows.length===0&&<div className={j.empty}><FileText size={26}/><strong>{t.empty}</strong><p>{t.emptyHint}</p><button className={j.primary} onClick={()=>openEditor()}><Plus size={16}/>{c.newTask}</button></div>}
      </div>
      {data.manager&&<details className={j.advanced}><summary><Settings2 size={15}/>{c.categories}</summary><p>{c.companyHint}</p>{data.categories.length===0?<button disabled={busy} onClick={()=>run(initializeCategoriesAction)}>{c.setup}</button>:<div className={j.chips}>{data.categories.map(x=><button key={x.id} onClick={()=>setCategory({id:x.id,name:x.name,archive:!!x.archivedAt})}>{x.name}{x.archivedAt&&` · ${c.archived}`}<Pencil size={13}/></button>)}</div>}<form onSubmit={e=>{e.preventDefault();run(()=>saveCategoryAction(category),()=>setCategory({id:null,name:'',archive:false}));}}><label>{c.categoryName}<input required maxLength={100} value={category.name} onChange={e=>setCategory({...category,name:e.target.value})}/></label>{category.id&&<label className={j.confirm}><input type="checkbox" checked={category.archive} onChange={e=>setCategory({...category,archive:e.target.checked})}/>{c.archive}</label>}<div className={j.chips}><button disabled={busy}>{category.id?c.save:c.addCategory}</button>{category.id&&<button type="button" onClick={()=>setCategory({id:null,name:'',archive:false})}>{c.cancel}</button>}</div></form></details>}
    </>}
  </div>;
}
