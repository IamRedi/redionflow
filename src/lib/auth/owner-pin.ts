import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { getCurrentAdmin } from './admin-session';
import { getCurrentWorker } from '@/lib/workzone/worker-session';
import { hashPassword,verifyPassword } from './password';
import { ensureLoginAllowed,registerFailedLogin,clearFailedLogin } from './login-guard';
import { assetFail } from '@/lib/company-assets/access';
import { isSteelCompany } from '@/lib/dashboard/steel-access';

export const normalizePinName=(name:string)=>name.trim().replace(/\s+/g,' ').toLocaleLowerCase('sq');
const pinSchema=z.string().regex(/^\d{8}$/);
/** No global first-company fallback, no plaintext credential, no role from the browser. */
export async function authenticateOwnerPin(name:string,pin:string){
 if(!pinSchema.safeParse(pin).success||!name.trim()||name.length>200)return null;
 const identity=normalizePinName(name),companyId=process.env.INSTALLATION_COMPANY_ID?.trim();
 const users=await prisma.user.findMany({where:{role:'ADMIN',isActive:true,isOwner:true,loginPinHash:{not:null},...(companyId?{companyProfileId:companyId}:{})},select:{id:true,name:true,loginPinHash:true,sessionEpoch:true,companyProfileId:true}});
 const matches=users.filter(u=>u.companyProfileId&&u.name&&(normalizePinName(u.name)===identity||normalizePinName(u.name).split(' ')[0]===identity));
 if(matches.length!==1)return null;
 const user=matches[0],key='owner-pin:'+createHash('sha256').update(user.id).digest('hex');
 if(!(await ensureLoginAllowed('admin',key)).ok)return null;
 if(!user.loginPinHash||!verifyPassword(pin,user.loginPinHash)){await registerFailedLogin('admin',key);return null;}
 // Re-read after hashing so an inactive, rotated or demoted account cannot win a race.
 const fresh=await prisma.user.findFirst({where:{id:user.id,companyProfileId:user.companyProfileId,role:'ADMIN',isActive:true,isOwner:true,sessionEpoch:user.sessionEpoch,loginPinHash:user.loginPinHash},select:{id:true,sessionEpoch:true}});
 if(!fresh)return null;await clearFailedLogin('admin',key);return fresh;
}

export async function configureOwnerPin(input:unknown){
 const data=z.object({name:z.string().trim().min(2).max(120),email:z.email().max(200).transform(v=>v.toLowerCase()),pin:pinSchema}).strict().parse(input);
 const [admin,worker]=await Promise.all([getCurrentAdmin(),getCurrentWorker()]);
 if(!admin?.companyProfileId||worker||!admin.isOwner)return assetFail('DENIED');
 const companyId=admin.companyProfileId,pinHash=hashPassword(data.pin);
 if(!await isSteelCompany(companyId))return assetFail('DENIED');
 return withTenantContext(companyId,async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${admin.id} AND "companyProfileId"=${companyId} FOR UPDATE`;
  const owner=await tx.user.findFirst({where:{id:admin.id,companyProfileId:companyId,role:'ADMIN',isActive:true,isOwner:true},select:{id:true}});if(!owner)return assetFail('DENIED');
  const existing=await tx.user.findUnique({where:{email:data.email},select:{id:true,companyProfileId:true,role:true,isOwner:true,loginPinHash:true,passwordHash:true}});
  if(existing&&(existing.companyProfileId!==companyId||existing.role!=='ADMIN'||existing.isOwner&&existing.id!==admin.id&&(existing.loginPinHash||existing.passwordHash)))return assetFail('DENIED');
  const names=await tx.user.findMany({where:{companyProfileId:companyId,isActive:true,loginPinHash:{not:null},...(existing?{id:{not:existing.id}}:{})},select:{name:true}});
  if(names.some(p=>p.name&&normalizePinName(p.name)===normalizePinName(data.name)))return assetFail('CONFLICT');
  const user=existing?await tx.user.update({where:{id:existing.id},data:{name:data.name,loginPinHash:pinHash,isOwner:true,isActive:true},select:{id:true}}):await tx.user.create({data:{companyProfileId:companyId,name:data.name,email:data.email,role:'ADMIN',isOwner:true,isActive:true,loginPinHash:pinHash,preferredLanguage:'SQ',motherTongue:'SQ'},select:{id:true}});
  await tx.auditLog.create({data:{companyProfileId:companyId,actorType:'ADMIN',actorId:admin.id,action:'admin.owner_pin_configured',payload:{userId:user.id,created:!existing}}});
  return {id:user.id};
 });
}
