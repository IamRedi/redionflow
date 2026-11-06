import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import type {RequesterContext} from './requester';
const mocks=vi.hoisted(()=>({actor:vi.fn(),steel:vi.fn(),transaction:vi.fn(),read:vi.fn()}));
vi.mock('@/lib/db/prisma',()=>({prisma:{$transaction:mocks.transaction}}));
vi.mock('@/lib/company-assets/access',()=>({assetActor:mocks.actor,AssetOperationError:class extends Error{constructor(readonly code:string){super(code);}}}));
vi.mock('@/lib/company-assets/service',()=>({readCanonicalAssistantAssets:mocks.read}));
vi.mock('@/lib/dashboard/steel-access',()=>({isSteelCompany:mocks.steel}));
import {AssetOperationError} from '@/lib/company-assets/access';
import {adminSearchCompanyAssets,adminGetCompanyWorkshop} from './asset-tools';
const requester:RequesterContext={kind:'admin',companyId:'tenant-a',adminId:'admin-a',preferredLanguage:'SQ',displayName:'Fictional chief'};
const actor={companyId:'tenant-a',userId:'admin-a',workerId:null,name:'Fictional chief',canManage:true,canRepair:true};
const tx={$executeRaw:vi.fn(),user:{findFirst:vi.fn()},companyProfile:{findUnique:vi.fn()}};
beforeEach(()=>{
 vi.clearAllMocks();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-06T10:00:00Z'));
 mocks.actor.mockResolvedValue(actor);mocks.steel.mockResolvedValue(true);tx.$executeRaw.mockResolvedValue(1);tx.user.findFirst.mockResolvedValue({id:'admin-a'});tx.companyProfile.findUnique.mockResolvedValue({country:'AL'});
 mocks.read.mockResolvedValue({items:[],totalMatching:0,returned:0,hasMore:false,nextCursor:null,complete:true});
 mocks.transaction.mockImplementation(async(fn:(client:typeof tx)=>Promise<unknown>)=>fn(tx));
});
afterEach(()=>vi.useRealTimers());
it('denies worker/anonymous access before any actor or data lookup',async()=>{
 for(const kind of ['worker','anonymous'] as const){expect(await adminSearchCompanyAssets({...requester,kind,workerId:'worker-a'} as RequesterContext)).toMatchObject({ok:false,code:'FORBIDDEN'});expect(await adminGetCompanyWorkshop({...requester,kind,workerId:'worker-a'} as RequesterContext)).toMatchObject({ok:false,code:'FORBIDDEN'});}
 expect(mocks.actor).not.toHaveBeenCalled();expect(mocks.transaction).not.toHaveBeenCalled();
});
it.each([{assetId:'item-a'},{query:'x'.repeat(101)},{limit:0},{limit:21},{cursor:'other:item-a'},{cursor:'machine:a:b'},{repairPhase:'ready'},{companyId:'foreign'},{originWorkerId:'worker-a'}])('rejects unsupported/unbounded input %j before reads',async input=>{
 expect(await adminSearchCompanyAssets(requester,input as never)).toMatchObject({ok:false,code:'INVALID_INPUT'});expect(mocks.actor).not.toHaveBeenCalled();expect(mocks.read).not.toHaveBeenCalled();
});
it.each([{companyId:'foreign'},{userId:'other-admin'},{userId:null,workerId:'office-worker',canManage:true}])('does not trust a mismatched fresh actor %j',async overrides=>{
 mocks.actor.mockResolvedValue({...actor,...overrides});expect(await adminSearchCompanyAssets(requester)).toMatchObject({ok:false,code:'FORBIDDEN'});expect(mocks.read).not.toHaveBeenCalled();expect(mocks.transaction).not.toHaveBeenCalled();
});
it('requires actual steel-company eligibility and fresh current ADMIN membership',async()=>{
 mocks.steel.mockResolvedValueOnce(false);expect(await adminGetCompanyWorkshop(requester)).toMatchObject({ok:false,code:'FORBIDDEN'});expect(mocks.transaction).not.toHaveBeenCalled();
 tx.user.findFirst.mockResolvedValueOnce(null);expect(await adminSearchCompanyAssets(requester)).toMatchObject({ok:false,code:'FORBIDDEN'});expect(mocks.read).not.toHaveBeenCalled();
 expect(tx.user.findFirst).toHaveBeenCalledWith({where:{id:'admin-a',companyProfileId:'tenant-a',role:'ADMIN',isActive:true},select:{id:true}});
 tx.companyProfile.findUnique.mockResolvedValueOnce(null);expect(await adminSearchCompanyAssets(requester)).toMatchObject({ok:false,code:'FORBIDDEN'});expect(mocks.read).not.toHaveBeenCalled();
});
it('binds one repeatable-read tenant transaction and uses fresh company timezone',async()=>{
 expect(await adminSearchCompanyAssets(requester,{assetKind:'inventory',assetId:'item-a',holderWorkerId:'worker-a',limit:8})).toMatchObject({ok:true,timeZone:'Europe/Tirane',retrievedAt:'2026-11-06T10:00:00.000Z',readOnly:true});
 expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function),{isolationLevel:'RepeatableRead',timeout:10000,maxWait:3000});expect(tx.$executeRaw).toHaveBeenCalled();expect(mocks.steel).toHaveBeenCalledWith('tenant-a');
 expect(mocks.read).toHaveBeenCalledWith(tx,actor,{assetKind:'inventory',assetId:'item-a',holderWorkerId:'worker-a',limit:8});
});
it('defaults workshop to active phases but preserves explicit repairing and location filters',async()=>{
 await adminGetCompanyWorkshop(requester);expect(mocks.read).toHaveBeenLastCalledWith(tx,actor,{repairPhase:'active'});
 await adminGetCompanyWorkshop(requester,{repairPhase:'repairing',repairLocation:'external',assetKind:'machine'});expect(mocks.read).toHaveBeenLastCalledWith(tx,actor,{repairPhase:'repairing',repairLocation:'external',assetKind:'machine'});
 await adminSearchCompanyAssets(requester);expect(mocks.read).toHaveBeenLastCalledWith(tx,actor,{});
});
it('returns safe unknown on database errors and never fabricates an empty warehouse or no repairs',async()=>{
 mocks.read.mockRejectedValue(new Error('PRIVATE_SQL_AND_CREDENTIALS'));const result=await adminGetCompanyWorkshop(requester);expect(result).toMatchObject({ok:false,code:'DATA_UNAVAILABLE'});expect(JSON.stringify(result)).not.toContain('PRIVATE_SQL_AND_CREDENTIALS');expect('data'in result).toBe(false);
});
it('returns a safe invalid-cursor error without reusing earlier results',async()=>{
 mocks.read.mockRejectedValue(new AssetOperationError('INVALID_CURSOR'));expect(await adminSearchCompanyAssets(requester,{cursor:'machine:owned'})).toMatchObject({ok:false,code:'INVALID_CURSOR'});
});
