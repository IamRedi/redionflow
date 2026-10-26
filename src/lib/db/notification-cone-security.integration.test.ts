import {afterEach,beforeEach,expect,it,vi} from "vitest";
const cookies=vi.hoisted(()=>new Map<string,string>());
const provider=vi.hoisted(()=>({send:vi.fn(async(input:{tokens:string[]})=>({responses:input.tokens.map(()=>({success:true})),successCount:input.tokens.length,failureCount:0}))}));
vi.mock("next/headers",()=>({cookies:async()=>({get:(name:string)=>cookies.has(name)?{value:cookies.get(name)}:undefined}),headers:async()=>new Headers({"accept-language":"en"})}));
vi.mock("next/cache",()=>({revalidatePath:()=>undefined}));
vi.mock("firebase-admin/app",()=>({getApps:()=>[{}],initializeApp:()=>({}),cert:()=>({}),applicationDefault:()=>({})}));
vi.mock("firebase-admin/messaging",()=>({getMessaging:()=>({sendEachForMulticast:provider.send})}));
import {prisma} from "./prisma";
import {createTestSession as createSessionCookie} from "../../../tests/security/fixtures";
import {seedSecurityTenants,removeSecurityTenants} from "../../../tests/security/fixtures";
import {getMachineConeHistoryAction} from "@/app/(workzone)/workzone/cone-actions";
import {sendNotification,sendNotificationToAdmins,sendNotificationToWorkers} from "@/lib/notifications/sendNotification";
import {POST as register} from "@/app/api/notifications/register/route";
import {registerNotificationSubscription} from "@/lib/notifications/notification-store";
let tenants:Awaited<ReturnType<typeof seedSecurityTenants>>;
const token=(id:string)=>`synthetic-device-token-${id}`;
beforeEach(async()=>{
  vi.stubEnv("SESSION_SIGNING_SECRET","synthetic-notification-cone-regression-signing-key");vi.stubEnv("APP_BASE_URL","http://127.0.0.1:3100");
  cookies.clear();provider.send.mockClear();tenants=await seedSecurityTenants();
  for(const t of tenants){
    await prisma.machineConeMovement.create({data:{companyProfileId:t.company.id,type:"DEPLOY",quantity:1,fromMachineId:t.machine.id,baustelleId:t.site.id,actorRole:"ADMIN",actorAdminId:t.admin.id,actorName:t.marker}});
    for(const id of [t.admin.id,t.worker.id])await prisma.notificationSubscription.create({data:{userId:id,fcmToken:token(id)}});
  }
});
afterEach(async()=>{
  const userId={in:tenants.flatMap(t=>[t.admin.id,t.worker.id])};
  await prisma.notificationSubscription.deleteMany({where:{userId}});await prisma.notificationSettings.deleteMany({where:{userId}});
  await removeSecurityTenants(tenants.map(t=>t.company.id));vi.unstubAllEnvs();
});
async function as(kind:"admin"|"worker",index:number){cookies.clear();cookies.set(`bk_${kind}_id`,await createSessionCookie(kind,tenants[index][kind].id));}
for(const kind of ["admin","worker"] as const)for(const index of [0,1]){
  it(`${kind} ${index} can read own cone history but not foreign machine movement data`,async()=>{
    await as(kind,index);const a=tenants[index],b=tenants[1-index];
    const f=(machineId:string)=>{const data=new FormData();data.set("machineId",machineId);return data;};
    const own=await getMachineConeHistoryAction(f(a.machine.id));expect(own.ok).toBe(true);expect(JSON.stringify(own)).toContain(a.marker);
    const foreign=await getMachineConeHistoryAction(f(b.machine.id));expect(foreign.ok).toBe(false);expect(JSON.stringify(foreign)).not.toContain(b.marker);
  });
  it(`${kind} ${index} notifications target only authenticated tenant even with forged recipients`,async()=>{
    await as(kind,index);const a=tenants[index],b=tenants[1-index];const input={title:"Synthetic tenant info",body:a.marker};
    await sendNotificationToAdmins(input);await sendNotificationToWorkers(input);
    await sendNotification({...input,userIds:[a.worker.id,b.worker.id,b.admin.id]});
    const tokens=provider.send.mock.calls.flatMap(([input])=>input.tokens);
    expect(tokens).toContain(token(a.worker.id));expect(tokens).toContain(token(a.admin.id));
    expect(tokens).not.toContain(token(b.worker.id));expect(tokens).not.toContain(token(b.admin.id));
  });
}
it("anonymous notifications make no provider calls",async()=>{
  await sendNotificationToAdmins({title:"Synthetic",body:"None"});await sendNotificationToWorkers({title:"Synthetic",body:"None"});
  expect(provider.send).not.toHaveBeenCalled();
});
it("register cannot delete/reassign another identity subscription using a forged device token",async()=>{
  await as("worker",0);const b=tenants[1];const before=await prisma.notificationSubscription.findUniqueOrThrow({where:{fcmToken:token(b.worker.id)}});
  const req=(fcmToken:string)=>new Request("http://127.0.0.1:3100/api/notifications/register",{method:"POST",headers:{origin:"http://127.0.0.1:3100","content-type":"application/json"},body:JSON.stringify({fcmToken})});
  expect((await register(req(token(b.worker.id)))).status).toBe(409);
  expect(await prisma.notificationSubscription.findUniqueOrThrow({where:{fcmToken:token(b.worker.id)}})).toEqual(before);
  expect((await register(req(`synthetic-own-fresh-token-${tenants[0].worker.id}`))).status).toBe(200);
});

it("concurrent registration assigns a new device token once and the loser cannot steal it",async()=>{
  const device=`synthetic-race-token-${tenants[0].company.id}`;
  const ids=tenants.map(t=>t.worker.id);
  const results=await Promise.all(ids.map(id=>registerNotificationSubscription(id,device)));
  expect(results.filter(Boolean)).toHaveLength(1);
  const before=await prisma.notificationSubscription.findUniqueOrThrow({where:{fcmToken:device}});
  const loser=ids.find(id=>id!==before.userId)!;
  expect(await registerNotificationSubscription(loser,device)).toBe(false);
  expect(await prisma.notificationSubscription.findUniqueOrThrow({where:{fcmToken:device}})).toEqual(before);
  expect(await registerNotificationSubscription(before.userId,device)).toBe(true);
});
