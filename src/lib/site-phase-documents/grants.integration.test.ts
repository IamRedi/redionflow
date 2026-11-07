import {randomUUID} from 'node:crypto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import sharp from 'sharp';
const auth=vi.hoisted(()=>({admin:vi.fn(),worker:vi.fn(),company:vi.fn()}));
vi.mock('@/lib/auth/admin-session',()=>({getCurrentAdmin:auth.admin}));
vi.mock('@/lib/workzone/worker-session',()=>({getCurrentWorker:auth.worker}));
vi.mock('@/lib/db/tenant',()=>({getCurrentCompanyId:auth.company,isOwnedByCurrentCompany:(row:{companyProfileId:string},id:string)=>row.companyProfileId===id}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/realtime/event-hub',()=>({notifyRealtimeUpdate:vi.fn()}));
vi.mock('@/lib/i18n/action-messages',()=>({getActionTranslator:async()=>((key:string)=>key)}));
import {prisma} from '@/lib/db/prisma';
import {withTenantContext} from '@/lib/db/tenant-context';
import {assertAssistantTestDatabase} from '../../../tests/fixtures/assistant-database';
import {readEngineerOptions,readSiteEngineerGrants,setSiteEngineerGrants} from './grants';
import {readPhaseDocuments,uploadPhaseDocument,actOnPhaseDocument} from './service';
import {uploadSiteFileAction} from '@/app/(workzone)/workzone/site-file-actions';
import {importElementListsAction,createSiteFromProjectAction} from '@/app/(workzone)/workzone/element-actions';
import {uploadBaustelleDocumentAction,addManualTaskAction} from '@/app/(workzone)/workzone/actions';
import {saveAssetPhoto,readAssetPhoto} from '@/lib/asset-photos/service';
assertAssistantTestDatabase();
let companyId:string,foreignId:string,bossId:string,siteId:string,otherSiteId:string;
let people:{id:string;crewRole:string|null;firstName:string;lastName:string}[]=[];
const asBoss=()=>{auth.company.mockResolvedValue(companyId);auth.admin.mockResolvedValue({id:bossId,companyProfileId:companyId});auth.worker.mockResolvedValue(null);};
const asWorker=async(index:number)=>{auth.admin.mockResolvedValue(null);auth.worker.mockResolvedValue(await prisma.worker.findUniqueOrThrow({where:{id:people[index].id}}));};
const pdf=()=>new File(['%PDF-1.4\nSynthetic access only\n%%EOF'],'Synthetic.pdf',{type:'application/pdf'});
function form(site=siteId){const f=new FormData();f.set('requestId',randomUUID());f.set('siteId',site);f.set('baustelleId',site);f.set('phase','piketim');f.set('title','Synthetic plan');f.set('kind','document');f.set('file',pdf());return f;}
beforeEach(async()=>{
 companyId=(await prisma.companyProfile.create({data:{legalName:'Synthetic grants',displayName:'Synthetic grants'}})).id;
 foreignId=(await prisma.companyProfile.create({data:{legalName:'Foreign grants',displayName:'Foreign grants'}})).id;
 bossId=(await prisma.user.create({data:{companyProfileId:companyId,email:`grant-${randomUUID()}@example.test`,role:'ADMIN',isOwner:true}})).id;
 siteId=(await prisma.baustelle.create({data:{companyProfileId:companyId,name:'Synthetic site A',type:'STEEL_ASSEMBLY'}})).id;
 otherSiteId=(await prisma.baustelle.create({data:{companyProfileId:companyId,name:'Synthetic site B',type:'STEEL_ASSEMBLY'}})).id;
 people=await Promise.all(['FIELD_ENGINEER','FACTORY_ENGINEER','FIELD_WORKER','OFFICE',null].map((crewRole,i)=>prisma.worker.create({data:{companyProfileId:companyId,firstName:`Synthetic-${i}`,lastName:'Person',crewRole,level:'VORARBEITER'}})));
 asBoss();
});
afterEach(async()=>{
 const where={companyProfileId:{in:[companyId,foreignId]}};
 await prisma.sitePhaseDocumentReceipt.deleteMany({where});await prisma.sitePhaseDocument.deleteMany({where});await prisma.siteDocumentEngineer.deleteMany({where});await prisma.user.deleteMany({where});await prisma.companyProfile.deleteMany({where:{id:{in:[companyId,foreignId]}}});
});
it('starts closed, grants only the selected site, and records the actual administrator',async()=>{
 expect((await readEngineerOptions()).engineers.map(p=>p.id).sort()).toEqual(people.slice(0,2).map(p=>p.id).sort());
 await asWorker(0);expect((await readPhaseDocuments(siteId)).canUpload).toBe(false);await expect(uploadPhaseDocument(form())).rejects.toMatchObject({code:'DENIED'});
 asBoss();await setSiteEngineerGrants({siteId,workerIds:[people[0].id],revision:0});
 expect(await prisma.siteDocumentEngineer.findFirstOrThrow()).toMatchObject({workerId:people[0].id,grantedByUserId:bossId});
 await asWorker(0);expect((await readPhaseDocuments(siteId)).canUpload).toBe(true);expect((await readPhaseDocuments(otherSiteId)).canUpload).toBe(false);
 const created=await uploadPhaseDocument(form());expect((await readPhaseDocuments(siteId)).documents[0].canEdit).toBe(true);
 asBoss();await setSiteEngineerGrants({siteId,workerIds:[],revision:1});await asWorker(0);
 expect((await readPhaseDocuments(siteId)).documents[0].canEdit).toBe(false);await expect(uploadPhaseDocument(form())).rejects.toMatchObject({code:'DENIED'});await expect(actOnPhaseDocument({documentId:created.id,action:'archive'})).rejects.toMatchObject({code:'DENIED'});
 await actOnPhaseDocument({documentId:created.id,action:'receive'});expect(await prisma.sitePhaseDocument.count()).toBe(1);
});
it('enforces uploads across phase, ordinary, material-list and legacy endpoints',async()=>{
 for(const i of [0,1,2,4]){await asWorker(i);await expect(uploadPhaseDocument(form())).rejects.toMatchObject({code:'DENIED'});expect((await uploadSiteFileAction(form())).ok).toBe(false);expect((await importElementListsAction(form())).ok).toBe(false);expect((await uploadBaustelleDocumentAction(form())).ok).toBe(false);}
 await asWorker(3);expect((await uploadSiteFileAction(form())).ok).toBe(true);expect((await readPhaseDocuments(otherSiteId)).canUpload).toBe(true);
 asBoss();await setSiteEngineerGrants({siteId,workerIds:[people[0].id],revision:0});await asWorker(0);expect((await uploadSiteFileAction(form())).ok).toBe(true);
 const invoice=form();invoice.set('kind','invoice');expect((await uploadSiteFileAction(invoice)).ok).toBe(false);
 expect(await prisma.siteFile.count()).toBe(2);expect(await prisma.siteElement.count()).toBe(0);
});
it('does not turn office staff, inactive people, nonengineers or foreign identities into grant managers',async()=>{
 const foreignWorker=await prisma.worker.create({data:{companyProfileId:foreignId,firstName:'Foreign',lastName:'Engineer',crewRole:'FIELD_ENGINEER'}});
 for(const id of [foreignWorker.id,people[2].id,people[3].id])await expect(setSiteEngineerGrants({siteId,workerIds:[id],revision:0})).rejects.toMatchObject({code:'DENIED'});
 await prisma.worker.update({where:{id:people[0].id},data:{status:'inactive'}});await expect(setSiteEngineerGrants({siteId,workerIds:[people[0].id],revision:0})).rejects.toMatchObject({code:'DENIED'});
 await asWorker(3);expect(await readEngineerOptions()).toMatchObject({canManage:false});await expect(readSiteEngineerGrants(siteId)).rejects.toMatchObject({code:'DENIED'});await expect(setSiteEngineerGrants({siteId,workerIds:[],revision:0})).rejects.toMatchObject({code:'DENIED'});
 asBoss();auth.worker.mockResolvedValue({id:people[0].id});await expect(readSiteEngineerGrants(siteId)).rejects.toMatchObject({code:'DENIED'});
 expect(await prisma.siteDocumentEngineer.count()).toBe(0);expect((await prisma.baustelle.findUniqueOrThrow({where:{id:siteId}})).documentAccessRevision).toBe(0);
});
it('rejects competing revisions and checks role revocation even while a grant still exists',async()=>{
 const results=await Promise.allSettled([setSiteEngineerGrants({siteId,workerIds:[people[0].id],revision:0}),setSiteEngineerGrants({siteId,workerIds:[people[1].id],revision:0})]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
 const selected=await prisma.siteDocumentEngineer.findFirstOrThrow();await asWorker(people.findIndex(p=>p.id===selected.workerId));
 await prisma.worker.update({where:{id:selected.workerId},data:{crewRole:'FIELD_WORKER'}});expect((await readPhaseDocuments(siteId)).canUpload).toBe(false);await expect(uploadPhaseDocument(form())).rejects.toMatchObject({code:'DENIED'});
});
it('has tenant-composite foreign keys and forced RLS for the private grant table',async()=>{
 await setSiteEngineerGrants({siteId,workerIds:[people[0].id],revision:0});
 const role='site_grant_rls_probe';await prisma.$executeRawUnsafe(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
 try{await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${role}`);await prisma.$executeRawUnsafe(`GRANT SELECT ON "SiteDocumentEngineer" TO ${role}`);
 const count=(tenant:string)=>withTenantContext(tenant,async tx=>{await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);return tx.siteDocumentEngineer.count();});expect(await count(companyId)).toBe(1);expect(await count(foreignId)).toBe(0);
 const flags=await prisma.$queryRaw<{relrowsecurity:boolean;relforcerowsecurity:boolean}[]>`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='SiteDocumentEngineer'`;expect(flags[0]).toEqual({relrowsecurity:true,relforcerowsecurity:true});
 }finally{await prisma.$executeRawUnsafe(`DROP OWNED BY ${role}`);await prisma.$executeRawUnsafe(`DROP ROLE ${role}`);}
});
it('requires the same grant for the site cover and rejects forged task actors from read-only workers',async()=>{
 const image=()=>sharp({create:{width:24,height:24,channels:3,background:'#ee7711'}}).png().toBuffer().then(bytes=>new File([new Uint8Array(bytes)],'Synthetic.png',{type:'image/png'}));
 await asWorker(0);await expect(saveAssetPhoto('site',siteId,await image())).rejects.toThrow('PHOTO_DENIED');
 asBoss();await setSiteEngineerGrants({siteId,workerIds:[people[0].id],revision:0});await asWorker(0);await saveAssetPhoto('site',siteId,await image());const saved=await readAssetPhoto('site',siteId);
 asBoss();await setSiteEngineerGrants({siteId,workerIds:[],revision:1});await asWorker(0);await expect(saveAssetPhoto('site',siteId,await image())).rejects.toThrow('PHOTO_DENIED');expect(await readAssetPhoto('site',siteId)).toEqual(saved);
 await asWorker(2);for(const workerId of [people[2].id,bossId,people[0].id])expect((await addManualTaskAction({baustelleId:siteId,workerId,description:'Synthetic forged task'})).ok).toBe(false);
 expect(await prisma.manualTask.count()).toBe(0);
});
it('creates a project and its selected engineers atomically and does not let the office grant access',async()=>{
 const f=form();f.set('name','Synthetic new site');f.set('address','');f.append('documentEngineerId',people[0].id);
 const result=await createSiteFromProjectAction(f);expect(result.ok).toBe(true);expect(result.siteId).toBeTruthy();expect(await prisma.siteDocumentEngineer.findFirst({where:{baustelleId:result.siteId}})).toMatchObject({workerId:people[0].id});
 await asWorker(3);f.set('name','Office forbidden grant');expect((await createSiteFromProjectAction(f)).ok).toBe(false);expect(await prisma.baustelle.count({where:{name:'Office forbidden grant'}})).toBe(0);
 asBoss();f.set('name','Invalid engineer rollback');f.set('documentEngineerId',people[2].id);expect((await createSiteFromProjectAction(f)).ok).toBe(false);expect(await prisma.baustelle.count({where:{name:'Invalid engineer rollback'}})).toBe(0);
});
