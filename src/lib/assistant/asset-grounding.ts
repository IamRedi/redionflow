import {isSteelCompany} from '@/lib/dashboard/steel-access';
import {withTenantContext} from '@/lib/db/tenant-context';
import {assetActor} from '@/lib/company-assets/access';
import {readCanonicalAssetFacts} from '@/lib/company-assets/service';
import type {AssetAvailability,AssetRef} from '@/lib/company-assets/types';
import type {RequesterContext} from './requester';

type Fact={ref:AssetRef;baseRecordActive:boolean;operationalAvailability:AssetAvailability;usable:boolean};
export type AssetGrounding={applicable:boolean;complete:boolean;items:Fact[];retrievedAt:string;warning:string|null};
const warning='Current company asset availability could not be read completely. Base active flags, old assignment rows and planned names do not prove usability, physical possession or available stock. Do not infer missing states.';
const key=(ref:AssetRef)=>`${ref.kind}:${ref.id}`;
/** No mutation/provider calls: revalidate the real actor and read exact owned IDs. */
export async function assistantAssetGrounding(requester:RequesterContext,inputs:AssetRef[]):Promise<AssetGrounding>{
 const retrievedAt=new Date().toISOString();
 try{
  if(requester.kind==='anonymous')return {applicable:true,complete:false,items:[],retrievedAt,warning};
  if(!await isSteelCompany(requester.companyId))return {applicable:false,complete:true,items:[],retrievedAt,warning:null};
  const actor=await assetActor();
  if(actor.companyId!==requester.companyId || (requester.kind==='admin'?actor.userId!==requester.adminId:actor.workerId!==requester.workerId))return {applicable:true,complete:false,items:[],retrievedAt,warning};
  const refs=[...new Map(inputs.map(ref=>[key(ref),ref])).values()];
  if(refs.length>500)return {applicable:true,complete:false,items:[],retrievedAt,warning};
  const items=await withTenantContext(actor.companyId,tx=>readCanonicalAssetFacts(tx,actor,refs));
  const requested=new Set(refs.map(key));
  // Never propagate an unexpected/foreign ID even if a future reader regresses.
  const safe=items.filter(item=>requested.has(key(item.ref)));
  const complete=safe.length===refs.length&&new Set(safe.map(item=>key(item.ref))).size===refs.length;
  return {applicable:true,complete,items:safe,retrievedAt,warning:complete?null:warning};
 }catch{return {applicable:true,complete:false,items:[],retrievedAt,warning};}
}
export function assetGroundingFields(grounding:AssetGrounding,ref:AssetRef,baseRecordActive?:boolean|null){
 if(!grounding.applicable)return {};
 const fact=grounding.items.find(item=>key(item.ref)===key(ref));
 return {baseRecordActive:fact?.baseRecordActive??baseRecordActive??null,operationalAvailability:fact?.operationalAvailability??null,usable:fact?.usable??null,operationalCoverageComplete:!!fact&&grounding.complete,operationalRetrievedAt:grounding.retrievedAt,operationalTimeBasis:'current_status_not_historical_plan_date',operationalWarning:grounding.warning,usableMeaning:'Not blocked by current asset rules; not proof of free stock or physical condition.'};
}
