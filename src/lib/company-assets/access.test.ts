import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({admin:vi.fn(),worker:vi.fn(),company:vi.fn(),steel:vi.fn(),tx:{user:{findFirst:vi.fn()},worker:{findFirst:vi.fn()}}}));
vi.mock('@/lib/auth/admin-session',()=>({getCurrentAdmin:mocks.admin}));
vi.mock('@/lib/workzone/worker-session',()=>({getCurrentWorker:mocks.worker}));
vi.mock('@/lib/db/tenant',()=>({getCurrentCompanyId:mocks.company}));
vi.mock('@/lib/dashboard/steel-access',()=>({isSteelCompany:mocks.steel}));
vi.mock('@/lib/db/tenant-context',()=>({withTenantContext:async(_id:string,fn:(tx:typeof mocks.tx)=>unknown)=>fn(mocks.tx)}));
import {assetActor} from './access';
import {assetMutationSchema} from './validation';
beforeEach(()=>{vi.resetAllMocks();mocks.company.mockResolvedValue('company-fixture');mocks.steel.mockResolvedValue(true);mocks.worker.mockResolvedValue({id:'worker-fixture'});mocks.tx.worker.findFirst.mockResolvedValue({id:'worker-fixture',firstName:'Fictional',lastName:'Operator',crewRole:'FIELD_WORKER'});});
it('denies anonymous, mixed identities and non-steel companies before returning permissions',async()=>{
 mocks.worker.mockResolvedValueOnce(null);await expect(assetActor()).rejects.toMatchObject({code:'DENIED'});
 mocks.admin.mockResolvedValueOnce({id:'admin-fixture'});await expect(assetActor()).rejects.toMatchObject({code:'DENIED'});
 mocks.steel.mockResolvedValueOnce(false);await expect(assetActor()).rejects.toMatchObject({code:'DENIED'});
 expect(mocks.tx.worker.findFirst).not.toHaveBeenCalled();
});
it.each([['FIELD_WORKER',false,false],['FIELD_ENGINEER',false,false],['OFFICE',true,true],['MECHANIC',false,true]])('resolves %s from fresh owned role data',async(crewRole,canManage,canRepair)=>{
 mocks.tx.worker.findFirst.mockResolvedValue({id:'worker-fixture',firstName:'Fictional',lastName:'Operator',crewRole});
 expect(await assetActor()).toMatchObject({companyId:'company-fixture',workerId:'worker-fixture',userId:null,canManage,canRepair});
 expect(mocks.tx.worker.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:'worker-fixture',companyProfileId:'company-fixture',status:'active'}}));
});
it('denies a stale or foreign worker even with a decoded session',async()=>{mocks.tx.worker.findFirst.mockResolvedValue(null);await expect(assetActor()).rejects.toMatchObject({code:'DENIED'});});
it('requires a fresh active tenant admin record',async()=>{mocks.worker.mockResolvedValue(null);mocks.admin.mockResolvedValue({id:'admin-fixture'});mocks.tx.user.findFirst.mockResolvedValue({id:'admin-fixture',name:'Fictional office',email:'fixture@example.test'});expect(await assetActor()).toMatchObject({userId:'admin-fixture',canManage:true,canRepair:true});mocks.tx.user.findFirst.mockResolvedValue(null);await expect(assetActor()).rejects.toMatchObject({code:'DENIED'});});
it('bounds batch quantities, validates idempotency keys and rejects forged actor fields',()=>{
 const command={type:'register',name:'Fixture jacket',category:'clothing',quantity:100};
 const base={requestId:'a5000000-0000-4000-8000-000000000001',command};
 expect(assetMutationSchema.safeParse(base).success).toBe(true);
 for(const input of [{...base,command:{...command,quantity:101}},{...base,requestId:'not-a-uuid'},{...base,actor:'admin'},{...base,command:{...command,companyProfileId:'foreign'}}])expect(assetMutationSchema.safeParse(input).success).toBe(false);
});
