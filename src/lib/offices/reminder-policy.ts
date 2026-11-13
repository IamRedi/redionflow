import { officeSeat } from './policy';

/** A background worker has no request identity. Only this explicit installation is eligible. */
export function reminderCompany(env:Readonly<Record<string,string|undefined>>=process.env):string|null {
  // The restricted local RLS rollout has no notification grants.
  if(['true','1','yes'].includes(env.RLS_ENFORCE?.trim().toLowerCase()||''))return null;
  if(env.OFFICE_TASK_REMINDERS_ENABLED!=='true'||env.VIRTUAL_OFFICE_ENABLED!=='true'||env.VIRTUAL_OFFICE_WORK_ENABLED!=='true')return null;
  const companyId=env.INSTALLATION_COMPANY_ID?.trim();
  if(!companyId)return null;
  try {
    const config=JSON.parse(env.VIRTUAL_OFFICE_ACCESS_JSON||'');
    return officeSeat(env.VIRTUAL_OFFICE_ACCESS_JSON,{kind:'admin',id:config.megi?.adminId,companyId})==='megi'?companyId:null;
  } catch {return null;}
}
export const MAX_REMINDER_AHEAD_MS=366*24*60*60*1000;
export function validReminderTime(value:Date,now=new Date()) {
  const delta=value.getTime()-now.getTime();
  return Number.isFinite(delta)&&delta>=30_000&&delta<=MAX_REMINDER_AHEAD_MS;
}
export function reminderOutcome(sent:number,failed:number,attempts:number) {
  return sent>0?'SENT':failed===0?'NO_DEVICE':attempts>=3?'FAILED':'PENDING';
}
/** Stable oldest-first within importance; edits never move a card to a new date. */
export function journalOrder<T extends {id:string;priority:string;status:string;createdAt:Date|string}>(rows:readonly T[]):T[] {
  return [...rows].sort((a,b)=>Number(a.status==='DONE')-Number(b.status==='DONE')
    ||Number(b.priority==='HIGH')-Number(a.priority==='HIGH')
    ||new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime()||a.id.localeCompare(b.id));
}
