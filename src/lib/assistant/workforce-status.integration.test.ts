import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {prisma} from '@/lib/db/prisma';
import {seedSecurityTenants,removeSecurityTenants} from '../../../tests/security/fixtures';
import {adminGetWorkforceStatus} from './workforce-status';
import type {RequesterContext} from './requester';

let tenants:Awaited<ReturnType<typeof seedSecurityTenants>>;
const now=new Date('2026-11-12T10:00:00Z');
const requester=():RequesterContext=>({kind:'admin',adminId:tenants[0].admin.id,companyId:tenants[0].company.id,preferredLanguage:'SQ',displayName:'Chief · DEMO'});
beforeEach(async()=>{tenants=await seedSecurityTenants();await prisma.companyProfile.update({where:{id:tenants[0].company.id},data:{country:'AL'}});vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now);});
afterEach(async()=>{vi.useRealTimers();vi.restoreAllMocks();await removeSecurityTenants(tenants.map(t=>t.company.id));});

it('separates explicit office/site/factory, pauses, stopped today, unknown and inconsistent clocks in one tenant snapshot',async()=>{
 const own=tenants[0],foreign=tenants[1],companyProfileId=own.company.id;
 const make=(name:string,extra:Record<string,string>={})=>prisma.worker.create({data:{companyProfileId,firstName:'Synthetic',lastName:name,...extra}});
 const [site,factory,unknown,stopped,idle,paused,old,duplicate,conflict,broken,future]=await Promise.all(['Site','Factory','Unknown','Stopped','Idle','Paused','Yesterday','Duplicate','Conflict','Broken','Future'].map(n=>make(n,n==='Unknown'?{crewRole:'OFFICE'}:n==='Conflict'?{availability:'VACATION'}:{})));
 const workshop=await prisma.baustelle.create({data:{companyProfileId,name:'Factory · DEMO',type:'STEEL_WORKSHOP'}});
 const live=(workerId:string,extra:Record<string,unknown>={})=>prisma.workSession.create({data:{workerId,startTime:new Date(now.getTime()-3600000),isLive:true,...extra}});
 await Promise.all([live(own.worker.id,{workplace:'OFFICE'}),live(site.id,{baustelleId:own.site.id}),live(factory.id,{baustelleId:workshop.id}),live(unknown.id),live(duplicate.id),live(duplicate.id),live(conflict.id,{workplace:'OFFICE'}),live(broken.id,{isLive:false}),live(future.id,{startTime:new Date(now.getTime()+60000)}),live(foreign.worker.id,{workplace:'OFFICE'})]);
 const pause=await live(paused.id,{workplace:'OFFICE'});
 await prisma.workSessionPauseInterval.create({data:{workerId:paused.id,workSessionId:pause.id,startedAt:new Date(now.getTime()-60000)}});
 await prisma.workSession.createMany({data:[{workerId:stopped.id,startTime:new Date('2026-11-12T07:00Z'),endTime:new Date('2026-11-12T09:00Z'),isLive:false},{workerId:old.id,startTime:new Date('2026-11-11T07:00Z'),endTime:new Date('2026-11-11T09:00Z'),isLive:false}]});
 const result=await adminGetWorkforceStatus(requester(),{state:'all',limit:30});if(!result.ok)throw Error(JSON.stringify(result));
 expect(result.timeZone).toBe('Europe/Tirane');expect(result.data.summary).toMatchObject({activeWorkers:12,working:4,paused:1,officeWorking:1,officePaused:1,siteWorking:1,factoryWorking:1,unknownLocationWorking:1,stoppedToday:1,noLiveSession:2,needsReview:4});
 const rows=new Map(result.data.items.map(r=>[r.workerId,r]));expect(rows.get(unknown.id)).toMatchObject({status:'working',location:{kind:'unknown'}});expect(rows.get(stopped.id)?.status).toBe('stopped');expect(rows.get(idle.id)?.status).toBe('no_live_session');expect(rows.get(old.id)?.status).toBe('no_live_session');expect(rows.get(duplicate.id)?.status).toBe('needs_review');expect(rows.get(conflict.id)?.status).toBe('needs_review');expect(rows.has(foreign.worker.id)).toBe(false);
 expect(JSON.stringify(result)).not.toMatch(/loginCode|passwordHash|nationalId|emailAccount|phone|aiPersonalityNote/);
 const first=await adminGetWorkforceStatus(requester(),{state:'office',limit:1});if(!first.ok)throw Error('No page');expect(first.data).toMatchObject({totalMatching:2,returned:1,hasMore:true,complete:false});
 const second=await adminGetWorkforceStatus(requester(),{state:'office',limit:1,cursor:first.data.nextCursor!});if(!second.ok)throw Error('No continuation');expect(second.data).toMatchObject({totalMatching:2,returned:1,hasMore:false,complete:false});expect(second.data.items[0].workerId).not.toBe(first.data.items[0].workerId);
});

