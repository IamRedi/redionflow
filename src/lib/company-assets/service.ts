import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import { withTenantContext } from '@/lib/db/tenant-context';
import { assetActor, assetActorKey, assetFail, type AssetActor } from './access';
import { assetMutationSchema, assetQuerySchema, assetRefSchema } from './validation';
import { generateAssetLabelCode, scanCodeCandidates, scanCodeKey } from '@/lib/inventory/scan-code';
import type { AssetRef, AssetQuery, AssetSnapshot, AssetDetail, AssetSummary, AssetHandoverView, AssetRepairView, AssetIncidentView, AssetMutation, AssetOperationalStatus } from './types';

type Tx = Prisma.TransactionClient;
export type OwnedAsset = {
  id: string; ref: AssetRef; revision: number; name: string; holderWorkerId: string | null; siteId: string | null;
  isActive: boolean; disposition: string; wasActive: boolean | null; machineId: string | null; inventoryItemId: string | null;
  code: string | null; plate: string | null; size: string | null; category: AssetSummary['category']; photoUrl: string | null;
};
const owned = (actor: AssetActor) => ({ companyProfileId: actor.companyId });
const permissions = (actor: AssetActor) => ({ canRegister: actor.canRegister, canManage: actor.canManage, canRepair: actor.canRepair, workerId: actor.workerId });
const activeRepairs = ['reported','received','repairing'];
const holderStatuses = ['ACTIVE','PENDING_ADMIN_DELETE_CONFIRMATION','PENDING_WORKER_DELETE_CONFIRMATION'] as const;
const personName = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName}`.trim();
function expectRevision(actual: number, expected: number) { if (actual !== expected) assetFail('CONFLICT'); }
function requireManage(actor: AssetActor) { if (!actor.canManage) assetFail('DENIED'); }
function requireRepair(actor: AssetActor) { if (!actor.canRepair) assetFail('DENIED'); }
async function freshLabel(tx:Tx,actor:AssetActor){
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`asset-label:${actor.companyId}`}))`;
  for(let attempt=0;attempt<5;attempt++){
    const value=generateAssetLabelCode();
    if(!await tx.companyInventoryItem.findFirst({where:{barcode:{equals:value,mode:'insensitive'}},select:{id:true}})&&!await tx.companyAssetCode.findFirst({where:{...owned(actor),matchValue:scanCodeKey(value),revokedAt:null},select:{id:true}}))return value;
  }return assetFail('CONFLICT');
}
const event = (tx: Tx, actor: AssetActor, assetId: string, type: string, note = '', repairId?: string) => tx.companyAssetEvent.create({ data: { ...owned(actor),assetId,type,note,repairId,actorKey:assetActorKey(actor),actorName:actor.name } });

async function baseAsset(tx: Tx, actor: AssetActor, ref: AssetRef) {
  if (ref.kind === 'machine') {
    const row = await tx.machine.findFirst({ where: { id:ref.id,...owned(actor) },select:{ id:true,name:true,targe:true,isActive:true,imageUrl:true,coverPhotoAt:true } });
    if (!row) return assetFail('NOT_FOUND');
    return { name:row.name,code:null,plate:row.targe,size:null,category:'vehicle' as const,isActive:row.isActive,photoUrl:row.coverPhotoAt ? `/api/asset-photos/machine/${row.id}?v=${row.coverPhotoAt.getTime()}` : row.imageUrl };
  }
  const row = await tx.companyInventoryItem.findFirst({ where:{id:ref.id,...owned(actor)},select:{name:true,itemCode:true,barcode:true,sizeLabel:true,category:true,isActive:true} });
  if (!row) return assetFail('NOT_FOUND');
  return {name:row.name,code:row.barcode || row.itemCode,plate:null,size:row.sizeLabel,category:row.category==='CLOTHING'?'clothing' as const:row.category==='SITE_EQUIPMENT'?'equipment' as const:'tool' as const,isActive:row.isActive,photoUrl:null};
}

