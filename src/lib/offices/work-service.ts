import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { withTenantContext } from '@/lib/db/tenant-context';
import { validateManagedUpload } from '@/lib/storage/upload-validation';
import { officeActor, OfficeError } from './work-access';
import { reminderCompany, validReminderTime } from './reminder-policy';
import { canReadOfficeTask, INITIAL_OFFICE_CATEGORIES, isThreadParticipant, MAX_MAIL_FILES, MAX_MAIL_FILE_BYTES, MAX_MAIL_TOTAL_BYTES, officeTaskInput } from './work-policy';

/** Persist only existing director identities inside an explicit write transaction. */
async function ensureOfficePrincipals(tx:Prisma.TransactionClient,actor:Awaited<ReturnType<typeof officeActor>>){
  for(const p of actor.people.filter(p=>p.seat!=='staff'))await tx.officeMember.upsert({where:{id:p.id},update:{},create:{id:p.id,companyProfileId:actor.companyId,userId:p.id,enabled:false,title:p.title}});
}
const taskSelect={id:true,ownerId:true,createdById:true,kind:true,title:true,body:true,status:true,priority:true,dueDate:true,categoryId:true,version:true,archivedAt:true,createdAt:true,updatedAt:true} satisfies Prisma.OfficeTaskSelect;
const attachmentSelect={id:true,fileName:true,mime:true,size:true} satisfies Prisma.OfficeAttachmentSelect;
const participant=(id:string)=>({OR:[{senderId:id},{recipientId:id}]});
const jsonDates=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));

