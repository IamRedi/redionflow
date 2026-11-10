import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const request=vi.hoisted(()=>({values:new Map<string,string>()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:(key:string)=>request.values.has(key)?{value:request.values.get(key)}:undefined}),headers:async()=>new Headers({'accept-language':'en'})}));
vi.mock('next/cache',()=>({revalidatePath:()=>undefined}));
vi.mock('@/lib/notifications/sendNotification',()=>({sendNotificationToAdmins:vi.fn(),sendWorkEventNotification:vi.fn(),sendNotificationToWorker:vi.fn()}));
import { prisma } from '@/lib/db/prisma';
import { sendWorkEventNotification } from '@/lib/notifications/sendNotification';
import { createTestSession, seedSecurityTenants, removeSecurityTenants } from '../../../tests/security/fixtures';
import { beginWorkerSession } from './session-start';
import { startWorkerSessionAction, startWorkSessionPauseAction, stopWorkerSessionAction, stopWorkSessionPauseAction } from '@/app/(workzone)/workzone/hr-actions';
import { startWorkingAction } from '@/app/(workzone)/workzone/actions';
import { workDateTimeInput, parseWorkDateTime, monthKey } from './date-utils';
const pressedLongAgo=(id:string)=>prisma.$executeRaw`UPDATE "WorkSession" SET "createdAt"=now()-interval '10 minutes' WHERE id=${id}`;
let tenants:Awaited<ReturnType<typeof seedSecurityTenants>>;
beforeEach(async()=>{vi.stubEnv('SESSION_SIGNING_SECRET','synthetic-plan-hours-local-secret-only');tenants=await seedSecurityTenants();request.values.clear();request.values.set('bk_admin_id',await createTestSession('admin',tenants[0].admin.id));});
afterEach(async()=>{await removeSecurityTenants(tenants.map(t=>t.company.id));vi.unstubAllEnvs();});
it('uses one business clock for manual start/stop and refuses a restart inside closed work',async()=>{
 const workerId=tenants[0].worker.id, start=workDateTimeInput(new Date(Date.now()-3*3600000)),end=workDateTimeInput(new Date(Date.now()-2*3600000));
 expect((await startWorkerSessionAction({workerId,startTime:start})).ok).toBe(true);
 const live=await prisma.workSession.findFirstOrThrow({where:{workerId,isLive:true}});
 await pressedLongAgo(live.id);
 expect(live.startTime.toISOString()).toBe(parseWorkDateTime(start)!.toISOString());
 expect((await stopWorkerSessionAction({sessionId:live.id,endTime:end,breakMinutes:0})).ok).toBe(true);
 const closed=await prisma.workSession.findUniqueOrThrow({where:{id:live.id}});
 expect(closed).toMatchObject({totalHours:1,isLive:false,endTime:parseWorkDateTime(end)});
 const overlap=await startWorkerSessionAction({workerId,startTime:start});
 expect(overlap.ok).toBe(false);expect((overlap.message??'').toLowerCase()).toContain('overlap');
 expect(await prisma.workSession.count({where:{workerId}})).toBe(1);
});
it('serializes simultaneous profile/site starts and double stop emits one saved admin time entry',async()=>{
 const workerId=tenants[0].worker.id, start=new Date(Date.now()-3*3600000).toISOString(),end=workDateTimeInput(new Date(Date.now()-2*3600000));
 const replies=await Promise.all([startWorkerSessionAction({workerId,startTime:start}),startWorkingAction({workerId,baustelleId:tenants[0].site.id,startTime:start})]);
 expect(replies.every(r=>r.ok)).toBe(true);expect(await prisma.workSession.count({where:{workerId,isLive:true}})).toBe(1);
 const live=await prisma.workSession.findFirstOrThrow({where:{workerId,isLive:true}});
 await pressedLongAgo(live.id);
 const stops=await Promise.all([stopWorkerSessionAction({sessionId:live.id,endTime:end,breakMinutes:0}),stopWorkerSessionAction({sessionId:live.id,endTime:end,breakMinutes:0})]);
 expect(stops.filter(r=>r.ok)).toHaveLength(1);
 const note=await prisma.workReportNote.findUniqueOrThrow({where:{workerId_type_periodKey:{workerId,type:'MONTHLY',periodKey:monthKey(live.startTime)}}});
 expect((note.note.match(/KOHE\|/g)??[])).toHaveLength(1);
});
it('rejects foreign targets and future starts without a row or a tenant change',async()=>{
 const input={companyId:tenants[0].company.id,workerId:tenants[0].worker.id,start:new Date(Date.now()-60000),siteId:tenants[0].site.id};
 await expect(beginWorkerSession({...input,siteId:tenants[1].site.id})).rejects.toThrow('SITE');
 await expect(beginWorkerSession({...input,workerId:tenants[1].worker.id})).rejects.toThrow('WORKER');
 await expect(beginWorkerSession({...input,start:new Date(Date.now()+3600000)})).rejects.toThrow('CLOCK');
 expect(await prisma.workSession.count({where:{workerId:input.workerId}})).toBe(0);
});

