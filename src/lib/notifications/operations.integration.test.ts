import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createECDH } from 'node:crypto';
const request = vi.hoisted(() => ({ cookies: new Map<string,string>() }));
const provider = vi.hoisted(() => ({ send: vi.fn(async()=>({statusCode:201})), fcm: vi.fn(async(input:{tokens:string[]})=>({responses:input.tokens.map(()=>({success:true})),successCount:input.tokens.length,failureCount:0})) }));
vi.mock('next/headers',()=>({cookies:async()=>({get:(key:string)=>request.cookies.has(key)?{value:request.cookies.get(key)}:undefined}),headers:async()=>new Headers({'accept-language':'sq'})}));
vi.mock('next/cache',()=>({revalidatePath:()=>undefined}));
vi.mock('web-push',()=>({sendNotification:provider.send}));
vi.mock('firebase-admin/app',()=>({getApps:()=>[{}],initializeApp:()=>({}),cert:()=>({}),applicationDefault:()=>({})}));
vi.mock('firebase-admin/messaging',()=>({getMessaging:()=>({sendEachForMulticast:provider.fcm})}));
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { seedSecurityTenants, removeSecurityTenants, createTestSession } from '../../../tests/security/fixtures';
import { notificationAudience } from './audience';
import { registerNotificationSubscription } from './notification-store';
import { encodeBrowserSubscription } from './web-push';
import { dispatchWorkNotification, siteCompletionSnapshot } from './events';
import { sendNotification } from './sendNotification';
import { updateSteelPhaseAction } from '@/app/(workzone)/workzone/steel-phase-actions';
import { saveDailyPlanAction } from '@/app/(workzone)/workzone/daily-plan-actions';
import { GET as config, POST as register } from '@/app/api/notifications/register/route';
import { POST as testPush } from '@/app/api/notifications/test/route';
let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
const key=createECDH('prime256v1');key.generateKeys();
const sub=(suffix:string)=>({endpoint:`https://web.push.apple.com/synthetic-${suffix}`,keys:{p256dh:key.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,2).toString('base64url')}});
const req=(path:string,body:unknown)=>new Request(`http://127.0.0.1:3226/api/notifications/${path}`,{method:'POST',headers:{origin:'http://127.0.0.1:3226','content-type':'application/json'},body:JSON.stringify(body)});
const as=async(kind:'worker'|'admin',index=0)=>{request.cookies.clear();request.cookies.set(`bk_${kind}_id`,await createTestSession(kind,tenants[index][kind].id));};
beforeEach(async()=>{
 vi.stubEnv('SESSION_SIGNING_SECRET','synthetic-push-regression-signing-secret-only');vi.stubEnv('APP_BASE_URL','http://127.0.0.1:3226');vi.stubEnv('WEB_PUSH_PUBLIC_KEY',key.getPublicKey().toString('base64url'));vi.stubEnv('WEB_PUSH_PRIVATE_KEY',key.getPrivateKey().toString('base64url'));vi.stubEnv('WEB_PUSH_SUBJECT','https://synthetic.example.test');
 provider.send.mockReset();provider.send.mockResolvedValue({statusCode:201});provider.fcm.mockClear();tenants=await seedSecurityTenants();await as('admin');
});
afterEach(async()=>{const ids=tenants.flatMap(t=>[t.admin.id,t.worker.id]);await prisma.notificationSubscription.deleteMany({where:{userId:{in:ids}}});await prisma.notificationSettings.deleteMany({where:{userId:{in:ids}}});await removeSecurityTenants(tenants.map(t=>t.company.id));vi.unstubAllEnvs();});