export async function officeWorkSnapshot(){
  const actor=await officeActor();
  return withTenantContext(actor.companyId,async tx=>{
    const where={companyProfileId:actor.companyId,...participant(actor.principalId)};
    const [tasks,categories,threads]=await Promise.all([
      tx.officeTask.findMany({where:{companyProfileId:actor.companyId,OR:[{ownerId:actor.principalId},{kind:'COMPANY',...(actor.manager?{}:{createdById:actor.principalId})}]},select:{...taskSelect,reminders:{where:{memberId:actor.principalId},select:{remindAt:true,status:true,sentAt:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:2000}),
      tx.officeCategory.findMany({where:{companyProfileId:actor.companyId},select:{id:true,name:true,archivedAt:true},orderBy:{name:'asc'}}),
      tx.officeThread.findMany({where,select:{id:true,subject:true,senderId:true,recipientId:true,senderReadAt:true,recipientReadAt:true,updatedAt:true,messages:{select:{id:true,senderId:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:1}},orderBy:[{updatedAt:'desc'},{id:'desc'}],take:500}),
    ]);
    return jsonDates({self:actor.principalId,seat:actor.seat,manager:actor.manager,people:actor.people,tasks,categories,remindersEnabled:reminderCompany()===actor.companyId,threads:threads.map(t=>{
      const last=t.messages[0],read=t.senderId===actor.principalId?t.senderReadAt:t.recipientReadAt;
      return {id:t.id,subject:t.subject,senderId:t.senderId,recipientId:t.recipientId,updatedAt:t.updatedAt,unread:!!last&&last.senderId!==actor.principalId&&(!read||last.createdAt>read)};
    })});
  });
}
export type OfficeSnapshot=Awaited<ReturnType<typeof officeWorkSnapshot>>;

export async function officeUnreadCount(){
  const actor=await officeActor();
  return withTenantContext(actor.companyId,async tx=>{
    const rows=await tx.officeThread.findMany({where:{companyProfileId:actor.companyId,...participant(actor.principalId)},select:{senderId:true,senderReadAt:true,recipientReadAt:true,messages:{select:{senderId:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:1}},take:500});
    return rows.filter(t=>{const last=t.messages[0],read=t.senderId===actor.principalId?t.senderReadAt:t.recipientReadAt;return last&&last.senderId!==actor.principalId&&(!read||last.createdAt>read);}).length;
  });
}

export async function saveOfficeTask(raw:unknown){
  const input=officeTaskInput.parse(raw),actor=await officeActor();
  if(!actor.people.some(p=>p.id===input.ownerId)||input.kind!=='COMPANY'&&input.ownerId!==actor.principalId)throw new OfficeError('DENIED');
  return withTenantContext(actor.companyId,async tx=>{
    // A delivery may serialize this task, never the entire office journal.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`office-task:${actor.companyId}:${input.id}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`office-work:${actor.companyId}`}))`;
    const old=await tx.officeTask.findFirst({where:{id:input.id,companyProfileId:actor.companyId},select:taskSelect});
    if(old&&!canReadOfficeTask(old,actor.principalId,actor.manager))throw new OfficeError('NOT_FOUND');
    if(old&&(old.archivedAt||old.version!==input.version))throw new OfficeError('CONFLICT');
    // Sharing is a deliberate UI action. A company task can never become private
    // again (which would silently remove it from the recipient's view).
    if(old?.kind==='COMPANY'&&input.kind!=='COMPANY')throw new OfficeError('INVALID');
    if(!old&&input.version!==0)throw new OfficeError('CONFLICT');
    if(input.categoryId==='OTHER'){const other=await tx.officeCategory.upsert({where:{companyProfileId_name:{companyProfileId:actor.companyId,name:'Tjetër'}},create:{companyProfileId:actor.companyId,name:'Tjetër'},update:{archivedAt:null}});input.categoryId=other.id;}
    if(input.categoryId&&!await tx.officeCategory.findFirst({where:{id:input.categoryId,companyProfileId:actor.companyId,...(old?.categoryId===input.categoryId?{}:{archivedAt:null})}}))throw new OfficeError('INVALID');
    if(!actor.manager&&input.kind==='COMPANY'&&input.ownerId!==actor.principalId&&old?.createdById!==actor.principalId)throw new OfficeError('DENIED');
    await ensureOfficePrincipals(tx,actor);
    const {id,reminderAt,...data}=input;
    if(old)await tx.officeTask.update({where:{id},data:{...data,version:{increment:1}}});
    else {
      if(await tx.officeTask.count({where:{companyProfileId:actor.companyId}})>=2000)throw new OfficeError('LIMIT');
      await tx.officeTask.create({data:{id,...data,version:1,companyProfileId:actor.companyId,createdById:actor.principalId}});
    }
    const scope={companyProfileId:actor.companyId,taskId:id};
    if(data.status==='DONE'||data.kind==='NOTE')await tx.officeTaskReminder.updateMany({where:{...scope,status:'PENDING'},data:{status:'CANCELLED',claimId:null,leaseUntil:null}});
    if(reminderAt!==undefined) {
      const key={...scope,memberId:actor.principalId};
      if(reminderAt===null)await tx.officeTaskReminder.updateMany({where:key,data:{status:'CANCELLED',claimId:null,leaseUntil:null}});
      else {
        if(data.status==='DONE'||data.kind==='NOTE'||reminderCompany()!==actor.companyId)throw new OfficeError('INVALID');
        const when=new Date(reminderAt),existing=await tx.officeTaskReminder.findUnique({where:{companyProfileId_taskId_memberId:key}});
        if(!existing||existing.remindAt.getTime()!==when.getTime()||existing.status==='CANCELLED') {
          if(!validReminderTime(when))throw new OfficeError('INVALID');
          await tx.officeTaskReminder.upsert({where:{companyProfileId_taskId_memberId:key},create:{...key,remindAt:when,nextAttemptAt:when},update:{remindAt:when,nextAttemptAt:when,status:'PENDING',attempts:0,claimId:null,leaseUntil:null,sentAt:null}});
        }
      }
    }
    return {id};
  },{timeout:35_000,maxWait:5_000});
}
export async function archiveOfficeTask(raw:unknown){
  const {id,version,restore}=z.object({id:z.uuid(),version:z.number().int().positive(),restore:z.boolean()}).strict().parse(raw),actor=await officeActor();
  return withTenantContext(actor.companyId,async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`office-task:${actor.companyId}:${id}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`office-work:${actor.companyId}`}))`;
    const old=await tx.officeTask.findFirst({where:{id,companyProfileId:actor.companyId},select:taskSelect});
    if(!old||!canReadOfficeTask(old,actor.principalId,actor.manager))throw new OfficeError('NOT_FOUND');
    const changed=await tx.officeTask.updateMany({where:{id,companyProfileId:actor.companyId,version},data:{archivedAt:restore?null:new Date(),version:{increment:1}}});
    if(!changed.count)throw new OfficeError('CONFLICT');
    if(!restore)await tx.officeTaskReminder.updateMany({where:{companyProfileId:actor.companyId,taskId:id,status:'PENDING'},data:{status:'CANCELLED',claimId:null,leaseUntil:null}});
  },{timeout:35_000,maxWait:5_000});
}
export async function saveOfficeCategory(raw:unknown){
  const input=z.object({id:z.uuid().nullable(),name:z.string().trim().min(1).max(100),archive:z.boolean().default(false)}).strict().parse(raw),actor=await officeActor();
  if(!actor.manager)throw new OfficeError('DENIED');
  return withTenantContext(actor.companyId,async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`office-work:${actor.companyId}`}))`;
    if(input.id){
      const row=await tx.officeCategory.findFirst({where:{id:input.id,companyProfileId:actor.companyId}});
      if(!row)throw new OfficeError('NOT_FOUND');
      return tx.officeCategory.update({where:{id:row.id},data:{name:input.name,archivedAt:input.archive?new Date():null},select:{id:true}});
    }
    if(await tx.officeCategory.count({where:{companyProfileId:actor.companyId}})>=50)throw new OfficeError('LIMIT');
    return tx.officeCategory.upsert({where:{companyProfileId_name:{companyProfileId:actor.companyId,name:input.name}},update:{},create:{companyProfileId:actor.companyId,name:input.name},select:{id:true}});
  });
}
/** Explicit configuration action, never seed the company as a side effect of GET. */
export async function initializeOfficeCategories(){
  const actor=await officeActor();if(!actor.manager)throw new OfficeError('DENIED');
  return withTenantContext(actor.companyId,async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`office-work:${actor.companyId}`}))`;
    if(await tx.officeCategory.count({where:{companyProfileId:actor.companyId}}))return;
    for(const name of INITIAL_OFFICE_CATEGORIES)await tx.officeCategory.create({data:{companyProfileId:actor.companyId,name}});
  });
}

