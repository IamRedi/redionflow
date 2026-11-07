import {createHash,randomUUID} from 'node:crypto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const auth=vi.hoisted(()=>({admin:vi.fn(),worker:vi.fn()}));
vi.mock('./admin-session',()=>({getCurrentAdmin:auth.admin}));
vi.mock('@/lib/workzone/worker-session',()=>({getCurrentWorker:auth.worker}));
import {prisma} from '@/lib/db/prisma';
import {assertAssistantTestDatabase} from '../../../tests/fixtures/assistant-database';
import {configureOwnerPin,authenticateOwnerPin} from './owner-pin';
import {verifyPassword} from './password';
import {computeClientKey} from './client-key';
assertAssistantTestDatabase();
let companyId:string,foreignId:string,bossId:string;
const pin='58392071';
beforeEach(async()=>{
 vi.stubEnv('LOGIN_GUARD_SALT','a9'.repeat(32));vi.stubEnv('LOGIN_ATTEMPT_STORE','postgres');vi.stubEnv('INSTALLATION_COMPANY_ID','');
 companyId=(await prisma.companyProfile.create({data:{legalName:'Synthetic PIN company',displayName:'Synthetic PIN company',mode:'bau',country:'AL'}})).id;
 foreignId=(await prisma.companyProfile.create({data:{legalName:'Foreign PIN company',displayName:'Foreign PIN company'}})).id;
 await prisma.baustelle.create({data:{companyProfileId:companyId,name:'Synthetic factory',type:'STEEL_WORKSHOP'}});
 bossId=(await prisma.user.create({data:{companyProfileId:companyId,name:'Synthetic Administrator',email:`boss-${randomUUID()}@example.test`,role:'ADMIN',isOwner:true}})).id;
 auth.admin.mockResolvedValue({id:bossId,companyProfileId:companyId,isOwner:true});auth.worker.mockResolvedValue(null);
});
afterEach(async()=>{
 const users=await prisma.user.findMany({where:{companyProfileId:{in:[companyId,foreignId]}},select:{id:true}});
 for(const u of users){const key='owner-pin:'+createHash('sha256').update(u.id).digest('hex');await prisma.loginAttempt.deleteMany({where:{scope:'admin',clientKey:computeClientKey('admin',key)}});}
 await prisma.user.deleteMany({where:{companyProfileId:{in:[companyId,foreignId]}}});await prisma.companyProfile.deleteMany({where:{id:{in:[companyId,foreignId]}}});vi.unstubAllEnvs();
});
const input=()=>({name:'Synthetic Owner',email:`owner-${randomUUID()}@example.test`,pin});
it('creates a separate full owner and authenticates by full or unambiguous first name without a worker cookie',async()=>{
 const data=input(),pending=await prisma.user.create({data:{companyProfileId:companyId,email:data.email,name:data.name,role:'ADMIN',isOwner:true,isActive:false}});
 expect(await authenticateOwnerPin(data.name,pin)).toBeNull();
 const created=await configureOwnerPin(data);expect(created.id).toBe(pending.id);const user=await prisma.user.findUniqueOrThrow({where:{id:created.id}});
 expect(user).toMatchObject({role:'ADMIN',isOwner:true,isActive:true,passwordHash:null});expect(user.loginPinHash).not.toBe(pin);expect(verifyPassword(pin,user.loginPinHash!)).toBe(true);
 expect(await authenticateOwnerPin(' Synthetic   Owner ',pin)).toEqual({id:user.id,sessionEpoch:user.sessionEpoch});expect(await authenticateOwnerPin('Synthetic',pin)).toMatchObject({id:user.id});
 expect(await authenticateOwnerPin('Foreign person',pin)).toBeNull();expect(await authenticateOwnerPin(data.name,'123456')).toBeNull();
 await prisma.user.update({where:{id:user.id},data:{isActive:false}});expect(await authenticateOwnerPin(data.name,pin)).toBeNull();
 expect(await prisma.worker.count({where:{companyProfileId:companyId}})).toBe(0);
});
it('requires a fresh sole owner identity and never changes foreign accounts',async()=>{
 const foreign=await prisma.user.create({data:{companyProfileId:foreignId,email:`foreign-${randomUUID()}@example.test`,role:'ADMIN',isOwner:true}});
 await expect(configureOwnerPin({...input(),email:foreign.email})).rejects.toMatchObject({code:'DENIED'});
 await prisma.user.update({where:{id:bossId},data:{isOwner:false}});await expect(configureOwnerPin(input())).rejects.toMatchObject({code:'DENIED'});
 await prisma.user.update({where:{id:bossId},data:{isOwner:true}});auth.worker.mockResolvedValue({id:'synthetic-worker'});await expect(configureOwnerPin(input())).rejects.toMatchObject({code:'DENIED'});
 expect((await prisma.user.findUniqueOrThrow({where:{id:foreign.id}})).loginPinHash).toBeNull();
});
it('retains both owners, protects an activated peer owner and revokes sessions on PIN rotation',async()=>{
 const data=input(),other=await configureOwnerPin(data);await expect(configureOwnerPin({...data,pin:'48293017'})).rejects.toMatchObject({code:'DENIED'});
 const original=await prisma.user.findUniqueOrThrow({where:{id:other.id}});auth.admin.mockResolvedValue({id:other.id,companyProfileId:companyId,isOwner:true});
 await configureOwnerPin({...data,pin:'48293017'});const next=await prisma.user.findUniqueOrThrow({where:{id:other.id}});expect(next.sessionEpoch).toBeGreaterThan(original.sessionEpoch);expect(await authenticateOwnerPin(data.name,pin)).toBeNull();expect(await authenticateOwnerPin(data.name,'48293017')).toMatchObject({id:other.id});
 expect((await prisma.user.findUniqueOrThrow({where:{id:bossId}})).isOwner).toBe(true);
});
it('uses a durable account-wide limiter across short/full-name aliases',async()=>{
 const data=input();await configureOwnerPin(data);for(let i=0;i<6;i++)expect(await authenticateOwnerPin(i%2?'Synthetic':data.name,'00000000')).toBeNull();
 expect(await authenticateOwnerPin(data.name,pin)).toBeNull();
});
it('respects dedicated installation binding and refuses ambiguous first names',async()=>{
 const first=await configureOwnerPin(input());await configureOwnerPin({...input(),name:'Synthetic Peer'});expect(await authenticateOwnerPin('Synthetic',pin)).toBeNull();expect(await authenticateOwnerPin('Synthetic Owner',pin)).toMatchObject({id:first.id});
 vi.stubEnv('INSTALLATION_COMPANY_ID',foreignId);expect(await authenticateOwnerPin('Synthetic Owner',pin)).toBeNull();
});
