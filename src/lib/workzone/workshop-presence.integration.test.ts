import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const request=vi.hoisted(()=>({values:new Map<string,string>()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:(key:string)=>request.values.has(key)?{value:request.values.get(key)}:undefined}),headers:async()=>new Headers()}));
vi.mock('next/cache',()=>({revalidatePath:()=>undefined}));
vi.mock('@/lib/notifications/sendNotification',()=>({sendNotificationToAdmins:vi.fn(),sendWorkEventNotification:vi.fn(),sendNotificationToWorker:vi.fn()}));
import {NextRequest} from 'next/server';
import {POST as phoneGps} from '@/app/api/workzone/gps/route';
import {prisma} from '@/lib/db/prisma';
import {seedSecurityTenants,removeSecurityTenants,createTestSession} from '../../../tests/security/fixtures';
import {workshopPresence,startOwnWorkshopWork,stopOwnWorkshopWork} from './workshop-presence';
import {startWorkerSessionAction} from '@/app/(workzone)/workzone/hr-actions';
import {adminGetWorkforceStatus} from '@/lib/assistant/workforce-status';
let tenants:Awaited<ReturnType<typeof seedSecurityTenants>>;
async function login(kind:'worker'|'admin'='worker',index=0){request.values.clear();const t=tenants[index];request.values.set(kind==='worker'?'bk_worker_id':'bk_admin_id',await createTestSession(kind,kind==='worker'?t.worker.id:t.admin.id));}
beforeEach(async()=>{
 vi.stubEnv('SESSION_SIGNING_SECRET','synthetic-workshop-presence-only-20261112');vi.stubEnv('VIRTUAL_OFFICE_ACCESS_JSON','');
 tenants=await seedSecurityTenants();for(const t of tenants){await prisma.companyProfile.update({where:{id:t.company.id},data:{mode:'bau',country:'AL'}});await prisma.baustelle.update({where:{id:t.site.id},data:{type:'STEEL_ASSEMBLY'}});await prisma.worker.update({where:{id:t.worker.id},data:{crewRole:'MECHANIC',availability:'AVAILABLE',accessLevel:null}});}await login();
});
afterEach(async()=>{request.values.clear();await removeSecurityTenants(tenants.map(t=>t.company.id));vi.unstubAllEnvs();});
it('mechanic Nis records workshop, names exclude pauses, stop uses existing hours and is visible to the admin assistant',async()=>{
 const t=tenants[0];expect((await startWorkerSessionAction({workerId:t.worker.id,startTime:new Date(Date.now()-7200000).toISOString()})).ok).toBe(true);
 const session=await prisma.workSession.findFirstOrThrow({where:{workerId:t.worker.id,isLive:true}});
 expect(session).toMatchObject({workplace:'WORKSHOP',baustelleId:null});expect(await workshopPresence()).toMatchObject({active:true,paused:false,sessionId:session.id,names:[`${t.worker.firstName} ${t.worker.lastName}`]});
 const status=await adminGetWorkforceStatus({kind:'admin',companyId:t.company.id,adminId:t.admin.id,preferredLanguage:'SQ',displayName:'Synthetic'},{state:'workshop'});
 expect(status).toMatchObject({ok:true,data:{totalMatching:1,summary:{workshopWorking:1,officeWorking:0,factoryWorking:0},items:[{location:{kind:'workshop'},status:'working'}]}});
 const pause=await prisma.workSessionPauseInterval.create({data:{workerId:t.worker.id,workSessionId:session.id,startedAt:new Date(Date.now()-600000)}});
 expect(await workshopPresence()).toMatchObject({active:true,paused:true,names:[]});
 await prisma.workSessionPauseInterval.update({where:{id:pause.id},data:{endedAt:new Date()}});
 await prisma.$executeRaw`UPDATE "WorkSession" SET "createdAt"=now()-interval '10 minutes' WHERE id=${session.id}`;
 await stopOwnWorkshopWork(session.id);expect(await workshopPresence()).toMatchObject({active:false,names:[]});
 expect(await prisma.workSession.findUniqueOrThrow({where:{id:session.id}})).toMatchObject({isLive:false,workplace:'WORKSHOP'});
 expect((await prisma.workSession.findUniqueOrThrow({where:{id:session.id}})).totalHours).toBeGreaterThan(1.5);
});
it('explicit Puno ketu transfers one own clock, preserves pauses, and cannot stop a clock moved to a site',async()=>{
 const t=tenants[0];const old=await prisma.workSession.create({data:{workerId:t.worker.id,isLive:true,startTime:new Date(Date.now()-3600000),workplace:'OFFICE'}});
 await startOwnWorkshopWork();await startOwnWorkshopWork();expect(await prisma.workSession.count({where:{workerId:t.worker.id,isLive:true}})).toBe(1);
 expect(await prisma.workSession.findUniqueOrThrow({where:{id:old.id}})).toMatchObject({workplace:'WORKSHOP',baustelleId:null,startTime:old.startTime});
 await prisma.workSession.update({where:{id:old.id},data:{workplace:null,baustelleId:t.site.id}});
 await expect(stopOwnWorkshopWork(old.id)).rejects.toMatchObject({code:'CONFLICT'});expect((await prisma.workSession.findUniqueOrThrow({where:{id:old.id}})).isLive).toBe(true);
});
it('denies hidden workshop, mixed identities, foreign session IDs, ambiguous clocks and unlinked administrators',async()=>{
 const t=tenants[0],other=tenants[1];
 const foreign=await prisma.workSession.create({data:{workerId:other.worker.id,isLive:true,workplace:'WORKSHOP',startTime:new Date()}});
 expect((await workshopPresence()).names).toEqual([]);await expect(stopOwnWorkshopWork(foreign.id)).rejects.toMatchObject({code:'CONFLICT'});
 await prisma.accessGrant.create({data:{companyProfileId:t.company.id,workerId:t.worker.id,place:'workshop',scopeId:'',level:'none'}});
 await expect(workshopPresence()).rejects.toMatchObject({code:'DENIED'});await expect(startOwnWorkshopWork()).rejects.toMatchObject({code:'DENIED'});
 await prisma.accessGrant.deleteMany({where:{companyProfileId:t.company.id,workerId:t.worker.id}});
 request.values.set('bk_admin_id',await createTestSession('admin',t.admin.id));await expect(workshopPresence()).rejects.toMatchObject({code:'DENIED'});
 await login('admin');expect(await workshopPresence()).toMatchObject({canWork:false});await expect(startOwnWorkshopWork()).rejects.toMatchObject({code:'DENIED'});
 vi.stubEnv('VIRTUAL_OFFICE_ACCESS_JSON',JSON.stringify({companyId:t.company.id,megi:{adminId:t.admin.id,workerId:t.worker.id}}));
 expect(await workshopPresence()).toMatchObject({canWork:true});
 await prisma.workSession.createMany({data:[1,2].map(()=>({workerId:t.worker.id,isLive:true,startTime:new Date(),workplace:'WORKSHOP'}))});
 expect(await workshopPresence()).toMatchObject({canWork:false,names:[]});await expect(startOwnWorkshopWork()).rejects.toMatchObject({code:'CONFLICT'});
});

