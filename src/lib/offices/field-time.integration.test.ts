import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const auth=vi.hoisted(()=>({admin:vi.fn(),worker:vi.fn(),company:vi.fn()}));
vi.mock('@/lib/auth/admin-session',()=>({getCurrentAdmin:auth.admin}));
vi.mock('@/lib/workzone/worker-session',()=>({getCurrentWorker:auth.worker}));
vi.mock('@/lib/db/tenant',()=>({getCurrentCompanyId:auth.company}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>undefined}),headers:async()=>new Headers({'accept-language':'sq'})}));
vi.mock('next/cache',()=>({revalidatePath:()=>undefined}));
vi.mock('@/lib/workzone/quick-undo-notify',()=>({notifyUnlessUndone:vi.fn()}));
import { prisma } from '@/lib/db/prisma';
import { assertAssistantTestDatabase } from '../../../tests/fixtures/assistant-database';
import { seedSecurityTenants,removeSecurityTenants } from '../../../tests/security/fixtures';
import { changeFieldTime,fieldTimeSnapshot } from './field-time';
import { saveOfficeMember } from './team-service';
import { startWorkerSessionAction,stopWorkerSessionAction } from '@/app/(workzone)/workzone/hr-actions';
import { beginWorkerSession } from '@/lib/workzone/session-start';
import { dateKey,dayRange } from '@/lib/workzone/date-utils';