it('Shikon and Vepron receive only their current place/site; Hiq, inactive and foreign users do not',async()=>{
 const a=tenants[0],b=tenants[1];await prisma.worker.update({where:{id:a.worker.id},data:{accessLevel:'BASE'}});
 await prisma.accessGrant.createMany({data:[{companyProfileId:a.company.id,workerId:a.worker.id,place:'site',scopeId:a.site.id,level:'view'},{companyProfileId:a.company.id,workerId:a.worker.id,place:'field',scopeId:a.site.id,level:'view'}]});
 const audience=(action:'field.view'|'factory.view'|'daily_plan.view',siteId?:string)=>withTenantContext(a.company.id,tx=>notificationAudience(tx,a.company.id,{action,siteId}));
 expect(await audience('field.view',a.site.id)).toEqual(expect.arrayContaining([a.admin.id,a.worker.id]));expect(await audience('factory.view',a.site.id)).not.toContain(a.worker.id);
 expect(await audience('field.view',b.site.id)).toEqual([]);
 await prisma.accessGrant.updateMany({where:{workerId:a.worker.id,place:'field'},data:{level:'act'}});expect(await audience('field.view',a.site.id)).toContain(a.worker.id);
 await prisma.accessGrant.updateMany({where:{workerId:a.worker.id,place:'field'},data:{level:'none'}});expect(await audience('field.view',a.site.id)).not.toContain(a.worker.id);
 await prisma.accessGrant.create({data:{companyProfileId:a.company.id,workerId:a.worker.id,place:'daily_plan',scopeId:'',level:'none'}});expect(await audience('daily_plan.view')).not.toContain(a.worker.id);
 await prisma.worker.update({where:{id:a.worker.id},data:{status:'inactive'}});expect(await audience('field.view',a.site.id)).not.toContain(a.worker.id);
});
it('records one completed task rather than the unrelated imported row; repeated Done does not send again',async()=>{
 const a=tenants[0];await prisma.baustelle.update({where:{id:a.site.id},data:{type:'STEEL_ASSEMBLY'}});
 const definition=await prisma.steelWorkDefinition.create({data:{companyProfileId:a.company.id,key:'steel-task-synthetic',kind:'site',label:'Montim demo'}});
 const item=await prisma.treeItem.create({data:{baustelleId:a.site.id,treeId:definition.key,species:'task',diameter:0}});
 await prisma.steelSiteTask.create({data:{companyProfileId:a.company.id,baustelleId:a.site.id,definitionId:definition.id,treeItemId:item.id}});
 await registerNotificationSubscription(a.admin.id,encodeBrowserSubscription(sub(a.admin.id)));
 expect((await updateSteelPhaseAction({phaseItemId:item.id,command:'done'})).ok).toBe(true);
 expect(provider.send).toHaveBeenCalledTimes(2); // process and site, only the admin has access
 expect(await withTenantContext(a.company.id,tx=>siteCompletionSnapshot(tx,a.company.id,a.site.id))).toMatchObject({complete:true});
 expect((await updateSteelPhaseAction({phaseItemId:item.id,command:'done'})).ok).toBe(true);expect(provider.send).toHaveBeenCalledTimes(2);
 expect(await prisma.treeItem.findUniqueOrThrow({where:{id:a.tree.id}})).toMatchObject({status:'todo'});
});
it('a saved plan notifies current viewers even today and even if not assigned; unchanged Save stays quiet',async()=>{
 const a=tenants[0];await registerNotificationSubscription(a.worker.id,encodeBrowserSubscription(sub(a.worker.id)));
 const {dayRange,dateKey}=await import('@/lib/workzone/date-utils');const date=dateKey(new Date());
 await prisma.dailyWorkPlan.create({data:{companyProfileId:a.company.id,planDate:dayRange(date).start,columns:{create:{title:'Synthetic place',baustelleId:a.site.id,note:'Synthetic plan'}}}});
 expect((await saveDailyPlanAction({date,lang:'sq'})).ok).toBe(true);expect(provider.send).toHaveBeenCalledTimes(1);
 expect((await saveDailyPlanAction({date,lang:'sq'})).ok).toBe(true);expect(provider.send).toHaveBeenCalledTimes(1);
});
it('standard push preserves Firebase devices, deduplicates an event and removes only expired subscriptions',async()=>{
 const a=tenants[0],b=tenants[1];await registerNotificationSubscription(a.worker.id,encodeBrowserSubscription(sub(a.worker.id)));await registerNotificationSubscription(a.admin.id,'synthetic-legacy-firebase-token-admin');await registerNotificationSubscription(b.worker.id,encodeBrowserSubscription(sub(b.worker.id)));
 const event={key:'synthetic-once',kind:'plan' as const,action:'daily_plan.view' as const,title:'Plan',body:'Synthetic',url:'/workzone/plan',preference:'tagesplan' as const};
 await Promise.all([dispatchWorkNotification(a.company.id,event),dispatchWorkNotification(a.company.id,event)]);
 expect(provider.send).toHaveBeenCalledTimes(1);expect(provider.fcm).toHaveBeenCalledTimes(1);
 provider.send.mockRejectedValueOnce(Object.assign(new Error('expired'),{statusCode:410}));await sendNotification({userIds:[a.worker.id],title:'Test',body:'Synthetic'});
 expect(await prisma.notificationSubscription.count({where:{userId:a.worker.id}})).toBe(0);expect(await prisma.notificationSubscription.count({where:{userId:b.worker.id}})).toBe(1);
});
it('registration and self-test require a single authenticated owner; same endpoint cannot be claimed with different keys',async()=>{
 const a=tenants[0],b=tenants[1],s=sub('owned');
 expect((await register(req('register',{subscription:s}))).status).toBe(200);
 expect(await registerNotificationSubscription(b.worker.id,encodeBrowserSubscription({...s,keys:{...s.keys,auth:Buffer.alloc(16,4).toString('base64url')}}))).toBe(false);
 expect((await testPush(req('test',{subscription:s}))).status).toBe(200);expect(provider.send).toHaveBeenCalledTimes(1);
 expect((await testPush(req('test',{subscription:s}))).status).toBe(429);
 await as('worker');expect((await testPush(req('test',{team:true}))).status).toBe(403);
 expect((await register(req('register',{subscription:{...s,endpoint:'http://127.0.0.1/internal'}}))).status).toBe(400);
 request.cookies.set('bk_admin_id',await createTestSession('admin',a.admin.id));expect((await config()).status).toBe(401);
 request.cookies.clear();expect((await config()).status).toBe(401);
});
