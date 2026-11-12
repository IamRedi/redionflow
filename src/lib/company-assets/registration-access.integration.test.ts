import {randomUUID} from 'node:crypto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const session=vi.hoisted(()=>({values:new Map<string,string>()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:(key:string)=>session.values.has(key)?{value:session.values.get(key)}:undefined}),headers:async()=>new Headers()}));
import {prisma} from '@/lib/db/prisma';
import {assertAssistantTestDatabase} from '../../../tests/fixtures/assistant-database';
import {createTestSession,seedSecurityTenants,removeSecurityTenants} from '../../../tests/security/fixtures';
import {setPlaceAccess,readPlaceAccess} from '@/lib/access/manage';
import {assetActor} from './access';
import {runAssetMutation} from './service';
import type {AssetCommand,AssetRef} from './types';

let tenants:Awaited<ReturnType<typeof seedSecurityTenants>>;
const mutate=(command:AssetCommand,requestId=randomUUID())=>runAssetMutation({requestId,command});
async function login(kind:'admin'|'worker'){
  session.values.clear();
  session.values.set(kind==='admin'?'bk_admin_id':'bk_worker_id',await createTestSession(kind,kind==='admin'?tenants[0].admin.id:tenants[0].worker.id));
}
beforeEach(async()=>{
  assertAssistantTestDatabase();vi.stubEnv('SESSION_SIGNING_SECRET','synthetic-registration-access-signing-key');
  tenants=await seedSecurityTenants();
  await prisma.companyProfile.update({where:{id:tenants[0].company.id},data:{mode:'bau'}});
  await prisma.baustelle.update({where:{id:tenants[0].site.id},data:{type:'STEEL_ASSEMBLY'}});
  await prisma.worker.update({where:{id:tenants[0].worker.id},data:{crewRole:'FIELD_ENGINEER',accessLevel:'BASE'}});
  await login('admin');
});
afterEach(async()=>{
  session.values.clear();
  if(tenants){
    const where={companyProfileId:{in:tenants.map(t=>t.company.id)}};
    await prisma.companyAssetCode.deleteMany({where});await prisma.companyAssetEvent.deleteMany({where});
    await prisma.companyAssetCommandReceipt.deleteMany({where});await prisma.companyOperationalAsset.deleteMany({where});
    await removeSecurityTenants(tenants.map(t=>t.company.id));
  }
  vi.unstubAllEnvs();
});

it('admin grants registration to an engineer, preserves identity/audit and revokes it on the next request',async()=>{
  const [{company,worker,item},foreign]=tenants;
  await expect(setPlaceAccess({place:'warehouse',workerId:foreign.worker.id,level:'register'})).rejects.toThrow('NOT_FOUND');
  await expect(setPlaceAccess({place:'costs',workerId:worker.id,level:'register'})).rejects.toThrow('BAD_INPUT');
  const access=await setPlaceAccess({place:'warehouse',workerId:worker.id,level:'register'});
  expect(access.people.find(p=>p.id===worker.id)).toMatchObject({grant:'register',acts:'some',sees:true});
  await login('worker');
  expect(await assetActor()).toMatchObject({canRegister:true,canManage:false,canRepair:false,userId:null});
  await expect(readPlaceAccess('warehouse')).rejects.toThrow('DENIED');
  await expect(setPlaceAccess({place:'warehouse',workerId:worker.id,level:'act'})).rejects.toThrow('DENIED');
  const command={type:'register',name:'Synthetic engineer registration',category:'tool',quantity:2,factoryCode:'SYNTHETIC-FACTORY'} as const;
  const requestId=randomUUID();
  const result=await mutate(command,requestId) as {assets:AssetRef[]};
  expect(result.assets).toHaveLength(2);
  expect(await mutate(command,requestId)).toEqual(result);
  expect(await prisma.companyInventoryItem.count({where:{companyProfileId:company.id,name:command.name}})).toBe(2);
  expect(await prisma.companyAssetEvent.findMany({where:{companyProfileId:company.id,type:'registered'},select:{actorKey:true,actorName:true}})).toEqual([
    {actorKey:`worker:${worker.id}`,actorName:`${worker.firstName} ${worker.lastName}`},
    {actorKey:`worker:${worker.id}`,actorName:`${worker.firstName} ${worker.lastName}`},
  ]);
  for(const asset of [{kind:'inventory' as const,id:item.id},result.assets[0]]){
    await expect(mutate({type:'edit',asset,revision:0,name:'Forbidden edit'})).rejects.toThrow('DENIED');
    await expect(mutate({type:'code-add',asset,value:'FORBIDDEN-CODE'})).rejects.toThrow('DENIED');
  }
  await login('admin');await setPlaceAccess({place:'warehouse',workerId:worker.id,level:'view'});
  await login('worker');await expect(mutate(command)).rejects.toThrow('DENIED');
  await expect(mutate(command,requestId)).rejects.toThrow('DENIED');
  await login('admin');await setPlaceAccess({place:'warehouse',workerId:worker.id,level:'none'});
  await login('worker');expect(await assetActor()).toMatchObject({canRegister:false});
  await expect(mutate(command)).rejects.toThrow('DENIED');
  await prisma.worker.update({where:{id:worker.id},data:{status:'inactive'}});
  await expect(mutate(command)).rejects.toThrow();
});

it('database constrains registration grants to the company-wide warehouse',async()=>{
  const [{company,worker}]=tenants;
  for(const data of [{place:'costs',scopeId:''},{place:'warehouse',scopeId:'a-site'}]){
    await expect(prisma.accessGrant.create({data:{companyProfileId:company.id,workerId:worker.id,level:'register',...data}})).rejects.toThrow();
  }
});
