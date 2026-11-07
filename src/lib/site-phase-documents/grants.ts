import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { withTenantContext } from '@/lib/db/tenant-context';
import { assetFail } from '@/lib/company-assets/access';
import { documentActor } from './access';
import { DOCUMENT_ENGINEER_ROLES, isDocumentEngineer, siteDocumentAccess, type SiteDocumentIdentity } from './site-access';

const ids=z.array(z.string().min(1).max(128)).max(100).refine(value=>new Set(value).size===value.length);
export const siteEngineerIds=(value:unknown)=>ids.parse(value);
const select={id:true,firstName:true,lastName:true,crewRole:true,status:true} satisfies Prisma.WorkerSelect;
async function adminIdentity(){const actor=await documentActor();if(!actor.userId)return assetFail('DENIED');return actor;}
export async function readEngineerOptions(){
 const actor=await documentActor();if(!actor.userId)return {canManage:false as const,engineers:[]};
 return withTenantContext(actor.companyId,async tx=>{
  const admin=await tx.user.findFirst({where:{id:actor.userId!,companyProfileId:actor.companyId,role:'ADMIN',isActive:true},select:{id:true}});if(!admin)return assetFail('DENIED');
  const people=await tx.worker.findMany({where:{companyProfileId:actor.companyId,status:'active',crewRole:{in:[...DOCUMENT_ENGINEER_ROLES]}},select,orderBy:[{firstName:'asc'},{lastName:'asc'}]});
  return {canManage:true as const,engineers:people.map(p=>({id:p.id,name:`${p.firstName} ${p.lastName}`.trim(),role:p.crewRole!}))};
 });
}
export async function readSiteEngineerGrants(siteId:string){
 const actor=await adminIdentity();
 return withTenantContext(actor.companyId,async tx=>{
  const access=await siteDocumentAccess(tx,actor,siteId);if(!access.manage)return assetFail('DENIED');
  const people=await tx.worker.findMany({where:{companyProfileId:actor.companyId,OR:[{status:'active',crewRole:{in:[...DOCUMENT_ENGINEER_ROLES]}},{siteDocumentGrants:{some:{baustelleId:siteId}}}]},select:{...select,siteDocumentGrants:{where:{baustelleId:siteId,companyProfileId:actor.companyId},select:{id:true}}},orderBy:[{firstName:'asc'},{lastName:'asc'}]});
  return {revision:access.revision,engineers:people.map(p=>({id:p.id,name:`${p.firstName} ${p.lastName}`.trim(),role:p.crewRole,eligible:p.status==='active'&&isDocumentEngineer(p.crewRole),selected:p.siteDocumentGrants.length>0}))};
 });
}
/** Used inside the same create/update transaction. Only real, fresh admins grant access. */
export async function writeSiteEngineerGrants(tx:Prisma.TransactionClient,actor:SiteDocumentIdentity,siteId:string,workerIds:string[],revision?:number,append=false){
 siteEngineerIds(workerIds);
 if(!actor.userId||actor.workerId)return assetFail('DENIED');
 await tx.$queryRaw`SELECT id FROM "Baustelle" WHERE id=${siteId} AND "companyProfileId"=${actor.companyId} FOR UPDATE`;
 const access=await siteDocumentAccess(tx,actor,siteId,true);if(!access.manage)return assetFail('DENIED');
 if(revision!==undefined&&revision!==access.revision)return assetFail('CONFLICT');
 if(workerIds.length){
  await tx.$queryRaw`SELECT id FROM "Worker" WHERE id=ANY(${workerIds}::text[]) AND "companyProfileId"=${actor.companyId} ORDER BY id FOR SHARE`;
  const count=await tx.worker.count({where:{id:{in:workerIds},companyProfileId:actor.companyId,status:'active',crewRole:{in:[...DOCUMENT_ENGINEER_ROLES]}}});if(count!==workerIds.length)return assetFail('DENIED');
 }
 const prior=await tx.siteDocumentEngineer.findMany({where:{companyProfileId:actor.companyId,baustelleId:siteId},select:{workerId:true}}),before=prior.map(p=>p.workerId).sort();
 const next=append?[...new Set([...before,...workerIds])].sort():[...workerIds].sort();
 if(JSON.stringify(before)===JSON.stringify(next))return {revision:access.revision};
 await tx.siteDocumentEngineer.deleteMany({where:{companyProfileId:actor.companyId,baustelleId:siteId,workerId:{notIn:next}}});
 const added=next.filter(id=>!before.includes(id));
 if(added.length)await tx.siteDocumentEngineer.createMany({data:added.map(workerId=>({companyProfileId:actor.companyId,baustelleId:siteId,workerId,grantedByUserId:actor.userId!}))});
 await tx.baustelle.update({where:{id:siteId},data:{documentAccessRevision:{increment:1}}});
 await tx.auditLog.create({data:{companyProfileId:actor.companyId,actorType:'ADMIN',actorId:actor.userId,action:'site.document_engineers_changed',payload:{siteId,before,after:next}}});
 return {revision:access.revision+1};
}
export async function setSiteEngineerGrants(input:unknown){
 const data=z.object({siteId:z.string().min(1).max(128),workerIds:ids,revision:z.number().int().nonnegative()}).strict().parse(input),actor=await adminIdentity();
 return withTenantContext(actor.companyId,tx=>writeSiteEngineerGrants(tx,actor,data.siteId,data.workerIds,data.revision));
}