/** Lock order: receipt -> per-asset advisory -> base row -> overlay; files reuse it. */
export async function lockOwnedAsset(tx: Tx, actor: AssetActor, input: AssetRef): Promise<OwnedAsset> {
  const ref = assetRefSchema.parse(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company-asset:${actor.companyId}:${ref.kind}:${ref.id}`}))`;
  const table = ref.kind==='machine' ? Prisma.raw('"Machine"') : Prisma.raw('"CompanyInventoryItem"');
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${table} WHERE "id"=${ref.id} AND "companyProfileId"=${actor.companyId} FOR UPDATE`);
  const base = await baseAsset(tx,actor,ref);
  const reference = ref.kind==='machine'?{machineId:ref.id}:{inventoryItemId:ref.id};
  let overlay = await tx.companyOperationalAsset.findFirst({where:{...owned(actor),...reference}});
  if (!overlay) {
    let holderWorkerId: string|null = null;
    if (ref.kind==='inventory') {
      const existing = await tx.workerAssetItem.findMany({where:{companyInventoryItemId:ref.id,isPrivate:false,status:{not:'DELETED'},worker:{companyProfileId:actor.companyId}},select:{workerId:true,status:true},take:3});
      if (existing.length>1) return assetFail('AMBIGUOUS_CUSTODY');
      if (existing.length && !holderStatuses.includes(existing[0].status as typeof holderStatuses[number])) return assetFail('LEGACY_CONFIRMATION_REQUIRED');
      holderWorkerId=existing[0]?.workerId??null;
    }
    overlay=await tx.companyOperationalAsset.create({data:{...owned(actor),...reference,holderWorkerId}});
  }
  return {id:overlay.id,ref,revision:overlay.revision,holderWorkerId:overlay.holderWorkerId,siteId:overlay.siteId,disposition:overlay.disposition,wasActive:overlay.wasActive,machineId:overlay.machineId,inventoryItemId:overlay.inventoryItemId,...base};
}

/** Company fleet remains readable; personal inventory is never included here. */
export async function assertAssetVisible(tx: Tx, actor: AssetActor, asset: OwnedAsset) {
  if (actor.canManage || actor.canRepair || asset.ref.kind==='machine' || asset.holderWorkerId===actor.workerId) return;
  if(!asset.holderWorkerId&&asset.disposition==='active'&&asset.isActive&&!await tx.companyAssetRepair.findFirst({where:{...owned(actor),assetId:asset.id,phase:{in:activeRepairs}},select:{id:true}})&&!await tx.companyAssetIncident.findFirst({where:{...owned(actor),assetId:asset.id,status:'pending'},select:{id:true}})&&!await tx.companyAssetHandover.findFirst({where:{...owned(actor),assetId:asset.id,status:'pending'},select:{id:true}}))return;
  if (actor.workerId && (await tx.companyAssetHandover.findFirst({where:{...owned(actor),assetId:asset.id,status:'pending',toWorkerId:actor.workerId},select:{id:true}}) || await tx.companyAssetRepair.findFirst({where:{...owned(actor),assetId:asset.id,OR:[{originWorkerId:actor.workerId},{reportedByKey:assetActorKey(actor)}]},select:{id:true}}) || await tx.companyAssetIncident.findFirst({where:{...owned(actor),assetId:asset.id,reportedByKey:assetActorKey(actor)},select:{id:true}}))) return;
  return assetFail('DENIED');
}

/** Read the owned identity and custody without creating/locking/mutating rows. */
export async function readOwnedAsset(tx:Tx,actor:AssetActor,input:AssetRef):Promise<OwnedAsset>{
 const ref=assetRefSchema.parse(input),base=await baseAsset(tx,actor,ref);
 const overlay=await tx.companyOperationalAsset.findFirst({where:{...owned(actor),...(ref.kind==='machine'?{machineId:ref.id}:{inventoryItemId:ref.id})}});
 let holderWorkerId=overlay?.holderWorkerId??null;
 if(!overlay&&ref.kind==='inventory'){
  const rows=await tx.workerAssetItem.findMany({where:{companyInventoryItemId:ref.id,isPrivate:false,status:{not:'DELETED'},worker:{companyProfileId:actor.companyId}},select:{workerId:true,status:true},take:3});
  if(rows.length>1)return assetFail('AMBIGUOUS_CUSTODY');
  holderWorkerId=rows.length&&holderStatuses.includes(rows[0].status as typeof holderStatuses[number])?rows[0].workerId:null;
 }
 return {...base,id:overlay?.id??'',ref,revision:overlay?.revision??0,holderWorkerId,siteId:overlay?.siteId??null,disposition:overlay?.disposition??'active',wasActive:overlay?.wasActive??null,machineId:ref.kind==='machine'?ref.id:null,inventoryItemId:ref.kind==='inventory'?ref.id:null};
}

async function unblocked(tx: Tx, actor: AssetActor, asset: OwnedAsset, returning = false, ignoreHandover?: string) {
  if (asset.disposition!=='active' || (!asset.isActive && !returning)) return assetFail('ASSET_UNAVAILABLE');
  if (await tx.companyAssetIncident.findFirst({where:{...owned(actor),assetId:asset.id,status:'pending'},select:{id:true}}) || await tx.companyAssetRepair.findFirst({where:{...owned(actor),assetId:asset.id,phase:{in:activeRepairs}},select:{id:true}}) || await tx.companyAssetHandover.findFirst({where:{...owned(actor),assetId:asset.id,status:'pending',...(ignoreHandover?{id:{not:ignoreHandover}}:{})},select:{id:true}})) return assetFail('ASSET_UNAVAILABLE');
}
/** Legacy mutation bridges must call this under the same transaction/asset lock. */
export async function assertAssetUsable(tx: Tx, actor: AssetActor, ref: AssetRef) {
  const asset=await lockOwnedAsset(tx,actor,ref); await unblocked(tx,actor,asset); return asset;
}

async function workerPerson(tx: Tx, actor: AssetActor, id: string, available = true) {
  const row=await tx.worker.findFirst({where:{id,...owned(actor),...(available?{status:'active' as const,availability:'AVAILABLE' as const}:{})},select:{id:true,firstName:true,lastName:true,status:true}});
  if (!row) return assetFail('WORKER_UNAVAILABLE');
  return {id:row.id,name:personName(row),active:row.status==='active'};
}
async function sitePerson(tx: Tx, actor: AssetActor, id?: string|null) {
  if (!id) return null;
  const row=await tx.baustelle.findFirst({where:{id,...owned(actor),status:'active'},select:{id:true,name:true}}); if (!row) return assetFail('SITE_UNAVAILABLE'); return row;
}
function refOf(asset: {machineId:string|null;inventoryItemId:string|null}):AssetRef { return asset.machineId?{kind:'machine',id:asset.machineId}:{kind:'inventory',id:asset.inventoryItemId!}; }
async function assetById(tx: Tx, actor: AssetActor, id: string) { const asset=await tx.companyOperationalAsset.findFirst({where:{id,...owned(actor)}}); if(!asset)return assetFail('NOT_FOUND'); return lockOwnedAsset(tx,actor,refOf(asset)); }
async function bump(tx: Tx, actor: AssetActor, asset: OwnedAsset, data: Prisma.CompanyOperationalAssetUncheckedUpdateInput = {}) { await tx.companyOperationalAsset.update({where:{id:asset.id,companyProfileId:actor.companyId},data:{...data,revision:{increment:1}}}); }

type Required = { key:string; name:string }[];
type Confirmation = { key:string; name:string; at:string }[];
function requiredPeople(value: Prisma.JsonValue):Required { return Array.isArray(value)?value as Required:assetFail('INVALID_STATE'); }
function confirmations(value: Prisma.JsonValue):Confirmation { return Array.isArray(value)?value as Confirmation:assetFail('INVALID_STATE'); }
function confirmationKeys(actor: AssetActor, required:Required) {
  // An OFFICE worker receiving their own item cannot sign both sides alone.
  if(required.some(p=>p.key===assetActorKey(actor)))return [assetActorKey(actor)];
  return actor.canManage&&required.some(p=>p.key==='office')?['office']:[];
}

async function changeCustody(tx: Tx, actor: AssetActor, asset:OwnedAsset, to:string|null, site:string|null) {
  if (asset.inventoryItemId) {
    const item=await tx.companyInventoryItem.findFirstOrThrow({where:{id:asset.inventoryItemId,...owned(actor)}});
    const rows=await tx.workerAssetItem.findMany({where:{companyInventoryItemId:item.id,isPrivate:false,status:{not:'DELETED'},worker:{companyProfileId:actor.companyId}},select:{id:true,workerId:true,status:true}});
    if (rows.length>1 || rows.some(r=>r.workerId!==asset.holderWorkerId || !holderStatuses.includes(r.status as typeof holderStatuses[number]))) return assetFail('AMBIGUOUS_CUSTODY');
    if (rows.length) await tx.workerAssetItem.updateMany({where:{id:{in:rows.map(r=>r.id)}},data:{status:'DELETED',deletedAt:new Date(),deleteRequestedAt:new Date(),deleteRequestedByRole:actor.userId?'ADMIN':'WORKER',deleteRequestedByName:actor.name,confirmedAt:new Date(),confirmedByRole:actor.userId?'ADMIN':'WORKER',confirmedByName:actor.name}});
    if (asset.holderWorkerId) await tx.inventoryAssetMovement.create({data:{...owned(actor),itemId:item.id,workerId:asset.holderWorkerId,actorAdminId:actor.userId,actorRole:actor.userId?'ADMIN':'WORKER',actorName:actor.name,action:'RETURN',barcode:item.barcode,note:'Confirmed company asset custody',isPrivate:false}});
    if (to) {
      await tx.workerAssetItem.create({data:{workerId:to,companyInventoryItemId:item.id,kind:item.category==='CLOTHING'?'CLOTHING':'EQUIPMENT',itemName:item.name,itemCode:item.itemCode,barcode:item.barcode,sizeLabel:item.sizeLabel,note:item.note,isPrivate:false,status:'ACTIVE',createdByRole:actor.userId?'ADMIN':'WORKER',createdByName:actor.name,confirmedAt:new Date(),confirmedByRole:actor.userId?'ADMIN':'WORKER',confirmedByName:actor.name}});
      await tx.inventoryAssetMovement.create({data:{...owned(actor),itemId:item.id,workerId:to,actorAdminId:actor.userId,actorRole:actor.userId?'ADMIN':'WORKER',actorName:actor.name,action:'TAKE',barcode:item.barcode,note:'Confirmed company asset custody',isPrivate:false}});
    }
  }
  await bump(tx,actor,asset,{holderWorkerId:to,siteId:site});
}

async function completeHandover(tx: Tx, actor: AssetActor, asset:OwnedAsset, handover:Prisma.CompanyAssetHandoverGetPayload<Record<string,never>>, approved:Confirmation) {
  if (requiredPeople(handover.required).some(p=>!approved.some(c=>c.key===p.key))) return false;
  if (asset.holderWorkerId!==handover.fromWorkerId) return assetFail('CONFLICT');
  await unblocked(tx,actor,asset,handover.kind==='return',handover.id);
  if(handover.toWorkerId)await workerPerson(tx,actor,handover.toWorkerId);
  await sitePerson(tx,actor,handover.siteId);
  await changeCustody(tx,actor,asset,handover.toWorkerId,handover.kind==='return'?null:handover.siteId);
  await tx.companyAssetHandover.update({where:{id:handover.id},data:{status:'completed',confirmations:approved,revision:{increment:1}}});
  await event(tx,actor,asset.id,`handover.${handover.kind}.completed`,handover.note);
  return true;
}

/** Single-piece and group requests share exactly the same confirmation rules. */
async function requestAssetHandover(tx:Tx,actor:AssetActor,a:OwnedAsset,c:Extract<AssetMutation['command'],{type:'handover'}>) {
  await unblocked(tx,actor,a,c.kind==='return');
      if(!actor.canManage && (c.kind==='issue'?!!a.holderWorkerId||c.toWorkerId!==actor.workerId:a.holderWorkerId!==actor.workerId)) return assetFail('DENIED');
      const to=c.kind==='return'?null:await workerPerson(tx,actor,c.toWorkerId??assetFail('WORKER_REQUIRED'));
      const site=c.kind==='return'?null:await sitePerson(tx,actor,c.siteId);
      if(c.kind==='return'&&!a.holderWorkerId || c.kind==='issue'&&a.holderWorkerId || c.kind==='transfer'&&(!a.holderWorkerId||a.holderWorkerId===to?.id&&a.siteId===(site?.id??null)))return assetFail('INVALID_TRANSITION');
      const kind=c.kind==='transfer'&&a.holderWorkerId===to?.id?'issue':c.kind;
      const from=a.holderWorkerId?await workerPerson(tx,actor,a.holderWorkerId,false):null;
      const inactiveReturn=!!from&&!from.active&&kind==='return';
      if(from&&!from.active&&!inactiveReturn)return assetFail('RETURN_REQUIRED');
      if(inactiveReturn&&(!actor.canManage||!c.note?.trim()))return assetFail('RETURN_NOTE_REQUIRED');
      const required:Required=inactiveReturn?[{key:'office',name:'Office'}]:kind==='transfer'?[{key:`worker:${from!.id}`,name:from!.name},{key:`worker:${to!.id}`,name:to!.name}]:[{key:'office',name:'Office'},{key:`worker:${(to??from)!.id}`,name:(to??from)!.name}];
      const approved=confirmationKeys(actor,required).map(key=>({key,name:actor.name,at:new Date().toISOString()}));
      const h=await tx.companyAssetHandover.create({data:{...owned(actor),assetId:a.id,kind,fromWorkerId:from?.id,toWorkerId:to?.id,siteId:site?.id,required,confirmations:approved,createdByKey:assetActorKey(actor),createdByName:actor.name,note:c.note??''}});
      await event(tx,actor,a.id,inactiveReturn?'inactive-holder-return':'handover.requested',c.note??''); await bump(tx,actor,a); await completeHandover(tx,actor,a,h,approved); return h.id;
}

export async function runAssetMutation(input:AssetMutation):Promise<unknown> {
  const parsed=assetMutationSchema.safeParse(input); if(!parsed.success)return assetFail('INVALID_INPUT');
  const actor=await assetActor(), {requestId,command:c}=parsed.data;
  if (c.type === 'register' && !actor.canRegister) return assetFail('DENIED');
  if (c.type === 'issue-clothing-group') requireManage(actor);
  const fingerprint=createHash('sha256').update(JSON.stringify([assetActorKey(actor),c])).digest('hex');
  return withTenantContext(actor.companyId,async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`asset-receipt:${actor.companyId}:${requestId}`}))`;
    const receipt=await tx.companyAssetCommandReceipt.findUnique({where:{companyProfileId_requestId:{companyProfileId:actor.companyId,requestId}}});
    if(receipt){if(receipt.actorKey!==assetActorKey(actor)||receipt.fingerprint!==fingerprint)return assetFail('CONFLICT');return receipt.result;}
    let result:Prisma.InputJsonValue={saved:true};
    if(c.type==='register') {
      const refs:AssetRef[]=[];
      for(let i=0;i<(c.quantity??1);i++){
        const suffix=(c.quantity??1)>1?`-${String(i+1).padStart(3,'0')}`:'';
        const item=await tx.companyInventoryItem.create({data:{...owned(actor),category:c.category==='clothing'?'CLOTHING':c.category==='equipment'?'SITE_EQUIPMENT':'WORK_TOOL',name:c.name,itemCode:c.code?`${c.code}${suffix}`:`INV-${randomUUID().slice(0,12)}`,barcode:c.barcode?`${c.barcode}${suffix}`:await freshLabel(tx,actor),sizeLabel:c.size,note:c.note}});
        const a=await lockOwnedAsset(tx,actor,{kind:'inventory',id:item.id}); await event(tx,actor,a.id,'registered',c.note??''); refs.push(a.ref);
        if(c.factoryCode)await tx.companyAssetCode.create({data:{...owned(actor),assetId:a.id,kind:'factory',value:c.factoryCode,matchValue:scanCodeKey(c.factoryCode),createdByKey:assetActorKey(actor),createdByName:actor.name}});
      }
      result={assets:refs};
    } else if(c.type==='code-add'||c.type==='code-generate'||c.type==='code-remove') {
      requireManage(actor);const a=await lockOwnedAsset(tx,actor,c.asset);
      if(c.type==='code-remove'){
        const code=await tx.companyAssetCode.findFirst({where:{id:c.codeId,...owned(actor),assetId:a.id,kind:'factory',revokedAt:null}});if(!code)return assetFail('NOT_FOUND');
        await tx.companyAssetCode.update({where:{id:code.id},data:{revokedAt:new Date()}});await event(tx,actor,a.id,'code.removed',code.value);
      }else if(c.type==='code-add'){
        const matchValue=scanCodeKey(c.value),existing=await tx.companyAssetCode.findFirst({where:{...owned(actor),assetId:a.id,kind:'factory',matchValue}});
        if(!existing||existing.revokedAt){
          if(await tx.companyAssetCode.count({where:{...owned(actor),assetId:a.id,kind:'factory',revokedAt:null}})>=10)return assetFail('INVALID_INPUT');
          await tx.companyAssetCode.upsert({where:{companyProfileId_assetId_kind_matchValue:{...owned(actor),assetId:a.id,kind:'factory',matchValue}},create:{...owned(actor),assetId:a.id,kind:'factory',value:c.value,matchValue,createdByKey:assetActorKey(actor),createdByName:actor.name},update:{revokedAt:null,value:c.value}});
          await event(tx,actor,a.id,'code.added',c.value);
        }
      }else{
        const existing=await tx.companyAssetCode.findFirst({where:{...owned(actor),assetId:a.id,kind:'label',revokedAt:null}});
        if(existing)result={code:existing.value};
        else if(a.code&&/^AS-[A-Z0-9-]+$/i.test(a.code)&&a.code.length<=24)result={code:a.code};
        else{
          const value=await freshLabel(tx,actor);await tx.companyAssetCode.create({data:{...owned(actor),assetId:a.id,kind:'label',value,matchValue:scanCodeKey(value),createdByKey:assetActorKey(actor),createdByName:actor.name}});await event(tx,actor,a.id,'code.generated',value);result={code:value};
        }
      }
    } else if(c.type==='issue-clothing-group') {
      // Serialize quantity requests for one group; per-asset locks still guard
      // races with individual issue/edit/report commands. Any failure rolls back
      // every pending request and the receipt, never a partially issued quantity.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`clothing-group-issue:${actor.companyId}:`}::text || jsonb_build_array(lower(btrim(${c.group.name}::text)),lower(btrim(${c.group.size??''}::text)))::text))`;
      await workerPerson(tx,actor,c.toWorkerId);
      const candidates=await tx.$queryRaw<{id:string}[]>(Prisma.sql`${assetProjection(actor)} SELECT id FROM assets WHERE ${visibleSql(actor)} AND category='clothing' AND availability='available' AND lower(btrim(name))=lower(btrim(${c.group.name})) AND lower(btrim(COALESCE(size,'')))=lower(btrim(${c.group.size??''})) ORDER BY id LIMIT ${c.quantity}`);
      if(candidates.length!==c.quantity)return assetFail('INSUFFICIENT_STOCK');
      const handoverIds:string[]=[],normalize=(value:string|null)=>value?.trim().toLowerCase()??'';
      for(const candidate of candidates){
        const ref:AssetRef={kind:'inventory',id:candidate.id},a=await lockOwnedAsset(tx,actor,ref);
        if(a.category!=='clothing'||a.holderWorkerId||normalize(a.name)!==normalize(c.group.name)||normalize(a.size)!==normalize(c.group.size))return assetFail('CONFLICT');
        handoverIds.push(await requestAssetHandover(tx,actor,a,{type:'handover',asset:ref,kind:'issue',toWorkerId:c.toWorkerId,note:c.note}));
      }
      result={handoverIds,quantity:c.quantity,group:{name:c.group.name,size:c.group.size}};
    } else if(c.type==='handover') {
      const a=await lockOwnedAsset(tx,actor,c.asset);result={handoverId:await requestAssetHandover(tx,actor,a,c)};
    } else if(c.type==='confirm-handover'||c.type==='decline-handover'||c.type==='cancel-handover') {
      const h=await tx.companyAssetHandover.findFirst({where:{id:c.handoverId,...owned(actor)}}); if(!h)return assetFail('NOT_FOUND');
      const a=await assetById(tx,actor,h.assetId);
      const current=await tx.companyAssetHandover.findFirstOrThrow({where:{id:h.id,...owned(actor)}}); expectRevision(current.revision,c.revision); if(current.status!=='pending')return assetFail('INVALID_TRANSITION');
      const keys=confirmationKeys(actor,requiredPeople(current.required));
      if(c.type==='cancel-handover'){if(!actor.canManage&&current.createdByKey!==assetActorKey(actor))return assetFail('DENIED');}
      else if(!keys.length)return assetFail('DENIED');
      if(c.type==='confirm-handover') {
        const approved=confirmations(current.confirmations);const additions=keys.filter(key=>!approved.some(p=>p.key===key)); if(!additions.length)return assetFail('INVALID_TRANSITION');
        approved.push(...additions.map(key=>({key,name:actor.name,at:new Date().toISOString()})));
        if(!await completeHandover(tx,actor,a,current,approved)){await tx.companyAssetHandover.update({where:{id:current.id},data:{confirmations:approved,revision:{increment:1}}});await bump(tx,actor,a);}
        await event(tx,actor,a.id,'handover.confirmed',c.note??'');
      }else{await tx.companyAssetHandover.update({where:{id:current.id},data:{status:c.type==='decline-handover'?'declined':'cancelled',note:c.note??current.note,revision:{increment:1}}});await event(tx,actor,a.id,c.type==='decline-handover'?'handover.declined':'handover.cancelled',c.note??'');await bump(tx,actor,a);}
    } else if(c.type==='report') {
      const a=await lockOwnedAsset(tx,actor,c.asset);await assertAssetVisible(tx,actor,a);
      if(a.disposition!=='active')return assetFail('ASSET_UNAVAILABLE');
      const incident=await tx.companyAssetIncident.create({data:{...owned(actor),assetId:a.id,kind:c.kind,note:c.note,reportedByKey:assetActorKey(actor),reportedByName:actor.name}});
      await tx.companyAssetHandover.updateMany({where:{...owned(actor),assetId:a.id,status:'pending'},data:{status:'cancelled',revision:{increment:1}}});
      if(c.kind==='defect') {
        if(a.category==='clothing')return assetFail('REPAIR_NOT_SUPPORTED');
        if(await tx.companyAssetRepair.findFirst({where:{...owned(actor),assetId:a.id,phase:{in:activeRepairs}},select:{id:true}}))return assetFail('REPAIR_ALREADY_OPEN');
        const r=await tx.companyAssetRepair.create({data:{...owned(actor),assetId:a.id,problem:c.note,originWorkerId:a.holderWorkerId,reportedByKey:assetActorKey(actor),reportedByName:actor.name}});
        result={incidentId:incident.id,repairId:r.id};
      }else result={incidentId:incident.id};
      await event(tx,actor,a.id,`incident.${c.kind}.reported`,c.note);await bump(tx,actor,a);
    } else if(c.type==='decide-incident') {
      requireManage(actor);const initial=await tx.companyAssetIncident.findFirst({where:{id:c.incidentId,...owned(actor)}});if(!initial)return assetFail('NOT_FOUND'); const a=await assetById(tx,actor,initial.assetId);
      const inc=await tx.companyAssetIncident.findFirstOrThrow({where:{id:initial.id,...owned(actor)}});expectRevision(inc.revision,c.revision);if(inc.status!=='pending')return assetFail('INVALID_TRANSITION');
      if(inc.kind==='defect'){
        const repair=await tx.companyAssetRepair.findFirst({where:{...owned(actor),assetId:a.id,phase:{in:activeRepairs}},select:{id:true,phase:true}});
        if(c.approve||!repair||repair.phase!=='reported')return assetFail('USE_REPAIR_WORKFLOW');
        await tx.companyAssetRepair.update({where:{id:repair.id},data:{phase:'cancelled',revision:{increment:1}}});
      }
      await tx.companyAssetIncident.update({where:{id:inc.id},data:{status:c.approve?'confirmed':'rejected',decisionNote:c.note,decidedByName:actor.name,decidedAt:new Date(),revision:{increment:1}}});
      if(c.approve){
        if(a.disposition!=='active')return assetFail('INVALID_TRANSITION');
        await setBaseActive(tx,actor,a,false);await bump(tx,actor,a,{disposition:inc.kind==='lost'?'lost':'retired',wasActive:a.isActive});
        await tx.companyAssetRepair.updateMany({where:{...owned(actor),assetId:a.id,phase:{in:activeRepairs}},data:{phase:'cancelled',revision:{increment:1}}});
        await tx.companyAssetIncident.updateMany({where:{...owned(actor),assetId:a.id,status:'pending'},data:{status:'rejected',decisionNote:c.note,decidedByName:actor.name,decidedAt:new Date(),revision:{increment:1}}});
      }else await bump(tx,actor,a);
      await event(tx,actor,a.id,`incident.${inc.kind}.${c.approve?'confirmed':'rejected'}`,c.note);
    } else if(c.type==='repair-phase'||c.type==='repair-location'||c.type==='repair-note') {
      requireRepair(actor);const initial=await tx.companyAssetRepair.findFirst({where:{id:c.repairId,...owned(actor)}});if(!initial)return assetFail('NOT_FOUND');const a=await assetById(tx,actor,initial.assetId);
      const r=await tx.companyAssetRepair.findFirstOrThrow({where:{id:initial.id,...owned(actor)}});expectRevision(r.revision,c.revision); if(!activeRepairs.includes(r.phase))return assetFail('INVALID_TRANSITION');
      if(c.type==='repair-location'){if(r.phase!=='repairing')return assetFail('INVALID_TRANSITION');await tx.companyAssetRepair.update({where:{id:r.id},data:{location:c.location,provider:c.provider??'',revision:{increment:1}}});await event(tx,actor,a.id,`repair.location.${c.location}`,c.note,r.id);}
      else if(c.type==='repair-note'){await tx.companyAssetRepair.update({where:{id:r.id},data:{repairNote:[r.repairNote,c.note].filter(Boolean).join('\n').slice(-12000),revision:{increment:1}}});await event(tx,actor,a.id,'repair.note',c.note,r.id);}
      else {
        if(!(r.phase==='reported'&&c.phase==='received'||r.phase==='received'&&c.phase==='repairing'||r.phase==='repairing'&&c.phase==='ready'))return assetFail('INVALID_TRANSITION');
        if(c.phase==='ready'){
          if(a.disposition!=='active'||await tx.companyAssetIncident.findFirst({where:{...owned(actor),assetId:a.id,status:'pending',kind:{in:['lost','retire']}},select:{id:true}}))return assetFail('ASSET_UNAVAILABLE');
          const hasFile=await tx.companyAssetFile.findFirst({where:{...owned(actor),assetId:a.id,repairId:r.id},select:{id:true}});
          if(!c.tested||!(c.repairNote?.trim()||r.repairNote.trim()||hasFile))return assetFail('REPAIR_EVIDENCE_REQUIRED');
          await tx.companyAssetIncident.updateMany({where:{...owned(actor),assetId:a.id,kind:'defect',status:'pending'},data:{status:'confirmed',decidedByName:actor.name,decidedAt:new Date(),decisionNote:c.repairNote??r.repairNote,revision:{increment:1}}});
        }
        if(c.phase==='received')await changeCustody(tx,actor,a,null,null);
        await tx.companyAssetRepair.update({where:{id:r.id},data:{phase:c.phase,...(c.repairNote?{repairNote:c.repairNote}:{}),...(c.phase==='ready'?{tested:true}:{}),revision:{increment:1}}});await event(tx,actor,a.id,`repair.${c.phase}`,c.repairNote??'',r.id);
      }
      await bump(tx,actor,a);
    } else if(c.type==='restore') {
      requireManage(actor);const a=await lockOwnedAsset(tx,actor,c.asset);expectRevision(a.revision,c.revision);if(a.disposition==='active')return assetFail('INVALID_TRANSITION');
      if(await tx.companyAssetIncident.findFirst({where:{...owned(actor),assetId:a.id,status:'pending'},select:{id:true}}))return assetFail('ASSET_UNAVAILABLE');
      await setBaseActive(tx,actor,a,a.wasActive??false);await bump(tx,actor,a,{disposition:'active',wasActive:null});await event(tx,actor,a.id,'restored',c.note);
    } else if(c.type==='make-available') {
      // One step for the boss: open repairs become ready, pending defect reports are confirmed, a blocked machine is active again.
      requireManage(actor);const a=await lockOwnedAsset(tx,actor,c.asset);expectRevision(a.revision,c.revision);
      if(a.disposition!=='active')return assetFail('INVALID_TRANSITION');
      if(await tx.companyAssetIncident.findFirst({where:{...owned(actor),assetId:a.id,status:'pending',kind:{in:['lost','retire']}},select:{id:true}}))return assetFail('ASSET_UNAVAILABLE');
      const note=c.note?.trim()||'';
      const open=await tx.companyAssetRepair.findMany({where:{...owned(actor),assetId:a.id,phase:{in:activeRepairs}},select:{id:true,repairNote:true}});
      for(const r of open){
        await tx.companyAssetRepair.update({where:{id:r.id},data:{phase:'ready',tested:true,repairNote:[r.repairNote,note].filter(Boolean).join('\n').slice(-12000),revision:{increment:1}}});
        await event(tx,actor,a.id,'repair.ready',note,r.id);
      }
      await tx.companyAssetIncident.updateMany({where:{...owned(actor),assetId:a.id,kind:'defect',status:'pending'},data:{status:'confirmed',decidedByName:actor.name,decidedAt:new Date(),decisionNote:note,revision:{increment:1}}});
      if(!a.isActive){await setBaseActive(tx,actor,a,true);await event(tx,actor,a.id,'machine.activated',note);}
      await bump(tx,actor,a);
    } else if(c.type==='edit') {
      requireManage(actor);const a=await lockOwnedAsset(tx,actor,c.asset);expectRevision(a.revision,c.revision);
      if(a.machineId)await tx.machine.update({where:{id:a.machineId,companyProfileId:actor.companyId},data:{name:c.name}});
      else await tx.companyInventoryItem.update({where:{id:a.inventoryItemId!,companyProfileId:actor.companyId},data:{name:c.name,sizeLabel:c.size,note:c.note}});
      await bump(tx,actor,a);await event(tx,actor,a.id,'updated',c.note??'');
    }
    await tx.companyAssetCommandReceipt.create({data:{...owned(actor),requestId,actorKey:assetActorKey(actor),fingerprint,result}});return result;
  },{timeout:20000,maxWait:10000});
}

