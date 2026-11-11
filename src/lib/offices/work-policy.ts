import { z } from 'zod';

export const taskKinds = ['NOTE','PERSONAL','COMPANY'] as const;
export const taskStatuses = ['TODO','DOING','DONE'] as const;
export const officeTaskInput = z.object({
  id:z.uuid(), version:z.number().int().min(0), kind:z.enum(taskKinds),
  title:z.string().trim().min(1).max(160), body:z.string().trim().max(8000),
  ownerId:z.string().min(1).max(128), categoryId:z.union([z.uuid(),z.literal('OTHER')]).nullable(),
  status:z.enum(taskStatuses), priority:z.enum(['NORMAL','HIGH']),
  dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v).nullable(),
}).strict().superRefine((v,ctx)=>{
  if(v.kind==='COMPANY'&&!v.categoryId)ctx.addIssue({code:'custom',message:'Category required'});
  if(v.kind!=='COMPANY'&&v.categoryId)ctx.addIssue({code:'custom',message:'Private work has no shared category'});
});
export type TaskInput=z.infer<typeof officeTaskInput>;
export const INITIAL_OFFICE_CATEGORIES=['Financë · Blerje–Shitje','Modelim · Për oferta','Përpunim · Për prodhim','Projektim · Aplikime Leje / Dosje kantieri','Tender · Aplikime','Tjetër'];
export const MAX_MAIL_FILE_BYTES=5_000_000, MAX_MAIL_TOTAL_BYTES=10_000_000, MAX_MAIL_FILES=3;
export function isThreadParticipant(thread:{senderId:string;recipientId:string},id:string){return thread.senderId===id||thread.recipientId===id;}
export function canReadOfficeTask(task:{kind:string;ownerId:string;createdById?:string},id:string,manager=false){return task.ownerId===id||task.kind==='COMPANY'&&(manager||task.createdById===id);}
export function officeReturn(value:unknown){return value==='reception'?'/workzone/offices':value==='desk'?'/workzone/offices/me':null;}
/** Stable numeric parts avoid Node/browser CLDR text differences during hydration. */
export function officeTimestamp(value:Date|string){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Tirane',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
  const get=(type:string)=>parts.find(p=>p.type===type)?.value??'';
  return `${get('day')}.${get('month')}.${get('year')} · ${get('hour')}:${get('minute')}`;
}
