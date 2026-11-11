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
it('previews employee work using the employee keys without impersonation or private work',async()=>{
 vi.stubEnv('VIRTUAL_OFFICE_TEAM_ENABLED','true');
 await initializeOfficeCategories();
 const {saveOfficeMember,officeDirectory}=await import('./team-service');
 const {officePreviewTarget,officePreviewTasks,officePreviewPlan}=await import('./preview');
 const {officeResources,officeSiteFiles,officeWorkbooks}=await import('./resources');
 const person=await prisma.worker.create({data:{companyProfileId:companyId,firstName:'Preview',lastName:'Demo',crewRole:'OFFICE',accessLevel:'BASE'}});
 const allowed=await prisma.baustelle.create({data:{companyProfileId:companyId,name:'Preview allowed',documents:[]}});
 const denied=await prisma.baustelle.create({data:{companyProfileId:companyId,name:'Preview denied',documents:[]}});
 const member=await saveOfficeMember({workerId:person.id,title:'Office',enabled:true,workbooksEnabled:false,version:0});
 await prisma.accessGrant.create({data:{companyProfileId:companyId,workerId:person.id,place:'site',scopeId:allowed.id,level:'view'}});
 const work={...draft(),id:randomUUID(),ownerId:member.id,kind:'COMPANY',categoryId:'OTHER',title:'Visible company assignment'};await saveOfficeTask(work);
 auth.admin.mockResolvedValue(null);auth.worker.mockResolvedValue({id:person.id,companyProfileId:companyId});
 await saveOfficeTask({...draft(),id:randomUUID(),ownerId:member.id,title:'Employee confidential note'});
 const employeeSites=(await officeResources()).sites;
 await expect(officeResources(member.id)).rejects.toThrow('DENIED');
 as(megi);
 expect((await officeResources(member.id)).sites).toEqual(employeeSites);
 expect((await officePreviewTasks(member.id)).map(t=>t.title)).toEqual(['Visible company assignment']);
 await expect(officeSiteFiles(denied.id,member.id)).rejects.toThrow('DENIED');
 await expect(officeWorkbooks('2026-11',undefined,member.id)).rejects.toThrow('DENIED');
 await prisma.accessGrant.create({data:{companyProfileId:companyId,workerId:person.id,place:'daily_plan',scopeId:'',level:'none'}});
 await expect(officePreviewPlan(member.id,'2026-11-11')).rejects.toThrow('DENIED');
 expect((await officeWorkSnapshot()).self).toBe(megi);
 await prisma.officeMember.update({where:{id:member.id},data:{enabled:false}});
 expect((await officeDirectory()).people.some(p=>p.id===member.id&&!p.enabled)).toBe(true);
 expect((await officePreviewTarget(member.id)).member.enabled).toBe(false);
 await prisma.worker.update({where:{id:person.id},data:{status:'inactive'}});
 await expect(officePreviewTarget(member.id)).rejects.toThrow('NOT_FOUND');
 vi.stubEnv('VIRTUAL_OFFICE_TEAM_ENABLED','false');
});
afterAll(async()=>{
  if(companyId){const where={companyProfileId:companyId};await prisma.officeAttachment.deleteMany({where});await prisma.officeMessage.deleteMany({where});await prisma.officeThread.deleteMany({where});await prisma.officeTask.deleteMany({where});await prisma.officeCategory.deleteMany({where});await prisma.officeMember.deleteMany({where});await prisma.worker.deleteMany({where});await prisma.user.deleteMany({where:{companyProfileId:{in:[companyId,otherCompanyId]}}});await prisma.companyProfile.deleteMany({where:{id:{in:[companyId,otherCompanyId]}}});}
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
  await initializeOfficeCategories();await initializeOfficeCategories();const cats=(await officeWorkSnapshot()).categories;expect(cats).toHaveLength(6);
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
it('supports employee offices, scoped tasks, manager-only setup and immediate revocation',async()=>{
  vi.stubEnv('VIRTUAL_OFFICE_TEAM_ENABLED','true');
  const {saveOfficeMember,officeTeamSettings}=await import('./team-service');
  const staff=await prisma.worker.create({data:{companyProfileId:companyId,firstName:'Engineer',lastName:'Demo'}});
  const second=await prisma.worker.create({data:{companyProfileId:companyId,firstName:'Finance',lastName:'Demo'}});
  const foreignWorker=await prisma.worker.create({data:{companyProfileId:otherCompanyId,firstName:'Foreign',lastName:'Demo'}});
  try{
    await expect(saveOfficeMember({workerId:foreignWorker.id,title:'Office',enabled:true,version:0})).rejects.toThrow('NOT_FOUND');
    const member=await saveOfficeMember({workerId:staff.id,title:'Projektim',enabled:true,version:0});
    const colleague=await saveOfficeMember({workerId:second.id,title:'Financë',enabled:true,version:0});
    const sent=await sendOfficeMail(mail({to:member.id,body:'Private staff mail'}));
    const categories=(await officeWorkSnapshot()).categories;
    const task={...draft(),id:randomUUID(),kind:'COMPANY',ownerId:member.id,categoryId:categories[0].id};await saveOfficeTask(task);
    await saveOfficeTask({...draft(),id:randomUUID(),kind:'COMPANY',ownerId:colleague.id,categoryId:categories[0].id,title:'Unrelated private assignment'});
    auth.admin.mockResolvedValue(null);auth.worker.mockResolvedValue({id:staff.id,companyProfileId:companyId});
    expect((await readOfficeThread(sent.id)).messages[0].body).toBe('Private staff mail');await sendOfficeMail(mail({thread:sent.id,to:megi,body:'Staff reply'}));
    const snapshot=await officeWorkSnapshot();expect(snapshot.manager).toBe(false);expect(snapshot.self).toBe(member.id);expect(snapshot.tasks.some(t=>t.id===task.id)).toBe(true);expect(snapshot.tasks.some(t=>t.title==='Unrelated private assignment')).toBe(false);
    await expect(officeTeamSettings()).rejects.toThrow('DENIED');await expect(saveOfficeCategory({id:null,name:'Unauthorized'})).rejects.toThrow('DENIED');
    await saveOfficeTask({...task,version:1,status:'DONE'});
    const privateTask={...draft(),id:randomUUID(),ownerId:member.id};await saveOfficeTask(privateTask);
    as(megi);expect((await officeWorkSnapshot()).tasks.some(t=>t.id===privateTask.id)).toBe(false);
    await saveOfficeMember({workerId:staff.id,title:'Projektim',enabled:false,version:1});
    auth.admin.mockResolvedValue(null);auth.worker.mockResolvedValue({id:staff.id,companyProfileId:companyId});await expect(officeWorkSnapshot()).rejects.toThrow('DENIED');await expect(readOfficeThread(sent.id)).rejects.toThrow('DENIED');
    as(megi);await expect(saveOfficeTask({...task,version:2})).rejects.toThrow('DENIED');
  }finally{as(megi);vi.stubEnv('VIRTUAL_OFFICE_TEAM_ENABLED','false');await prisma.worker.delete({where:{id:foreignWorker.id}});}
});
it('filters office resources, protects workbook access and isolates personal assistant sources',async()=>{
 vi.stubEnv('VIRTUAL_OFFICE_TEAM_ENABLED','true');
 const {saveOfficeMember,prepareOfficeTeam}=await import('./team-service');
 const {officeResources,officeSiteFiles,officeWorkbooks}=await import('./resources');
 const {personalOfficeContext,personalOfficeMail}=await import('./personal-context');
 const staff=await prisma.worker.create({data:{companyProfileId:companyId,firstName:'Economist',lastName:'Demo',position:'Accounting',crewRole:'OFFICE',accessLevel:'BASE'}});
 const permitted=await prisma.baustelle.create({data:{companyProfileId:companyId,name:'Allowed office site',documents:[],type:'STEEL_ASSEMBLY'}});
 const denied=await prisma.baustelle.create({data:{companyProfileId:companyId,name:'Unrelated office site',documents:[],type:'STEEL_ASSEMBLY'}});
 try{
  vi.stubEnv('VIRTUAL_OFFICE_TEAM_SETUP_JSON',JSON.stringify({companyId:otherCompanyId,people:[{workerId:staff.id,title:'Wrong tenant'}]}));await expect(prepareOfficeTeam()).rejects.toThrow('DENIED');vi.stubEnv('VIRTUAL_OFFICE_TEAM_SETUP_JSON',JSON.stringify({companyId,people:[{workerId:staff.id,title:'Accounting',workbooksEnabled:false}]}));
  await prepareOfficeTeam();vi.stubEnv('VIRTUAL_OFFICE_TEAM_SETUP_JSON','');let member=await prisma.officeMember.findUniqueOrThrow({where:{companyProfileId_workerId:{companyProfileId:companyId,workerId:staff.id}}});expect(member.enabled).toBe(false);expect(member.workbooksEnabled).toBe(false);
  await saveOfficeMember({workerId:staff.id,title:'Accounting',enabled:true,version:member.version});
  await prisma.accessGrant.create({data:{companyProfileId:companyId,workerId:staff.id,place:'site',scopeId:permitted.id,level:'view'}});
  await prisma.accessGrant.create({data:{companyProfileId:companyId,workerId:staff.id,place:'factory',scopeId:'',level:'act'}});
  await prisma.siteFile.create({data:{companyProfileId:companyId,baustelleId:permitted.id,kind:'invoice',officeOnly:true,fileName:'Private price.pdf',mime:'application/pdf',size:5,data:Buffer.from('dummy')}});
  await prisma.siteFile.create({data:{companyProfileId:companyId,baustelleId:permitted.id,kind:'document',fileName:'Drawing.pdf',mime:'application/pdf',size:5,data:Buffer.from('dummy')}});
  await prisma.workSession.create({data:{workerId:staff.id,startTime:new Date('2026-11-10T07:00:00Z'),endTime:new Date('2026-11-10T15:00:00Z'),totalHours:7.5,breakMinutes:30}});
  const privateAdmin={...draft(),id:randomUUID(),title:'Director confidential note'};await saveOfficeTask(privateAdmin);
  const privateMail=await sendOfficeMail(mail({body:'Director confidential mail'}));
  auth.admin.mockResolvedValue(null);auth.worker.mockResolvedValue({id:staff.id,companyProfileId:companyId});
  expect((await officeResources()).sites.map(s=>s.id)).toEqual([permitted.id]);expect((await officeSiteFiles(permitted.id)).files.map(f=>f.fileName)).toEqual(['Drawing.pdf']);await expect(officeSiteFiles(denied.id)).rejects.toThrow('DENIED');
  await expect(officeWorkbooks('2026-11')).rejects.toThrow('DENIED');await expect(personalOfficeMail(privateMail.id)).rejects.toThrow('NOT_FOUND');
  const context=await personalOfficeContext();expect(context.namespace).toContain(member.id);expect(JSON.stringify(context)).not.toContain('Director confidential');
  as(megi);await expect(personalOfficeContext()).rejects.toThrow('DENIED');
  member=await prisma.officeMember.findUniqueOrThrow({where:{id:member.id}});await saveOfficeMember({workerId:staff.id,title:'Accounting',enabled:true,workbooksEnabled:true,version:member.version});
  auth.admin.mockResolvedValue(null);auth.worker.mockResolvedValue({id:staff.id,companyProfileId:companyId});
  const books=await officeWorkbooks('2026-11',staff.id);expect(books.summary[0].hours).toBe(7.5);expect(books.rows.reduce((n,r)=>n+r.totalHours,0)).toBe(7.5);expect(books.summary[0]).not.toHaveProperty('nationalId');
  await prisma.accessGrant.create({data:{companyProfileId:companyId,workerId:staff.id,place:'staff',scopeId:'',level:'none'}});await expect(officeWorkbooks('2026-11')).rejects.toThrow('DENIED');
  as(megi);member=await prisma.officeMember.findUniqueOrThrow({where:{id:member.id}});await saveOfficeMember({workerId:staff.id,title:'Accounting',enabled:true,workbooksEnabled:false,version:member.version});
  auth.admin.mockResolvedValue(null);auth.worker.mockResolvedValue({id:staff.id,companyProfileId:companyId});await expect(officeWorkbooks('2026-11')).rejects.toThrow('DENIED');
 }finally{as(megi);await prisma.siteFile.deleteMany({where:{baustelleId:permitted.id}});await prisma.baustelle.deleteMany({where:{id:{in:[permitted.id,denied.id]}}});vi.stubEnv('VIRTUAL_OFFICE_TEAM_ENABLED','false');}
});