async function setBaseActive(tx:Tx,actor:AssetActor,asset:OwnedAsset,isActive:boolean){
  if(asset.machineId)await tx.machine.update({where:{id:asset.machineId,companyProfileId:actor.companyId},data:{isActive}});
  else await tx.companyInventoryItem.update({where:{id:asset.inventoryItemId!,companyProfileId:actor.companyId},data:{isActive}});
}

type RawAsset = {kind:AssetRef['kind'];id:string;name:string;category:AssetSummary['category'];code:string|null;plate:string|null;size:string|null;photoUrl:string|null;availability:AssetSummary['availability'];revision:number;aid:string|null;holderWorkerId:string|null;holderName:string|null;siteId:string|null;siteName:string|null;activeRepairId:string|null;activeRepairPhase:AssetSummary['activeRepairPhase'];activeRepairLocation:AssetSummary['activeRepairLocation']};
function summary(row:RawAsset):AssetSummary{return {kind:row.kind,id:row.id,key:`${row.kind}:${row.id}`,name:row.name,category:row.category,code:row.code,plate:row.plate,size:row.size,photoUrl:row.photoUrl,availability:row.availability,revision:row.revision,holder:row.holderWorkerId?{id:row.holderWorkerId,name:row.holderName??''}:null,site:row.siteId?{id:row.siteId,name:row.siteName??''}:null,activeRepairId:row.activeRepairId,activeRepairPhase:row.activeRepairPhase,activeRepairLocation:row.activeRepairLocation};}

