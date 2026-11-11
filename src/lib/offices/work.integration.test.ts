import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,beforeEach,expect,it,vi } from 'vitest';
const auth=vi.hoisted(()=>({admin:vi.fn(),worker:vi.fn(),company:vi.fn()}));
vi.mock('@/lib/auth/admin-session',()=>({getCurrentAdmin:auth.admin}));
vi.mock('@/lib/workzone/worker-session',()=>({getCurrentWorker:auth.worker}));
vi.mock('@/lib/db/tenant',()=>({getCurrentCompanyId:auth.company}));
import { prisma } from '@/lib/db/prisma';
import { assertAssistantTestDatabase } from '../../../tests/fixtures/assistant-database';
import { archiveOfficeTask,initializeOfficeCategories,officeWorkSnapshot,officeUnreadCount,readOfficeAttachment,readOfficeThread,saveOfficeCategory,saveOfficeTask,sendOfficeMail } from './work-service';
assertAssistantTestDatabase();
let companyId:string,otherCompanyId:string,megi:string,almet:string,outsider:string,foreign:string,workerId:string;
const role='office_work_rls_probe';
function as(id:string){auth.company.mockResolvedValue(companyId);auth.admin.mockResolvedValue({id,companyProfileId:companyId});auth.worker.mockResolvedValue(null);}
const draft=()=>({id:randomUUID(),version:0,kind:'PERSONAL',title:'Synthetic private task',body:'Private notes',status:'TODO',priority:'NORMAL',ownerId:megi,categoryId:null,dueDate:'2026-11-20'});
function mail(options:{id?:string;thread?:string;to?:string;body?:string;file?:File}={}){const f=new FormData();for(const[k,v]of Object.entries({requestId:options.id??randomUUID(),threadId:options.thread??'',recipientId:options.to??almet,subject:'Synthetic office conversation',body:options.body??'Private test message'}))f.set(k,v);if(options.file)f.set('files',options.file);return f;}
beforeAll(async()=>{
  const c=await prisma.companyProfile.create({data:{displayName:'Office test DEMO',legalName:'Synthetic only'}});companyId=c.id;
  otherCompanyId=(await prisma.companyProfile.create({data:{displayName:'Foreign office DEMO',legalName:'Synthetic only'}})).id;
  const people=await Promise.all(['Megi','Almet','Other','Foreign'].map((name,i)=>prisma.user.create({data:{companyProfileId:i===3?otherCompanyId:companyId,name:`${name} Demo`,email:`office-${randomUUID()}@example.test`,role:'ADMIN',isActive:true,isOwner:i===2}})));
  [megi,almet,outsider,foreign]=people.map(p=>p.id);
  workerId=(await prisma.worker.create({data:{companyProfileId:companyId,firstName:'Megi',lastName:'Demo'}})).id;
  vi.stubEnv('VIRTUAL_OFFICE_ACCESS_JSON',JSON.stringify({companyId,megi:{adminId:megi,workerId},almet:{adminId:almet}}));
  vi.stubEnv('VIRTUAL_OFFICE_WORK_ENABLED','true');
  await prisma.$executeRawUnsafe(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
  await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await prisma.$executeRawUnsafe(`GRANT SELECT ON "OfficeTask","OfficeThread","OfficeMessage","OfficeAttachment","OfficeCategory" TO ${role}`);
});
beforeEach(()=>as(megi));
afterAll(async()=>{
  if(companyId){const where={companyProfileId:companyId};await prisma.officeAttachment.deleteMany({where});await prisma.officeMessage.deleteMany({where});await prisma.officeThread.deleteMany({where});await prisma.officeTask.deleteMany({where});await prisma.officeCategory.deleteMany({where});await prisma.worker.deleteMany({where});await prisma.user.deleteMany({where:{companyProfileId:{in:[companyId,otherCompanyId]}}});await prisma.companyProfile.deleteMany({where:{id:{in:[companyId,otherCompanyId]}}});}
  await prisma.$executeRawUnsafe(`DROP OWNED BY ${role}`);await prisma.$executeRawUnsafe(`DROP ROLE ${role}`);vi.unstubAllEnvs();
});
it('keeps personal work private, including from the other owner, and prevents lost updates',async()=>{
  const d=draft();await saveOfficeTask(d);
  as(almet);expect((await officeWorkSnapshot()).tasks.some(t=>t.id===d.id)).toBe(false);
  await expect(saveOfficeTask({...d,version:1,ownerId:almet})).rejects.toThrow('NOT_FOUND');
  await expect(archiveOfficeTask({id:d.id,version:1,restore:false})).rejects.toThrow('NOT_FOUND');
  as(megi);await saveOfficeTask({...d,version:1,title:'Changed once'});await expect(saveOfficeTask({...d,version:1,title:'Stale edit'})).rejects.toThrow('CONFLICT');
  await archiveOfficeTask({id:d.id,version:2,restore:false});expect((await officeWorkSnapshot()).tasks.find(t=>t.id===d.id)?.archivedAt).not.toBeNull();
  await archiveOfficeTask({id:d.id,version:3,restore:true});expect((await officeWorkSnapshot()).tasks.find(t=>t.id===d.id)?.archivedAt).toBeNull();
});
it('shares office tasks deliberately, reuses editable categories and preserves operational records',async()=>{
  const sessions=await prisma.workSession.count(),processes=await prisma.steelSiteTask.count(),documents=await prisma.sitePhaseDocument.count();
  await initializeOfficeCategories();await initializeOfficeCategories();const cats=(await officeWorkSnapshot()).categories;expect(cats).toHaveLength(5);
  const d=draft();await saveOfficeTask({...d,kind:'NOTE'});await saveOfficeTask({...d,version:1,kind:'COMPANY',categoryId:cats[0].id,ownerId:almet});
  as(almet);expect((await officeWorkSnapshot()).tasks.find(t=>t.id===d.id)?.kind).toBe('COMPANY');
  await expect(saveOfficeTask({...d,version:2,ownerId:almet})).rejects.toThrow('INVALID');
  await saveOfficeCategory({id:cats[0].id,name:'Updated category',archive:true});
  await saveOfficeTask({...d,version:2,kind:'COMPANY',categoryId:cats[0].id,ownerId:almet,status:'DONE'});
  await expect(saveOfficeTask({...draft(),kind:'COMPANY',categoryId:cats[0].id,ownerId:almet})).rejects.toThrow('INVALID');
  expect(await prisma.workSession.count()).toBe(sessions);expect(await prisma.steelSiteTask.count()).toBe(processes);expect(await prisma.sitePhaseDocument.count()).toBe(documents);
});
it('stores attachments atomically, retries without duplicates, replies and marks only personal reads',async()=>{
  const id=randomUUID(),file=new File(['%PDF-1.4\nSynthetic only\n%%EOF'],'Office demo.pdf',{type:'application/pdf'});
  const sent=await sendOfficeMail(mail({id,file}));await sendOfficeMail(mail({id,file}));expect(await prisma.officeMessage.count({where:{id}})).toBe(1);
  expect(await officeUnreadCount()).toBe(0);as(almet);expect(await officeUnreadCount()).toBe(1);
  const before=await prisma.officeThread.findUniqueOrThrow({where:{id:sent.id}});const thread=await readOfficeThread(sent.id);expect(thread.messages).toHaveLength(1);expect(await officeUnreadCount()).toBe(0);
  expect((await prisma.officeThread.findUniqueOrThrow({where:{id:sent.id}})).updatedAt).toEqual(before.updatedAt);
  const attachment=thread.messages[0].attachments[0];expect(Buffer.from((await readOfficeAttachment(attachment.id)).dataBytes).toString()).toContain('Synthetic only');
  await sendOfficeMail(mail({thread:sent.id,to:megi,body:'Reply from Almet'}));as(megi);expect(await officeUnreadCount()).toBe(1);expect((await readOfficeThread(sent.id)).messages).toHaveLength(2);
  as(outsider);await expect(readOfficeThread(sent.id)).rejects.toThrow('DENIED');await expect(readOfficeAttachment(attachment.id)).rejects.toThrow('DENIED');
  as(megi);await expect(sendOfficeMail(mail({id,file,body:'Changed retry'}))).rejects.toThrow('CONFLICT');
});
it('rejects foreign recipients, malformed uploads, mixed sessions and revoked access',async()=>{
  await expect(sendOfficeMail(mail({to:foreign}))).rejects.toThrow('DENIED');
  await expect(sendOfficeMail(mail({file:new File(['<script>bad</script>'],'fake.pdf',{type:'application/pdf'})}))).rejects.toThrow();
  auth.worker.mockResolvedValue({id:workerId,companyProfileId:companyId});await expect(officeWorkSnapshot()).rejects.toThrow('DENIED');
  auth.admin.mockResolvedValue(null);expect((await officeWorkSnapshot()).self).toBe(megi);
  await prisma.user.update({where:{id:megi},data:{isActive:false}});await expect(officeWorkSnapshot()).rejects.toThrow('DENIED');await prisma.user.update({where:{id:megi},data:{isActive:true}});
  as(megi);vi.stubEnv('VIRTUAL_OFFICE_WORK_ENABLED','false');await expect(officeWorkSnapshot()).rejects.toThrow('DENIED');vi.stubEnv('VIRTUAL_OFFICE_WORK_ENABLED','true');
});
it('enforces tenant RLS and composite foreign keys below the service layer',async()=>{
  const d=draft();await saveOfficeTask(d);
  await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);await tx.$executeRaw`SELECT set_config('app.current_tenant_id',${otherCompanyId},true)`;expect(await tx.officeTask.count({where:{id:d.id}})).toBe(0);});
  await expect(prisma.officeTask.create({data:{id:randomUUID(),companyProfileId:companyId,ownerId:foreign,createdById:foreign,title:'Cross-tenant',kind:'NOTE'}})).rejects.toThrow();
});
