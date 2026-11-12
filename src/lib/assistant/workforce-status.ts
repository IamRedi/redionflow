import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { fuelTimeZone } from '@/lib/fleet/fuel/time';
import { dayKey } from '@/lib/dashboard/steel-metrics';
import { assistantDayBounds } from './turn-context';
import { categorizeAssistantFailure } from './diagnostics';
import type { RequesterContext } from './requester';

export const workforceStatusInput = z.object({
  state: z.enum(['activity','all','live','working','office','site','factory','paused','stopped','no_live_session','needs_review']).default('activity'),
  workerId: z.string().regex(/^[a-z0-9_-]{1,120}$/i).optional(),
  query: z.string().trim().max(100).optional(),
  cursor: z.string().regex(/^[a-z0-9_-]{1,120}$/i).optional(),
  limit: z.number().int().min(1).max(30).default(20),
}).strict();
type Input = z.input<typeof workforceStatusInput>;
type Status = 'working'|'paused'|'stopped'|'no_live_session'|'needs_review';
type Location = {kind:'office'|'site'|'factory'|'unknown';siteId:string|null;name:string|null};
const failure = (code:string,message:string)=>({ok:false as const,code,message});
const forbidden = ()=>failure('FORBIDDEN','Only a current administrator of this company may read workforce attendance.');