/** A single canonical SQL projection computes availability before pagination/counts. */
function assetProjection(actor:AssetActor){return Prisma.sql`
WITH base AS (
 SELECT 'machine'::text AS kind,m.id,m.name,'vehicle'::text AS category,NULL::text AS code,m.targe AS plate,NULL::text AS size,m."isActive",
 CASE WHEN m."coverPhotoAt" IS NOT NULL THEN '/api/asset-photos/machine/'||m.id||'?v='||(extract(epoch from m."coverPhotoAt")*1000)::bigint::text ELSE m."imageUrl" END AS "photoUrl",NULL::text AS "searchCode"
 FROM "Machine" m WHERE m."companyProfileId"=${actor.companyId}
 UNION ALL
 SELECT 'inventory',i.id,i.name,CASE i.category::text WHEN 'CLOTHING' THEN 'clothing' WHEN 'SITE_EQUIPMENT' THEN 'equipment' ELSE 'tool' END,COALESCE(i.barcode,i."itemCode"),NULL,i."sizeLabel",i."isActive",NULL,i."itemCode"
 FROM "CompanyInventoryItem" i WHERE i."companyProfileId"=${actor.companyId}
), decorated AS (
 SELECT b.*,a.id AS aid,COALESCE(a.revision,0) AS revision,COALESCE(a.disposition,'active') AS disposition,
 CASE WHEN a.id IS NOT NULL THEN a."holderWorkerId" WHEN legacy.n=1 AND NOT legacy.pending THEN legacy.worker END AS "holderWorkerId",a."siteId",r.id AS "activeRepairId",r.phase AS "repairPhase",r.location AS "repairLocation",
 EXISTS(SELECT 1 FROM "CompanyAssetHandover" h WHERE h."companyProfileId"=${actor.companyId} AND h."assetId"=a.id AND h.status='pending') OR (a.id IS NULL AND (legacy.n>1 OR legacy.pending)) AS handover,
 (SELECT inc.kind FROM "CompanyAssetIncident" inc WHERE inc."companyProfileId"=${actor.companyId} AND inc."assetId"=a.id AND inc.status='pending' ORDER BY CASE inc.kind WHEN 'lost' THEN 0 WHEN 'retire' THEN 1 ELSE 2 END LIMIT 1) AS incident,
 cover.id AS "coverId"
 FROM base b LEFT JOIN "CompanyOperationalAsset" a ON a."companyProfileId"=${actor.companyId} AND (b.kind='machine' AND a."machineId"=b.id OR b.kind='inventory' AND a."inventoryItemId"=b.id)
 LEFT JOIN LATERAL (SELECT count(*)::int AS n,min(w."workerId") AS worker,bool_or(w.status::text IN ('PENDING_ADMIN_CONFIRMATION','PENDING_WORKER_CONFIRMATION')) AS pending FROM "WorkerAssetItem" w JOIN "Worker" person ON person.id=w."workerId" WHERE person."companyProfileId"=${actor.companyId} AND NOT w."isPrivate" AND w."companyInventoryItemId"=b.id AND w.status::text<>'DELETED' AND b.kind='inventory') legacy ON true
 LEFT JOIN LATERAL (SELECT p.id,p.phase,p.location FROM "CompanyAssetRepair" p WHERE p."companyProfileId"=${actor.companyId} AND p."assetId"=a.id AND p.phase IN ('reported','received','repairing') ORDER BY p."createdAt" DESC LIMIT 1) r ON true
 LEFT JOIN LATERAL (SELECT f.id FROM "CompanyAssetFile" f WHERE f."companyProfileId"=${actor.companyId} AND f."assetId"=a.id AND f.kind='cover' ORDER BY f."createdAt" DESC,f.id DESC LIMIT 1) cover ON true
), assets AS (
 SELECT d.kind,d.id,d.name,d.category,d.code,d.plate,d.size,d."isActive",d."searchCode",CASE WHEN d.kind='machine' THEN d."photoUrl" ELSE COALESCE('/api/company-assets/files/'||d."coverId",d."photoUrl") END AS "photoUrl",d.aid,d.revision,d."holderWorkerId",d."siteId",d."activeRepairId",d."repairPhase" AS "activeRepairPhase",d."repairLocation" AS "activeRepairLocation",concat_ws(' ',w."firstName",w."lastName") AS "holderName",s.name AS "siteName",
 CASE WHEN d.disposition='lost' THEN 'lost' WHEN d.disposition='retired' THEN 'retired' WHEN d.incident='lost' THEN 'loss_pending' WHEN d.incident='retire' THEN 'retirement_pending' WHEN d."repairPhase"='reported' THEN 'reported' WHEN d."activeRepairId" IS NOT NULL THEN 'workshop' WHEN d.incident='defect' THEN 'reported' WHEN NOT d."isActive" THEN 'inactive' WHEN d.handover THEN 'handover' WHEN d."holderWorkerId" IS NOT NULL THEN 'issued' ELSE 'available' END AS availability
 FROM decorated d LEFT JOIN "Worker" w ON w.id=d."holderWorkerId" AND w."companyProfileId"=${actor.companyId} LEFT JOIN "Baustelle" s ON s.id=d."siteId" AND s."companyProfileId"=${actor.companyId}
)
`;}
function visibleSql(actor:AssetActor,workerId?:string){
  if(workerId){if(!actor.canManage&&!actor.canRepair&&workerId!==actor.workerId)return assetFail('DENIED');return Prisma.sql`("holderWorkerId"=${workerId} OR EXISTS(SELECT 1 FROM "CompanyAssetHandover" h WHERE h."assetId"=assets.aid AND h."companyProfileId"=${actor.companyId} AND h.status='pending' AND h."toWorkerId"=${workerId}) OR EXISTS(SELECT 1 FROM "CompanyAssetRepair" r WHERE r."assetId"=assets.aid AND r."companyProfileId"=${actor.companyId} AND r."originWorkerId"=${workerId} AND r.phase IN ('reported','received','repairing')))`;}
  if(actor.canManage||actor.canRepair)return Prisma.sql`true`;
  return Prisma.sql`(kind='machine' OR ("holderWorkerId" IS NULL AND availability='available') OR "holderWorkerId"=${actor.workerId} OR EXISTS(SELECT 1 FROM "CompanyAssetHandover" h WHERE h."assetId"=assets.aid AND h."companyProfileId"=${actor.companyId} AND h.status='pending' AND h."toWorkerId"=${actor.workerId}) OR EXISTS(SELECT 1 FROM "CompanyAssetRepair" r WHERE r."assetId"=assets.aid AND r."companyProfileId"=${actor.companyId} AND (r."originWorkerId"=${actor.workerId} OR r."reportedByKey"=${assetActorKey(actor)})) OR EXISTS(SELECT 1 FROM "CompanyAssetIncident" i WHERE i."assetId"=assets.aid AND i."companyProfileId"=${actor.companyId} AND i."reportedByKey"=${assetActorKey(actor)}))`;
}

