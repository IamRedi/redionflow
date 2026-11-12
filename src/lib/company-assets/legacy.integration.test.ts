import {randomUUID} from 'node:crypto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const identity=vi.hoisted(()=>({actor:vi.fn()}));
vi.mock('./access',async original=>({...await original<typeof import('./access')>(),assetActor:identity.actor}));
import {prisma} from '@/lib/db/prisma';
import {assertAssistantTestDatabase} from '../../../tests/fixtures/assistant-database';
import {confirmLegacyAssetAssignment} from './legacy';
import type {AssetActor} from './access';
import type {WorkerAssetStatus} from '@/generated/prisma/client';
assertAssistantTestDatabase();
let companyId:string,workerId:string,itemId:string,boss:AssetActor,worker:AssetActor;
async function pending(status:WorkerAssetStatus){return prisma.workerAssetItem.create({data:{workerId,companyInventoryItemId:itemId,itemName:'Fictional legacy drill',kind:'EQUIPMENT',isPrivate:false,status,createdByRole:status==='PENDING_ADMIN_CONFIRMATION'?'WORKER':'ADMIN'}});}
beforeEach(async()=>{
 identity.actor.mockReset();const company=await prisma.companyProfile.create({data:{displayName:`Legacy fixture ${randomUUID()}`,legalName:'Synthetic legacy inventory'}});companyId=company.id;
 const admin=await prisma.user.create({data:{companyProfileId:companyId,name:'Fictional chief',email:`legacy-${randomUUID()}@example.test`,role:'ADMIN'}});
 const person=await prisma.worker.create({data:{companyProfileId:companyId,firstName:'Fictional',lastName:'Worker'}});workerId=person.id;
 const item=await prisma.companyInventoryItem.create({data:{companyProfileId:companyId,name:'Fictional drill',category:'WORK_TOOL',itemCode:'LEGACY-DRILL'}});itemId=item.id;
 boss={companyId,userId:admin.id,workerId:null,name:'Fictional chief',canRegister:true,canManage:true,canRepair:true};worker={companyId,userId:null,workerId,name:'Fictional Worker',canRegister:false,canManage:false,canRepair:false};identity.actor.mockResolvedValue(boss);
});
afterEach(async()=>{await prisma.companyOperationalAsset.deleteMany({where:{companyProfileId:companyId}});await prisma.workerAssetItem.deleteMany({where:{companyInventoryItemId:itemId}});await prisma.inventoryAssetMovement.deleteMany({where:{companyProfileId:companyId}});await prisma.user.deleteMany({where:{companyProfileId:companyId}});await prisma.companyProfile.delete({where:{id:companyId}});});
it.each(['PENDING_ADMIN_CONFIRMATION','PENDING_WORKER_CONFIRMATION'] as const)('completes an authentic existing %s with the opposite party and records one TAKE',async status=>{
 const row=await pending(status);identity.actor.mockResolvedValue(status==='PENDING_ADMIN_CONFIRMATION'?worker:boss);await expect(confirmLegacyAssetAssignment(row.id)).rejects.toMatchObject({code:'DENIED'});
 identity.actor.mockResolvedValue(status==='PENDING_ADMIN_CONFIRMATION'?boss:worker);await confirmLegacyAssetAssignment(row.id);
 expect((await prisma.workerAssetItem.findUniqueOrThrow({where:{id:row.id}})).status).toBe('ACTIVE');expect(await prisma.inventoryAssetMovement.count({where:{itemId,action:'TAKE'}})).toBe(1);expect(await prisma.companyOperationalAsset.count({where:{companyProfileId:companyId}})).toBe(0);
});
it.each(['ACTIVE','PENDING_WORKER_CONFIRMATION'] as const)('rejects a second initial confirmation when another %s row exists',async status=>{
 const target=await pending('PENDING_ADMIN_CONFIRMATION');await pending(status);await expect(confirmLegacyAssetAssignment(target.id)).rejects.toMatchObject({code:'AMBIGUOUS_CUSTODY'});expect(await prisma.inventoryAssetMovement.count({where:{itemId}})).toBe(0);
});
it('denies initial confirmation for an inactive base item',async()=>{const row=await pending('PENDING_ADMIN_CONFIRMATION');await prisma.companyInventoryItem.update({where:{id:itemId},data:{isActive:false}});await expect(confirmLegacyAssetAssignment(row.id)).rejects.toMatchObject({code:'AMBIGUOUS_CUSTODY'});});
it('lets an existing pending return finish even for an inactive base item and preserves the row',async()=>{
 const row=await pending('PENDING_ADMIN_DELETE_CONFIRMATION');await prisma.companyInventoryItem.update({where:{id:itemId},data:{isActive:false}});await confirmLegacyAssetAssignment(row.id);
 expect((await prisma.workerAssetItem.findUniqueOrThrow({where:{id:row.id}})).status).toBe('DELETED');expect(await prisma.inventoryAssetMovement.count({where:{itemId,action:'RETURN'}})).toBe(1);
});
it('blocks old confirmation after overlay adoption and excludes private or foreign records',async()=>{
 const row=await pending('PENDING_ADMIN_CONFIRMATION');await prisma.companyOperationalAsset.create({data:{companyProfileId:companyId,inventoryItemId:itemId}});await expect(confirmLegacyAssetAssignment(row.id)).rejects.toMatchObject({code:'USE_REPAIR_WORKFLOW'});
 await prisma.companyOperationalAsset.deleteMany({where:{companyProfileId:companyId}});await prisma.workerAssetItem.update({where:{id:row.id},data:{isPrivate:true}});await expect(confirmLegacyAssetAssignment(row.id)).rejects.toMatchObject({code:'NOT_FOUND'});
 identity.actor.mockResolvedValue({...boss,companyId:'synthetic-foreign-tenant'});await expect(confirmLegacyAssetAssignment(row.id)).rejects.toMatchObject({code:'NOT_FOUND'});
});