const mailInput=z.object({requestId:z.uuid(),threadId:z.uuid().nullable(),recipientId:z.string().min(1).max(128),subject:z.string().trim().min(1).max(160),body:z.string().trim().max(10000)}).strict();
export async function sendOfficeMail(form:FormData){
  const actor=await officeActor();
  const input=mailInput.parse({requestId:form.get('requestId'),threadId:form.get('threadId')||null,recipientId:form.get('recipientId'),subject:form.get('subject'),body:form.get('body')||''});
  if(input.recipientId===actor.principalId||!actor.people.some(p=>p.id===input.recipientId))throw new OfficeError('DENIED');
  const files=form.getAll('files').filter((f):f is File=>f instanceof File&&f.size>0);
  if(files.length>MAX_MAIL_FILES||files.some(f=>f.size>MAX_MAIL_FILE_BYTES)||files.reduce((n,f)=>n+f.size,0)>MAX_MAIL_TOTAL_BYTES||(!input.body&&!files.length))throw new OfficeError('INVALID');
  // Verify membership BEFORE reading or processing any attachment bytes.
  if(input.threadId)await withTenantContext(actor.companyId,async tx=>{
    const t=await tx.officeThread.findFirst({where:{id:input.threadId!,companyProfileId:actor.companyId,...participant(actor.principalId)}});
    if(!t||!isThreadParticipant(t,input.recipientId))throw new OfficeError('NOT_FOUND');
  });
  const attachments:{fileName:string;mime:string;size:number;dataBytes:Uint8Array<ArrayBuffer>;sha256:string}[]=[];
  for(const file of files){
    if(file.name.length>255||! /\.(pdf|png|jpe?g|webp|docx|xlsx)$/i.test(file.name))throw new OfficeError('INVALID');
    const mime=await validateManagedUpload(file,'worker-assets');
    const dataBytes=new Uint8Array(await file.arrayBuffer());
    attachments.push({fileName:file.name,mime,size:dataBytes.length,dataBytes,sha256:createHash('sha256').update(dataBytes).digest('hex')});
  }
  // A single transaction stores the message and private bytes: no orphan files,
  // public URLs, official document receipt, process update or attendance write.
  return withTenantContext(actor.companyId,async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`office-mail:${actor.companyId}`}))`;
    await ensureOfficePrincipals(tx,actor);
    const retry=await tx.officeMessage.findFirst({where:{id:input.requestId,companyProfileId:actor.companyId},include:{attachments:{select:{sha256:true,fileName:true}},thread:{select:{senderId:true,recipientId:true,subject:true}}}});
    if(retry){
      if(retry.senderId!==actor.principalId||retry.body!==input.body||!isThreadParticipant(retry.thread,input.recipientId)||retry.thread.subject!==input.subject||retry.threadId!==(input.threadId||input.requestId)||JSON.stringify(retry.attachments.map(a=>[a.sha256,a.fileName]).sort())!==JSON.stringify(attachments.map(a=>[a.sha256,a.fileName]).sort()))throw new OfficeError('CONFLICT');
      return {id:retry.threadId};
    }
    const totals=await tx.officeAttachment.aggregate({where:{companyProfileId:actor.companyId},_sum:{size:true}});
    if((totals._sum.size??0)+attachments.reduce((n,f)=>n+f.size,0)>250_000_000)throw new OfficeError('LIMIT');
    if(await tx.officeMessage.count({where:{companyProfileId:actor.companyId,senderId:actor.principalId,createdAt:{gte:new Date(Date.now()-60_000)}}})>=10)throw new OfficeError('LIMIT');
    const now=new Date();let threadId=input.threadId;
    if(threadId){
      const thread=await tx.officeThread.findFirst({where:{id:threadId,companyProfileId:actor.companyId,...participant(actor.principalId)}});
      if(!thread||!isThreadParticipant(thread,input.recipientId))throw new OfficeError('NOT_FOUND');
      if(await tx.officeMessage.count({where:{companyProfileId:actor.companyId,threadId}})>=500)throw new OfficeError('LIMIT');
      await tx.officeThread.update({where:{id:threadId},data:{updatedAt:now,...(thread.senderId===actor.principalId?{senderReadAt:now}:{recipientReadAt:now})}});
    }else{
      if(await tx.officeThread.count({where:{companyProfileId:actor.companyId}})>=500)throw new OfficeError('LIMIT');
      threadId=input.requestId;
      await tx.officeThread.create({data:{id:threadId,companyProfileId:actor.companyId,senderId:actor.principalId,recipientId:input.recipientId,subject:input.subject,senderReadAt:now}});
    }
    await tx.officeMessage.create({data:{id:input.requestId,companyProfileId:actor.companyId,threadId,senderId:actor.principalId,body:input.body,createdAt:now}});
    if(attachments.length)await tx.officeAttachment.createMany({data:attachments.map(a=>({...a,companyProfileId:actor.companyId,messageId:input.requestId}))});
    return {id:threadId};
  });
}

export async function readOfficeThread(id:string){
  z.uuid().parse(id);const actor=await officeActor();
  return withTenantContext(actor.companyId,async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`office-mail:${actor.companyId}`}))`;
    const thread=await tx.officeThread.findFirst({where:{id,companyProfileId:actor.companyId,...participant(actor.principalId)},select:{id:true,subject:true,senderId:true,recipientId:true,updatedAt:true,messages:{select:{id:true,senderId:true,body:true,createdAt:true,attachments:{select:attachmentSelect}},orderBy:[{createdAt:'asc'},{id:'asc'}],take:500}}});
    if(!thread)throw new OfficeError('NOT_FOUND');
    // Update only this reader's receipt; mark through the last returned message,
    // not wall-clock time (a concurrent new message must remain unread).
    const last=thread.messages.at(-1)?.createdAt;
    if(last)await tx.officeThread.update({where:{id},data:{...(thread.senderId===actor.principalId?{senderReadAt:last}:{recipientReadAt:last}),updatedAt:thread.updatedAt}});
    return jsonDates(thread);
  });
}
export type OfficeMailThread=Awaited<ReturnType<typeof readOfficeThread>>;
export async function readOfficeAttachment(id:string){
  z.uuid().parse(id);const actor=await officeActor();
  return withTenantContext(actor.companyId,async tx=>{
    const file=await tx.officeAttachment.findFirst({where:{id,companyProfileId:actor.companyId,message:{thread:{...participant(actor.principalId)}}},select:{fileName:true,mime:true,dataBytes:true}});
    if(!file)throw new OfficeError('NOT_FOUND');return file;
  });
}