/** Bounded exact-ID read bridge; same canonical state projection as the UI/gates. */
export async function readCanonicalAssetFacts(tx:Tx,actor:AssetActor,inputs:AssetRef[]){
 if(inputs.length>500)return assetFail('INVALID_INPUT');
 const refs=inputs.map(ref=>assetRefSchema.parse(ref));if(!refs.length)return [];
 const filters=Prisma.join(refs.map(ref=>Prisma.sql`(kind=${ref.kind} AND id=${ref.id})`),' OR ');
 const rows=await tx.$queryRaw<(RawAsset&{isActive:boolean})[]>(Prisma.sql`${assetProjection(actor)} SELECT * FROM assets WHERE (${filters}) AND ${visibleSql(actor)}`);
 return rows.map(row=>({ref:{kind:row.kind,id:row.id} as AssetRef,baseRecordActive:row.isActive,operationalAvailability:row.availability,usable:row.availability==='available'||row.availability==='issued'}));
}
/** Read-only exact-ID projection for current machine cards; no overlay initialization. */
export async function readCanonicalAssetStatuses(tx:Tx,actor:AssetActor,inputs:AssetRef[]):Promise<{ref:AssetRef;status:AssetOperationalStatus}[]>{
 if(inputs.length>500)return assetFail('INVALID_INPUT');
 const refs=inputs.map(ref=>assetRefSchema.parse(ref));if(!refs.length)return [];
 const filters=Prisma.join(refs.map(ref=>Prisma.sql`(kind=${ref.kind} AND id=${ref.id})`),' OR ');
 const rows=await tx.$queryRaw<Pick<RawAsset,'kind'|'id'|'availability'|'activeRepairPhase'|'activeRepairLocation'>[]>(Prisma.sql`${assetProjection(actor)} SELECT kind,id,availability,"activeRepairPhase","activeRepairLocation" FROM assets WHERE (${filters}) AND ${visibleSql(actor)}`);
 const readAt=new Date().toISOString();
 return rows.map(row=>({ref:{kind:row.kind,id:row.id},status:{availability:row.availability,activeRepairPhase:row.activeRepairPhase,activeRepairLocation:row.activeRepairLocation,usable:row.availability==='available'||row.availability==='issued',known:true,readAt}}));
}
const assetInclude={asset:{include:{machine:{select:{id:true,name:true,targe:true,imageUrl:true}},inventoryItem:{select:{id:true,name:true,barcode:true,itemCode:true,category:true}}}}} as const;
type HandoverRow=Prisma.CompanyAssetHandoverGetPayload<{include:typeof assetInclude}>;
type RepairRow=Prisma.CompanyAssetRepairGetPayload<{include:typeof assetInclude}>;
type IncidentRow=Prisma.CompanyAssetIncidentGetPayload<{include:typeof assetInclude}>;
function queueName(row:{asset:{machine:{name:string}|null;inventoryItem:{name:string}|null}}){return row.asset.machine?.name??row.asset.inventoryItem?.name??'';}
function handoverView(h:HandoverRow,actor:AssetActor):AssetHandoverView{
 const required=requiredPeople(h.required),approved=confirmations(h.confirmations),label=(id:string|null)=>id?{id,name:required.find(p=>p.key===`worker:${id}`)?.name??''}:null;
 const keys=confirmationKeys(actor,required);
 return {id:h.id,asset:refOf(h.asset),name:queueName(h),kind:h.kind as AssetHandoverView['kind'],status:h.status as AssetHandoverView['status'],revision:h.revision,from:label(h.fromWorkerId),to:label(h.toWorkerId),site:h.siteId?{id:h.siteId,name:''}:null,confirmations:required.map(p=>({name:p.name,confirmed:approved.some(c=>c.key===p.key)})),canConfirm:h.status==='pending'&&keys.some(key=>!approved.some(c=>c.key===key)),canCancel:h.status==='pending'&&(actor.canManage||h.createdByKey===assetActorKey(actor)),createdAt:h.createdAt.toISOString(),note:h.note};
}
function repairView(r:RepairRow,current?:AssetSummary):AssetRepairView{return{id:r.id,asset:refOf(r.asset),name:queueName(r),code:r.asset.inventoryItem?.barcode??r.asset.inventoryItem?.itemCode??null,plate:r.asset.machine?.targe??null,photoUrl:current?.photoUrl??null,category:current?.category??(r.asset.machine?'vehicle':r.asset.inventoryItem?.category==='CLOTHING'?'clothing':r.asset.inventoryItem?.category==='WORK_TOOL'?'tool':'equipment'),phase:r.phase as AssetRepairView['phase'],location:r.location as AssetRepairView['location'],provider:r.provider,problem:r.problem,repairNote:r.repairNote,tested:r.tested,revision:r.revision,reportedBy:r.reportedByName,createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString()};}
function incidentView(r:IncidentRow):AssetIncidentView{return{id:r.id,asset:refOf(r.asset),name:queueName(r),kind:r.kind as AssetIncidentView['kind'],status:r.status as AssetIncidentView['status'],revision:r.revision,note:r.note,reportedBy:r.reportedByName,createdAt:r.createdAt.toISOString()};}

