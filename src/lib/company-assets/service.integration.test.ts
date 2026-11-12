import {randomUUID} from 'node:crypto';
import {afterAll,afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import sharp from 'sharp';
const identity=vi.hoisted(()=>({actor:vi.fn()}));
vi.mock('./access',async original=>({...await original<typeof import('./access')>(),assetActor:identity.actor}));
import {prisma} from '@/lib/db/prisma';
import {withTenantContext} from '@/lib/db/tenant-context';
import {assertAssistantTestDatabase} from '../../../tests/fixtures/assistant-database';
import {runAssetMutation,readAssetSnapshot,readAssetDetail,assertAssetUsable,readCanonicalAssetStatuses} from './service';
import {saveCompanyAssetFile,readCompanyAssetFile} from './files';
import {assistantAssetGrounding} from '@/lib/assistant/asset-grounding';
import {adminSearchCompanyFleet} from '@/lib/assistant/company-tools';
import type {AssetActor} from './access';
import type {AssetCommand,AssetRef} from './types';
assertAssistantTestDatabase();
const probeRole='company_asset_domain_probe';
beforeAll(async()=>{await prisma.$executeRawUnsafe(`CREATE ROLE ${probeRole} NOLOGIN NOSUPERUSER NOBYPASSRLS`);await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${probeRole}`);await prisma.$executeRawUnsafe(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${probeRole}`);});
afterAll(async()=>{await prisma.$executeRawUnsafe(`DROP OWNED BY ${probeRole}`);await prisma.$executeRawUnsafe(`DROP ROLE ${probeRole}`);});
let companies:string[]=[],boss:AssetActor,workerA:AssetActor,workerB:AssetActor,mechanic:AssetActor,ref:AssetRef,machine:AssetRef,other:AssetRef;
const mutate=(command:AssetCommand,requestId=randomUUID())=>runAssetMutation({requestId,command});
const as=(actor:AssetActor)=>identity.actor.mockResolvedValue(actor);
function fileForm(asset:AssetRef,kind:'invoice'|'photo'|'document'|'cover',file:File,repairId?:string,requestId=randomUUID()){
 const form=new FormData();form.set('assetKind',asset.kind);form.set('assetId',asset.id);form.set('kind',kind);form.set('requestId',requestId);form.set('file',file);if(repairId)form.set('repairId',repairId);return form;
}
const pdf=()=>new File(['%PDF-1.4\nSynthetic repair document\n%%EOF'],'Fictional.pdf',{type:'application/pdf'});
async function handover(id:string){return prisma.companyAssetHandover.findUniqueOrThrow({where:{id}});}
async function give(){as(boss);const result=await mutate({type:'handover',asset:ref,kind:'issue',toWorkerId:workerA.workerId!}) as {handoverId:string};as(workerA);await mutate({type:'confirm-handover',handoverId:result.handoverId,revision:(await handover(result.handoverId)).revision});as(boss);}
beforeEach(async()=>{
 identity.actor.mockReset();companies=[];
 const a=await prisma.companyProfile.create({data:{displayName:`Asset fictional ${randomUUID()}`,legalName:'Synthetic asset company'}});companies.push(a.id);
 const b=await prisma.companyProfile.create({data:{displayName:`Asset foreign ${randomUUID()}`,legalName:'Synthetic foreign company'}});companies.push(b.id);
 const user=await prisma.user.create({data:{companyProfileId:a.id,email:`asset-${randomUUID()}@example.test`,name:'Fictional chief',role:'ADMIN'}});
 const workers=await Promise.all(['A','B','Mechanic'].map(firstName=>prisma.worker.create({data:{companyProfileId:a.id,firstName,lastName:'Fictional',crewRole:firstName==='Mechanic'?'MECHANIC':'FIELD_WORKER'}})));
 boss={companyId:a.id,userId:user.id,workerId:null,name:'Fictional chief',canRegister:true,canManage:true,canRepair:true};
 [workerA,workerB,mechanic]=workers.map(w=>({companyId:a.id,userId:null,workerId:w.id,name:`${w.firstName} Fictional`,canRegister:false,canManage:false,canRepair:w.crewRole==='MECHANIC'}));
 await prisma.baustelle.create({data:{companyProfileId:a.id,name:'Synthetic steel site',type:'STEEL_ASSEMBLY',documents:[]}});
 const item=await prisma.companyInventoryItem.create({data:{companyProfileId:a.id,name:'Fictional drill',category:'WORK_TOOL',itemCode:'ITEM-ONLY-CODE',barcode:`BAR-${randomUUID()}`}});ref={kind:'inventory',id:item.id};
 const m=await prisma.machine.create({data:{companyProfileId:a.id,name:'Fictional truck',hourlyRateCents:100,targe:'TEST 001'}});machine={kind:'machine',id:m.id};
 const foreign=await prisma.companyInventoryItem.create({data:{companyProfileId:b.id,name:'Foreign drill',category:'WORK_TOOL',itemCode:'FOREIGN'}});other={kind:'inventory',id:foreign.id};as(boss);
});
afterEach(async()=>{
 const where={companyProfileId:{in:companies}};
 await prisma.companyAssetCode.deleteMany({where});
 await prisma.companyAssetFile.deleteMany({where});await prisma.companyAssetEvent.deleteMany({where});await prisma.companyAssetHandover.deleteMany({where});await prisma.companyAssetIncident.deleteMany({where});await prisma.companyAssetRepair.deleteMany({where});await prisma.companyOperationalAsset.deleteMany({where});await prisma.companyAssetCommandReceipt.deleteMany({where});
 await prisma.workerAssetItem.deleteMany({where:{worker:{companyProfileId:{in:companies}}}});await prisma.inventoryAssetMovement.deleteMany({where});await prisma.user.deleteMany({where});await prisma.companyProfile.deleteMany({where:{id:{in:companies}}});
});
it('resolves exact factory QR and GTIN identities, keeps multiple units explicit, and never treats names as scans',async()=>{
 const qr='https://factory.example.test/Drill?serial=001-aB&part=M_7';
 const result=await mutate({type:'register',name:'Fictional factory drill',category:'tool',quantity:2,factoryCode:qr}) as {assets:AssetRef[]};
 expect((await readAssetSnapshot({scan:qr})).assets.map(a=>a.id).sort()).toEqual(result.assets.map(a=>a.id).sort());
 expect((await readAssetSnapshot({scan:qr.toUpperCase()})).total).toBe(0);
 expect((await readAssetSnapshot({scan:'Fictional factory drill'})).total).toBe(0);
 const codes=await Promise.all(result.assets.map(async r=>(await readAssetDetail(r)).asset.code!));
 expect(new Set(codes).size).toBe(2);expect(codes.every(c=>/^AS-[A-F0-9]{12}$/.test(c))).toBe(true);
 expect((await readAssetSnapshot({scan:codes[0].toLowerCase()})).assets.map(a=>a.id)).toEqual([result.assets[0].id]);
 await mutate({type:'code-add',asset:ref,value:'012345678905'});expect((await readAssetSnapshot({scan:'0012345678905'})).assets[0].id).toBe(ref.id);
 const gs1='0101234567890128\u001d21AbC_123';await mutate({type:'code-add',asset:ref,value:gs1});expect((await readAssetSnapshot({scan:gs1})).assets[0].id).toBe(ref.id);
 await expect(mutate({type:'code-add',asset:other,value:qr})).rejects.toMatchObject({code:'NOT_FOUND'});
 as(workerA);await expect(mutate({type:'code-add',asset:ref,value:'Worker cannot alias'})).rejects.toMatchObject({code:'DENIED'});
});
it('reuses generated unit labels, soft-unlinks factory aliases, and preserves legacy codes and custody guards',async()=>{
 const generated=await mutate({type:'code-generate',asset:ref}) as {code:string};
 expect(await mutate({type:'code-generate',asset:ref})).toEqual(generated);
 expect((await readAssetSnapshot({scan:generated.code})).assets[0].id).toBe(ref.id);
 await mutate({type:'code-add',asset:ref,value:'Factory:Abc_001'});
 const detail=await readAssetDetail(ref),factory=detail.codes.find(c=>c.kind==='factory')!;
 await mutate({type:'code-remove',asset:ref,codeId:factory.id});expect((await readAssetSnapshot({scan:factory.value})).total).toBe(0);
 expect((await prisma.companyAssetCode.findUniqueOrThrow({where:{id:factory.id}})).revokedAt).not.toBeNull();
 await mutate({type:'code-add',asset:ref,value:factory.value});expect((await readAssetDetail(ref)).codes.find(c=>c.kind==='factory')?.id).toBe(factory.id);
 await expect(mutate({type:'code-remove',asset:ref,codeId:detail.codes.find(c=>c.kind==='label')!.id})).rejects.toMatchObject({code:'NOT_FOUND'});
 const legacy=(await prisma.companyInventoryItem.findUniqueOrThrow({where:{id:ref.id}})).barcode!;
 expect((await readAssetSnapshot({scan:legacy})).assets[0].id).toBe(ref.id);
 await mutate({type:'report',asset:ref,kind:'defect',note:'Synthetic drill jammed'});
 expect((await readAssetSnapshot({scan:generated.code,includeInactive:true})).assets[0].availability).toBe('reported');
 await expect(mutate({type:'handover',asset:ref,kind:'issue',toWorkerId:workerA.workerId!})).rejects.toMatchObject({code:'ASSET_UNAVAILABLE'});
});
it('reads legacy rows without backfill, counts the whole filtered dataset and paginates individual clothing units',async()=>{
 expect((await readAssetDetail(ref)).asset.revision).toBe(0);expect(await prisma.companyOperationalAsset.count({where:{companyProfileId:boss.companyId}})).toBe(0);
 expect((await readAssetSnapshot({query:'ITEM-ONLY-CODE'})).assets[0].id).toBe(ref.id);
 await mutate({type:'register',name:'Fictional jacket',category:'clothing',quantity:35,size:'M'});
 const first=await readAssetSnapshot({category:'clothing'}),second=await readAssetSnapshot({category:'clothing',page:2});
 expect(first.total).toBe(35);expect(first.counts.available).toBe(35);expect(first.assets).toHaveLength(30);expect(first.hasMore).toBe(true);expect(second.assets).toHaveLength(5);expect(new Set([...first.assets,...second.assets].map(a=>a.id)).size).toBe(35);
 await mutate({type:'edit',asset:ref,revision:0,name:'Fictional drill edited'});expect((await readAssetDetail(ref)).asset.name).toBe('Fictional drill edited');
});
it('groups the entire permitted clothing stock by name and size without changing units or counting pending custody as reserve',async()=>{
 const items=[];
 for(let n=0;n<36;n++)items.push(await prisma.companyInventoryItem.create({data:{companyProfileId:boss.companyId,category:'CLOTHING',name:n===35?' Fictional jacket ':'Fictional jacket',sizeLabel:n===35?' m ':'M',itemCode:`XLS-FIXTURE-${n}`}}));
 await prisma.companyInventoryItem.createMany({data:[{companyProfileId:boss.companyId,category:'CLOTHING',name:'Fictional jacket',sizeLabel:'L',itemCode:'XLS-L-1'},{companyProfileId:boss.companyId,category:'CLOTHING',name:'Fictional jacket',sizeLabel:'L',itemCode:'XLS-L-2'},{companyProfileId:boss.companyId,category:'CLOTHING',name:'Fictional gloves',sizeLabel:null,itemCode:'XLS-G-1'},{companyProfileId:boss.companyId,category:'CLOTHING',name:'Fictional gloves',sizeLabel:' ',itemCode:'XLS-G-2'},{companyProfileId:companies[1],category:'CLOTHING',name:'Fictional jacket',sizeLabel:'M',itemCode:'XLS-FOREIGN'}]});
 for(let n=0;n<3;n++){const workerId=n===2?workerB.workerId!:workerA.workerId!;await prisma.companyOperationalAsset.create({data:{companyProfileId:boss.companyId,inventoryItemId:items[n].id,holderWorkerId:workerId}});await prisma.workerAssetItem.create({data:{workerId,companyInventoryItemId:items[n].id,kind:'CLOTHING',itemName:items[n].name,status:'ACTIVE',createdByRole:'ADMIN'}});}
 const pendingAsset=await prisma.companyOperationalAsset.create({data:{companyProfileId:boss.companyId,inventoryItemId:items[3].id}});
 await prisma.companyAssetHandover.create({data:{companyProfileId:boss.companyId,assetId:pendingAsset.id,kind:'issue',toWorkerId:workerB.workerId,required:[],confirmations:[],createdByKey:'fixture',createdByName:'Fixture'}});
 const before={items:await prisma.companyInventoryItem.findMany({where:{companyProfileId:boss.companyId},orderBy:{id:'asc'}}),assignments:await prisma.workerAssetItem.findMany({where:{worker:{companyProfileId:boss.companyId}},orderBy:{id:'asc'}}),overlays:await prisma.companyOperationalAsset.findMany({where:{companyProfileId:boss.companyId},orderBy:{id:'asc'}})};
 const snapshot=await readAssetSnapshot({category:'clothing',groupClothing:true});expect(snapshot.total).toBe(40);expect(snapshot.assets).toEqual([]);expect(snapshot.clothingGroups?.total).toBe(3);expect(snapshot.clothingGroups?.groups.find(g=>g.size==='M')).toMatchObject({total:36,reserve:32,assigned:3,other:1});expect(snapshot.clothingGroups?.groups.find(g=>g.size===null)).toMatchObject({total:2,reserve:2,assigned:0});
 const first=await readAssetSnapshot({category:'clothing',clothingGroup:{name:'Fictional jacket',size:'M'}}),second=await readAssetSnapshot({category:'clothing',clothingGroup:{name:'Fictional jacket',size:'M'},page:2});expect(first.total).toBe(36);expect(first.assets).toHaveLength(30);expect(second.assets).toHaveLength(6);expect(first.assets[0].availability).toBe('available');expect(new Set([...first.assets,...second.assets].map(i=>i.id)).size).toBe(36);
 as(workerA);const restricted=await readAssetSnapshot({category:'clothing',groupClothing:true});expect(restricted.clothingGroups?.groups.find(g=>g.size==='M')).toMatchObject({total:34,reserve:32,assigned:2,other:0});await expect(readAssetSnapshot({category:'clothing',groupClothing:true,workerId:workerB.workerId!})).rejects.toMatchObject({code:'DENIED'});
 as(boss);expect((await readAssetSnapshot({category:'clothing',groupClothing:true,query:'gloves'})).clothingGroups?.groups).toHaveLength(1);expect(await prisma.companyInventoryItem.findMany({where:{companyProfileId:boss.companyId},orderBy:{id:'asc'}})).toEqual(before.items);expect(await prisma.workerAssetItem.findMany({where:{worker:{companyProfileId:boss.companyId}},orderBy:{id:'asc'}})).toEqual(before.assignments);expect(await prisma.companyOperationalAsset.findMany({where:{companyProfileId:boss.companyId},orderBy:{id:'asc'}})).toEqual(before.overlays);
 await expect(readAssetSnapshot({category:'tool',groupClothing:true})).rejects.toMatchObject({code:'INVALID_INPUT'});
});
it('paginates clothing groups independently of their units and preserves exact group matching',async()=>{
 await prisma.companyInventoryItem.createMany({data:Array.from({length:32},(_,n)=>({companyProfileId:boss.companyId,category:'CLOTHING' as const,name:`Fictional group ${String(n).padStart(2,'0')}`,sizeLabel:'L',itemCode:`XLS-GROUP-${n}`}))});
 const first=await readAssetSnapshot({category:'clothing',groupClothing:true}),last=await readAssetSnapshot({category:'clothing',groupClothing:true,page:2});expect(first.clothingGroups?.total).toBe(32);expect(first.clothingGroups?.groups).toHaveLength(30);expect(first.hasMore).toBe(true);expect(last.clothingGroups?.groups).toHaveLength(2);expect(last.hasMore).toBe(false);expect((await readAssetSnapshot({category:'clothing',clothingGroup:{name:'Fictional group 0',size:'L'}})).total).toBe(0);
});
async function clothingStock(quantity:number,size:string|null='M'){
 const rows=[];for(let n=0;n<quantity;n++)rows.push(await prisma.companyInventoryItem.create({data:{companyProfileId:boss.companyId,category:'CLOTHING',name:'Batch jacket',sizeLabel:size,itemCode:`XLS-BATCH-${size??'none'}-${n}`}}));return rows;
}
const groupIssue=(toWorkerId:string,quantity:number):Extract<AssetCommand,{type:'issue-clothing-group'}>=>({type:'issue-clothing-group',group:{name:'Batch jacket',size:'M'},toWorkerId,quantity,note:'Synthetic quantity handover'});
async function issueBatch(quantity:number){const batchId=randomUUID();await mutate(groupIssue(workerA.workerId!,quantity),batchId);return batchId;}
async function batchCommand(batchId:string):Promise<Extract<AssetCommand,{type:'confirm-clothing-batch'}>>{
 const batch=(await readAssetSnapshot({groupHandovers:true})).handoverBatches!.find(b=>b.id===batchId)!;
 return {type:'confirm-clothing-batch',batchId,members:batch.items.map(({id,revision})=>({id,revision}))};
}
it('confirms an original pre-marker receipt once and preserves each signature, movement and audit event',async()=>{
 await clothingStock(3);const batchId=await issueBatch(3),receipt=await prisma.companyAssetCommandReceipt.findUniqueOrThrow({where:{companyProfileId_requestId:{companyProfileId:boss.companyId,requestId:batchId}}});
 const legacy={...receipt.result as {handoverIds:string[];quantity:number;group:{name:string;size:string};batchType?:string}};delete legacy.batchType;await prisma.companyAssetCommandReceipt.update({where:{id:receipt.id},data:{result:legacy}});
 as(workerA);expect((await readAssetSnapshot()).handovers).toHaveLength(3);const command=await batchCommand(batchId),requestId=randomUUID();expect(await mutate(command,requestId)).toMatchObject({confirmedCount:3,completedCount:3});await mutate(command,requestId);
 const rows=await prisma.companyAssetHandover.findMany({where:{companyProfileId:boss.companyId}});expect(rows).toHaveLength(3);for(const h of rows){expect(h.status).toBe('completed');expect(h.confirmations).toEqual([expect.objectContaining({key:'office'}),expect.objectContaining({key:`worker:${workerA.workerId}`,name:workerA.name,at:expect.any(String)})]);}
 expect(await prisma.workerAssetItem.count({where:{workerId:workerA.workerId!,status:'ACTIVE'}})).toBe(3);expect(await prisma.inventoryAssetMovement.count({where:{companyProfileId:boss.companyId,action:'TAKE'}})).toBe(3);expect(await prisma.companyAssetEvent.count({where:{companyProfileId:boss.companyId,type:'handover.confirmed'}})).toBe(3);expect((await readAssetSnapshot({groupHandovers:true})).handoverBatches).toEqual([]);
});
it('separates original deliveries and rejects subsets, mixed members, another recipient and foreign receipts',async()=>{
 await clothingStock(5);const first=await issueBatch(2),second=await issueBatch(3);as(workerA);const a=await batchCommand(first),b=await batchCommand(second);expect((await readAssetSnapshot({groupHandovers:true})).handoverBatches).toHaveLength(2);
 for(const members of [a.members.slice(0,1),[a.members[0],b.members[0]],[a.members[0],a.members[0]]])await expect(mutate({...a,members})).rejects.toMatchObject({code:members[0].id===members[1]?.id?'INVALID_INPUT':'CONFLICT'});
 as(workerB);expect((await readAssetSnapshot({groupHandovers:true})).handoverBatches).toEqual([]);await expect(mutate(a)).rejects.toMatchObject({code:'DENIED'});as(boss);await expect(mutate(a)).rejects.toMatchObject({code:'DENIED'});as({...workerA,companyId:companies[1]});await expect(mutate(a)).rejects.toMatchObject({code:'NOT_FOUND'});
 as(workerA);await expect(mutate({...a,batchId:randomUUID()})).rejects.toMatchObject({code:'NOT_FOUND'});expect(await prisma.inventoryAssetMovement.count({where:{companyProfileId:boss.companyId}})).toBe(0);
});
it('rejects stale batch membership atomically and lets a refreshed recipient confirm only the remaining pieces',async()=>{
 await clothingStock(3);const id=await issueBatch(3);as(workerA);const stale=await batchCommand(id);await mutate({type:'decline-handover',handoverId:stale.members[0].id,revision:stale.members[0].revision});await expect(mutate(stale)).rejects.toMatchObject({code:'CONFLICT'});expect(await prisma.companyAssetEvent.count({where:{companyProfileId:boss.companyId,type:'handover.confirmed'}})).toBe(0);
 const fresh=await batchCommand(id);expect(fresh.members).toHaveLength(2);await mutate(fresh);expect((await handover(stale.members[0].id)).status).toBe('declined');expect(await prisma.workerAssetItem.count({where:{workerId:workerA.workerId!,status:'ACTIVE'}})).toBe(2);
});
it('rolls back every signature and history entry if a later piece fails during batch confirmation',async()=>{
 await clothingStock(3);const batchId=await issueBatch(3);as(workerA);const command=await batchCommand(batchId),before=await prisma.companyAssetHandover.findMany({where:{companyProfileId:boss.companyId},orderBy:{id:'asc'}}),stock=await prisma.companyInventoryItem.findMany({where:{companyProfileId:boss.companyId,category:'CLOTHING'},orderBy:{id:'asc'}}),trigger=`confirm_abort_${randomUUID().replaceAll('-','')}`,requestId=randomUUID();
 try{await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic confirmation interruption'; END $$`);await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "InventoryAssetMovement" FOR EACH ROW WHEN (NEW."itemId"='${stock[1].id.replaceAll("'","''")}' AND NEW.action='TAKE') EXECUTE FUNCTION "${trigger}"()`);await expect(mutate(command,requestId)).rejects.toThrow();}
 finally{await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "InventoryAssetMovement"`);await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);}
 expect(await prisma.companyAssetHandover.findMany({where:{companyProfileId:boss.companyId},orderBy:{id:'asc'}})).toEqual(before);expect(await prisma.workerAssetItem.count({where:{workerId:workerA.workerId!}})).toBe(0);expect(await prisma.inventoryAssetMovement.count({where:{companyProfileId:boss.companyId}})).toBe(0);expect(await prisma.companyAssetEvent.count({where:{companyProfileId:boss.companyId,type:'handover.confirmed'}})).toBe(0);expect(await prisma.companyAssetCommandReceipt.count({where:{companyProfileId:boss.companyId,requestId}})).toBe(0);
});
it('serializes simultaneous recipient confirmations without duplicate custody or history',async()=>{
 await clothingStock(3);const batchId=await issueBatch(3);as(workerA);const command=await batchCommand(batchId),results=await Promise.allSettled([mutate(command),mutate(command)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected').map(r=>r.status==='rejected'&&r.reason.code)).toEqual(['CONFLICT']);expect(await prisma.inventoryAssetMovement.count({where:{companyProfileId:boss.companyId,action:'TAKE'}})).toBe(3);expect(await prisma.companyAssetEvent.count({where:{companyProfileId:boss.companyId,type:'handover.confirmed'}})).toBe(3);
});
it('records only the recipient side when independent office approval is missing',async()=>{
 await clothingStock(2);const batchId=await issueBatch(2);await prisma.companyAssetHandover.updateMany({where:{companyProfileId:boss.companyId},data:{confirmations:[]}});as({...workerA,canManage:true});const command=await batchCommand(batchId);expect(await mutate(command)).toMatchObject({confirmedCount:2,completedCount:0});expect((await readAssetSnapshot({groupHandovers:true})).handoverBatches).toEqual([]);expect(await prisma.workerAssetItem.count({where:{workerId:workerA.workerId!}})).toBe(0);
 for(const row of await prisma.companyAssetHandover.findMany({where:{companyProfileId:boss.companyId}})){expect(row.status).toBe('pending');expect(row.confirmations).toEqual([expect.objectContaining({key:`worker:${workerA.workerId}`})]);}
 as(boss);for(const row of await prisma.companyAssetHandover.findMany({where:{companyProfileId:boss.companyId}}))await mutate({type:'confirm-handover',handoverId:row.id,revision:row.revision});expect(await prisma.workerAssetItem.count({where:{workerId:workerA.workerId!,status:'ACTIVE'}})).toBe(2);
});
it('expands complete original deliveries across the queue page boundary without mutating reads',async()=>{
 await clothingStock(120);await issueBatch(60);await issueBatch(60);as(workerA);const before=await prisma.companyAssetCommandReceipt.count({where:{companyProfileId:boss.companyId}}),snapshot=await readAssetSnapshot({groupHandovers:true});expect(snapshot.handoverBatches).toHaveLength(2);expect(snapshot.handoverBatches!.map(b=>b.items.length)).toEqual([60,60]);expect(new Set(snapshot.handoverBatches!.flatMap(b=>b.items.map(h=>h.id))).size).toBe(120);expect(snapshot.handovers).toEqual([]);expect(snapshot.queueHasMore?.handovers).toBe(true);expect(await prisma.companyAssetCommandReceipt.count({where:{companyProfileId:boss.companyId}})).toBe(before);
});
it('requests a quantity beyond one page with per-piece confirmations and audit, replaying the UUID without issuing twice',async()=>{
 await clothingStock(40);await clothingStock(2,'L');const original=await prisma.companyInventoryItem.findMany({where:{companyProfileId:boss.companyId},orderBy:{id:'asc'}}),requestId=randomUUID(),command=groupIssue(workerA.workerId!,35);
 const result=await mutate(command,requestId) as {handoverIds:string[];quantity:number};expect(result.handoverIds).toHaveLength(35);expect(result.quantity).toBe(35);expect(await mutate(command,requestId)).toEqual(result);expect(await prisma.companyAssetHandover.count({where:{companyProfileId:boss.companyId}})).toBe(35);expect(await prisma.companyAssetEvent.count({where:{companyProfileId:boss.companyId,type:'handover.requested'}})).toBe(35);expect(await prisma.workerAssetItem.count({where:{workerId:workerA.workerId!}})).toBe(0);
 const pending=await prisma.companyAssetHandover.findMany({where:{companyProfileId:boss.companyId}});expect(pending.every(h=>h.status==='pending'&&h.toWorkerId===workerA.workerId)).toBe(true);expect(pending.every(h=>JSON.stringify(h.confirmations).includes('office')&&!JSON.stringify(h.confirmations).includes(`worker:${workerA.workerId}`))).toBe(true);
 let groups=(await readAssetSnapshot({category:'clothing',groupClothing:true})).clothingGroups!.groups;expect(groups.find(g=>g.size==='M')).toMatchObject({total:40,reserve:5,assigned:0,other:35});expect(groups.find(g=>g.size==='L')).toMatchObject({reserve:2,other:0});
 await expect(mutate({...command,quantity:34},requestId)).rejects.toMatchObject({code:'CONFLICT'});as(workerB);await expect(mutate({type:'confirm-handover',handoverId:result.handoverIds[0],revision:1})).rejects.toMatchObject({code:'DENIED'});
 as(workerA);await mutate({type:'confirm-handover',handoverId:result.handoverIds[0],revision:1});await mutate({type:'decline-handover',handoverId:result.handoverIds[1],revision:1});as(boss);await mutate({type:'cancel-handover',handoverId:result.handoverIds[2],revision:1});expect(await prisma.workerAssetItem.count({where:{workerId:workerA.workerId!,status:'ACTIVE'}})).toBe(1);expect(await prisma.inventoryAssetMovement.count({where:{companyProfileId:boss.companyId,action:'TAKE'}})).toBe(1);
 groups=(await readAssetSnapshot({category:'clothing',groupClothing:true})).clothingGroups!.groups;expect(groups.find(g=>g.size==='M')).toMatchObject({total:40,reserve:7,assigned:1,other:32});expect(await prisma.companyInventoryItem.findMany({where:{companyProfileId:boss.companyId},orderBy:{id:'asc'}})).toEqual(original);
});
it('rejects insufficient stock, bad quantities, foreign recipients and registration-only access without reserving anything',async()=>{
 await clothingStock(2);const foreign=await prisma.worker.create({data:{companyProfileId:companies[1],firstName:'Foreign',lastName:'Recipient'}});
 await expect(mutate(groupIssue(workerA.workerId!,3))).rejects.toMatchObject({code:'INSUFFICIENT_STOCK'});await expect(mutate(groupIssue(foreign.id,1))).rejects.toMatchObject({code:'WORKER_UNAVAILABLE'});
 for(const quantity of [0,-1,1.5,101])await expect(mutate(groupIssue(workerA.workerId!,quantity))).rejects.toMatchObject({code:'INVALID_INPUT'});
 as({...workerA,canRegister:true});await expect(mutate(groupIssue(workerA.workerId!,1))).rejects.toMatchObject({code:'DENIED'});as(boss);await prisma.worker.update({where:{id:workerA.workerId!},data:{status:'inactive'}});await expect(mutate(groupIssue(workerA.workerId!,1))).rejects.toMatchObject({code:'WORKER_UNAVAILABLE'});
 expect(await prisma.companyAssetHandover.count({where:{companyProfileId:boss.companyId}})).toBe(0);expect(await prisma.companyAssetEvent.count({where:{companyProfileId:boss.companyId}})).toBe(0);expect(await prisma.companyOperationalAsset.count({where:{companyProfileId:boss.companyId}})).toBe(0);expect(await prisma.companyAssetCommandReceipt.count({where:{companyProfileId:boss.companyId}})).toBe(0);
});
it('serializes competing quantities in the same normalized group instead of reserving the same pieces twice',async()=>{
 await clothingStock(3);const commands=[groupIssue(workerA.workerId!,2),{...groupIssue(workerB.workerId!,2),group:{name:' BATCH JACKET ',size:' m '}}];const results=await Promise.allSettled(commands.map(command=>mutate(command)));
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected').map(r=>r.status==='rejected'&&r.reason.code)).toEqual(['INSUFFICIENT_STOCK']);const handovers=await prisma.companyAssetHandover.findMany({where:{companyProfileId:boss.companyId}});expect(handovers).toHaveLength(2);expect(new Set(handovers.map(h=>h.assetId)).size).toBe(2);expect((await readAssetSnapshot({category:'clothing',groupClothing:true})).clothingGroups!.groups[0]).toMatchObject({total:3,reserve:1,assigned:0,other:2});
});
it('rolls back every earlier piece and receipt when a later request in the quantity fails',async()=>{
 const stock=(await clothingStock(3)).sort((a,b)=>a.id.localeCompare(b.id));const assets=[];for(const item of stock)assets.push(await prisma.companyOperationalAsset.create({data:{companyProfileId:boss.companyId,inventoryItemId:item.id}}));
 const before=await prisma.companyOperationalAsset.findMany({where:{companyProfileId:boss.companyId},orderBy:{id:'asc'}}),trigger=`clothing_abort_${randomUUID().replaceAll('-','')}`;
 try{await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic quantity interruption'; END $$`);await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "CompanyAssetHandover" FOR EACH ROW WHEN (NEW."assetId"='${assets[1].id.replaceAll("'","''")}') EXECUTE FUNCTION "${trigger}"()`);await expect(mutate(groupIssue(workerA.workerId!,3))).rejects.toThrow();
 }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "CompanyAssetHandover"`);await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);}
 expect(await prisma.companyAssetHandover.count({where:{companyProfileId:boss.companyId}})).toBe(0);expect(await prisma.companyAssetEvent.count({where:{companyProfileId:boss.companyId}})).toBe(0);expect(await prisma.companyAssetCommandReceipt.count({where:{companyProfileId:boss.companyId}})).toBe(0);expect(await prisma.companyOperationalAsset.findMany({where:{companyProfileId:boss.companyId},orderBy:{id:'asc'}})).toEqual(before);
});
it('keeps the office side independent when an office worker requests several pieces for themselves',async()=>{
 await clothingStock(2);await prisma.worker.update({where:{id:workerA.workerId!},data:{crewRole:'OFFICE'}});as({...workerA,canManage:true});const result=await mutate(groupIssue(workerA.workerId!,2)) as {handoverIds:string[]};
 for(const id of result.handoverIds){const h=await handover(id);expect(h.status).toBe('pending');expect(h.confirmations).toEqual([expect.objectContaining({key:`worker:${workerA.workerId}`})]);await expect(mutate({type:'confirm-handover',handoverId:id,revision:1})).rejects.toMatchObject({code:'INVALID_TRANSITION'});}
 expect(await prisma.workerAssetItem.count({where:{workerId:workerA.workerId!}})).toBe(0);as(boss);for(const id of result.handoverIds)await mutate({type:'confirm-handover',handoverId:id,revision:1});expect(await prisma.workerAssetItem.count({where:{workerId:workerA.workerId!,status:'ACTIVE'}})).toBe(2);
});
it('changes actual worker custody only after two real confirmations and replays one UUID without duplicating history',async()=>{
 const result=await mutate({type:'handover',asset:ref,kind:'issue',toWorkerId:workerA.workerId!}) as {handoverId:string};
 expect(await prisma.workerAssetItem.count({where:{companyInventoryItemId:ref.id}})).toBe(0);as(workerA);
 const command:AssetCommand={type:'confirm-handover',handoverId:result.handoverId,revision:1},requestId=randomUUID();await mutate(command,requestId);await mutate(command,requestId);
 expect(await prisma.workerAssetItem.count({where:{companyInventoryItemId:ref.id,status:'ACTIVE'}})).toBe(1);expect(await prisma.inventoryAssetMovement.count({where:{itemId:ref.id,action:'TAKE'}})).toBe(1);
 await expect(mutate({...command,note:'changed'},requestId)).rejects.toMatchObject({code:'CONFLICT'});
 const row=await handover(result.handoverId);expect(row.status).toBe('completed');expect((await readAssetDetail(ref)).asset.holder?.id).toBe(workerA.workerId);
});
it('requires both colleagues for an office-requested transfer and preserves returned assignment history',async()=>{
 await give();const result=await mutate({type:'handover',asset:ref,kind:'transfer',toWorkerId:workerB.workerId!}) as {handoverId:string};
 await expect(mutate({type:'confirm-handover',handoverId:result.handoverId,revision:1})).rejects.toMatchObject({code:'DENIED'});
 as(workerA);await mutate({type:'confirm-handover',handoverId:result.handoverId,revision:1});expect((await readAssetDetail(ref)).asset.holder?.id).toBe(workerA.workerId);
 as(workerB);await mutate({type:'confirm-handover',handoverId:result.handoverId,revision:2});expect((await readAssetDetail(ref)).asset.holder?.id).toBe(workerB.workerId);
 expect(await prisma.workerAssetItem.count({where:{companyInventoryItemId:ref.id,status:'DELETED'}})).toBe(1);expect(await prisma.workerAssetItem.count({where:{companyInventoryItemId:ref.id,status:'ACTIVE',workerId:workerB.workerId!}})).toBe(1);
});
it('allows only a chief with a note to return an inactive former worker asset, never bypassing an active holder',async()=>{
 await give();await prisma.worker.update({where:{id:workerA.workerId!},data:{status:'inactive'}});
 await expect(mutate({type:'handover',asset:ref,kind:'return'})).rejects.toMatchObject({code:'RETURN_NOTE_REQUIRED'});
 await expect(mutate({type:'handover',asset:ref,kind:'transfer',toWorkerId:workerB.workerId!})).rejects.toMatchObject({code:'RETURN_REQUIRED'});
 const result=await mutate({type:'handover',asset:ref,kind:'return',note:'Fictional chief physically checked warehouse return'}) as {handoverId:string};expect((await handover(result.handoverId)).status).toBe('completed');
 expect((await readAssetDetail(ref)).asset.availability).toBe('available');expect(await prisma.workerAssetItem.count({where:{companyInventoryItemId:ref.id,status:'ACTIVE'}})).toBe(0);
 expect(await prisma.companyAssetEvent.count({where:{companyProfileId:boss.companyId,type:'inactive-holder-return'}})).toBe(1);
});
it('serializes simultaneous requests, denies foreign references and keeps private belongings outside the domain',async()=>{
 const attempts=await Promise.allSettled([mutate({type:'handover',asset:ref,kind:'issue',toWorkerId:workerA.workerId!}),mutate({type:'handover',asset:ref,kind:'issue',toWorkerId:workerB.workerId!})]);expect(attempts.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 await expect(mutate({type:'report',asset:other,kind:'lost',note:'Synthetic foreign report'})).rejects.toMatchObject({code:'NOT_FOUND'});
 const privateItem=await prisma.workerAssetItem.create({data:{workerId:workerA.workerId!,itemName:'Private fictional glove',kind:'CLOTHING',isPrivate:true,status:'ACTIVE',createdByRole:'WORKER'}});
 expect((await readAssetSnapshot()).assets.some(a=>a.id===privateItem.id)).toBe(false);
});
it('blocks legacy usages on reports, protects lifecycle decisions and restores the prior active flag only',async()=>{
 await give();as(workerA);const result=await mutate({type:'report',asset:ref,kind:'lost',note:'Fictional missing drill'}) as {incidentId:string};
 await expect(withTenantContext(boss.companyId,tx=>assertAssetUsable(tx,boss,ref))).rejects.toMatchObject({code:'ASSET_UNAVAILABLE'});
 await expect(mutate({type:'decide-incident',incidentId:result.incidentId,revision:1,approve:true,note:'Not authorized'})).rejects.toMatchObject({code:'DENIED'});
 as(boss);await mutate({type:'decide-incident',incidentId:result.incidentId,revision:1,approve:true,note:'Fictional confirmation'});expect((await readAssetDetail(ref)).asset.availability).toBe('lost');
 expect((await prisma.companyInventoryItem.findUniqueOrThrow({where:{id:ref.id}})).isActive).toBe(false);
 const asset=(await readAssetDetail(ref)).asset;await mutate({type:'restore',asset:ref,revision:asset.revision,note:'Fictional item found'});expect((await prisma.companyInventoryItem.findUniqueOrThrow({where:{id:ref.id}})).isActive).toBe(true);
 expect(await prisma.workerAssetItem.count({where:{companyInventoryItemId:ref.id,status:'ACTIVE'}})).toBe(1);
});
it('grounds assistant fleet usability in the exact owned canonical status, not the active register flag',async()=>{
 const requester={kind:'admin' as const,adminId:boss.userId!,companyId:boss.companyId,displayName:boss.name,preferredLanguage:'EN' as const};
 await mutate({type:'report',asset:machine,kind:'defect',note:'Fictional engine inspection needed'});
 expect((await prisma.machine.findUniqueOrThrow({where:{id:machine.id}})).isActive).toBe(true);
 expect(await adminSearchCompanyFleet(requester,{machineId:machine.id})).toMatchObject({ok:true,data:{items:[{active:true,baseRecordActive:true,operationalAvailability:'reported',usable:false}]}});
 const grounding=await assistantAssetGrounding(requester,[machine,other]);expect(grounding.complete).toBe(false);expect(grounding.items).toHaveLength(1);expect(grounding.items[0].ref).toEqual(machine);
});
it('enforces workshop transitions, external-only-in-repairing and tested evidence before ready',async()=>{
 as(workerA);const result=await mutate({type:'report',asset:machine,kind:'defect',note:'Fictional broken connection'}) as {repairId:string};as(mechanic);
 await expect(mutate({type:'repair-location',repairId:result.repairId,revision:1,location:'external',note:'Too early'})).rejects.toMatchObject({code:'INVALID_TRANSITION'});
 await mutate({type:'repair-phase',repairId:result.repairId,revision:1,phase:'received'});await mutate({type:'repair-phase',repairId:result.repairId,revision:2,phase:'repairing'});
 await mutate({type:'repair-location',repairId:result.repairId,revision:3,location:'external',provider:'Fictional repair shop',note:'Bench equipment required'});
 await expect(mutate({type:'repair-phase',repairId:result.repairId,revision:4,phase:'ready',tested:true})).rejects.toMatchObject({code:'REPAIR_EVIDENCE_REQUIRED'});
 await mutate({type:'repair-phase',repairId:result.repairId,revision:4,phase:'ready',tested:true,repairNote:'Fictional connector replaced and tested'});
 expect((await readAssetDetail(machine)).asset.availability).toBe('available');expect((await readAssetSnapshot()).repairs.some(r=>r.id===result.repairId&&r.phase==='ready')).toBe(true);
});
it('lets the boss make a vehicle available in one step from the workshop or a block, but not a worker',async()=>{
 as(workerA);const result=await mutate({type:'report',asset:machine,kind:'defect',note:'Fictional stuck in service'}) as {repairId:string};
 await mutate({type:'repair-phase',repairId:result.repairId,revision:1,phase:'received'}).catch(()=>undefined);
 const before=(await readAssetDetail(machine)).asset;
 await expect(mutate({type:'make-available',asset:machine,revision:before.revision})).rejects.toMatchObject({code:'DENIED'});
 as(boss);const current=(await readAssetDetail(machine)).asset;expect(['reported','workshop']).toContain(current.availability);
 await mutate({type:'make-available',asset:machine,revision:current.revision});
 expect((await readAssetDetail(machine)).asset.availability).toBe('available');
 await prisma.machine.update({where:{id:machine.id},data:{isActive:false}});
 const blocked=(await readAssetDetail(machine)).asset;expect(blocked.availability).toBe('inactive');
 await mutate({type:'make-available',asset:machine,revision:blocked.revision});
 expect((await readAssetDetail(machine)).asset.availability).toBe('available');
});
it('projects exact open repair phases through reception and repair while keeping pending loss primary and tenant reads exact',async()=>{
 const report=await mutate({type:'report',asset:machine,kind:'defect',note:'Fictional current-phase probe'}) as {repairId:string};
 const read=()=>withTenantContext(boss.companyId,tx=>readCanonicalAssetStatuses(tx,boss,[machine,other]));
 expect(await read()).toMatchObject([{ref:machine,status:{availability:'reported',activeRepairPhase:'reported',usable:false,known:true}}]);
 as(mechanic);await mutate({type:'repair-phase',repairId:report.repairId,revision:1,phase:'received'});
 expect(await read()).toMatchObject([{ref:machine,status:{availability:'workshop',activeRepairPhase:'received',usable:false}}]);
 await mutate({type:'repair-phase',repairId:report.repairId,revision:2,phase:'repairing'});
 expect(await read()).toMatchObject([{ref:machine,status:{availability:'workshop',activeRepairPhase:'repairing',activeRepairLocation:'internal',usable:false}}]);
 const lost=await mutate({type:'report',asset:machine,kind:'lost',note:'Fictional missing asset during repair'}) as {incidentId:string};
 expect(await read()).toMatchObject([{ref:machine,status:{availability:'loss_pending',activeRepairPhase:'repairing',usable:false}}]);
 as(boss);await mutate({type:'decide-incident',incidentId:lost.incidentId,revision:1,approve:true,note:'Fictional confirmed loss'});
 expect(await read()).toMatchObject([{ref:machine,status:{availability:'lost',activeRepairPhase:null,activeRepairLocation:null,usable:false}}]);
});
it('never converts a historical ready job into current availability when a newer report or inactive register blocks use',async()=>{
 const first=await mutate({type:'report',asset:machine,kind:'defect',note:'Fictional earlier repair'}) as {repairId:string};as(mechanic);
 await mutate({type:'repair-phase',repairId:first.repairId,revision:1,phase:'received'});
 await mutate({type:'repair-phase',repairId:first.repairId,revision:2,phase:'repairing'});
 await mutate({type:'repair-phase',repairId:first.repairId,revision:3,phase:'ready',tested:true,repairNote:'Fictional repair checked'});
 await prisma.machine.update({where:{id:machine.id},data:{isActive:false}});
 expect((await readAssetDetail(machine)).asset).toMatchObject({availability:'inactive',activeRepairPhase:null});
 const second=await mutate({type:'report',asset:machine,kind:'defect',note:'Fictional new defect'}) as {repairId:string};
 await mutate({type:'repair-phase',repairId:second.repairId,revision:1,phase:'received'});
 const detail=await readAssetDetail(machine),snapshot=await readAssetSnapshot({includeInactive:true});
 expect(detail.asset).toMatchObject({availability:'workshop',activeRepairId:second.repairId,activeRepairPhase:'received'});
 expect(snapshot.repairs).toEqual(expect.arrayContaining([expect.objectContaining({id:first.repairId,phase:'ready'}),expect.objectContaining({id:second.repairId,phase:'received'})]));
 expect(await withTenantContext(boss.companyId,tx=>readCanonicalAssetStatuses(tx,boss,[machine]))).toMatchObject([{status:{activeRepairPhase:'received',usable:false}}]);
});
it('uses canonical current machine and inventory covers plus actual category on compact workshop rows',async()=>{
 const equipment=await mutate({type:'register',name:'Fictional barrier',category:'equipment'}) as {assets:AssetRef[]};
 const photo=new File([new Uint8Array(await sharp({create:{width:4,height:3,channels:4,background:{r:120,g:140,b:180,alpha:1}}}).png().toBuffer())],'Synthetic cover.png',{type:'image/png'});
 await saveCompanyAssetFile(fileForm(machine,'cover',photo));const inventoryCover=await saveCompanyAssetFile(fileForm(equipment.assets[0],'cover',photo));
 const m=await mutate({type:'report',asset:machine,kind:'defect',note:'Fictional machine cover'}) as {repairId:string};
 const i=await mutate({type:'report',asset:equipment.assets[0],kind:'defect',note:'Fictional equipment cover'}) as {repairId:string};
 const snapshot=await readAssetSnapshot(),machineDetail=await readAssetDetail(machine),equipmentDetail=await readAssetDetail(equipment.assets[0]);
 expect(snapshot.repairs.find(r=>r.id===m.repairId)).toMatchObject({category:'vehicle',photoUrl:machineDetail.asset.photoUrl});
 expect(snapshot.repairs.find(r=>r.id===i.repairId)).toMatchObject({category:'equipment',photoUrl:`/api/company-assets/files/${inventoryCover.id}`});
 expect(equipmentDetail.repairs[0]).toMatchObject({category:'equipment',photoUrl:equipmentDetail.asset.photoUrl});
});
it('lets the chief reject only an unreceived mistaken defect and never auto-reactivates a separately inactive machine',async()=>{
 await prisma.machine.update({where:{id:machine.id},data:{isActive:false}});
 const report=await mutate({type:'report',asset:machine,kind:'defect',note:'Fictional false alarm'}) as {incidentId:string;repairId:string};
 await mutate({type:'decide-incident',incidentId:report.incidentId,revision:1,approve:false,note:'Checked: no reported defect'});
 expect((await prisma.companyAssetRepair.findUniqueOrThrow({where:{id:report.repairId}})).phase).toBe('cancelled');expect((await prisma.machine.findUniqueOrThrow({where:{id:machine.id}})).isActive).toBe(false);
});
it('hides invoice metadata from ordinary workers while keeping repair evidence for mechanics',async()=>{
 const result=await mutate({type:'report',asset:machine,kind:'defect',note:'Fictional document test'}) as {repairId:string};const repair=await prisma.companyAssetRepair.findUniqueOrThrow({where:{id:result.repairId}});
 await prisma.companyAssetFile.create({data:{companyProfileId:boss.companyId,assetId:repair.assetId,repairId:repair.id,kind:'invoice',name:'PRIVATE_INVOICE.pdf',mime:'application/pdf',size:1,dataBytes:new Uint8Array([1]),sha256:'a'.repeat(64),uploadedByUserId:boss.userId,uploadedByName:boss.name}});
 as(workerA);expect((await readAssetDetail(machine)).files).toHaveLength(0);as(mechanic);expect((await readAssetDetail(machine)).files[0].name).toBe('PRIVATE_INVOICE.pdf');
});
it('private files deny missing identity, foreign references, other-asset repairs and invoice bytes for ordinary workers',async()=>{
 identity.actor.mockRejectedValueOnce(new Error('DENIED'));await expect(saveCompanyAssetFile(fileForm(machine,'document',pdf()))).rejects.toThrow('DENIED');
 await expect(saveCompanyAssetFile(fileForm(other,'document',pdf()))).rejects.toMatchObject({code:'NOT_FOUND'});
 const report=await mutate({type:'report',asset:machine,kind:'defect',note:'Fictional repair evidence'}) as {repairId:string};
 await expect(saveCompanyAssetFile(fileForm(ref,'document',pdf(),report.repairId))).rejects.toMatchObject({code:'NOT_FOUND'});
 const saved=await saveCompanyAssetFile(fileForm(machine,'invoice',pdf(),report.repairId));as(workerA);
 await expect(readCompanyAssetFile(saved.id)).rejects.toMatchObject({code:'NOT_FOUND'});await expect(saveCompanyAssetFile(fileForm(machine,'invoice',pdf(),report.repairId))).rejects.toMatchObject({code:'DENIED'});
 expect((await readAssetDetail(machine)).files).toHaveLength(0);expect((await readAssetDetail(machine)).history.some(h=>h.note.includes('Fictional.pdf'))).toBe(false);
 as(mechanic);expect((await readCompanyAssetFile(saved.id)).mime).toBe('application/pdf');expect((await readAssetDetail(machine)).files[0].kind).toBe('invoice');
});
it('replays one upload UUID without duplicating files and rejects a changed body or different asset',async()=>{
 const requestId=randomUUID(),form=fileForm(machine,'document',pdf(),undefined,requestId);const first=await saveCompanyAssetFile(form);const second=await saveCompanyAssetFile(form);expect(second).toEqual(first);
 expect(await prisma.companyAssetFile.count({where:{id:requestId}})).toBe(1);expect(await prisma.companyAssetEvent.count({where:{companyProfileId:boss.companyId,type:'file-added'}})).toBe(1);
 await expect(saveCompanyAssetFile(fileForm(machine,'document',new File(['%PDF-1.4\nDifferent content'],'Fictional.pdf'),undefined,requestId))).rejects.toMatchObject({code:'CONFLICT'});
 await expect(saveCompanyAssetFile(fileForm(ref,'document',pdf(),undefined,requestId))).rejects.toMatchObject({code:'CONFLICT'});
});
it('accepts same-job file evidence for ready only with a successful test and retains original covers',async()=>{
 const report=await mutate({type:'report',asset:machine,kind:'defect',note:'Synthetic repair with evidence'}) as {repairId:string};as(mechanic);
 await mutate({type:'repair-phase',repairId:report.repairId,revision:1,phase:'received'});await mutate({type:'repair-phase',repairId:report.repairId,revision:2,phase:'repairing'});
 await saveCompanyAssetFile(fileForm(machine,'document',pdf(),report.repairId));
 await expect(mutate({type:'repair-phase',repairId:report.repairId,revision:3,phase:'ready',tested:false})).rejects.toMatchObject({code:'REPAIR_EVIDENCE_REQUIRED'});
 await mutate({type:'repair-phase',repairId:report.repairId,revision:3,phase:'ready',tested:true});as(boss);
 const photo=new File([new Uint8Array(await sharp({create:{width:4,height:3,channels:4,background:{r:200,g:100,b:20,alpha:1}}}).png().toBuffer())],'Original.png',{type:'image/png'});
 const first=await saveCompanyAssetFile(fileForm(machine,'cover',photo));const second=await saveCompanyAssetFile(fileForm(machine,'cover',photo));
 const current=await prisma.machine.findUniqueOrThrow({where:{id:machine.id}});
 expect((await readAssetDetail(machine)).asset.photoUrl).toBe(`/api/asset-photos/machine/${machine.id}?v=${current.coverPhotoAt!.getTime()}`);expect((await readCompanyAssetFile(first.id)).mime).toBe('image/webp');expect((await readCompanyAssetFile(second.id)).mime).toBe('image/webp');expect(await prisma.companyAssetFile.count({where:{companyProfileId:boss.companyId,kind:'cover'}})).toBe(2);
});
it('synchronizes a new machine cover with existing fleet photos and never lets upload replay override a later camera photo',async()=>{
 const photo=new File([new Uint8Array(await sharp({create:{width:8,height:6,channels:4,background:{r:210,g:120,b:30,alpha:1}}}).png().toBuffer())],'Fictional cover.png',{type:'image/png'});
 const requestId=randomUUID(),form=fileForm(machine,'cover',photo,undefined,requestId),saved=await saveCompanyAssetFile(form);
 const historical=await prisma.companyAssetFile.findUniqueOrThrow({where:{id:saved.id}}),current=await prisma.machine.findUniqueOrThrow({where:{id:machine.id}});
 const fleetPhoto=await prisma.assetPhoto.findUniqueOrThrow({where:{companyProfileId_machineId:{companyProfileId:boss.companyId,machineId:machine.id}}});
 expect(new Uint8Array(fleetPhoto.data)).toEqual(new Uint8Array(historical.dataBytes));expect(current.coverPhotoAt).toEqual(historical.createdAt);
 expect((await readAssetDetail(machine)).asset.photoUrl).toBe(`/api/asset-photos/machine/${machine.id}?v=${historical.createdAt.getTime()}`);
 const laterBytes=new Uint8Array(await sharp({create:{width:8,height:6,channels:4,background:{r:40,g:150,b:220,alpha:1}}}).webp().toBuffer()),laterAt=new Date(historical.createdAt.getTime()+1000);
 // Emulate the existing camera's atomic AssetPhoto + Machine.coverPhotoAt write,
 // using a deterministic later time rather than sleeps or production sessions.
 await prisma.$transaction(async tx=>{
  await tx.assetPhoto.update({where:{companyProfileId_machineId:{companyProfileId:boss.companyId,machineId:machine.id}},data:{data:laterBytes}});
  await tx.machine.update({where:{id:machine.id},data:{coverPhotoAt:laterAt}});
 });
 expect((await readAssetDetail(machine)).asset.photoUrl).toBe(`/api/asset-photos/machine/${machine.id}?v=${laterAt.getTime()}`);
 expect(await saveCompanyAssetFile(form)).toEqual(saved);
 expect((await prisma.machine.findUniqueOrThrow({where:{id:machine.id}})).coverPhotoAt).toEqual(laterAt);
 expect(new Uint8Array((await prisma.assetPhoto.findUniqueOrThrow({where:{companyProfileId_machineId:{companyProfileId:boss.companyId,machineId:machine.id}}})).data)).toEqual(laterBytes);
 expect((await readCompanyAssetFile(saved.id)).bytes).toEqual(historical.dataBytes);
 expect(await prisma.companyAssetFile.count({where:{id:requestId}})).toBe(1);
});
it('enforces FORCE RLS and same-company/same-asset references with a non-owner probe role',async()=>{
 const report=await mutate({type:'report',asset:machine,kind:'defect',note:'Synthetic tenant probe'}) as {repairId:string};const repair=await prisma.companyAssetRepair.findUniqueOrThrow({where:{id:report.repairId}});
 async function restricted<T>(tenant:string|null,run:(tx:Parameters<Parameters<typeof prisma.$transaction>[0]>[0])=>Promise<T>){return prisma.$transaction(async tx=>{await tx.$executeRawUnsafe(`SET LOCAL ROLE ${probeRole}`);if(tenant)await tx.$executeRaw`SELECT set_config('app.current_tenant_id',${tenant},true)`;return run(tx);});}
 expect(await restricted(null,tx=>tx.companyOperationalAsset.count())).toBe(0);expect(await restricted(companies[1],tx=>tx.companyAssetRepair.count({where:{id:repair.id}}))).toBe(0);
 expect(await restricted(boss.companyId,tx=>tx.companyAssetRepair.count({where:{id:repair.id}}))).toBe(1);
 await expect(restricted(companies[1],tx=>tx.companyAssetEvent.create({data:{companyProfileId:boss.companyId,assetId:repair.assetId,type:'forged',actorKey:'synthetic',actorName:'Synthetic'}}))).rejects.toThrow(/row.level security/i);
 const otherAsset=await mutate({type:'register',name:'Synthetic second drill',category:'tool'}) as {assets:AssetRef[]};const overlay=await prisma.companyOperationalAsset.findFirstOrThrow({where:{companyProfileId:boss.companyId,inventoryItemId:otherAsset.assets[0].id}});
 await expect(prisma.companyAssetFile.create({data:{companyProfileId:boss.companyId,assetId:overlay.id,repairId:repair.id,kind:'document',name:'Synthetic.pdf',mime:'application/pdf',size:1,dataBytes:new Uint8Array([1]),sha256:'a'.repeat(64),uploadedByName:boss.name,uploadedByUserId:boss.userId}})).rejects.toThrow();
 await expect(prisma.companyOperationalAsset.create({data:{companyProfileId:boss.companyId,inventoryItemId:other.id}})).rejects.toThrow();
});
