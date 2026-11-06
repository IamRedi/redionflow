import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { assetActor, AssetOperationError } from '@/lib/company-assets/access';
import { readCanonicalAssistantAssets, type CanonicalAssistantAssetInput } from '@/lib/company-assets/service';
import { isSteelCompany } from '@/lib/dashboard/steel-access';
import { fuelTimeZone } from '@/lib/fleet/fuel/time';
import { categorizeAssistantFailure } from './diagnostics';
import type { RequesterContext } from './requester';

const id=z.string().trim().regex(/^[a-z0-9_-]{1,120}$/i);
const inputSchema=z.object({
 query:z.string().trim().max(100).optional(),assetKind:z.enum(['machine','inventory']).optional(),assetId:id.optional(),
 category:z.enum(['vehicle','tool','clothing','equipment']).optional(),holderWorkerId:id.optional(),
 repairPhase:z.enum(['active','reported','received','repairing']).optional(),repairLocation:z.enum(['internal','external']).optional(),
 cursor:z.string().max(130).regex(/^(machine|inventory):[a-z0-9_-]{1,120}$/).optional(),limit:z.number().int().min(1).max(20).optional(),
}).strict().superRefine((input,context)=>{
 if(input.assetId&&!input.assetKind)context.addIssue({code:'custom',path:['assetKind'],message:'An exact asset ID requires its kind.'});
});
const forbidden=()=>({ok:false as const,code:'FORBIDDEN',message:'Only a current administrator of this steel company can read company asset operations.'});
const invalid=()=>({ok:false as const,code:'INVALID_INPUT',message:'Use a bounded asset search, valid asset kind with its ID, current repair filters and kind:id cursor.'});

async function readAssets(requester:RequesterContext,input:CanonicalAssistantAssetInput,workshop:boolean){
 if(requester.kind!=='admin'||!requester.companyId||!requester.adminId)return forbidden();
 const parsed=inputSchema.safeParse(input);if(!parsed.success)return invalid();
 const filters:CanonicalAssistantAssetInput={...parsed.data,...(workshop&&parsed.data.repairPhase===undefined?{repairPhase:'active' as const}:{})};
 try{
  const actor=await assetActor();
  if(actor.companyId!==requester.companyId||actor.userId!==requester.adminId||actor.workerId||!actor.canManage)return forbidden();
  if(!await isSteelCompany(actor.companyId))return forbidden();
  return await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${actor.companyId}, true)`;
   const admin=await tx.user.findFirst({where:{id:requester.adminId,companyProfileId:actor.companyId,role:'ADMIN',isActive:true},select:{id:true}});
   if(!admin)return forbidden();
   const company=await tx.companyProfile.findUnique({where:{id:actor.companyId},select:{country:true}});
   if(!company)return forbidden();
   const retrievedAt=new Date().toISOString();
   const data=await readCanonicalAssistantAssets(tx,actor,filters);
   return {ok:true as const,source:'Canonical current company asset custody and workshop records',retrievedAt,timeZone:fuelTimeZone(company.country),readOnly:true,consistency:'One repeatable-read tenant snapshot of current stored records. No physical check, GPS refresh or provider call.',data};
  },{isolationLevel:'RepeatableRead',timeout:10000,maxWait:3000});
 }catch(error){
  if(error instanceof AssetOperationError){
   if(error.code==='DENIED')return forbidden();
   if(error.code==='INVALID_INPUT'||error.code==='INVALID_CURSOR')return {...invalid(),code:error.code};
  }
  return {ok:false as const,code:'DATA_UNAVAILABLE',message:'Current company asset operations could not be read. Custody, location and repair state are unknown; do not infer zero, no repairs, warehouse location or a previous holder.',diagnostic:categorizeAssistantFailure(error,{source:'database'})};
 }
}

/** Admin-only company assets; exact canonical holder filtering, never a plan/origin-worker inference. */
export function adminSearchCompanyAssets(requester:RequesterContext,input:CanonicalAssistantAssetInput={}){
 return readAssets(requester,input,false);
}
/** Defaults to all active recorded phases. Explicit repairing means only the repairing phase. */
export function adminGetCompanyWorkshop(requester:RequesterContext,input:CanonicalAssistantAssetInput={}){
 return readAssets(requester,input,true);
}
