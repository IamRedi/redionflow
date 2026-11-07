import type { Prisma } from '@/generated/prisma/client';
import { assetFail, AssetOperationError } from '@/lib/company-assets/access';

type Tx=Prisma.TransactionClient;
export type SiteDocumentIdentity={companyId:string;userId:string|null;workerId:string|null};
export const DOCUMENT_ENGINEER_ROLES=['FIELD_ENGINEER','FACTORY_ENGINEER'] as const;
export const isDocumentEngineer=(role:string|null|undefined)=>DOCUMENT_ENGINEER_ROLES.some(value=>value===role);

/** Fresh tenant/role/grant checks. A write holds site + identity locks until commit,
 * so revoking a grant or role cannot race the authorization of a stored file. */
export async function siteDocumentAccess(tx:Tx,actor:SiteDocumentIdentity,siteId:string,write=false){
 if(Boolean(actor.userId)===Boolean(actor.workerId))return assetFail('DENIED');
 if(write)await tx.$queryRaw`SELECT id FROM "Baustelle" WHERE id=${siteId} AND "companyProfileId"=${actor.companyId} FOR SHARE`;
 const site=await tx.baustelle.findFirst({where:{id:siteId,companyProfileId:actor.companyId},select:{type:true,documentAccessRevision:true}});
 if(!site||site.type!=='STEEL_ASSEMBLY')return assetFail('NOT_FOUND');
 if(actor.userId){
  if(write)await tx.$queryRaw`SELECT id FROM "User" WHERE id=${actor.userId} AND "companyProfileId"=${actor.companyId} FOR SHARE`;
  const user=await tx.user.findFirst({where:{id:actor.userId,companyProfileId:actor.companyId,role:'ADMIN',isActive:true},select:{id:true}});
  if(!user)return assetFail('DENIED');
  return {read:true,upload:true,office:true,manage:true,revision:site.documentAccessRevision};
 }
 if(write)await tx.$queryRaw`SELECT id FROM "Worker" WHERE id=${actor.workerId!} AND "companyProfileId"=${actor.companyId} FOR SHARE`;
 const person=await tx.worker.findFirst({where:{id:actor.workerId!,companyProfileId:actor.companyId,status:'active'},select:{crewRole:true}});
 if(!person)return assetFail('DENIED');
 const office=person.crewRole==='OFFICE';
 const grant=isDocumentEngineer(person.crewRole)?await tx.siteDocumentEngineer.findUnique({where:{companyProfileId_baustelleId_workerId:{companyProfileId:actor.companyId,baustelleId:siteId,workerId:actor.workerId!}},select:{id:true}}):null;
 return {read:true,upload:office||Boolean(grant),office,manage:false,revision:site.documentAccessRevision};
}
export async function requireSiteDocumentUpload(tx:Tx,actor:SiteDocumentIdentity,siteId:string){
 const access=await siteDocumentAccess(tx,actor,siteId,true);
 if(!access.upload)return assetFail('DENIED');return access;
}
export async function mayUploadSiteDocuments(tx:Tx,actor:SiteDocumentIdentity,siteId:string){
 try{return (await siteDocumentAccess(tx,actor,siteId,true)).upload;}
 catch(error){if(error instanceof AssetOperationError&&['DENIED','NOT_FOUND'].includes(error.code))return false;throw error;}
}