it('a start undone within 5 seconds leaves no record, a stop undone within 5 seconds keeps the same session',async()=>{
 const workerId=tenants[0].worker.id;
 request.values.clear();request.values.set('bk_worker_id',await createTestSession('worker',workerId));
 const now=()=>workDateTimeInput(new Date());
 expect((await startWorkerSessionAction({workerId,startTime:new Date(Date.now()-2*3600000).toISOString()})).ok).toBe(true);
 const first=await prisma.workSession.findFirstOrThrow({where:{workerId,isLive:true}});
 expect((await stopWorkerSessionAction({sessionId:first.id,endTime:now(),breakMinutes:0})).ok).toBe(true);
 expect(await prisma.workSession.count({where:{workerId}})).toBe(0);

 expect((await startWorkerSessionAction({workerId,startTime:new Date(Date.now()-2*3600000).toISOString()})).ok).toBe(true);
 const live=await prisma.workSession.findFirstOrThrow({where:{workerId,isLive:true}});
 await pressedLongAgo(live.id);
 expect((await startWorkSessionPauseAction({sessionId:live.id})).ok).toBe(true);
 expect((await stopWorkSessionPauseAction({sessionId:live.id})).ok).toBe(true);
 expect(await prisma.workSessionPauseInterval.count({where:{workSessionId:live.id}})).toBe(0);
 expect((await prisma.workSession.findUniqueOrThrow({where:{id:live.id}})).breakMinutes).toBe(live.breakMinutes);

 const pauseStart=new Date(Date.now()-20*60000),pauseEnd=new Date(Date.now()-1000);
 const pause=await prisma.workSessionPauseInterval.create({data:{workSessionId:live.id,workerId,startedAt:pauseStart,endedAt:pauseEnd}});
 expect((await startWorkSessionPauseAction({sessionId:live.id})).ok).toBe(true);
 expect(await prisma.workSessionPauseInterval.findMany({where:{workSessionId:live.id}})).toMatchObject([{id:pause.id,endedAt:null}]);

 expect((await stopWorkerSessionAction({sessionId:live.id,endTime:now(),breakMinutes:0})).ok).toBe(true);
 expect(await prisma.workSession.findUniqueOrThrow({where:{id:live.id}})).toMatchObject({isLive:false});
 const resumed=await startWorkerSessionAction({workerId,startTime:new Date().toISOString()});
 expect(resumed.ok).toBe(true);
 expect(await prisma.workSession.count({where:{workerId}})).toBe(1);
 expect(await prisma.workSession.findUniqueOrThrow({where:{id:live.id}})).toMatchObject({isLive:true,endTime:null,totalHours:0,startTime:live.startTime});
 expect((await prisma.workSessionPauseInterval.findUniqueOrThrow({where:{id:pause.id}})).endedAt).toBeNull();
});
it('a site start undone within 5 seconds is discarded',async()=>{
 const workerId=tenants[0].worker.id;
 expect((await startWorkingAction({workerId,baustelleId:tenants[0].site.id})).ok).toBe(true);
 const { stopWorkingAction }=await import('@/app/(workzone)/workzone/actions');
 expect((await stopWorkingAction({workerId,baustelleId:tenants[0].site.id})).ok).toBe(true);
 expect(await prisma.workSession.count({where:{workerId}})).toBe(0);
});

it('the boss is told only about a start that was not undone within 5 seconds',async()=>{
 const workerId=tenants[0].worker.id;
 request.values.clear();request.values.set('bk_worker_id',await createTestSession('worker',workerId));
 vi.mocked(sendWorkEventNotification).mockClear();
 const start=()=>startWorkerSessionAction({workerId,startTime:new Date(Date.now()-3600000).toISOString()});
 expect((await start()).ok).toBe(true);
 const first=await prisma.workSession.findFirstOrThrow({where:{workerId,isLive:true}});
 expect((await stopWorkerSessionAction({sessionId:first.id,endTime:workDateTimeInput(new Date()),breakMinutes:0})).ok).toBe(true);
 expect((await start()).ok).toBe(true);
 await new Promise(resolve=>setTimeout(resolve,6500));
 expect(vi.mocked(sendWorkEventNotification).mock.calls.map(([input])=>input.preference)).toEqual(['workStart']);
},15000);
