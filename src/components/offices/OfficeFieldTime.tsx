'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ArrowLeft, Check, Play, RefreshCw, Square, Users } from 'lucide-react';
import type { FieldTimeSnapshot } from '@/lib/offices/field-time';
import { changeFieldTimeAction, loadFieldTimeAction } from '@/lib/offices/work-actions';
import { FieldTimeConfirm, type FieldTimeConfirmation } from './FieldTimeConfirm';
import { officeTimestamp } from '@/lib/offices/work-policy';
import s from './work.module.css';
import glass from './surfaces.module.css';
import t from './team-time.module.css';
export function OfficeFieldTime({initial,sq}:{initial:FieldTimeSnapshot;sq:boolean}){
  const opener=useRef<HTMLButtonElement>(null);
  function closeConfirm(){setConfirm(null);requestAnimationFrame(()=>opener.current?.focus({preventScroll:true}));}
  const [data,setData]=useState(initial),[command,setCommand]=useState<'start'|'stop'>('start'),[search,setSearch]=useState('');
  const [selected,setSelected]=useState<Record<string,string|null>>({}),[confirm,setConfirm]=useState<FieldTimeSnapshot['workers']|null>(null),[notice,setNotice]=useState(''),[errors,setErrors]=useState<Record<string,string>>({}),[busy,start]=useTransition();
  const rows=data.workers.filter(w=>w.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const eligible=rows.filter(w=>command==='start'?w.canStart:w.canStop),ids=Object.keys(selected),all=eligible.length>0&&eligible.every(w=>w.id in selected);
  useEffect(()=>{const timer=setInterval(async()=>{if(document.visibilityState!=='visible')return;try{const r=await loadFieldTimeAction();if(r.ok)setData(r.data);}catch{/* keep the last successful snapshot */}},30_000);return()=>clearInterval(timer);},[]);
  function refresh(){start(async()=>{const r=await loadFieldTimeAction();if(r.ok)setData(r.data);else setNotice(sq?'Nuk u rifreskua. Kontrollo hyrjen.':'Could not refresh. Check your access.');});}
  function toggle(id:string,sessionId:string|null){setSelected(old=>{const next={...old};if(id in next)delete next[id];else if(Object.keys(next).length<100)next[id]=sessionId;return next;});setNotice('');}
  function commit(workers:FieldTimeConfirmation){
    setNotice('');setErrors({});
    start(async()=>{
      try{
        const r=await changeFieldTimeAction({command,workers});
        if(!r.ok){setNotice(sq?'Nuk u krye. Rifresko dhe kontrollo përzgjedhjen.':'Not completed. Refresh and check the selection.');return;}
        const succeeded=r.data.results.filter(x=>x.ok),failed=r.data.results.filter(x=>!x.ok);
        const warnings=r.data.results.filter(x=>x.ok&&'preferenceSaved' in x&&!x.preferenceSaved);
        setSelected(old=>Object.fromEntries(Object.entries(old).filter(([id])=>!succeeded.some(x=>x.workerId===id))));
        setErrors(Object.fromEntries([...failed.map(x=>[x.workerId,x.message==='CLOCK'?(sq?'Ora ose orari ndryshoi. Kontrollo orën për këtë person.':'Time or schedule changed. Review this person.'):['CONFLICT','DENIED','FAILED'].includes(x.message)?(sq?'Gjendja ose leja ndryshoi. Rifresko.':'State or access changed. Refresh.'):x.message]),...warnings.map(x=>[x.workerId,sq?'Ora u regjistrua; zgjedhja e orarit nuk u ruajt.':'Time recorded; schedule preference was not saved.'])]));
        setNotice(`${succeeded.length} ${sq?'u regjistruan':'recorded'}${failed.length?` · ${failed.length} ${sq?'nuk u kryen; shiko personat':'not completed; review people'}`:''}${warnings.length?` · ${sq?'Zgjedhja e orarit nuk u ruajt për disa persona. Orët u regjistruan.':'Some schedule choices were not saved. Times were recorded.'}`:''}`);
        setConfirm(null);
        const fresh=await loadFieldTimeAction();if(fresh.ok)setData(fresh.data);
      }catch{setConfirm(null);setNotice(sq?'Lidhja u ndërpre. Rifresko për të parë cilët u regjistruan para se të provosh përsëri.':'Connection interrupted. Refresh to check who was recorded before retrying.');}
    });
  }
  return <section className={`${s.workspace} ${t.panel}`} aria-busy={busy} data-app-update-blocked={busy||ids.length>0} data-testid="office-field-time">
    <nav className={`${s.nav} ${glass.backNav}`}><Link href="/workzone/offices/me"><ArrowLeft size={17}/>{sq?'Zyra ime':'My office'}</Link><Link href="/workzone/offices">{sq?'Recepsioni':'Reception'}</Link></nav>
    <header className={s.header}><div><p className={s.overline}>{sq?'EKIPI I TERRENIT':'FIELD TEAM'}</p><h1><Users size={22}/> {sq?'Nis / Ndalo punën':'Start / Stop work'}</h1><p>{sq?'Zgjidh personat dhe regjistro veprimin. Kantieri merret nga plani; orët ruhen në profilin e secilit.':'Select people and record the action. The site follows the plan; hours stay in each person’s profile.'}</p></div><button className={s.icon} disabled={busy} onClick={refresh} aria-label={sq?'Rifresko':'Refresh'}><RefreshCw size={18}/></button></header>
    {!confirm&&<><div className={t.controls}><div className={t.mode} aria-label={sq?'Veprimi':'Action'}>{(['start','stop'] as const).map(mode=><button type="button" key={mode} disabled={busy} aria-pressed={command===mode} onClick={()=>{setCommand(mode);setSelected({});setErrors({});setNotice('');}}>{mode==='start'?<Play size={15}/>:<Square size={15}/>} {mode==='start'?(sq?'Nis':'Start'):(sq?'Ndalo':'Stop')}</button>)}</div><input type="search" aria-label={sq?'Kërko punëtor':'Find worker'} placeholder={sq?'Kërko punëtor…':'Find worker…'} value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <div className={t.selection}><label><input type="checkbox" disabled={busy||!eligible.length} checked={all} onChange={()=>{setSelected(old=>{const next={...old};if(all)eligible.forEach(w=>delete next[w.id]);else eligible.forEach(w=>{if(Object.keys(next).length<100)next[w.id]=w.session?.id??null;});return next;});setNotice('');}}/>{sq?'Zgjidh të gjithë':'Select all'} <small>({eligible.length})</small></label>{ids.length>0&&<button type="button" disabled={busy} onClick={()=>{setSelected({});setErrors({});setNotice('');}}>{sq?'Pastro':'Clear'}</button>}</div></>}
    {!confirm&&<footer className={t.commit}><button ref={opener} type="button" className={s.primary} disabled={busy||!ids.length} onClick={()=>{setNotice('');setErrors({});setConfirm(data.workers.filter(w=>w.id in selected).map(w=>({...w,session:w.session?{...w.session,id:selected[w.id]!}:null})));}}>{command==='start'?<Play size={16}/>:<Square size={16}/>} {command==='start'?(sq?'Nis të zgjedhurit':'Start selected'):(sq?'Ndalo të zgjedhurit':'Stop selected')} · {ids.length}</button></footer>}
    {confirm&&<FieldTimeConfirm people={confirm} command={command} sq={sq} busy={busy} onCancel={closeConfirm} onConfirm={commit}/>}
    <p className={s.feedback} role="status" aria-live="polite">{notice}</p>
    {!confirm&&<div className={t.grid}>{rows.map(w=>{const enabled=command==='start'?w.canStart:w.canStop;return <label key={w.id} className={t.person} data-selected={w.id in selected} data-disabled={!enabled}><input type="checkbox" disabled={busy||!enabled} checked={w.id in selected} onChange={()=>toggle(w.id,w.session?.id??null)} aria-label={w.name}/><span><strong>{w.name}</strong><small className={w.session?.place==='field'?t.live:undefined}>{w.session?.place==='office'?(sq?'Në zyrë':'In office'):w.session?.place==='workshop'?(sq?'Në oficinë / fabrikë':'In workshop / factory'):w.session?(sq?'Në punë':'Working'):(sq?'Pa punë aktive':'Not working')}{!w.available&&!w.session?` · ${sq?'Jo në dispozicion':'Unavailable'}`:''}</small><small>{w.session?.site??(w.session?.place==='field'?(sq?'Pa kantier të regjistruar':'No recorded site'):!w.session?(w.plannedSite?`${sq?'Plani':'Plan'} · ${w.plannedSite}`:(sq?'Pa kantier në plan':'No site in plan')):'')}{w.session?` · ${officeTimestamp(w.session.start)}`:''}</small>{errors[w.id]&&<small role="alert" className={t.error}>{errors[w.id]}</small>}</span>{w.id in selected&&<Check size={16}/>}</label>;})}</div>}
    <p className={s.hint}>{sq?'Deri 100 persona për veprim. Zyrat dhe oficina mbeten jashtë këtij veprimi.':'Up to 100 people per action. Office and workshop sessions are excluded.'}</p>
  </section>;
}