/** One fresh tenant snapshot. Plans, crew roles, login and GPS never establish attendance. */
export async function adminGetWorkforceStatus(requester:RequesterContext,input:Input={}) {
  if(requester.kind!=='admin'||!requester.companyId||!requester.adminId)return forbidden();
  const parsed=workforceStatusInput.safeParse(input);
  if(!parsed.success)return failure('INVALID_INPUT','Use a valid current attendance state, worker search and bounded page.');
  const filters=parsed.data;
  try {
    return await prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id',${requester.companyId},true)`;
      if(!await tx.user.findFirst({where:{id:requester.adminId,companyProfileId:requester.companyId,role:'ADMIN',isActive:true},select:{id:true}}))return forbidden();
      const company=await tx.companyProfile.findUnique({where:{id:requester.companyId},select:{country:true}});
      if(!company)return forbidden();
      const now=new Date(),timeZone=fuelTimeZone(company.country),date=dayKey(now,timeZone),day=assistantDayBounds(date,timeZone)!;
      const tokens=filters.query?.split(/\s+/).filter(Boolean)??[];
      const workerWhere:Prisma.WorkerWhereInput={companyProfileId:requester.companyId,status:'active',...(filters.workerId?{id:filters.workerId}:{}),...(tokens.length?{AND:tokens.map(token=>({OR:[{firstName:{contains:token,mode:'insensitive' as const}},{lastName:{contains:token,mode:'insensitive' as const}}]}))}:{})};
      const workers=await tx.worker.findMany({where:workerWhere,orderBy:{id:'asc'},take:5001,select:{id:true,firstName:true,lastName:true,availability:true}});
      if(workers.length>5000)return failure('SCOPE_TOO_LARGE','Narrow the worker search. No totals or rows were silently clipped.');
      const worker:Prisma.WorkerWhereInput={...workerWhere,id:{in:workers.map(w=>w.id)}};
      const [open,ended]=await Promise.all([
        tx.workSession.findMany({where:{worker,OR:[{endTime:null},{isLive:true},{endTime:{gt:now}},{endTime:{lte:tx.workSession.fields.startTime}}]},take:10001,orderBy:{id:'asc'},select:{id:true,workerId:true,startTime:true,endTime:true,isLive:true,workplace:true,baustelleId:true,baustelle:{select:{id:true,name:true,type:true,companyProfileId:true}},pauseIntervals:{where:{endedAt:null},select:{startedAt:true},take:2}}}),
        tx.workSession.findMany({where:{worker,isLive:false,startTime:{lte:now},endTime:{gte:day.start,lte:now,gt:tx.workSession.fields.startTime}},distinct:['workerId'],orderBy:[{workerId:'asc'},{endTime:'desc'},{id:'asc'}],take:5001,select:{workerId:true,endTime:true,closedBySystem:true}}),
      ]);
      if(open.length>10000||ended.length>5000)return failure('SCOPE_TOO_LARGE','Attendance contains too many records. Narrow the worker search; no complete result is available.');
      const openByWorker=new Map<string,typeof open>();
      for(const session of open){const rows=openByWorker.get(session.workerId)??[];rows.push(session);openByWorker.set(session.workerId,rows);}
      const stoppedByWorker=new Map(ended.map(s=>[s.workerId,s]));
      const snapshot=workers.map(w=>{
        const sessions=openByWorker.get(w.id)??[],s=sessions[0],stop=stoppedByWorker.get(w.id),lastStop=stop?.endTime??null;
        const reasons:string[]=[];
        let status:Status=lastStop?'stopped':'no_live_session',location:Location={kind:'unknown',siteId:null,name:null};
        if(sessions.length){
          if(sessions.length!==1)reasons.push('multiple_open_or_inconsistent_sessions');
          if(s.endTime||!s.isLive||s.startTime>now)reasons.push('invalid_current_clock_record');
          if(s.workplace&&s.workplace!=='OFFICE')reasons.push('unknown_workplace_value');
          if(s.workplace==='OFFICE'&&s.baustelleId)reasons.push('office_and_site_conflict');
          if(s.baustelleId&&(!s.baustelle||s.baustelle.companyProfileId!==requester.companyId))reasons.push('site_not_available_in_company');
          if(w.availability!=='AVAILABLE')reasons.push('profile_availability_conflicts_with_live_clock');
          if(lastStop&&lastStop>s.startTime)reasons.push('closed_record_overlaps_live_clock');
          if(s.pauseIntervals.length>1||s.pauseIntervals.some(p=>p.startedAt<s.startTime||p.startedAt>now))reasons.push('inconsistent_open_pause');
          status=reasons.length?'needs_review':s.pauseIntervals.length?'paused':'working';
          if(!reasons.length)location=s.workplace==='OFFICE'?{kind:'office',siteId:null,name:'Office'}:s.baustelle?{kind:s.baustelle.type==='STEEL_WORKSHOP'?'factory':'site',siteId:s.baustelle.id,name:s.baustelle.name}:{kind:'unknown',siteId:null,name:null};
        }
        return {workerId:w.id,name:`${w.firstName} ${w.lastName}`.trim(),profileAvailability:w.availability,status,location,startedAt:status==='working'||status==='paused'?s.startTime.toISOString():null,lastStoppedAtToday:lastStop?.toISOString()??null,lastStopKind:stop?(stop.closedBySystem?'system':'recorded'):null,reasons};
      });
      const summary={activeWorkers:snapshot.length,working:0,paused:0,officeWorking:0,officePaused:0,siteWorking:0,sitePaused:0,factoryWorking:0,factoryPaused:0,unknownLocationWorking:0,unknownLocationPaused:0,stoppedToday:0,noLiveSession:0,needsReview:0};
      for(const row of snapshot){
        if(row.status==='working'||row.status==='paused'){
          summary[row.status]++;
          const place=row.location.kind==='unknown'?'unknownLocation':row.location.kind;
          const key=`${place}${row.status==='working'?'Working':'Paused'}` as 'officeWorking'|'officePaused'|'siteWorking'|'sitePaused'|'factoryWorking'|'factoryPaused'|'unknownLocationWorking'|'unknownLocationPaused';summary[key]++;
        }else if(row.status==='stopped')summary.stoppedToday++;else if(row.status==='no_live_session')summary.noLiveSession++;else summary.needsReview++;
      }
      const matching=snapshot.filter(r=>{
        switch(filters.state){
          case 'all':return true;
          case 'activity':return r.status!=='no_live_session';
          case 'live':return r.status==='working'||r.status==='paused';
          case 'office':case 'site':case 'factory':return (r.status==='working'||r.status==='paused')&&r.location.kind===filters.state;
          default:return r.status===filters.state;
        }
      }).sort((a,b)=>a.workerId<b.workerId?-1:a.workerId>b.workerId?1:0);
      const after=matching.filter(r=>!filters.cursor||r.workerId>filters.cursor),items=after.slice(0,filters.limit),hasMore=after.length>items.length;
      return {ok:true as const,source:'Current WorkSession clock, explicit workplace, site and open pause records',retrievedAt:now.toISOString(),timeZone,readOnly:true,consistency:'One repeatable-read snapshot; current stored attendance, not physical/GPS verification.',data:{date,filters,summary,summaryScope:'All active company workers matching workerId/query before the state/page filter.',items,totalMatching:matching.length,returned:items.length,hasMore,nextCursor:hasMore?items.at(-1)!.workerId:null,complete:!filters.cursor&&!hasMore,identityResolution:filters.workerId?'exact_id':filters.query&&workers.length>1?'multiple_candidates_require_clarification':'company_workforce',rules:{office:'Explicit OFFICE workplace only; never inferred from job, office access, login or plan.',site:'Recorded company site only; STEEL_WORKSHOP is factory, not a construction site.',stopped:'No open/inconsistent clock and a valid recorded end during the current company day.',noLiveSession:'No current session and no valid end today. This does not prove absence, logout or a stop today.',needsReview:'Conflicting/invalid records. Do not infer working, stopped or a location.',page:'Counts cover the matching scope; items can be a partial page. Fetch nextCursor before claiming a complete name list.'}}};
    },{isolationLevel:'RepeatableRead',timeout:10000,maxWait:3000});
  }catch(error){return {...failure('DATA_UNAVAILABLE','Current attendance could not be read. Do not infer nobody working, stopped, office/site location or reuse a previous answer.'),diagnostic:categorizeAssistantFailure(error,{source:'database'})};}
}
