import {afterEach,beforeEach,expect,it} from 'vitest';
import {prisma} from '@/lib/db/prisma';
import {withTenantContext} from '@/lib/db/tenant-context';
import {assertAssistantTestDatabase} from '../../../tests/fixtures/assistant-database';
import {removeSiteFileData} from './remove-data';
assertAssistantTestDatabase();
let companyId:string,siteId:string,otherSiteId:string;
const file=(data:{baustelleId?:string;kind:string;fileName:string;reference?:string|null})=>prisma.siteFile.create({data:{companyProfileId:companyId,baustelleId:data.baustelleId??siteId,kind:data.kind,fileName:data.fileName,reference:data.reference??null,mime:'application/pdf',size:1,data:new Uint8Array([1])},select:{id:true,baustelleId:true,kind:true,fileName:true,reference:true}});
const element=(mark:string,sourceFile:string,baustelleId=siteId)=>prisma.siteElement.create({data:{companyProfileId:companyId,baustelleId,list:'assembly',mark,sourceFile}});
const batch=(data:{orderRef?:string|null;siteFileId?:string|null;baustelleId?:string})=>prisma.productionBatch.create({data:{companyProfileId:companyId,baustelleId:data.baustelleId??siteId,title:'Synthetic',steps:[],orderRef:data.orderRef??null,siteFileId:data.siteFileId??null}});
beforeEach(async()=>{
 companyId=(await prisma.companyProfile.create({data:{legalName:'Synthetic remove',displayName:'Synthetic remove'}})).id;
 siteId=(await prisma.baustelle.create({data:{companyProfileId:companyId,name:'Synthetic A',type:'STEEL_ASSEMBLY'}})).id;
 otherSiteId=(await prisma.baustelle.create({data:{companyProfileId:companyId,name:'Synthetic B',type:'STEEL_ASSEMBLY'}})).id;
});
afterEach(async()=>{await prisma.companyProfile.deleteMany({where:{id:companyId}});});
it('a deleted element list takes its elements and their work with it, but not other files or sites',async()=>{
 const list=await file({kind:'document',fileName:'lista.xlsx'});
 const own=await element('B/1','lista.xlsx');await element('B/2','tjeter.xlsx');await element('B/1','lista.xlsx',otherSiteId);
 await prisma.siteElementWork.create({data:{companyProfileId:companyId,elementId:own.id,stage:'cut',workerIds:[],checkedByName:'Synthetic'}});
 expect(await withTenantContext(companyId,tx=>removeSiteFileData(tx,companyId,list))).toEqual({elements:1,batches:0});
 expect((await prisma.siteElement.findMany({where:{companyProfileId:companyId},select:{mark:true,baustelleId:true}})).map(e=>`${e.baustelleId===siteId?'A':'B'}:${e.mark}`).sort()).toEqual(['A:B/2','B:B/1']);
});
it('keeps elements while another file of the same name is still on the site',async()=>{
 const a=await file({kind:'document',fileName:'lista.xlsx'});await file({kind:'document',fileName:'lista.xlsx'});await element('B/1','lista.xlsx');
 expect(await withTenantContext(companyId,tx=>removeSiteFileData(tx,companyId,a))).toEqual({elements:0,batches:0});
});
it('a deleted order takes its factory material (linked, or older by order number) and nothing else',async()=>{
 const order=await file({kind:'order',fileName:'porosia.pdf',reference:'P-7'});
 await batch({siteFileId:order.id});await batch({orderRef:'P-7'});await batch({orderRef:'P-8'});await batch({orderRef:'P-7',baustelleId:otherSiteId});await batch({});
 expect(await withTenantContext(companyId,tx=>removeSiteFileData(tx,companyId,order))).toEqual({elements:0,batches:2});
 expect(await prisma.productionBatch.count({where:{companyProfileId:companyId}})).toBe(3);
});
