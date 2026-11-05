import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({grounding:vi.fn(),worker:vi.fn(),assets:vi.fn(),plan:vi.fn(),resolution:vi.fn()}));
vi.mock('@/lib/db/prisma',()=>({prisma:{worker:{findFirst:mocks.worker},workerAssetItem:{findMany:mocks.assets},dailyWorkPlan:{findUnique:mocks.plan}}}));
vi.mock('../asset-grounding',async original=>({...await original<typeof import('../asset-grounding')>(),assistantAssetGrounding:mocks.grounding}));
vi.mock('./shared',async original=>({...await original<typeof import('./shared')>(),resolveWorkerByName:mocks.resolution}));
import {getWorkerHrProfile,adminAnalyzeDailyPlanLicenses,adminQueryDailyPlan} from './hr';
import type {RequesterContext} from '../requester';
const requester:RequesterContext={kind:'admin',adminId:'admin-fixture',companyId:'tenant-fixture',displayName:'Fictional chief',preferredLanguage:'EN',timeZone:'Europe/Tirane'};
beforeEach(()=>{
 vi.clearAllMocks();mocks.worker.mockResolvedValue({id:'worker-fixture',firstName:'Fictional',lastName:'Worker',licenses:null,position:null,level:'WORKER',availability:'AVAILABLE',phone:null,emailAccount:null,birthDate:null,startedAtCompany:null});
 mocks.resolution.mockResolvedValue({status:'found',worker:{id:'worker-fixture',firstName:'Fictional',lastName:'Worker'}});
 mocks.assets.mockResolvedValue([{kind:'EQUIPMENT',itemName:'Recorded drill',itemCode:'D-1',companyInventoryItemId:'item-fixture',isPrivate:false},{kind:'CLOTHING',itemName:'Private glove',itemCode:null,companyInventoryItemId:null,isPrivate:true}]);
 mocks.grounding.mockImplementation(async(_requester:unknown,refs:{kind:string;id:string}[])=>({applicable:true,complete:true,retrievedAt:'2026-11-05T12:00:00Z',warning:null,items:refs.map(ref=>({ref,baseRecordActive:ref.kind==='machine',operationalAvailability:ref.kind==='machine'?'reported':'lost',usable:false}))}));
 mocks.plan.mockResolvedValue({columns:[{title:'Fictional site',baustelle:{name:'Fictional site'},note:'',assignments:[{kind:'MACHINE',machineId:'machine-fixture',labelSnapshot:'Fictional crane',machine:{name:'Fictional crane',nickname:null,patentaEnevojshme:null,targe:'TEST 1',model:null,isActive:true}}]}],savedRows:[]});
});
it('marks preserved ACTIVE company equipment as lost, while private/unlinked rows remain recorded-only',async()=>{
 const result=await getWorkerHrProfile(requester,{workerName:'Fictional Worker'});expect(result).toMatchObject({ok:true,assetItems:[{itemName:'Recorded drill',operationalAvailability:'lost',usable:false},{itemName:'Private glove',operationalAvailability:null,usable:null}]});
 expect(mocks.grounding).toHaveBeenCalledWith(requester,[{kind:'inventory',id:'item-fixture'}]);
});
it('does not report a license-only plan as OK when an active register machine has an operational block',async()=>{
 const result=await adminAnalyzeDailyPlanLicenses(requester,{date:'2026-11-05'});expect(result).toMatchObject({ok:true,groups:[{machines:[{active:true,baseRecordActive:true,operationalAvailability:'reported',usable:false}]}]});if(result.ok)expect(result.warnings.some((value:string)=>value.includes('operational asset block'))).toBe(true);
});
it('attaches current status to exact planned machine IDs and warns if the status read fails',async()=>{
 mocks.grounding.mockResolvedValue({applicable:true,complete:false,retrievedAt:'2026-11-05T12:00:00Z',items:[],warning:'Current operational states unavailable'});
 expect(await adminQueryDailyPlan(requester,{date:'2026-11-05'})).toMatchObject({ok:true,groups:[{machines:[{active:true,operationalAvailability:null,usable:null}],warnings:expect.arrayContaining(['Current operational states unavailable'])}]});
});
