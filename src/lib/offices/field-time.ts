import { withRealtimeBatch } from '@/lib/realtime/event-hub';
import { z } from 'zod';
import { withTenantContext } from '@/lib/db/tenant-context';
import { officeActor, OfficeError } from './work-access';
import { FIELD_CREW_ROLES, fieldTimeDelegate, fieldTimeTarget } from '@/lib/workzone/field-attendance-access';
import { dateKey, dayRange, parseWorkDateTime } from '@/lib/workzone/date-utils';
import { siteFromSavedRows } from '@/lib/workzone/plan-site-rule';
import { startWorkerSessionAction, stopWorkerSessionAction } from '@/app/(workzone)/workzone/hr-actions';
import { plannedSteelSchedule } from '@/lib/workzone/planned-schedule';
import { isSteelCompany } from '@/lib/dashboard/steel-access';
import { fieldClockTime } from './field-time-clock';

async function fieldActor(){
  const actor=await officeActor();
  if(actor.kind!=='admin'&&!await withTenantContext(actor.companyId,tx=>fieldTimeDelegate(tx,actor.companyId,actor.id)))throw new OfficeError('DENIED');
  return actor;
}
export async function canUseFieldTime(){
  try{await fieldActor();return true;}catch(e){if(e instanceof OfficeError)return false;throw e;}
}
/** Minimal clock metadata only. This grant does not open profiles or site documents. */
export async function fieldTimeSnapshot(){
  const actor=await fieldActor(),now=new Date(),planDate=dayRange(dateKey(now)).start;
  const steel=await isSteelCompany(actor.companyId);
  return withTenantContext(actor.companyId,async tx=>{
    const [workers,plan,sites,sessions,company]=await Promise.all([
      tx.worker.findMany({where:{companyProfileId:actor.companyId,status:'active',crewRole:{in:FIELD_CREW_ROLES}},select:{id:true,firstName:true,lastName:true,availability:true,crewRole:true,fieldTimeScheduled:true},orderBy:[{firstName:'asc'},{lastName:'asc'},{id:'asc'}],take:500}),
      tx.dailyWorkPlan.findUnique({where:{companyProfileId_planDate:{companyProfileId:actor.companyId,planDate}},select:{savedRows:{select:{workerNames:true,baustelleName:true}},columns:{select:{baustelleId:true,baustelle:{select:{status:true}},assignments:{select:{workerId:true}}}}}}),
      tx.baustelle.findMany({where:{companyProfileId:actor.companyId,status:'active'},select:{id:true,name:true,type:true}}),
      tx.workSession.findMany({where:{isLive:true,endTime:null,worker:{companyProfileId:actor.companyId,status:'active',crewRole:{in:FIELD_CREW_ROLES}}},select:{id:true,workerId:true,startTime:true,breakMinutes:true,workplace:true,baustelle:{select:{id:true,name:true,type:true}}},orderBy:{startTime:'desc'},take:500}),
      tx.companyProfile.findUnique({where:{id:actor.companyId},select:{country:true}}),
    ]);
    return {at:now.toISOString(),workers:workers.map(w=>{
      const live=sessions.find(s=>s.workerId===w.id),name=`${w.firstName} ${w.lastName}`.trim();
      const column=plan?.columns.find(c=>c.baustelleId&&c.baustelle?.status==='active'&&c.assignments.some(a=>a.workerId===w.id));
      const saved=plan?siteFromSavedRows(plan.savedRows,name,sites):null;
      const planned=sites.find(s=>s.id===(column?.baustelleId??saved?.id));
      const field=live?!live.workplace&&live.baustelle?.type!=='STEEL_WORKSHOP':planned?.type!=='STEEL_WORKSHOP';
      return {id:w.id,name,scheduled:w.fieldTimeScheduled,schedule:plannedSteelSchedule(w.crewRole,steel&&company?.country==='AL'),available:w.availability==='AVAILABLE',session:live?{id:live.id,start:live.startTime.toISOString(),breakMinutes:live.breakMinutes,place:live.workplace==='OFFICE'?'office':live.workplace==='WORKSHOP'||live.baustelle?.type==='STEEL_WORKSHOP'?'workshop':'field',site:live.baustelle?.name??null}:null,plannedSite:planned?.name??null,canStart:!live&&w.availability==='AVAILABLE'&&field,canStop:!!live&&field};
    })};
  });
}
export type FieldTimeSnapshot=Awaited<ReturnType<typeof fieldTimeSnapshot>>;
const batchInput=z.object({command:z.enum(['start','stop']),at:z.string().max(40).optional(),workers:z.array(z.object({workerId:z.string().min(1).max(128),sessionId:z.string().min(1).max(128).nullable(),clock:z.object({mode:z.enum(['now','manual','schedule']),at:z.string().max(40).optional()}).strict().optional(),preference:z.object({value:z.boolean(),expected:z.boolean()}).strict().optional()}).strict()).min(1).max(100)}).strict().refine(v=>new Set(v.workers.map(w=>w.workerId)).size===v.workers.length);

