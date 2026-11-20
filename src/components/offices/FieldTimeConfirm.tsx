'use client';
import { useEffect, useRef, useState } from 'react';
import { Clock3, Play, Square, X } from 'lucide-react';
import type { FieldTimeSnapshot } from '@/lib/offices/field-time';
import { fieldClockTime, type FieldClockChoice } from '@/lib/offices/field-time-clock';
import { REPORT_TIME_ZONE, workDateTimeInput } from '@/lib/workzone/date-utils';
import s from './work.module.css';
import t from './team-time.module.css';

type Person = FieldTimeSnapshot['workers'][number];
export type FieldTimeConfirmation = { workerId: string; sessionId: string | null; clock: FieldClockChoice; preference: { value: boolean; expected: boolean } }[];
export function FieldTimeConfirm({ people, command, sq, busy, onCancel, onConfirm }: {
  people: Person[]; command: 'start' | 'stop'; sq: boolean; busy: boolean;
  onCancel: () => void; onConfirm: (workers: FieldTimeConfirmation) => void;
}) {
  const [now,setNow] = useState(() => new Date());
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus();const timer=setInterval(()=>setNow(new Date()),30_000);return()=>clearInterval(timer);},[]);
  const [time, setTime] = useState(workDateTimeInput(now));
  const [choices, setChoices] = useState<Record<string, FieldClockChoice>>(() => Object.fromEntries(people.map(w => [w.id, { mode: w.scheduled && w.schedule ? 'schedule' : 'now' }])));
  const [preferences, setPreferences] = useState<Record<string, boolean>>(() => Object.fromEntries(people.map(w => [w.id, w.scheduled])));
  const invalid = people.some(w => !fieldClockTime(choices[w.id], command, w.schedule, w.session?.start ?? null, now));
  function group(mode: FieldClockChoice['mode']) {
    setChoices(Object.fromEntries(people.map(w => [w.id, { mode, ...(mode === 'manual' ? { at: time } : {}) }])));
  }
  return <section className={t.clockCard} aria-label={command === 'start' ? (sq ? 'Ora e fillimit' : 'Start time') : (sq ? 'Ora e mbarimit' : 'Finish time')} data-testid="field-time-confirm" onKeyDown={e=>{if(e.key==='Escape'&&!busy){e.preventDefault();e.stopPropagation();onCancel();}}}>
    <header><div><Clock3 size={18}/><h2 ref={heading} tabIndex={-1}>{sq ? (command === 'start' ? 'Kur filloi puna?' : 'Kur mbaroi puna?') : (command === 'start' ? 'When did work start?' : 'When did work finish?')}</h2><small>{people.length} {sq ? 'persona' : 'people'}</small></div><button type="button" className={s.icon} aria-label={sq ? 'Mbyll zgjedhjen e orës' : 'Close time choice'} disabled={busy} onClick={onCancel}><X size={17}/></button></header>
    <div className={t.clockGroup}>
      <button type="button" disabled={busy} onClick={() => group('now')}>{sq ? 'Tani' : 'Now'}</button>
      <button type="button" disabled={busy} onClick={() => group('manual')}>{sq ? 'Vendos orën' : 'Set time'}</button>
      {people.some(w => w.schedule) && <button type="button" disabled={busy} onClick={() => group('schedule')}>{sq ? 'Orari i firmës' : 'Company hours'}</button>}
      <label>{sq ? 'Ora për grupin' : 'Group time'}<input type="datetime-local" value={time} disabled={busy} onChange={e => { const at = e.target.value; setTime(at); setChoices(old => Object.fromEntries(Object.entries(old).map(([id, choice]) => [id, choice.mode === 'manual' ? { mode: 'manual', at } : choice]))); }}/></label>
    </div>
    <p className={s.hint}>{sq ? 'Zgjedhja sipër vlen për grupin. Ndrysho veçmas personin që ka ardhur vonë ose është larguar më herët.' : 'The choice above applies to the group. Override anyone who arrived late or left early.'} · {REPORT_TIME_ZONE}</p>
    <div className={t.clockPeople}>{people.map(w => {
      const choice = choices[w.id], at = fieldClockTime(choice, command, w.schedule, w.session?.start ?? null, now);
      return <div className={t.clockPerson} key={w.id} data-testid="field-clock-person">
        <strong>{w.name}</strong>
        <select aria-label={`${sq ? 'Ora' : 'Time'} · ${w.name}`} disabled={busy} value={choice.mode} onChange={e => setChoices(old => ({ ...old, [w.id]: { mode: e.target.value as FieldClockChoice['mode'], at: time } }))}>
          <option value="now">{sq ? 'Tani' : 'Now'}</option><option value="manual">{sq ? 'Vendos orën' : 'Set time'}</option>
          {w.schedule && <option value="schedule">{sq ? 'Orari i firmës' : 'Company hours'} · {command === 'start' ? w.schedule.start : w.schedule.end}</option>}
        </select>
        {choice.mode === 'manual' && <label className={t.personTime}>{sq ? 'Data dhe ora' : 'Date and time'} · {w.name}<input type="datetime-local" value={choice.at ?? ''} disabled={busy} onChange={e => setChoices(old => ({ ...old, [w.id]: { mode: 'manual', at: e.target.value } }))}/></label>}
        {w.schedule && <label className={t.remember}><input type="checkbox" disabled={busy} checked={preferences[w.id]} onChange={e => { const checked = e.target.checked; setPreferences(old => ({ ...old, [w.id]: checked })); if (checked) setChoices(old => ({ ...old, [w.id]: { mode: 'schedule' } })); }}/>{sq ? 'Kujto orarin e firmës' : 'Remember company hours'} · {w.schedule.start}–{w.schedule.end}</label>}
        {!at && <small role="alert" className={t.error}>{sq ? 'Zgjidh një orë të vlefshme: jo në të ardhmen, para fillimit ose jashtë ditëve të orarit.' : 'Choose a valid time: not in the future, before the start or outside scheduled days.'}</small>}
      </div>;
    })}</div>
    <p className={s.hint}>{sq ? 'Check-i ruhet për personin pas regjistrimit. Nis/Ndalo bëhet vetëm kur konfirmon; orët dhe pushimet ekzistuese ruhen.' : 'The check is remembered per person after recording. Start/Stop only happens when you confirm; existing hours and breaks stay intact.'}</p>
    <div className={t.clockActions}><button type="button" disabled={busy} onClick={onCancel}>{sq ? 'Kthehu' : 'Back'}</button><button type="button" className={s.primary} disabled={busy || invalid} onClick={() => onConfirm(people.map(w => ({ workerId: w.id, sessionId: w.session?.id ?? null, clock: choices[w.id], preference: { value: preferences[w.id], expected: w.scheduled } })))}>{command === 'start' ? <Play size={15}/> : <Square size={15}/>} {busy ? (sq ? 'Duke regjistruar…' : 'Recording…') : command === 'start' ? (sq ? 'Konfirmo Nis' : 'Confirm start') : (sq ? 'Konfirmo Ndalo' : 'Confirm stop')}</button></div>
  </section>;
}
