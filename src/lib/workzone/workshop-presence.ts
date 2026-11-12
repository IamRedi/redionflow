import {assetActor,assetFail} from '@/lib/company-assets/access';
import {currentCompanyActor} from '@/lib/site-files/actor';
import {withTenantContext} from '@/lib/db/tenant-context';
import {beginWorkerSession} from './session-start';
import {stopWorkerSessionAction} from '@/app/(workzone)/workzone/hr-actions';
import {defaultBreakForRange} from './session-rules';

export type WorkshopPresence={names:string[];canWork:boolean;active:boolean;paused:boolean;sessionId:string|null};
async function workshopActor(){
 const asset=await assetActor(),actor=await currentCompanyActor(asset.companyId);
 if(!actor?.allows('workshop.view'))return assetFail('DENIED');
 let workerId=asset.workerId;
 if(!workerId&&asset.userId){
  const config=JSON.parse(process.env.VIRTUAL_OFFICE_ACCESS_JSON||'null');
  if(config?.companyId===asset.companyId)for(const seat of ['megi','almet'])if(config[seat]?.adminId===asset.userId)workerId=config[seat].workerId??null;
  if(!workerId){const links=await withTenantContext(asset.companyId,tx=>tx.officeMember.findMany({where:{companyProfileId:asset.companyId,userId:asset.userId,enabled:true},select:{workerId:true},take:2}));if(links.length===1)workerId=links[0].workerId;}
 }
 const worker=workerId?await withTenantContext(asset.companyId,tx=>tx.worker.findFirst({where:{id:workerId,companyProfileId:asset.companyId,status:'active'},select:{id:true,availability:true}})):null;
 return {companyId:asset.companyId,worker};
}
export async function workshopPresence():Promise<WorkshopPresence>{
 const actor=await workshopActor(),now=new Date();
 return withTenantContext(actor.companyId,async tx=>{
  const sessions=await tx.workSession.findMany({where:{worker:{companyProfileId:actor.companyId,status:'active'},OR:[{isLive:true},{endTime:null}]},take:1001,select:{id:true,workerId:true,isLive:true,endTime:true,workplace:true,baustelleId:true,startTime:true,worker:{select:{firstName:true,lastName:true,availability:true}},pauseIntervals:{where:{endedAt:null},select:{startedAt:true},take:2}}});
  if(sessions.length>1000)return assetFail('INVALID_INPUT');
  const grouped=new Map<string,typeof sessions>();for(const s of sessions)grouped.set(s.workerId,[...(grouped.get(s.workerId)??[]),s]);
  const invalidClock=(s:typeof sessions[number])=>!s.isLive||!!s.endTime||s.startTime>now||!!(s.workplace&&s.baustelleId)||!!(s.workplace&&!['OFFICE','WORKSHOP'].includes(s.workplace))||s.pauseIntervals.length>1||s.pauseIntervals.some(p=>p.startedAt<s.startTime||p.startedAt>now);
  const valid=sessions.filter(s=>grouped.get(s.workerId)?.length===1&&!invalidClock(s)&&s.workplace==='WORKSHOP'&&s.worker.availability==='AVAILABLE');
  const own=valid.find(s=>s.workerId===actor.worker?.id),ownRows=actor.worker?grouped.get(actor.worker.id)??[]:[];
  return {names:valid.filter(s=>!s.pauseIntervals.length).map(s=>`${s.worker.firstName} ${s.worker.lastName}`.trim()).sort((a,b)=>a.localeCompare(b)),canWork:!!actor.worker&&actor.worker.availability==='AVAILABLE'&&ownRows.length<=1&&!ownRows.some(invalidClock),active:!!own,paused:!!own?.pauseIntervals.length,sessionId:own?.id??null};
 });
}
export async function startOwnWorkshopWork(){
 const actor=await workshopActor();if(!actor.worker||actor.worker.availability!=='AVAILABLE')return assetFail('DENIED');
 const clocks=await withTenantContext(actor.companyId,tx=>tx.workSession.findMany({where:{workerId:actor.worker!.id,OR:[{isLive:true},{endTime:null}]},select:{isLive:true,endTime:true,startTime:true},take:2}));if(clocks.length>1||clocks.some(s=>!s.isLive||s.endTime||s.startTime>new Date()))return assetFail('CONFLICT');
 await beginWorkerSession({companyId:actor.companyId,workerId:actor.worker.id,start:new Date(),siteId:null,workplace:'WORKSHOP',moveExisting:true});return actor.companyId;
}
export async function stopOwnWorkshopWork(sessionId:unknown){
 if(typeof sessionId!=='string'||!sessionId||sessionId.length>128)return assetFail('INVALID_INPUT');
 const actor=await workshopActor();if(!actor.worker)return assetFail('DENIED');
 const session=await withTenantContext(actor.companyId,tx=>tx.workSession.findFirst({where:{id:sessionId,workerId:actor.worker!.id,isLive:true,endTime:null,workplace:'WORKSHOP',baustelleId:null},select:{id:true,startTime:true}}));
 if(!session)return assetFail('CONFLICT');
 const now=new Date(),result=await stopWorkerSessionAction({sessionId:session.id,expectedWorkplace:'WORKSHOP',endTime:now.toISOString(),breakMinutes:defaultBreakForRange(session.startTime,now)});
 if(!result.ok)return assetFail('CONFLICT');return actor.companyId;
}
