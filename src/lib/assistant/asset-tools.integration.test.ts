import {randomUUID} from 'node:crypto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const identity=vi.hoisted(()=>({actor:vi.fn()}));
vi.mock('@/lib/company-assets/access',async original=>({...await original<typeof import('@/lib/company-assets/access')>(),assetActor:identity.actor}));
import {prisma} from '@/lib/db/prisma';
import {runAssetMutation} from '@/lib/company-assets/service';
import type {AssetActor} from '@/lib/company-assets/access';
import type {AssetCommand,AssetRef} from '@/lib/company-assets/types';
import {assertAssistantTestDatabase} from '../../../tests/fixtures/assistant-database';
import {adminSearchCompanyAssets,adminGetCompanyWorkshop} from './asset-tools';
import type {RequesterContext} from './requester';
assertAssistantTestDatabase();
let companies:string[]=[],boss:AssetActor,workerA:AssetActor,workerB:AssetActor,mechanic:AssetActor,requester:RequesterContext,item:AssetRef,machine:AssetRef,foreign:AssetRef,siteA:string,siteB:string;
const as=(actor:AssetActor)=>identity.actor.mockResolvedValue(actor);
const mutate=(command:AssetCommand)=>runAssetMutation({requestId:randomUUID(),command});
async function handover(id:string){return prisma.companyAssetHandover.findUniqueOrThrow({where:{id}});}
async function repair(id:string){return prisma.companyAssetRepair.findUniqueOrThrow({where:{id}});}
async function result(input:Parameters<typeof adminSearchCompanyAssets>[1]={}){as(boss);const answer=await adminSearchCompanyAssets(requester,input);if(!answer.ok)throw new Error(`Synthetic assistant asset read failed: ${answer.code}`);return answer.data;}
async function workshop(input:Parameters<typeof adminGetCompanyWorkshop>[1]={}){as(boss);const answer=await adminGetCompanyWorkshop(requester,input);if(!answer.ok)throw new Error(`Synthetic workshop read failed: ${answer.code}`);return answer.data;}
async function give(asset:AssetRef=item){
 as(boss);const created=await mutate({type:'handover',asset,kind:'issue',toWorkerId:workerA.workerId!,siteId:siteA}) as {handoverId:string};
 as(workerA);await mutate({type:'confirm-handover',handoverId:created.handoverId,revision:(await handover(created.handoverId)).revision});as(boss);return created.handoverId;
}
beforeEach(async()=>{
 identity.actor.mockReset();companies=[];
 const company=await prisma.companyProfile.create({data:{displayName:`Fictional assistant assets ${randomUUID()}`,legalName:'Synthetic asset company',country:'AL'}});companies.push(company.id);
 const other=await prisma.companyProfile.create({data:{displayName:`Fictional foreign assets ${randomUUID()}`,legalName:'Synthetic foreign company'}});companies.push(other.id);
 const admin=await prisma.user.create({data:{companyProfileId:company.id,email:`assistant-assets-${randomUUID()}@example.test`,name:'Fictional chief',role:'ADMIN'}});
 boss={companyId:company.id,userId:admin.id,workerId:null,name:'Fictional chief',canManage:true,canRepair:true};
 const workers=await Promise.all(['A','B','Mechanic'].map(firstName=>prisma.worker.create({data:{companyProfileId:company.id,firstName,lastName:'Fictional',crewRole:firstName==='Mechanic'?'MECHANIC':'FIELD_WORKER',nationalId:'DO_NOT_EXPORT_HR_ID'}})));
 [workerA,workerB,mechanic]=workers.map(w=>({companyId:company.id,userId:null,workerId:w.id,name:`${w.firstName} Fictional`,canManage:false,canRepair:w.crewRole==='MECHANIC'}));
 const sites=await Promise.all(['A','B'].map(name=>prisma.baustelle.create({data:{companyProfileId:company.id,name:`Fictional steel site ${name}`,type:'STEEL_ASSEMBLY',documents:[]}})));[siteA,siteB]=sites.map(s=>s.id);
 const inventory=await prisma.companyInventoryItem.create({data:{companyProfileId:company.id,name:'Fictional drill',itemCode:'ONLY-ITEM-CODE',barcode:`BAR-${randomUUID()}`,category:'WORK_TOOL'}});item={kind:'inventory',id:inventory.id};
 const vehicle=await prisma.machine.create({data:{companyProfileId:company.id,name:'Fictional van',targe:'ZZ 001 DM',hourlyRateCents:100}});machine={kind:'machine',id:vehicle.id};
 const privateForeign=await prisma.companyInventoryItem.create({data:{companyProfileId:other.id,name:'DO_NOT_EXPORT_FOREIGN',itemCode:'FOREIGN-ONLY',category:'WORK_TOOL'}});foreign={kind:'inventory',id:privateForeign.id};
 requester={kind:'admin',companyId:company.id,adminId:admin.id,preferredLanguage:'SQ',displayName:'Fictional chief'};as(boss);
});
afterEach(async()=>{
 const where={companyProfileId:{in:companies}};
 await prisma.companyAssetFile.deleteMany({where});await prisma.companyAssetEvent.deleteMany({where});await prisma.companyAssetHandover.deleteMany({where});await prisma.companyAssetIncident.deleteMany({where});await prisma.companyAssetRepair.deleteMany({where});await prisma.companyOperationalAsset.deleteMany({where});await prisma.companyAssetCommandReceipt.deleteMany({where});
 await prisma.workerAssetItem.deleteMany({where:{worker:{companyProfileId:{in:companies}}}});await prisma.inventoryAssetMovement.deleteMany({where});await prisma.user.deleteMany({where});await prisma.companyProfile.deleteMany({where:{id:{in:companies}}});
});
it('reads exact owned asset identities without overlays/backfill and keeps absent location explicitly unproven',async()=>{
 const before=await prisma.companyOperationalAsset.count({where:{companyProfileId:boss.companyId}});
 const data=await result({query:'ONLY-ITEM-CODE'});expect(data).toMatchObject({totalMatching:1,complete:true,items:[{kind:'inventory',id:item.id,recordedHolder:null,assignedSite:null,custodyBasis:'no_recorded_holder',operationalAvailability:'available'}]});
 expect(data.caveats.join(' ')).toContain('does not prove a physical warehouse location');expect(await prisma.companyOperationalAsset.count({where:{companyProfileId:boss.companyId}})).toBe(before);
 expect((await result({assetKind:foreign.kind,assetId:foreign.id})).totalMatching).toBe(0);
 expect((await result({assetKind:'machine',query:'ZZ001DM'})).items[0].id).toBe(machine.id);
 const scoped=await adminSearchCompanyAssets({...requester,companyId:companies[1]} as RequesterContext);expect(scoped).toMatchObject({ok:false,code:'FORBIDDEN'});
});
it('reports pending recipient separately and changes holder/site only after both real transfer confirmations',async()=>{
 as(boss);const issue=await mutate({type:'handover',asset:item,kind:'issue',toWorkerId:workerA.workerId!,siteId:siteA}) as {handoverId:string};
 let data=await result({assetKind:'inventory',assetId:item.id});expect(data.items[0]).toMatchObject({recordedHolder:null,assignedSite:null,operationalAvailability:'handover',pendingHandover:{to:{id:workerA.workerId},allRequiredConfirmed:false},latestCompletedHandover:null});
 as(workerA);await mutate({type:'confirm-handover',handoverId:issue.handoverId,revision:1});
 data=await result({assetKind:'inventory',assetId:item.id});expect(data.items[0]).toMatchObject({recordedHolder:{id:workerA.workerId},assignedSite:{id:siteA},custodyBasis:'completed_handover',pendingHandover:null,latestCompletedHandover:{status:'completed',allRequiredConfirmed:true}});
 as(boss);const transfer=await mutate({type:'handover',asset:item,kind:'transfer',toWorkerId:workerB.workerId!,siteId:siteB}) as {handoverId:string};
 as(workerA);await mutate({type:'confirm-handover',handoverId:transfer.handoverId,revision:1});
 expect((await result({holderWorkerId:workerA.workerId!})).items[0]).toMatchObject({recordedHolder:{id:workerA.workerId},assignedSite:{id:siteA},pendingHandover:{to:{id:workerB.workerId},allRequiredConfirmed:false}});expect((await result({holderWorkerId:workerB.workerId!})).totalMatching).toBe(0);
 as(workerB);await mutate({type:'confirm-handover',handoverId:transfer.handoverId,revision:2});
 data=await result({holderWorkerId:workerB.workerId!});expect(data.items[0]).toMatchObject({recordedHolder:{id:workerB.workerId},assignedSite:{id:siteB},pendingHandover:null,latestCompletedHandover:{from:{id:workerA.workerId},to:{id:workerB.workerId},allRequiredConfirmed:true}});
 expect(data.handoverCoverage.completed).toContain('latest_completed_only');expect(JSON.stringify(data)).not.toContain('user:');expect(data.items[0].latestCompletedHandover?.confirmations.every(p=>!!p.confirmedAt)).toBe(true);
});
it('preserves current custody after a rejected handover and distinguishes legacy pending/ambiguous assignments',async()=>{
 await give();as(boss);const transfer=await mutate({type:'handover',asset:item,kind:'transfer',toWorkerId:workerB.workerId!}) as {handoverId:string};as(workerB);await mutate({type:'decline-handover',handoverId:transfer.handoverId,revision:1,note:'Fictional transfer declined'});
 expect((await result({assetKind:'inventory',assetId:item.id})).items[0]).toMatchObject({recordedHolder:{id:workerA.workerId},pendingHandover:null});
 const legacy=await prisma.companyInventoryItem.create({data:{companyProfileId:boss.companyId,name:'Fictional legacy saw',itemCode:'LEGACY-SAW',category:'WORK_TOOL'}});
 await prisma.workerAssetItem.create({data:{workerId:workerA.workerId!,companyInventoryItemId:legacy.id,kind:'EQUIPMENT',itemName:'Legacy saw',status:'PENDING_ADMIN_DELETE_CONFIRMATION',createdByRole:'ADMIN',isPrivate:false}});
 let legacyData=await result({assetKind:'inventory',assetId:legacy.id});expect(legacyData.items[0]).toMatchObject({recordedHolder:{id:workerA.workerId},custodyBasis:'legacy_recorded_assignment',latestCompletedHandover:null});
 await prisma.workerAssetItem.create({data:{workerId:workerB.workerId!,companyInventoryItemId:legacy.id,kind:'EQUIPMENT',itemName:'Ambiguous old saw',status:'ACTIVE',createdByRole:'ADMIN',isPrivate:false}});
 legacyData=await result({assetKind:'inventory',assetId:legacy.id});expect(legacyData.items[0]).toMatchObject({recordedHolder:null,custodyBasis:'legacy_pending_or_ambiguous',operationalAvailability:'handover'});
});
it('follows real workshop phases, clears current holder on receipt, and never substitutes historical origin custody',async()=>{
 await give(machine);as(workerA);const reported=await mutate({type:'report',asset:machine,kind:'defect',note:'Fictional brake check'}) as {repairId:string};
 let data=await workshop({assetKind:'machine'});expect(data).toMatchObject({totalMatching:1,countsByRepairPhase:{reported:1,received:0,repairing:0},items:[{operationalAvailability:'reported',recordedHolder:{id:workerA.workerId},activeRepair:{phase:'reported'}}]});expect((await workshop({repairPhase:'repairing'})).totalMatching).toBe(0);
 as(mechanic);await mutate({type:'repair-phase',repairId:reported.repairId,revision:1,phase:'received'});
 data=await workshop();expect(data.items[0]).toMatchObject({recordedHolder:null,assignedSite:null,custodyBasis:'no_recorded_holder',activeRepair:{phase:'received',originWorker:{id:workerA.workerId}}});expect((await workshop({holderWorkerId:workerA.workerId!})).totalMatching).toBe(0);
 as(mechanic);await mutate({type:'repair-phase',repairId:reported.repairId,revision:(await repair(reported.repairId)).revision,phase:'repairing'});await mutate({type:'repair-location',repairId:reported.repairId,revision:(await repair(reported.repairId)).revision,location:'external',provider:'Fictional repair shop',note:'Fictional external route'});
 data=await workshop({repairPhase:'repairing',repairLocation:'external'});expect(data).toMatchObject({totalMatching:1,items:[{activeRepair:{phase:'repairing',location:'external',provider:'Fictional repair shop'}}]});expect(data.caveats.join(' ')).toContain('not a live address or GPS fix');
 as(mechanic);await mutate({type:'repair-phase',repairId:reported.repairId,revision:(await repair(reported.repairId)).revision,phase:'ready',tested:true,repairNote:'Fictional recorded test passed'});
 expect((await workshop()).totalMatching).toBe(0);expect((await result({assetKind:'machine',assetId:machine.id})).items[0]).toMatchObject({recordedHolder:null,activeRepair:null,operationalAvailability:'available'});
});
it('filters phases before pagination and counts all matching vehicles beyond the first30 catalog rows',async()=>{
 const key=randomUUID(),ids=Array.from({length:38},(_,i)=>`paged-${key}-${String(i).padStart(2,'0')}`);
 await prisma.machine.createMany({data:ids.map((id,i)=>({id,companyProfileId:boss.companyId,name:`Synthetic paged van ${i}`,targe:`ZZ ${String(i).padStart(3,'0')} PX`,hourlyRateCents:100}))});
 await prisma.companyOperationalAsset.createMany({data:ids.map((id,i)=>({id:`overlay-${key}-${i}`,companyProfileId:boss.companyId,machineId:id}))});
 await prisma.companyAssetRepair.createMany({data:ids.map((_,i)=>({id:`job-${key}-${i}`,companyProfileId:boss.companyId,assetId:`overlay-${key}-${i}`,phase:i===0?'reported':i===1?'received':'repairing',location:i===37?'external':'internal',problem:'Fictional paged repair',reportedByKey:`user:${boss.userId}`,reportedByName:'Fictional chief',originWorkerId:workerA.workerId}))});
 const first=await workshop({query:'Synthetic paged van',repairPhase:'repairing',limit:20});expect(first).toMatchObject({totalMatching:36,returned:20,hasMore:true,complete:false,countsByRepairPhase:{reported:0,received:0,repairing:36}});
 const second=await workshop({query:'Synthetic paged van',repairPhase:'repairing',limit:20,cursor:first.nextCursor!});expect(second).toMatchObject({totalMatching:36,returned:16,hasMore:false,complete:false});expect(new Set([...first.items,...second.items].map(a=>a.id)).size).toBe(36);
 const active=await workshop({query:'Synthetic paged van',limit:1});expect(active).toMatchObject({totalMatching:38,countsByRepairPhase:{reported:1,received:1,repairing:36},returned:1});
 expect((await workshop({query:'ZZ037PX',repairLocation:'external'})).items[0].id).toBe(ids[37]);expect((await workshop({query:'Synthetic paged van',holderWorkerId:workerA.workerId!})).totalMatching).toBe(0);
 as(boss);expect(await adminGetCompanyWorkshop(requester,{cursor:`machine:${foreign.id}`})).toMatchObject({ok:false,code:'INVALID_CURSOR'});
});
it('preserves lost responsibility without claiming physical possession and excludes private belongings/files/full notes',async()=>{
 await give();as(workerA);const report=await mutate({type:'report',asset:item,kind:'lost',note:'Fictional lost drill'}) as {incidentId:string};as(boss);await mutate({type:'decide-incident',incidentId:report.incidentId,revision:1,approve:true,note:'Fictional management decision'});
 let data=await result({assetKind:'inventory',assetId:item.id});expect(data.items[0]).toMatchObject({recordedHolder:{id:workerA.workerId},operationalAvailability:'lost',usable:false,custodyBasis:'recorded_responsibility_not_physical_possession'});expect(await prisma.workerAssetItem.count({where:{companyInventoryItemId:item.id,status:'ACTIVE'}})).toBe(1);
 await prisma.workerAssetItem.create({data:{workerId:workerB.workerId!,companyInventoryItemId:item.id,kind:'EQUIPMENT',itemName:'DO_NOT_EXPORT_PRIVATE_BELONGING',note:'DO_NOT_EXPORT_PRIVATE_NOTE',status:'ACTIVE',createdByRole:'WORKER',isPrivate:true}});
 const overlay=await prisma.companyOperationalAsset.findUniqueOrThrow({where:{inventoryItemId:item.id}});
 await prisma.companyAssetFile.create({data:{companyProfileId:boss.companyId,assetId:overlay.id,kind:'invoice',mime:'application/pdf',name:'DO_NOT_EXPORT_INVOICE',size:4,dataBytes:Buffer.from('FAKE'),sha256:'0'.repeat(64),uploadedByUserId:boss.userId,uploadedByName:'Fictional chief'}});
 await prisma.companyAssetEvent.create({data:{companyProfileId:boss.companyId,assetId:overlay.id,type:'synthetic.private.fixture',actorKey:`user:${boss.userId}`,actorName:'Fictional chief',note:'DO_NOT_EXPORT_HISTORY_NOTE'}});
 data=await result();const serialized=JSON.stringify(data);for(const marker of ['DO_NOT_EXPORT','dataBytes','sha256','photoUrl','repairNote','actorKey'])expect(serialized).not.toContain(marker);
 expect((await result({holderWorkerId:workerB.workerId!})).totalMatching).toBe(0);
});
it('keeps duplicate names as candidates and clips repair free text with explicit field flags',async()=>{
 await prisma.companyInventoryItem.create({data:{companyProfileId:boss.companyId,name:'Fictional drill',itemCode:'SECOND-DRILL',category:'WORK_TOOL'}});
 expect(await result({query:'Fictional drill'})).toMatchObject({totalMatching:2,identityResolution:'multiple_candidates_require_clarification_if_targeting_one_asset'});
 as(boss);const report=await mutate({type:'report',asset:machine,kind:'defect',note:'p'.repeat(700)}) as {repairId:string};
 await prisma.companyAssetRepair.update({where:{id:report.repairId},data:{provider:'v'.repeat(180),repairNote:'DO_NOT_EXPORT_FULL_REPAIR_NOTE'}});
 const row=(await workshop({assetKind:'machine',assetId:machine.id})).items[0];expect(row.activeRepair?.problem).toHaveLength(240);expect(row.activeRepair?.provider).toHaveLength(120);expect(row.truncatedFields).toEqual(expect.arrayContaining(['activeRepair.problem','activeRepair.provider']));expect(JSON.stringify(row)).not.toContain('DO_NOT_EXPORT_FULL_REPAIR_NOTE');
 as(workerA);expect(await adminGetCompanyWorkshop({...requester,kind:'worker',workerId:workerA.workerId} as RequesterContext)).toMatchObject({ok:false,code:'FORBIDDEN'});
});
it('preserves UTC handover timestamps when the application host uses a different timezone',async()=>{
 const handoverId=await give(),requestedAt='2026-11-05T10:15:30.000Z',statusRecordedAt='2026-11-05T11:20:40.000Z';
 await prisma.companyAssetHandover.update({where:{id:handoverId},data:{createdAt:new Date(requestedAt),updatedAt:new Date(statusRecordedAt)}});
 const previousTimeZone=process.env.TZ;
 try{
  process.env.TZ='Europe/Berlin';
  const row=(await result({assetKind:'inventory',assetId:item.id})).items[0];
  expect(row.latestCompletedHandover).toMatchObject({requestedAt,statusRecordedAt});
 }finally{if(previousTimeZone===undefined)delete process.env.TZ;else process.env.TZ=previousTimeZone;}
});