let tenants:Awaited<ReturnType<typeof seedSecurityTenants>>,engineerId:string;
const at=(hours:number)=>new Date(Date.now()-hours*3600_000);
function admin(){auth.admin.mockResolvedValue(tenants[0].admin);auth.worker.mockResolvedValue(null);}
async function engineer(enabled=true){admin();await saveOfficeMember({workerId:engineerId,title:'Terreni DEMO',enabled:true,fieldAttendanceEnabled:enabled,version:0});auth.admin.mockResolvedValue(null);auth.worker.mockResolvedValue({id:engineerId,companyProfileId:tenants[0].company.id});}
beforeEach(async()=>{
 assertAssistantTestDatabase();tenants=await seedSecurityTenants();auth.company.mockResolvedValue(tenants[0].company.id);admin();
 for(const key of ['VIRTUAL_OFFICE_ENABLED','VIRTUAL_OFFICE_WORK_ENABLED','VIRTUAL_OFFICE_TEAM_ENABLED'])vi.stubEnv(key,'true');
 vi.stubEnv('VIRTUAL_OFFICE_ACCESS_JSON',JSON.stringify({companyId:tenants[0].company.id,megi:{adminId:tenants[0].admin.id},almet:{adminId:'synthetic-unassigned-director'}}));
 engineerId=(await prisma.worker.create({data:{companyProfileId:tenants[0].company.id,firstName:'Hrisa',lastName:'DEMO',crewRole:'FIELD_ENGINEER',accessLevel:'BASE'}})).id;
 await prisma.worker.update({where:{id:tenants[0].worker.id},data:{crewRole:'FIELD_WORKER'}});
});
afterEach(async()=>{await removeSecurityTenants(tenants.map(t=>t.company.id));vi.unstubAllEnvs();});
it('requires an explicit engineer grant, rejects foreign/non-field staff and revokes immediately',async()=>{
 await engineer(false);await expect(fieldTimeSnapshot()).rejects.toThrow('DENIED');
 expect((await startWorkerSessionAction({workerId:tenants[0].worker.id,startTime:at(3).toISOString()})).ok).toBe(false);
 admin();await expect(saveOfficeMember({workerId:tenants[0].worker.id,title:'Wrong role',enabled:true,fieldAttendanceEnabled:true,version:0})).rejects.toThrow('INVALID');
 await saveOfficeMember({workerId:engineerId,title:'Terreni DEMO',enabled:true,fieldAttendanceEnabled:true,version:1});
 auth.admin.mockResolvedValue(null);auth.worker.mockResolvedValue({id:engineerId,companyProfileId:tenants[0].company.id});
 const rows=(await fieldTimeSnapshot()).workers;expect(rows.map(w=>w.id)).toContain(tenants[0].worker.id);expect(rows.map(w=>w.id)).not.toContain(tenants[1].worker.id);
 await prisma.officeMember.updateMany({where:{workerId:engineerId},data:{fieldAttendanceEnabled:false}});
 await expect(changeFieldTime({command:'start',workers:[{workerId:tenants[0].worker.id,sessionId:null}]})).rejects.toThrow('DENIED');
 expect(await prisma.workSession.count({where:{workerId:tenants[0].worker.id}})).toBe(0);
});
it('records each selected person through the original clock, preserves breaks, and reports partial success',async()=>{
 await engineer();const a=tenants[0],b=tenants[1];
 const date=dayRange(dateKey(at(3))).start;
 await prisma.dailyWorkPlan.upsert({where:{companyProfileId_planDate:{companyProfileId:a.company.id,planDate:date}},update:{},create:{companyProfileId:a.company.id,planDate:date,columns:{create:{title:a.site.name,baustelleId:a.site.id,assignments:{create:{kind:'WORKER',workerId:a.worker.id,labelSnapshot:'DEMO'}}}}}});
 const result=await changeFieldTime({command:'start',at:at(3).toISOString(),workers:[{workerId:a.worker.id,sessionId:null},{workerId:b.worker.id,sessionId:null}]});
 expect(result.results.map(r=>r.ok)).toEqual([true,false]);
 const live=await prisma.workSession.findFirstOrThrow({where:{workerId:a.worker.id,isLive:true}});expect(live.baustelleId).toBe(a.site.id);expect(live.breakMinutes).toBe(30);
 await prisma.$executeRaw`UPDATE "WorkSession" SET "createdAt"=now()-interval '10 minutes' WHERE id=${live.id}`;
 const stopped=await changeFieldTime({command:'stop',at:at(1).toISOString(),workers:[{workerId:a.worker.id,sessionId:live.id}]});expect(stopped.results[0].ok).toBe(true);
 const closed=await prisma.workSession.findUniqueOrThrow({where:{id:live.id}});expect(closed.totalHours).toBe(1.5);expect(closed.breakMinutes).toBe(30);expect(closed.isLive).toBe(false);
 expect(await prisma.auditLog.count({where:{companyProfileId:a.company.id,actorId:engineerId,action:{in:['office.field_time.start','office.field_time.stop']}}})).toBe(2);
 expect(await prisma.workSession.count({where:{workerId:b.worker.id}})).toBe(0);
 await expect(changeFieldTime({command:'start',workers:[{workerId:a.worker.id,sessionId:null},{workerId:a.worker.id,sessionId:null}]})).rejects.toThrow();
});
it('never stops or reopens office/workshop clocks and never stops a replacement session from a stale selection',async()=>{
 await engineer();const a=tenants[0];
 const own=await beginWorkerSession({companyId:a.company.id,workerId:a.worker.id,start:at(3),siteId:null,workplace:'OFFICE'});
 expect((await changeFieldTime({command:'stop',workers:[{workerId:a.worker.id,sessionId:own.id}]})).results[0].ok).toBe(false);
 expect((await stopWorkerSessionAction({sessionId:own.id,endTime:new Date().toISOString(),breakMinutes:0})).ok).toBe(false);
 await expect(beginWorkerSession({companyId:a.company.id,workerId:a.worker.id,start:at(2),siteId:a.site.id,recordedByWorkerId:engineerId,fieldOnly:true})).rejects.toThrow('DELEGATE');
 await prisma.workSession.update({where:{id:own.id},data:{isLive:false,endTime:new Date()}});
 await expect(beginWorkerSession({companyId:a.company.id,workerId:a.worker.id,start:new Date(),siteId:a.site.id,recordedByWorkerId:engineerId,fieldOnly:true})).rejects.toThrow('DELEGATE');
 await prisma.workSession.update({where:{id:own.id},data:{workplace:null,updatedAt:at(1)}});
 const replacement=await beginWorkerSession({companyId:a.company.id,workerId:a.worker.id,start:new Date(),siteId:a.site.id,fieldOnly:true,recordedByWorkerId:engineerId});
 expect((await changeFieldTime({command:'stop',workers:[{workerId:a.worker.id,sessionId:own.id}]})).results[0].ok).toBe(false);
 expect((await prisma.workSession.findUniqueOrThrow({where:{id:replacement.id}})).isLive).toBe(true);
 await prisma.workSession.update({where:{id:replacement.id},data:{workplace:'WORKSHOP',baustelleId:null}});
 expect((await stopWorkerSessionAction({sessionId:replacement.id,endTime:new Date().toISOString(),breakMinutes:0})).ok).toBe(false);
});
