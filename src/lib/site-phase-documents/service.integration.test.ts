import {randomUUID,createHash} from 'node:crypto';
import {afterAll,afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import sharp from 'sharp';
const auth=vi.hoisted(()=>({admin:vi.fn(),worker:vi.fn(),company:vi.fn()}));
vi.mock('@/lib/auth/admin-session',()=>({getCurrentAdmin:auth.admin}));
vi.mock('@/lib/workzone/worker-session',()=>({getCurrentWorker:auth.worker}));
vi.mock('@/lib/db/tenant',()=>({getCurrentCompanyId:auth.company}));
import {prisma} from '@/lib/db/prisma';
import {assertAssistantTestDatabase} from '../../../tests/fixtures/assistant-database';
import {documentActor} from './access';
import {actOnPhaseDocument,readPhaseDocumentFile,readPhaseDocuments,uploadPhaseDocument} from './service';
assertAssistantTestDatabase();
const probeRole='phase_document_rls_probe';
beforeAll(async()=>{await prisma.$executeRawUnsafe(`CREATE ROLE ${probeRole} NOLOGIN NOSUPERUSER NOBYPASSRLS`);await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${probeRole}`);await prisma.$executeRawUnsafe(`GRANT SELECT ON "SitePhaseDocument","SitePhaseDocumentReceipt","CompanyAssetCode" TO ${probeRole}`);});
afterAll(async()=>{await prisma.$executeRawUnsafe(`DROP OWNED BY ${probeRole}`);await prisma.$executeRawUnsafe(`DROP ROLE ${probeRole}`);});
let companies:string[]=[],companyId:string,siteId:string,foreignSite:string,bossId:string;
let people:{id:string;crewRole:string|null;level:string}[]=[];
const asBoss=()=>{auth.company.mockResolvedValue(companyId);auth.admin.mockResolvedValue({id:bossId,companyProfileId:companyId});auth.worker.mockResolvedValue(null);};
const asWorker=(index:number)=>{auth.admin.mockResolvedValue(null);auth.worker.mockResolvedValue({id:people[index].id,companyProfileId:companyId});};
const pdf=()=>new File(['%PDF-1.4\nSynthetic drawing only\n%%EOF'],'Synthetic drawing.pdf',{type:'application/pdf'});
function form(options:{requestId?:string;site?:string;phase?:string;previous?:string;file?:File}={}){
 const value=new FormData();for(const [key,data]of Object.entries({requestId:options.requestId??randomUUID(),siteId:options.site??siteId,phase:options.phase??'piketim',title:'Synthetic drawing',note:'Fictional test only',supersedesId:options.previous??''}))value.set(key,data);value.set('file',options.file??pdf());return value;
}
beforeEach(async()=>{
 companies=[];const company=await prisma.companyProfile.create({data:{displayName:`Phase fictional ${randomUUID()}`,legalName:'Synthetic phase company'}});companyId=company.id;companies.push(companyId);
 const other=await prisma.companyProfile.create({data:{displayName:`Phase foreign ${randomUUID()}`,legalName:'Synthetic foreign company'}});companies.push(other.id);
 siteId=(await prisma.baustelle.create({data:{companyProfileId:companyId,name:'Synthetic steel phase site',type:'STEEL_ASSEMBLY'}})).id;
 foreignSite=(await prisma.baustelle.create({data:{companyProfileId:other.id,name:'Foreign phase site',type:'STEEL_ASSEMBLY'}})).id;
 bossId=(await prisma.user.create({data:{companyProfileId:companyId,email:`phase-${randomUUID()}@example.test`,name:'Synthetic Office',role:'ADMIN'}})).id;
 people=await Promise.all(['OFFICE','FIELD_ENGINEER','FACTORY_ENGINEER','FIELD_WORKER','FACTORY_WORKER','MECHANIC',null].map((crewRole,index)=>prisma.worker.create({data:{companyProfileId:companyId,firstName:`Synthetic-${index}`,lastName:'Person',crewRole,level:index===6?'VORARBEITER':'JUNIOR'}})));
 asBoss();
});
afterEach(async()=>{
 const where={companyProfileId:{in:companies}};
 await prisma.sitePhaseDocumentReceipt.deleteMany({where});
 // Remove immutable version children before their parents in this guarded disposable fixture.
 while(await prisma.sitePhaseDocument.count({where})){
  const deleted=await prisma.sitePhaseDocument.deleteMany({where:{...where,nextVersion:{is:null}}});if(!deleted.count)throw new Error('Fixture version cycle');
 }
 await prisma.user.deleteMany({where});await prisma.companyProfile.deleteMany({where:{id:{in:companies}}});
});
it('uses fresh office/engineer permissions and denies workers, mechanics, mixed sessions and foreign sites',async()=>{
 for(const i of [0,1,2,6]){asWorker(i);expect((await documentActor()).workerId).toBe(people[i].id);expect((await readPhaseDocuments(siteId)).documents).toEqual([]);}
 for(const i of [3,4,5]){asWorker(i);await expect(readPhaseDocuments(siteId)).rejects.toMatchObject({code:'DENIED'});}
 asWorker(1);await prisma.worker.update({where:{id:people[1].id},data:{status:'inactive'}});await expect(documentActor()).rejects.toMatchObject({code:'DENIED'});
 asBoss();auth.worker.mockResolvedValue({id:people[0].id});await expect(documentActor()).rejects.toMatchObject({code:'DENIED'});
 asBoss();await expect(uploadPhaseDocument(form({site:foreignSite}))).rejects.toMatchObject({code:'NOT_FOUND'});
});
it('records only the current person, idempotently, and keeps new-version receipts separate from history',async()=>{
 const requestId=randomUUID(),first=await uploadPhaseDocument(form({requestId}));expect(await uploadPhaseDocument(form({requestId}))).toEqual(first);
 expect((await readPhaseDocuments(siteId)).documents).toHaveLength(1);
 asWorker(1);await Promise.all([actOnPhaseDocument({documentId:first.id,action:'receive'}),actOnPhaseDocument({documentId:first.id,action:'receive'})]);
 const received=(await readPhaseDocuments(siteId)).documents[0].receipts[0];expect(received).toMatchObject({name:'Synthetic-1 Person',mine:true});
 await actOnPhaseDocument({documentId:first.id,action:'receive'});expect((await readPhaseDocuments(siteId)).documents[0].receipts).toEqual([received]);
 await expect(actOnPhaseDocument({documentId:first.id,action:'receive',actorName:'Forged'})).rejects.toThrow();
 await expect(uploadPhaseDocument(form({previous:first.id}))).rejects.toMatchObject({code:'DENIED'});
 asBoss();const next=await uploadPhaseDocument(form({previous:first.id}));
 const snapshot=await readPhaseDocuments(siteId);expect(snapshot.documents.find(d=>d.id===first.id)?.archivedAt).toBeTruthy();expect(snapshot.documents.find(d=>d.id===next.id)?.receipts).toEqual([]);
 expect(snapshot.documents.find(d=>d.id===first.id)?.receipts[0].name).toBe('Synthetic-1 Person');
 await expect(actOnPhaseDocument({documentId:first.id,action:'receive'})).rejects.toMatchObject({code:'CONFLICT'});
 expect((await readPhaseDocumentFile(first.id)).dataBytes).toEqual((await readPhaseDocumentFile(next.id)).dataBytes);
 asWorker(2);await actOnPhaseDocument({documentId:next.id,action:'receive'});expect((await readPhaseDocuments(siteId)).documents.find(d=>d.id===next.id)?.receipts[0].name).toBe('Synthetic-2 Person');
});
it('rejects UUID replay with different content, serializes competing replacements and keeps old general documents intact',async()=>{
 const original=await uploadPhaseDocument(form());const requestId=randomUUID();await uploadPhaseDocument(form({requestId,phase:'rilevim'}));
 await expect(uploadPhaseDocument(form({requestId,phase:'porosi'}))).rejects.toMatchObject({code:'CONFLICT'});
 const replacements=await Promise.allSettled([uploadPhaseDocument(form({previous:original.id})),uploadPhaseDocument(form({previous:original.id}))]);
 expect(replacements.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(replacements.filter(r=>r.status==='rejected')).toHaveLength(1);
 expect(await prisma.siteFile.count({where:{companyProfileId:companyId}})).toBe(0);
});
it('isolates file bytes and receipts across tenants at service and forced-RLS level',async()=>{
 const first=await uploadPhaseDocument(form());const foreign=companies[1];
 const otherBoss=await prisma.user.create({data:{companyProfileId:foreign,email:`foreign-phase-${randomUUID()}@example.test`,role:'ADMIN'}});
 auth.company.mockResolvedValue(foreign);auth.admin.mockResolvedValue({id:otherBoss.id});
 await expect(readPhaseDocumentFile(first.id)).rejects.toMatchObject({code:'NOT_FOUND'});
 await expect(readPhaseDocuments(siteId)).rejects.toMatchObject({code:'NOT_FOUND'});
 await expect(actOnPhaseDocument({documentId:first.id,action:'receive'})).rejects.toMatchObject({code:'NOT_FOUND'});
 const restricted=(tenant:string|null)=>prisma.$transaction(async tx=>{await tx.$executeRawUnsafe(`SET LOCAL ROLE ${probeRole}`);if(tenant)await tx.$executeRaw`SELECT set_config('app.current_tenant_id',${tenant},true)`;return {docs:await tx.sitePhaseDocument.count(),receipts:await tx.sitePhaseDocumentReceipt.count(),codes:await tx.companyAssetCode.count()};});
 expect(await restricted(foreign)).toEqual({docs:0,receipts:0,codes:0});expect(await restricted(null)).toEqual({docs:0,receipts:0,codes:0});
 expect((await restricted(companyId)).docs).toBe(1);
 const policies=await prisma.$queryRaw<{relname:string;relrowsecurity:boolean;relforcerowsecurity:boolean}[]>`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('SitePhaseDocument','SitePhaseDocumentReceipt','CompanyAssetCode')`;
 expect(policies).toHaveLength(3);expect(policies.every(p=>p.relrowsecurity&&p.relforcerowsecurity)).toBe(true);
});
it('sniffs actual bytes and stores bounded WebP without metadata while preserving document bytes',async()=>{
 await expect(uploadPhaseDocument(form({file:new File(['not a pdf'],'x.pdf',{type:'application/pdf'})}))).rejects.toMatchObject({code:'FILE_INVALID'});
 const png=await sharp({create:{width:32,height:24,channels:3,background:'#cc7733'}}).png().toBuffer();
 const photo=await uploadPhaseDocument(form({file:new File([new Uint8Array(png)],'Synthetic.png',{type:'image/png'})}));
 const saved=await readPhaseDocumentFile(photo.id);expect(saved.mime).toBe('image/webp');expect(saved.size).toBeLessThanOrEqual(180000);
 const meta=await sharp(saved.dataBytes).metadata();expect(meta.exif).toBeUndefined();expect(meta.format).toBe('webp');
 const plain=await uploadPhaseDocument(form());const doc=await readPhaseDocumentFile(plain.id);
 expect(createHash('sha256').update(doc.dataBytes).digest('hex')).toBe(createHash('sha256').update(new Uint8Array(await pdf().arrayBuffer())).digest('hex'));
});