it('keeps explicit workplace exclusivity and refuses a future unresolved clock',async()=>{
 const t=tenants[0];
 for(const workplace of ['OFFICE','WORKSHOP','unrecorded'])await expect(prisma.workSession.create({data:{workerId:t.worker.id,isLive:true,startTime:new Date(),workplace,baustelleId:t.site.id}})).rejects.toThrow();
 await prisma.workSession.create({data:{workerId:t.worker.id,isLive:true,startTime:new Date(Date.now()+3600000),workplace:'WORKSHOP'}});
 expect(await workshopPresence()).toMatchObject({canWork:false,names:[]});await expect(startOwnWorkshopWork()).rejects.toMatchObject({code:'CONFLICT'});
});

it('keeps the explicit workshop when a phone GPS point is near a site',async()=>{
 const t=tenants[0];vi.stubEnv('APP_BASE_URL','http://127.0.0.1:3245');
 await prisma.companyProfile.update({where:{id:t.company.id},data:{workerPhoneGpsEnabled:true}});
 await prisma.baustelle.update({where:{id:t.site.id},data:{coordinates:{lat:41.123,lng:19.456}}});
 const session=await prisma.workSession.create({data:{workerId:t.worker.id,isLive:true,startTime:new Date(Date.now()-60000),workplace:'WORKSHOP'}});
 const response=await phoneGps(new NextRequest('http://127.0.0.1:3245/api/workzone/gps',{method:'POST',headers:{origin:'http://127.0.0.1:3245','content-type':'application/json'},body:JSON.stringify({sessionId:session.id,lat:41.123,lng:19.456})}));
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({baustelleId:null});
 expect(await prisma.workSession.findUniqueOrThrow({where:{id:session.id}})).toMatchObject({workplace:'WORKSHOP',baustelleId:null});
 expect(await prisma.gpsLocationPoint.findFirstOrThrow({where:{workSessionId:session.id}})).toMatchObject({baustelleId:null});
});