export async function readAssetSnapshot(input:AssetQuery={}):Promise<AssetSnapshot>{
 const parsed=assetQuerySchema.safeParse(input);if(!parsed.success)return assetFail('INVALID_INPUT');const q=parsed.data,actor=await assetActor(),page=q.page??1,limit=30;
 return withTenantContext(actor.companyId,async tx=>{
  const search=q.query?Prisma.sql`AND (name ILIKE ${`%${q.query}%`} OR code ILIKE ${`%${q.query}%`} OR "searchCode" ILIKE ${`%${q.query}%`} OR plate ILIKE ${`%${q.query}%`} OR EXISTS(SELECT 1 FROM "CompanyAssetCode" ac WHERE ac."companyProfileId"=${actor.companyId} AND ac."assetId"=assets.aid AND ac."revokedAt" IS NULL AND ac.value ILIKE ${`%${q.query}%`}))`:Prisma.empty;
  const scanned=q.scan?Prisma.sql`AND (code IN (${Prisma.join(scanCodeCandidates(q.scan))}) OR "searchCode" IN (${Prisma.join(scanCodeCandidates(q.scan))}) OR ${scanCodeKey(q.scan).startsWith('unit:')?Prisma.sql`upper(code)=upper(${q.scan})`:Prisma.sql`false`} OR plate=${q.scan} OR EXISTS(SELECT 1 FROM "CompanyAssetCode" ac WHERE ac."companyProfileId"=${actor.companyId} AND ac."assetId"=assets.aid AND ac."revokedAt" IS NULL AND ac."matchValue"=${scanCodeKey(q.scan)}))`:Prisma.empty;
  const groupFilter=q.clothingGroup?Prisma.sql`AND lower(btrim(name))=lower(btrim(${q.clothingGroup.name})) AND lower(btrim(COALESCE(size,'')))=lower(btrim(${q.clothingGroup.size??''}))`:Prisma.empty;
  const filters=Prisma.sql`${visibleSql(actor,q.workerId)} ${q.includeInactive?Prisma.empty:Prisma.sql`AND availability NOT IN ('lost','retired','inactive')`} ${q.category?Prisma.sql`AND category=${q.category}`:Prisma.empty} ${search} ${scanned} ${groupFilter}`;
  const groupCount=q.groupClothing?Prisma.sql`count(DISTINCT (lower(btrim(name)),lower(btrim(COALESCE(size,'')))))::int`:Prisma.sql`0::int`;
  const [{groupTotal,...counts}]=await tx.$queryRaw<(AssetSnapshot['counts']&{groupTotal:number})[]>(Prisma.sql`${assetProjection(actor)} SELECT ${groupCount} AS "groupTotal",count(*)::int AS total,count(*) FILTER(WHERE availability='available')::int AS available,count(*) FILTER(WHERE availability='issued')::int AS issued,count(*) FILTER(WHERE availability IN ('reported','workshop'))::int AS workshop,count(*) FILTER(WHERE availability IN ('handover','loss_pending','retirement_pending'))::int AS pending,count(*) FILTER(WHERE availability='lost')::int AS lost,count(*) FILTER(WHERE availability='retired')::int AS retired FROM assets WHERE ${filters}`);
  // Aggregate the full permitted dataset before pagination, never just 30 units.
  const groups=q.groupClothing?await tx.$queryRaw<{name:string;size:string|null;nameKey:string;sizeKey:string;total:number;reserve:number;assigned:number;other:number}[]>(Prisma.sql`${assetProjection(actor)} SELECT min(btrim(name)) AS name,NULLIF(min(btrim(COALESCE(size,''))),'') AS size,lower(btrim(name)) AS "nameKey",lower(btrim(COALESCE(size,''))) AS "sizeKey",count(*)::int AS total,count(*) FILTER(WHERE availability='available')::int AS reserve,count(*) FILTER(WHERE "holderWorkerId" IS NOT NULL)::int AS assigned,count(*) FILTER(WHERE availability<>'available' AND "holderWorkerId" IS NULL)::int AS other FROM assets WHERE ${filters} GROUP BY lower(btrim(name)),lower(btrim(COALESCE(size,''))) ORDER BY lower(btrim(name)),lower(btrim(COALESCE(size,''))) LIMIT ${limit+1} OFFSET ${(page-1)*limit}`):null;
  const unitOrder=q.clothingGroup?Prisma.sql`CASE WHEN availability='available' THEN 0 WHEN "holderWorkerId" IS NOT NULL THEN 1 ELSE 2 END,lower("holderName"),id`:Prisma.sql`lower(name),kind,id`;
  const rows=groups?[]:await tx.$queryRaw<RawAsset[]>(Prisma.sql`${assetProjection(actor)} SELECT * FROM assets WHERE ${filters} ORDER BY ${unitOrder} LIMIT ${limit+1} OFFSET ${(page-1)*limit}`);
  const workerScope=q.workerId??actor.workerId;
  const handoverScope=actor.canManage||actor.canRepair?{}:{OR:[{fromWorkerId:workerScope},{toWorkerId:workerScope},{createdByKey:assetActorKey(actor)}]};
  const reportScope=actor.canManage||actor.canRepair?{}:{OR:[{reportedByKey:assetActorKey(actor)},{asset:{holderWorkerId:workerScope}},{asset:{machineId:{not:null}}}]};
  const repairScope=actor.canManage||actor.canRepair?{}:{OR:[{originWorkerId:workerScope},{reportedByKey:assetActorKey(actor)},{asset:{machineId:{not:null}}}]};
  const [handovers,incidents,repairs,ready,workers,sites]=await Promise.all([
   tx.companyAssetHandover.findMany({where:{...owned(actor),status:'pending',...handoverScope},include:assetInclude,orderBy:[{createdAt:'desc'},{id:'desc'}],take:101}),
   tx.companyAssetIncident.findMany({where:{...owned(actor),status:'pending',...reportScope},include:assetInclude,orderBy:[{createdAt:'desc'},{id:'desc'}],take:101}),
   tx.companyAssetRepair.findMany({where:{...owned(actor),phase:{in:activeRepairs},...repairScope},include:assetInclude,orderBy:[{createdAt:'desc'},{id:'desc'}],take:101}),
   tx.companyAssetRepair.findMany({where:{...owned(actor),phase:'ready',...repairScope},include:assetInclude,orderBy:[{updatedAt:'desc'},{id:'desc'}],take:21}),
   tx.worker.findMany({where:{...owned(actor),status:'active'},select:{id:true,firstName:true,lastName:true},orderBy:[{firstName:'asc'},{id:'asc'}]}),
   tx.baustelle.findMany({where:{...owned(actor),status:'active'},select:{id:true,name:true},orderBy:[{name:'asc'},{id:'asc'}]}),
  ]);
  const queue=[...repairs.slice(0,100),...ready.slice(0,20)];
  const queueRefs=[...new Map(queue.map(job=>{const ref=refOf(job.asset);return [`${ref.kind}:${ref.id}`,ref] as const;})).values()];
  const queueRows=queueRefs.length?await tx.$queryRaw<RawAsset[]>(Prisma.sql`${assetProjection(actor)} SELECT * FROM assets WHERE (${Prisma.join(queueRefs.map(ref=>Prisma.sql`(kind=${ref.kind} AND id=${ref.id})`),' OR ')}) AND ${visibleSql(actor)}`):[];
  const currentAssets=new Map(queueRows.map(row=>[`${row.kind}:${row.id}`,summary(row)]));
  return {assets:rows.slice(0,limit).map(summary),...(groups?{clothingGroups:{groups:groups.slice(0,limit).map(({nameKey,sizeKey,...g})=>({...g,key:JSON.stringify([nameKey,sizeKey])})),total:groupTotal}}:{}),total:counts.total,page,hasMore:(groups??rows).length>limit,counts,workers:workers.map(w=>({id:w.id,name:personName(w)})),sites,handovers:handovers.slice(0,100).map(h=>handoverView(h,actor)),incidents:incidents.slice(0,100).map(incidentView),repairs:queue.map(job=>{const ref=refOf(job.asset);return repairView(job,currentAssets.get(`${ref.kind}:${ref.id}`));}),permissions:permissions(actor),serverNow:new Date().toISOString(),queueHasMore:{handovers:handovers.length>100,incidents:incidents.length>100,repairs:repairs.length>100||ready.length>20}};
 });
}

