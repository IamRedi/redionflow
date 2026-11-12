import {explicitWorkplaceLabel} from '@/lib/workzone/explicit-workplace';
import {z} from 'zod';
import {withTenantContext} from '@/lib/db/tenant-context';
import {loadWorkerAccess} from '@/lib/access/load';
import {can,type AccessSubject} from '@/lib/access/rules';
import {officeActor,OfficeError} from './work-access';
import {effectiveSessionHours,isReportableSession} from '@/lib/workzone/session-rules';
import {monthRange,dateKey,formatReportDay} from '@/lib/workzone/date-utils';
import {officePreviewTarget} from './preview';

export const officeMonth=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine(v=>Number(v.slice(0,4))>=2000&&Number(v.slice(0,4))<=2100);
export async function officeResourceAccess(previewId?:string){
 const preview=previewId?await officePreviewTarget(previewId):null;
 const actor=preview?.actor??await officeActor();
 return withTenantContext(actor.companyId,async tx=>{
  const subject:AccessSubject|null=preview?await loadWorkerAccess(tx,actor.companyId,preview.member.workerId!):actor.kind==='admin'?{kind:'admin'}:await loadWorkerAccess(tx,actor.companyId,actor.id);
  if(!subject)throw new OfficeError('DENIED');
  const membership=preview?.member??await tx.officeMember.findFirst({where:{id:actor.principalId,companyProfileId:actor.companyId},select:{workbooksEnabled:true,workProfile:true,assistantEnabled:true}});
  const staffDenied=subject.kind==='worker'&&subject.grants.some(g=>g.place==='staff'&&g.scopeId===''&&g.level==='none');
  return {actor,subject,profile:membership?.workProfile??'GENERAL',assistant:!preview&&!actor.manager&&!!membership?.assistantEnabled&&process.env.VIRTUAL_OFFICE_AI_ENABLED==='true',workbooks:!preview&&actor.manager||!staffDenied&&(!!membership?.workbooksEnabled||can(subject,'staff.view'))};
 });
}
/** No title/category inference: every module and site is filtered by its real key. */
export async function officeResources(previewId?:string){
 const {actor,subject,workbooks,profile,assistant}=await officeResourceAccess(previewId);
 return withTenantContext(actor.companyId,async tx=>{
  if(await tx.baustelle.count({where:{companyProfileId:actor.companyId}})>500)throw new OfficeError('LIMIT');
  const sites=await tx.baustelle.findMany({where:{companyProfileId:actor.companyId},select:{id:true,name:true,type:true},orderBy:{name:'asc'}});
  return {workbooks,profile,assistant,sites:sites.filter(s=>can(subject,'site.view',s.id)).map(s=>({...s,documents:can(subject,'site.documents',s.id),factory:can(subject,'factory.view',s.id),productionWrite:can(subject,'factory.steps',s.id),field:can(subject,'field.view',s.id),costs:can(subject,'costs.view',s.id),details:can(subject,'site.details',s.id)})),plan:can(subject,'daily_plan.view'),warehouse:can(subject,'warehouse.view'),workshop:can(subject,'workshop.view'),fleet:can(subject,'fleet_gps.view')};
 });
}
export async function officeSiteFiles(siteId:string,previewId?:string){
 const {actor,subject}=await officeResourceAccess(previewId);
 if(!can(subject,'site.view',siteId))throw new OfficeError('DENIED');
 const costs=can(subject,'costs.view')||can(subject,'site.details',siteId);
 return withTenantContext(actor.companyId,async tx=>{
  const site=await tx.baustelle.findFirst({where:{id:siteId,companyProfileId:actor.companyId},select:{id:true,name:true,address:true,description:true}});if(!site)throw new OfficeError('NOT_FOUND');
  const where={companyProfileId:actor.companyId,baustelleId:siteId,...(costs?{}:{officeOnly:false})};
  if(await tx.siteFile.count({where})>200)throw new OfficeError('LIMIT');
  const files=await tx.siteFile.findMany({where,select:{id:true,kind:true,fileName:true,mime:true,size:true,amount:true,currency:true,supplier:true,reference:true,uploadedByName:true,createdAt:true},orderBy:{createdAt:'desc'}});
  return {site:{...site,address:site.address??'',description:site.description??''},files:files.map(f=>({...f,createdAt:f.createdAt.toISOString()})),canUpload:can(subject,'site.documents',siteId),canSeeCosts:costs,canEditDetails:can(subject,'site.details',siteId)};
 });
}
export async function officeWorkbooks(month:string,workerId?:string,previewId?:string){
 officeMonth.parse(month);const {actor,workbooks}=await officeResourceAccess(previewId);if(!workbooks)throw new OfficeError('DENIED');
 const {start,end}=monthRange(month),now=new Date();
 return withTenantContext(actor.companyId,async tx=>{
  const where={companyProfileId:actor.companyId,...(workerId?{id:workerId}:{})};
  if(await tx.worker.count({where})>500)throw new OfficeError('LIMIT');
  const workers=await tx.worker.findMany({where,select:{id:true,firstName:true,lastName:true,position:true,companyProfileId:true},orderBy:[{firstName:'asc'},{id:'asc'}]});
  if(workerId&&!workers.length)throw new OfficeError('NOT_FOUND');
  const sessionWhere={worker:{companyProfileId:actor.companyId},workerId:{in:workers.map(w=>w.id)},startTime:{gte:start,lt:end}};
  if(await tx.workSession.count({where:sessionWhere})>20000)throw new OfficeError('LIMIT');
  const sessions=(await tx.workSession.findMany({where:sessionWhere,select:{workerId:true,startTime:true,endTime:true,totalHours:true,breakMinutes:true,workplace:true,baustelle:{select:{name:true}}},orderBy:{startTime:'asc'}})).filter(isReportableSession);
  const summary=workers.map(w=>{const rows=sessions.filter(s=>s.workerId===w.id);return {...w,hours:Math.round(rows.reduce((sum,s)=>sum+effectiveSessionHours(s,now),0)*100)/100,days:new Set(rows.map(s=>dateKey(s.startTime))).size,live:rows.some(s=>!s.endTime)};});
  const rows=workerId?Array.from({length:new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate()},(_,i)=>{
   const date=`${month}-${String(i+1).padStart(2,'0')}`,day=new Date(`${date}T12:00:00Z`),found=sessions.filter(s=>dateKey(s.startTime)===date),closed=found.filter(s=>s.endTime);
   return {date,dayOfMonth:date.slice(8),dayName:formatReportDay(day,'sq'),startTime:found.length?new Date(Math.min(...found.map(s=>s.startTime.getTime()))):null,endTime:closed.length?new Date(Math.max(...closed.map(s=>s.endTime!.getTime()))):null,hasLive:found.some(s=>!s.endTime),breakMinutes:found.reduce((sum,s)=>sum+s.breakMinutes,0),locations:[...new Set(found.map(s=>explicitWorkplaceLabel(s.workplace,'sq')??s.baustelle?.name).filter(Boolean))].join(', ')||'-',totalHours:found.reduce((sum,s)=>sum+effectiveSessionHours(s,now),0),hasWork:found.length>0};
  }):[];
  return {month,asOf:now.toISOString(),summary,rows};
 });
}