it('uses the company day boundary, preserves ambiguous names and reads current changes for either administrator',async()=>{
 const own=tenants[0],companyProfileId=own.company.id;
 const [a,b]=await Promise.all(['One','Two'].map(lastName=>prisma.worker.create({data:{companyProfileId,firstName:'Alex',lastName}})));
 await prisma.workSession.createMany({data:[{workerId:a.id,startTime:new Date('2026-11-11T21:00Z'),endTime:new Date('2026-11-11T23:01Z'),isLive:false,closedBySystem:true},{workerId:b.id,startTime:new Date('2026-11-11T21:00Z'),endTime:new Date('2026-11-11T22:59:59Z'),isLive:false}]});
 const both=await adminGetWorkforceStatus(requester(),{query:'Alex',state:'all'});if(!both.ok)throw Error('No result');expect(both.data).toMatchObject({totalMatching:2,identityResolution:'multiple_candidates_require_clarification'});expect(both.data.summary).toMatchObject({stoppedToday:1,noLiveSession:1});expect(both.data.items.find(r=>r.workerId===a.id)?.lastStopKind).toBe('system');
 const secondAdmin=await prisma.user.create({data:{companyProfileId,email:`second-${own.company.id}@example.test`,role:'ADMIN',name:'Second chief · DEMO'}});
 await prisma.workSession.create({data:{workerId:a.id,startTime:new Date('2026-11-12T09:00Z'),isLive:true,workplace:'OFFICE'}});
 const fresh=await adminGetWorkforceStatus({...requester(),kind:'admin',adminId:secondAdmin.id},{workerId:a.id});if(!fresh.ok)throw Error('No fresh result');expect(fresh.data.items).toHaveLength(1);expect(fresh.data.items[0]).toMatchObject({workerId:a.id,status:'working',location:{kind:'office'}});expect(fresh.data.summary.stoppedToday).toBe(0);
});

it('fails closed for workers, stale admins, foreign membership, invalid input and read failures',async()=>{
 const own=tenants[0];expect(await adminGetWorkforceStatus({kind:'worker',workerId:own.worker.id,companyId:own.company.id,displayName:'Worker',preferredLanguage:'SQ'})).toMatchObject({ok:false,code:'FORBIDDEN'});
 const r=requester();expect(await adminGetWorkforceStatus({...r,kind:'admin',adminId:tenants[1].admin.id})).toMatchObject({ok:false,code:'FORBIDDEN'});
 expect(await adminGetWorkforceStatus(r,{limit:31})).toMatchObject({ok:false,code:'INVALID_INPUT'});
 await prisma.user.update({where:{id:own.admin.id},data:{isActive:false}});expect(await adminGetWorkforceStatus(r)).toMatchObject({ok:false,code:'FORBIDDEN'});
 vi.spyOn(prisma,'$transaction').mockRejectedValueOnce(new Error('private diagnostic sentinel'));
 const failure=await adminGetWorkforceStatus(r);expect(failure).toMatchObject({ok:false,code:'DATA_UNAVAILABLE'});expect(JSON.stringify(failure)).not.toContain('private diagnostic sentinel');
});
