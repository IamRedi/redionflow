import { isRuntimePilotEnabled } from '@/lib/auth/pilot-session';
import { after } from 'next/server';
import { withTenantContext } from '@/lib/db/tenant-context';
import { sendInstalledNotification } from '@/lib/notifications/sendNotification';
import { logger } from '@/lib/observability/logger';
import { officeActor } from './work-access';
import { canReadOfficeTask } from './work-policy';

type Activity={kind:'mail';messageId:string}|{kind:'task';taskId:string;version:number};
/** Commit first; push delivery is best effort and never changes the save result. */
export function scheduleOfficeActivity(event:Activity){
  const run=()=>dispatchOfficeActivity(event).catch(()=>logger.warn({event:'office.notification_failed',kind:event.kind},'Office notification did not complete'));
  try{after(run);}catch{/* Direct test/script callers dispatch explicitly, without an HTTP request. */}
}
export async function dispatchOfficeActivity(event:Activity,deliver=sendInstalledNotification){
  if(isRuntimePilotEnabled())return;
  const actor=await officeActor(),companyId=actor.companyId;
  if(process.env.INSTALLATION_COMPANY_ID!==companyId)return;
  const config=JSON.parse(process.env.VIRTUAL_OFFICE_ACCESS_JSON!);
  const key=event.kind==='mail'?`office-mail:${event.messageId}`:`office-task:${event.taskId}:${event.version}`;
  const claim=await withTenantContext(companyId,async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`notification:${companyId}:${key}`}))`;
    if(await tx.auditLog.findFirst({where:{companyProfileId:companyId,action:'notification.delivery',payload:{path:['eventKey'],equals:key}},select:{id:true}}))return null;
    let recipients:string[]=[],url:string;
    if(event.kind==='mail'){
      const message=await tx.officeMessage.findFirst({where:{id:event.messageId,companyProfileId:companyId,senderId:actor.principalId},select:{thread:{select:{id:true,senderId:true,recipientId:true}}}});
      if(!message)return null;
      recipients=[message.thread.senderId===actor.principalId?message.thread.recipientId:message.thread.senderId];
      url=`/workzone/offices/me/mail?thread=${message.thread.id}`;
    }else{
      const task=await tx.officeTask.findFirst({where:{id:event.taskId,companyProfileId:companyId,kind:'COMPANY',archivedAt:null,version:event.version},select:{kind:true,ownerId:true,createdById:true}});
      if(!task||!canReadOfficeTask(task,actor.principalId,actor.manager))return null;
      recipients=actor.people.filter(p=>p.id!==actor.principalId&&canReadOfficeTask(task,p.id,p.seat!=='staff')).map(p=>p.id);
      url=`/workzone/offices/me/tasks?task=${event.taskId}`;
    }
    const userIds=recipients.flatMap(id=>{
      const p=actor.people.find(p=>p.id===id);if(!p)return [];
      if(p.seat!=='staff')return [config[p.seat].adminId,config[p.seat].workerId].filter((v):v is string=>!!v);
      return []; // Staff identities are resolved below from fresh enabled membership.
    });
    const members=await tx.officeMember.findMany({where:{id:{in:recipients},companyProfileId:companyId,enabled:true,OR:[{worker:{status:'active'}},{user:{isActive:true,role:'ADMIN'}}]},select:{workerId:true,userId:true}});
    userIds.push(...members.flatMap(m=>[m.workerId,m.userId].filter((v):v is string=>!!v)));
    const record=await tx.auditLog.create({data:{companyProfileId:companyId,actorType:'SYSTEM',action:'notification.delivery',payload:{eventKey:key,kind:`office.${event.kind}`,eligible:new Set(userIds).size,state:'sending'}}});
    return {id:record.id,userIds:[...new Set(userIds)],url};
  });
  if(!claim)return;
  let result:{sent:number;failed:number};
  try{result=await deliver(companyId,{userIds:claim.userIds,title:event.kind==='mail'?'AL-Steel · Posta':'AL-Steel · Detyrat',body:event.kind==='mail'?'Ke një mesazh të ri në Postë.':'Ke një detyrë të re ose të caktuar në ditarin e zyrës.',url:claim.url,tag:key,preference:'adminMessages'});}catch{result={sent:0,failed:1};}
  await withTenantContext(companyId,tx=>tx.auditLog.update({where:{id:claim.id},data:{payload:{eventKey:key,kind:`office.${event.kind}`,eligible:claim.userIds.length,...result,state:result.failed?'partial':result.sent?'completed':claim.userIds.length?'no_devices':'no_audience'}}}));
}