async function rememberSchedule(actor:Awaited<ReturnType<typeof fieldActor>>,workerId:string,value:boolean,expected:boolean){
  return withTenantContext(actor.companyId,async tx=>{
    // Same lock order as the original clock. Recheck delegation and tenant after
    // recording; losing permission must not allow a subsequent preference write.
    await tx.$queryRaw`SELECT id FROM "Worker" WHERE id=${workerId} AND "companyProfileId"=${actor.companyId} FOR UPDATE`;
    if(actor.kind!=='admin'&&!await fieldTimeDelegate(tx,actor.companyId,actor.id)||!await fieldTimeTarget(tx,actor.companyId,workerId))return false;
    const changed=await tx.worker.updateMany({where:{id:workerId,companyProfileId:actor.companyId,fieldTimeScheduled:expected},data:{fieldTimeScheduled:value}});
    if(!changed.count)return false;
    await tx.auditLog.create({data:{companyProfileId:actor.companyId,actorType:actor.kind==='admin'?'ADMIN':'WORKER',actorId:actor.id,action:'office.field_time.schedule_preference',payload:{workerId,value,previous:expected}}});
    return true;
  });
}
/** Each person commits independently through the existing clock rules. A partial
 * result stays partial, and a stale stop can never close a replacement session. */
export async function changeFieldTime(raw:unknown){
  const input=batchInput.parse(raw),now=new Date(),legacyAt=input.at?parseWorkDateTime(input.at):now;
  if(!legacyAt||legacyAt.getTime()>now.getTime()+60_000)throw new OfficeError('INVALID');
  const actor=await fieldActor(),snapshot=await fieldTimeSnapshot();
  return withRealtimeBatch(actor.companyId,async()=>{
  const results=[];
  for(const selected of input.workers){
    try{
      const current=snapshot.workers.find(w=>w.id===selected.workerId);
      if(!current||input.command==='start'&&(!current.canStart||selected.sessionId!==null)||input.command==='stop'&&(!current.canStop||current.session?.id!==selected.sessionId)){
        results.push({workerId:selected.workerId,ok:false,message:'CONFLICT'});continue;
      }
      const at=selected.clock?fieldClockTime(selected.clock,input.command,current.schedule,current.session?.start??null,now):legacyAt;
      if(!at||selected.preference&&(selected.preference.expected!==current.scheduled||selected.preference.value&&!current.schedule)){
        results.push({workerId:selected.workerId,ok:false,message:'CLOCK'});continue;
      }
      const result=input.command==='start'
        ?await startWorkerSessionAction({workerId:selected.workerId,startTime:at.toISOString(),fieldOnly:true})
        :await stopWorkerSessionAction({sessionId:selected.sessionId!,endTime:at.toISOString(),breakMinutes:current.session!.breakMinutes,fieldOnly:true});
      // A clock success is never reported as failed merely because remembering
      // the choice failed: retrying a successful stop/start could lose hours.
      let preferenceSaved=true;
      if(result.ok&&selected.preference&&selected.preference.value!==selected.preference.expected){
        try{preferenceSaved=await rememberSchedule(actor,selected.workerId,selected.preference.value,selected.preference.expected);}catch{preferenceSaved=false;}
      }
      results.push({workerId:selected.workerId,ok:result.ok,message:result.message??'',preferenceSaved});
    }catch(e){results.push({workerId:selected.workerId,ok:false,message:e instanceof OfficeError?e.code:'FAILED'});}
  }
  return {results};
  });
}
