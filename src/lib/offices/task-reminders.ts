import { randomUUID } from 'node:crypto';
import { withTenantContext } from '@/lib/db/tenant-context';
import { sendInstalledNotification } from '@/lib/notifications/sendNotification';
import { canReadOfficeTask } from './work-policy';
import { officeSeat } from './policy';
import { reminderCompany, reminderOutcome } from './reminder-policy';

type Delivery=typeof sendInstalledNotification;
/** One bounded batch, durable across deployments. Claims expire after a crash.
 * No private title/note is sent to a device lock screen or to the operator log.
 * OS/network delivery is best-effort, not an acknowledgement that a person read it.
 */
export async function dispatchOfficeReminders(now=new Date(),deliver:Delivery=sendInstalledNotification) {
  const companyId=reminderCompany();
  const counts={claimed:0,sent:0,cancelled:0,noDevice:0,failed:0};
  if(!companyId)return counts;
  for(let i=0;i<10;i++) {
    const claimId=randomUUID();
    const claim=await withTenantContext(companyId,async tx=>{
      const rows=await tx.$queryRaw<Array<{id:string}>>`
        SELECT "id" FROM "OfficeTaskReminder"
        WHERE "companyProfileId"=${companyId} AND "status"='PENDING'
          AND "nextAttemptAt"<=${now} AND ("leaseUntil" IS NULL OR "leaseUntil"<=${now})
        ORDER BY "nextAttemptAt","id" FOR UPDATE SKIP LOCKED LIMIT 1`;
      if(!rows.length)return null;
      const row=await tx.officeTaskReminder.findUniqueOrThrow({where:{id:rows[0].id}});
      if(row.attempts>=3) {
        await tx.officeTaskReminder.update({where:{id:row.id},data:{status:'FAILED',claimId:null,leaseUntil:null}});
        return {exhausted:true as const};
      }
      await tx.officeTaskReminder.update({where:{id:row.id},data:{claimId,leaseUntil:new Date(now.getTime()+120_000),attempts:{increment:1}}});
      return {exhausted:false as const,id:row.id,taskId:row.taskId};
    });
    if(!claim)break;
    if(claim.exhausted){counts.failed++;continue;}
    counts.claimed++;
    // Serialize with saving/completing/archiving. Recheck current membership and
    // task visibility immediately before delivery, never cached snapshot rights.
    await withTenantContext(companyId,async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`office-task:${companyId}:${claim.taskId}`}))`;
      const row=await tx.officeTaskReminder.findFirst({where:{id:claim.id,companyProfileId:companyId,claimId,status:'PENDING'},include:{task:true,member:{include:{worker:{select:{id:true,status:true}},user:{select:{id:true,isActive:true,role:true}}}}}});
      if(!row)return;
      const m=row.member;
      const director=!!m.user?.isActive&&m.user.role==='ADMIN'&&!!officeSeat(process.env.VIRTUAL_OFFICE_ACCESS_JSON,{kind:'admin',id:m.user.id,companyId});
      const staff=process.env.VIRTUAL_OFFICE_TEAM_ENABLED==='true'&&m.enabled&&(m.worker?.status==='active'||!!m.user?.isActive);
      const taskVisible=!row.task.archivedAt&&row.task.status!=='DONE'&&canReadOfficeTask(row.task,m.id,director);
      if((!director&&!staff)||!taskVisible) {
        await tx.officeTaskReminder.update({where:{id:row.id},data:{status:'CANCELLED',claimId:null,leaseUntil:null}});
        counts.cancelled++;return;
      }
      const userIds=director?[m.userId!,...(officeSeat(process.env.VIRTUAL_OFFICE_ACCESS_JSON,{kind:'admin',id:m.userId!,companyId})==='megi'?[JSON.parse(process.env.VIRTUAL_OFFICE_ACCESS_JSON!).megi.workerId]:[JSON.parse(process.env.VIRTUAL_OFFICE_ACCESS_JSON!).almet.workerId])].filter((v):v is string=>!!v):[m.workerId||m.userId!];
      let result:{sent:number;failed:number};
      try {result=await deliver(companyId,{userIds,title:'AL-Steel · Kujtesë',body:'Ke një detyrë për të parë në ditarin tënd.',url:`/workzone/offices/me/tasks?task=${row.taskId}`,tag:`office-reminder:${row.id}`});}
      catch {result={sent:0,failed:1};}
      const status=reminderOutcome(result.sent,result.failed,row.attempts);
      await tx.officeTaskReminder.update({where:{id:row.id},data:{status,claimId:null,leaseUntil:null,sentAt:status==='SENT'?now:null,nextAttemptAt:new Date(now.getTime()+300_000)}});
      if(status==='SENT')counts.sent++;else if(status==='NO_DEVICE')counts.noDevice++;else counts.failed++;
    },{timeout:30_000,maxWait:5_000});
  }
  return counts;
}