/** Detail never initializes an overlay. Legacy-only assets remain unchanged. */
export async function readAssetDetail(input:AssetRef):Promise<AssetDetail>{
 const ref=assetRefSchema.parse(input),actor=await assetActor();return withTenantContext(actor.companyId,async tx=>{
  const [row]=await tx.$queryRaw<RawAsset[]>(Prisma.sql`${assetProjection(actor)} SELECT * FROM assets WHERE kind=${ref.kind} AND id=${ref.id} AND ${visibleSql(actor)}`);if(!row)return assetFail('NOT_FOUND');
  const asset=summary(row);
  const [repairs,incidents,handovers,history,files,legacy,codes]=await Promise.all([
   row.aid?tx.companyAssetRepair.findMany({where:{...owned(actor),assetId:row.aid},include:assetInclude,orderBy:[{createdAt:'desc'},{id:'desc'}]}):[],
   row.aid?tx.companyAssetIncident.findMany({where:{...owned(actor),assetId:row.aid},include:assetInclude,orderBy:[{createdAt:'desc'},{id:'desc'}]}):[],
   row.aid?tx.companyAssetHandover.findMany({where:{...owned(actor),assetId:row.aid},include:assetInclude,orderBy:[{createdAt:'desc'},{id:'desc'}]}):[],
   row.aid?tx.companyAssetEvent.findMany({where:{...owned(actor),assetId:row.aid},orderBy:[{createdAt:'desc'},{id:'desc'}]}):[],
   row.aid?tx.companyAssetFile.findMany({where:{...owned(actor),assetId:row.aid,...(!actor.canRepair&&!actor.canManage?{kind:{not:'invoice'}}:{})},select:{id:true,name:true,kind:true,mime:true,size:true,repairId:true,uploadedByName:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'desc'}]}):[],
   ref.kind==='inventory'?tx.inventoryAssetMovement.findMany({where:{...owned(actor),itemId:ref.id,isPrivate:false},orderBy:[{createdAt:'desc'},{id:'desc'}]}):[],
   row.aid?tx.companyAssetCode.findMany({where:{...owned(actor),assetId:row.aid,revokedAt:null},select:{id:true,kind:true,value:true},orderBy:{createdAt:'asc'},take:12}):[],
  ]);
  return {asset,codes:codes.map(c=>({...c,kind:c.kind as 'factory'|'label'})),permissions:permissions(actor),repairs:repairs.map(job=>repairView(job,asset)),incidents:incidents.map(incidentView),handovers:handovers.map(h=>handoverView(h,actor)),files:files.map(f=>({id:f.id,name:f.name,kind:f.kind as 'photo'|'invoice'|'document'|'cover',mime:f.mime,bytes:f.size,repairId:f.repairId,url:`/api/company-assets/files/${f.id}`,uploadedBy:f.uploadedByName,uploadedAt:f.createdAt.toISOString()})),history:[...history.map(h=>({id:h.id,type:h.type,actor:h.actorName,at:h.createdAt.toISOString(),note:h.note,repairId:h.repairId})),...legacy.map(h=>({id:`legacy:${h.id}`,type:`legacy.${h.action}`,actor:h.actorName??'',at:h.createdAt.toISOString(),note:h.note??'',repairId:null}))].sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id))};
 });
}

