import { getCurrentAdmin } from '@/lib/auth/admin-session';
import { getCurrentWorker } from '@/lib/workzone/worker-session';
import { getCurrentCompanyId } from '@/lib/db/tenant';
import { withTenantContext } from '@/lib/db/tenant-context';
import { isSteelCompany } from '@/lib/dashboard/steel-access';
import { crewPermissions } from '@/lib/workzone/crew-roles';
import { isSteelSiteType } from '@/lib/workzone/steel-phases';
import { assetFail } from '@/lib/company-assets/access';
import type { Prisma } from '@/generated/prisma/client';

export type DocumentActor={companyId:string;userId:string|null;workerId:string|null;key:string;name:string;office:boolean};
/** A receipt always belongs to one fresh authenticated person, never a browser-supplied name. */
export async function documentActor():Promise<DocumentActor>{
  const [admin,worker,companyId]=await Promise.all([getCurrentAdmin(),getCurrentWorker(),getCurrentCompanyId()]);
  if(!companyId||(!admin&&!worker)||(admin&&worker)||!await isSteelCompany(companyId))return assetFail('DENIED');
  return withTenantContext(companyId,async tx=>{
    if(admin){
      const person=await tx.user.findFirst({where:{id:admin.id,companyProfileId:companyId,role:'ADMIN',isActive:true},select:{id:true,name:true,email:true}});
      if(!person)return assetFail('DENIED');
      return {companyId,userId:person.id,workerId:null,key:`user:${person.id}`,name:person.name||person.email,office:true};
    }
    const person=await tx.worker.findFirst({where:{id:worker!.id,companyProfileId:companyId,status:'active'},select:{id:true,firstName:true,lastName:true,crewRole:true,level:true}});
    if(!person)return assetFail('DENIED');
    const can=crewPermissions({isAdmin:false,crewRole:person.crewRole,level:person.level});
    if(!can.office&&!can.factorySteps&&!can.siteSteps)return assetFail('DENIED');
    return {companyId,userId:null,workerId:person.id,key:`worker:${person.id}`,name:`${person.firstName} ${person.lastName}`.trim(),office:can.office};
  });
}
export async function assertDocumentSite(tx:Prisma.TransactionClient,actor:DocumentActor,siteId:string){
  const site=await tx.baustelle.findFirst({where:{id:siteId,companyProfileId:actor.companyId},select:{type:true}});
  if(!site||!isSteelSiteType(site.type)||site.type==='STEEL_WORKSHOP')return assetFail('NOT_FOUND');
}
