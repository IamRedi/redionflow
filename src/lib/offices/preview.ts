import {withTenantContext} from '@/lib/db/tenant-context';
import {officeActor,OfficeError} from './work-access';
import {loadWorkerAccess} from '@/lib/access/load';
import {can} from '@/lib/access/rules';
import {dateKey,dayRange} from '@/lib/workzone/date-utils';

/** Read-only management view. Never changes session, principal, mail receipts or AI context. */
export async function officePreviewTarget(id:string){
 const actor=await officeActor();
 if(!actor.manager||process.env.VIRTUAL_OFFICE_TEAM_ENABLED!=='true')throw new OfficeError('DENIED');
 const member=await withTenantContext(actor.companyId,tx=>tx.officeMember.findFirst({
  where:{id,companyProfileId:actor.companyId,worker:{status:'active'}},
  select:{id:true,workerId:true,title:true,enabled:true,workbooksEnabled:true,worker:{select:{firstName:true,lastName:true}}},
 }));
 if(!member?.workerId||!member.worker)throw new OfficeError('NOT_FOUND');
 return {actor,member,name:`${member.worker.firstName} ${member.worker.lastName}`};
}
export async function officePreviewTasks(id:string){
 const {actor,member}=await officePreviewTarget(id);
 return withTenantContext(actor.companyId,async tx=>{
  const where={companyProfileId:actor.companyId,kind:'COMPANY' as const,archivedAt:null,OR:[{ownerId:member.id},{createdById:member.id}]};
  if(await tx.officeTask.count({where})>2000)throw new OfficeError('LIMIT');
  return tx.officeTask.findMany({where,select:{id:true,title:true,body:true,status:true,priority:true,dueDate:true,category:{select:{name:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}]});
 });
}
export async function officePreviewPlan(id:string,date:string){
 const {actor,member}=await officePreviewTarget(id);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new OfficeError('INVALID');
 const {start}=dayRange(date);if(Number.isNaN(start.getTime())||dateKey(start)!==date)throw new OfficeError('INVALID');
 return withTenantContext(actor.companyId,async tx=>{
  const subject=await loadWorkerAccess(tx,actor.companyId,member.workerId!);
  if(!subject||!can(subject,'daily_plan.view'))throw new OfficeError('DENIED');
  return tx.dailyWorkPlan.findUnique({where:{companyProfileId_planDate:{companyProfileId:actor.companyId,planDate:start}},select:{savedRows:{orderBy:{sortOrder:'asc'}}}});
 });
}