/** Compact read-only assistant projection. Never initializes an asset overlay. */
export type CanonicalAssistantAssetInput = {
 query?:string;assetKind?:AssetRef['kind'];assetId?:string;category?:AssetSummary['category'];holderWorkerId?:string;
 repairPhase?:'active'|'reported'|'received'|'repairing';repairLocation?:'internal'|'external';cursor?:string;limit?:number;
};
type AssistantPerson={id:string;name:string|null};
type AssistantHandover={
 id:string;kind:string;status:string;from:AssistantPerson|null;to:AssistantPerson|null;assignedSite:AssistantPerson|null;
 requestedAt:string|null;statusRecordedAt:string|null;confirmationEvidenceComplete:boolean;allRequiredConfirmed:boolean;
 confirmations:{participant:'office'|'worker';workerId:string|null;requiredName:string|null;confirmed:boolean;confirmedBy:string|null;confirmedAt:string|null}[];
};
type AssistantAssetRow=RawAsset&{isActive:boolean;repairPhase:string|null;repairLocation:string|null;repairProvider:string|null;repairProblem:string|null;repairUpdatedAt:Date|null;repairCreatedAt:Date|null;repairOriginId:string|null;repairOriginName:string|null;pendingHandover:unknown;latestCompletedHandover:unknown};
type StoredAssistantHandover={id:string;kind:string;status:string;fromWorkerId:string|null;fromWorkerName:string|null;toWorkerId:string|null;toWorkerName:string|null;siteId:string|null;siteName:string|null;required:unknown;confirmations:unknown;createdAt:string;updatedAt:string};
const assistantId=/^[a-z0-9_-]{1,120}$/i;
const assistantCursor=/^(machine|inventory):([a-z0-9_-]{1,120})$/i;
const assistantIso=(value:Date|string|null|undefined)=>{if(!value)return null;const date=new Date(value);return Number.isFinite(date.getTime())?date.toISOString():null;};
function assistantClip(value:string|null|undefined,path:string,truncated:string[],max=120){
 if(value==null)return null;if(value.length>max)truncated.push(path);return value.slice(0,max);
}
function assistantPerson(id:string|null,name:string|null,path:string,truncated:string[]):AssistantPerson|null{return id?{id,name:assistantClip(name,path,truncated)}:null;}
function assistantHandover(value:unknown,path:string,truncated:string[]):AssistantHandover|null{
 if(!value||typeof value!=='object')return null;
 const row=value as StoredAssistantHandover;
 if(typeof row.id!=='string'||typeof row.status!=='string'||typeof row.kind!=='string')return null;
 const required=Array.isArray(row.required)?row.required:[],approved=Array.isArray(row.confirmations)?row.confirmations:[];
 let complete=Array.isArray(row.required)&&Array.isArray(row.confirmations)&&required.length>0&&required.length<=4&&approved.length<=4;
 if(required.length>4||approved.length>4)truncated.push(`${path}.confirmations`);
 const confirmations:AssistantHandover['confirmations']=[];
 for(const raw of required.slice(0,4)){
  if(!raw||typeof raw!=='object'||!('key' in raw)||typeof raw.key!=='string'||!('name' in raw)||typeof raw.name!=='string'){complete=false;continue;}
  const workerId=raw.key.startsWith('worker:')?raw.key.slice(7):null;
  if(raw.key!=='office'&&(!workerId||!assistantId.test(workerId))){complete=false;continue;}
  const matching=approved.filter(p=>p&&typeof p==='object'&&'key' in p&&p.key===raw.key);
  if(matching.length>1)complete=false;
  const approval=matching[0] as {name?:unknown;at?:unknown}|undefined;
  const at=typeof approval?.at==='string'?assistantIso(approval.at):null;
  const confirmed=!!approval&&typeof approval.name==='string'&&!!at;
  if(approval&&!confirmed)complete=false;
  confirmations.push({participant:workerId?'worker':'office',workerId,requiredName:assistantClip(raw.name,`${path}.requiredName`,truncated),confirmed,confirmedBy:typeof approval?.name==='string'?assistantClip(approval.name,`${path}.confirmedBy`,truncated):null,confirmedAt:at});
 }
 if(confirmations.length!==required.length||new Set(required.map(p=>p&&typeof p==='object'&&'key'in p?p.key:null)).size!==required.length||approved.some(p=>!p||typeof p!=='object'||!('key'in p)||!required.some(r=>r&&typeof r==='object'&&'key'in r&&r.key===p.key)))complete=false;
 return {id:row.id,kind:row.kind,status:row.status,from:assistantPerson(row.fromWorkerId,row.fromWorkerName,`${path}.from.name`,truncated),to:assistantPerson(row.toWorkerId,row.toWorkerName,`${path}.to.name`,truncated),assignedSite:assistantPerson(row.siteId,row.siteName,`${path}.assignedSite.name`,truncated),requestedAt:assistantIso(row.createdAt),statusRecordedAt:assistantIso(row.updatedAt),confirmationEvidenceComplete:complete,allRequiredConfirmed:complete&&confirmations.every(p=>p.confirmed),confirmations};
}
function assistantAssetRow(row:AssistantAssetRow){
 const truncatedFields:string[]=[];
 const pendingHandover=assistantHandover(row.pendingHandover,'pendingHandover',truncatedFields),latestCompletedHandover=assistantHandover(row.latestCompletedHandover,'latestCompletedHandover',truncatedFields);
 const custodyBasis=row.holderWorkerId
  ? ['lost','retired'].includes(row.availability)?'recorded_responsibility_not_physical_possession'
   : latestCompletedHandover?.to?.id===row.holderWorkerId&&latestCompletedHandover.allRequiredConfirmed?'completed_handover'
   : row.aid?'recorded_operational_holder':'legacy_recorded_assignment'
  : !row.aid&&row.kind==='inventory'&&row.availability==='handover'?'legacy_pending_or_ambiguous':'no_recorded_holder';
 return {kind:row.kind,id:row.id,name:assistantClip(row.name,'name',truncatedFields),category:row.category,code:assistantClip(row.code,'code',truncatedFields),plate:assistantClip(row.plate,'plate',truncatedFields),size:assistantClip(row.size,'size',truncatedFields),baseRecordActive:row.isActive,operationalAvailability:row.availability,usable:row.availability==='available'||row.availability==='issued',
  recordedHolder:assistantPerson(row.holderWorkerId,row.holderName,'recordedHolder.name',truncatedFields),assignedSite:assistantPerson(row.siteId,row.siteName,'assignedSite.name',truncatedFields),custodyBasis,
  activeRepair:row.activeRepairId?{id:row.activeRepairId,phase:row.repairPhase,location:row.repairLocation,provider:assistantClip(row.repairProvider,'activeRepair.provider',truncatedFields),problem:assistantClip(row.repairProblem,'activeRepair.problem',truncatedFields,240),createdAt:assistantIso(row.repairCreatedAt),updatedAt:assistantIso(row.repairUpdatedAt),originWorker:assistantPerson(row.repairOriginId,row.repairOriginName,'activeRepair.originWorker.name',truncatedFields)}:null,
  pendingHandover,latestCompletedHandover,truncatedFields};
}
function assistantHandoverJoin(actor:AssetActor,status:'pending'|'completed',alias:'pending'|'completed'){
 return Prisma.sql`LEFT JOIN LATERAL (
  SELECT jsonb_build_object('id',h.id,'kind',h.kind,'status',h.status,'fromWorkerId',h."fromWorkerId",'fromWorkerName',concat_ws(' ',fw."firstName",fw."lastName"),'toWorkerId',h."toWorkerId",'toWorkerName',concat_ws(' ',tw."firstName",tw."lastName"),'siteId',h."siteId",'siteName',hs.name,'required',h.required,'confirmations',h.confirmations,'createdAt',h."createdAt" AT TIME ZONE 'UTC','updatedAt',h."updatedAt" AT TIME ZONE 'UTC') AS value
  FROM "CompanyAssetHandover" h
  LEFT JOIN "Worker" fw ON fw.id=h."fromWorkerId" AND fw."companyProfileId"=${actor.companyId}
  LEFT JOIN "Worker" tw ON tw.id=h."toWorkerId" AND tw."companyProfileId"=${actor.companyId}
  LEFT JOIN "Baustelle" hs ON hs.id=h."siteId" AND hs."companyProfileId"=${actor.companyId}
  WHERE h."companyProfileId"=${actor.companyId} AND h."assetId"=assets.aid AND h.status=${status}
  ORDER BY h."updatedAt" DESC,h.id DESC LIMIT 1
 ) ${Prisma.raw(alias)} ON true`;
}
/** Caller supplies a freshly verified admin and a repeatable-read tenant transaction. */
export async function readCanonicalAssistantAssets(tx:Tx,actor:AssetActor,input:CanonicalAssistantAssetInput={}){
 if(!actor.companyId||!actor.userId||actor.workerId||!actor.canManage)return assetFail('DENIED');
 const limit=input.limit??8,query=input.query?.trim().replace(/\s+/g,' ')??'',cursor=input.cursor?assistantCursor.exec(input.cursor):null;
 if(!Number.isInteger(limit)||limit<1||limit>20||query.length>100||(input.cursor&&(!cursor||input.cursor.length>130))||(input.assetId&&(!input.assetKind||!assistantId.test(input.assetId)))||(input.holderWorkerId&&!assistantId.test(input.holderWorkerId))||(input.assetKind&&!['machine','inventory'].includes(input.assetKind))||(input.category&&!['vehicle','tool','clothing','equipment'].includes(input.category))||(input.repairPhase&&!['active','reported','received','repairing'].includes(input.repairPhase))||(input.repairLocation&&!['internal','external'].includes(input.repairLocation)))return assetFail('INVALID_INPUT');
 const filters:Prisma.Sql[]=[Prisma.sql`true`];
 if(input.assetKind)filters.push(Prisma.sql`assets.kind=${input.assetKind}`);
 if(input.assetId)filters.push(Prisma.sql`assets.id=${input.assetId}`);
 if(input.category)filters.push(Prisma.sql`assets.category=${input.category}`);
 if(input.holderWorkerId)filters.push(Prisma.sql`assets."holderWorkerId"=${input.holderWorkerId}`);
 if(input.repairPhase)filters.push(input.repairPhase==='active'?Prisma.sql`r.phase IN ('reported','received','repairing')`:Prisma.sql`r.phase=${input.repairPhase}`);
 if(input.repairLocation)filters.push(Prisma.sql`r.location=${input.repairLocation}`);
 if(query){
  const pattern=`%${query.replace(/[\\%_]/g,'\\$&')}%`,compact=query.replace(/[\s-]/g,'');
  const plate=compact&&/[a-z0-9]/i.test(compact)?Prisma.sql`OR regexp_replace(COALESCE(assets.plate,''),'[[:space:]-]','','g') ILIKE ${`%${compact.replace(/[\\%_]/g,'\\$&')}%`}`:Prisma.empty;
  filters.push(Prisma.sql`(assets.name ILIKE ${pattern} OR assets.code ILIKE ${pattern} OR assets."searchCode" ILIKE ${pattern} OR assets.plate ILIKE ${pattern} ${plate})`);
 }
 const where=Prisma.join(filters,' AND '),repairJoin=Prisma.sql`LEFT JOIN "CompanyAssetRepair" r ON r.id=assets."activeRepairId" AND r."assetId"=assets.aid AND r."companyProfileId"=${actor.companyId}`;
 if(cursor){const found=await tx.$queryRaw<{id:string}[]>(Prisma.sql`${assetProjection(actor)} SELECT assets.id FROM assets ${repairJoin} WHERE ${where} AND assets.kind=${cursor[1].toLowerCase()} AND assets.id=${cursor[2]} LIMIT 1`);if(!found.length)return assetFail('INVALID_CURSOR');}
 const [counts]=await tx.$queryRaw<{totalMatching:number;reported:number;received:number;repairing:number}[]>(Prisma.sql`${assetProjection(actor)} SELECT count(*)::int AS "totalMatching",count(*) FILTER(WHERE r.phase='reported')::int AS reported,count(*) FILTER(WHERE r.phase='received')::int AS received,count(*) FILTER(WHERE r.phase='repairing')::int AS repairing FROM assets ${repairJoin} WHERE ${where}`);
 const after=cursor?Prisma.sql`AND (assets.kind>${cursor[1].toLowerCase()} OR (assets.kind=${cursor[1].toLowerCase()} AND assets.id>${cursor[2]}))`:Prisma.empty;
 const rows=await tx.$queryRaw<AssistantAssetRow[]>(Prisma.sql`${assetProjection(actor)}
 SELECT assets.*,r.phase AS "repairPhase",r.location AS "repairLocation",r.provider AS "repairProvider",r.problem AS "repairProblem",r."updatedAt" AS "repairUpdatedAt",r."createdAt" AS "repairCreatedAt",r."originWorkerId" AS "repairOriginId",concat_ws(' ',origin."firstName",origin."lastName") AS "repairOriginName",pending.value AS "pendingHandover",completed.value AS "latestCompletedHandover"
 FROM assets ${repairJoin}
 LEFT JOIN "Worker" origin ON origin.id=r."originWorkerId" AND origin."companyProfileId"=${actor.companyId}
 ${assistantHandoverJoin(actor,'pending','pending')} ${assistantHandoverJoin(actor,'completed','completed')}
 WHERE ${where} ${after} ORDER BY assets.kind,assets.id LIMIT ${limit+1}`);
 const hasMore=rows.length>limit,items=rows.slice(0,limit).map(assistantAssetRow);
 return {items,totalMatching:counts.totalMatching,returned:items.length,hasMore,nextCursor:hasMore?`${items.at(-1)!.kind}:${items.at(-1)!.id}`:null,complete:!input.cursor&&!hasMore&&items.length===counts.totalMatching,scope:input.cursor?'continuation_page':hasMore?'first_page':'all_matching_rows',countsByRepairPhase:{reported:counts.reported,received:counts.received,repairing:counts.repairing},countsScope:'all_matching_assets_before_pagination',identityResolution:input.assetId?'exact_asset_ref':query&&counts.totalMatching>1?'multiple_candidates_require_clarification_if_targeting_one_asset':'matching_assets',filters:{query:query||null,assetKind:input.assetKind??null,assetId:input.assetId??null,category:input.category??null,holderWorkerId:input.holderWorkerId??null,repairPhase:input.repairPhase??null,repairLocation:input.repairLocation??null},
 handoverCoverage:{pending:'at_most_one_operational_pending_handover_per_asset_by_database_constraint_legacy_pending_is_separate',completed:'latest_completed_only_not_full_history'},
 caveats:['Current recorded workflow state, not a historical snapshot or independent physical check.','Holder and assigned site are recorded custody/allocation; no holder or available status does not prove a physical warehouse location or free stock.','Pending handover recipients are not current holders until completion; completed handovers remain historical when later custody changes.','Reported is not received in the workshop; originWorker is historical responsibility, not the current holder.','Repair internal/external is a recorded route/provider, not a live address or GPS fix.','Lost/retired holder rows describe recorded responsibility, not physical possession.','Legacy pending/ambiguous custody is unresolved; never select a worker from it. No file contents, invoice contents or full repair/history notes are returned.']};
}
