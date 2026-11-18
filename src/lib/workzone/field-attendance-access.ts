import type { Prisma } from '@/generated/prisma/client';
import { withTenantContext } from '@/lib/db/tenant-context';
import { officeSeat } from '@/lib/offices/policy';

export const FIELD_CREW_ROLES = ['FIELD_WORKER','FIELD_ENGINEER'];
type Tx=Prisma.TransactionClient;
/** Explicit office delegation, never job-title/name matching or an admin promotion. */
export async function fieldTimeDelegate(tx:Tx,companyId:string,workerId:string){
  if(process.env.VIRTUAL_OFFICE_ENABLED!=='true'||process.env.VIRTUAL_OFFICE_WORK_ENABLED!=='true')return false;
  try{if(JSON.parse(process.env.VIRTUAL_OFFICE_ACCESS_JSON??'{}').companyId!==companyId)return false;}catch{return false;}
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext(${`office-team:${companyId}`}))`;
  const worker=await tx.worker.findFirst({where:{id:workerId,companyProfileId:companyId,status:'active'},select:{id:true,crewRole:true}});
  if(!worker)return false;
  const director=officeSeat(process.env.VIRTUAL_OFFICE_ACCESS_JSON,{companyId,id:workerId,kind:'worker'});
  if(director){const config=JSON.parse(process.env.VIRTUAL_OFFICE_ACCESS_JSON!);return !!await tx.user.findFirst({where:{id:config[director].adminId,companyProfileId:companyId,isActive:true,role:'ADMIN'},select:{id:true}});}
  return process.env.VIRTUAL_OFFICE_TEAM_ENABLED==='true'&&worker.crewRole==='FIELD_ENGINEER'&&!!await tx.officeMember.findFirst({where:{companyProfileId:companyId,workerId,enabled:true,fieldAttendanceEnabled:true},select:{id:true}});
}
export async function fieldTimeTarget(tx:Tx,companyId:string,workerId:string,scope?:{siteId:string|null;workplace?:string|null}){
  if(!await tx.worker.findFirst({where:{id:workerId,companyProfileId:companyId,status:'active',crewRole:{in:FIELD_CREW_ROLES}},select:{id:true}}))return false;
  if(scope?.workplace)return false;
  if(scope?.siteId&&!await tx.baustelle.findFirst({where:{id:scope.siteId,companyProfileId:companyId,type:{not:'STEEL_WORKSHOP'}},select:{id:true}}))return false;
  return true;
}
export async function canDelegateFieldTime(companyId:string,actorId:string,targetId:string,scope?:{siteId:string|null;workplace?:string|null}){
  return withTenantContext(companyId,async tx=>await fieldTimeDelegate(tx,companyId,actorId)&&await fieldTimeTarget(tx,companyId,targetId,scope));
}
export async function fieldTimeAudit(tx:Tx,companyId:string,actorId:string,targetId:string,sessionId:string,command:'start'|'stop'){
  await tx.auditLog.create({data:{companyProfileId:companyId,actorType:'WORKER',actorId,action:`office.field_time.${command}`,payload:{workerId:targetId,sessionId}}});
}
