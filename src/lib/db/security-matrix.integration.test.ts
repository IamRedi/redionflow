import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const cookies=vi.hoisted(()=>new Map<string,string>());
vi.mock("next/headers",()=>({cookies:async()=>({get:(name:string)=>cookies.has(name)?{value:cookies.get(name)}:undefined}),headers:async()=>new Headers({"accept-language":"en"})}));
vi.mock("next/cache",()=>({revalidatePath:()=>undefined,revalidateTag:()=>undefined,unstable_cache:(fn:unknown)=>fn}));
const storage=vi.hoisted(()=>({upload:vi.fn(async()=>"/unused"),remove:vi.fn(async()=>undefined)}));
vi.mock("@/lib/storage/object-storage",()=>({uploadManagedFile:storage.upload,deleteManagedFileByUrl:storage.remove}));
import {prisma} from "./prisma";
import {createTestSession as createSessionCookie} from "../../../tests/security/fixtures";
import {getAdminCompanyId} from "@/lib/auth/authorization";
import {seedSecurityTenants,removeSecurityTenants} from "../../../tests/security/fixtures";
import {saveReportNoteAction,uploadWorkerAssetAction,deleteWorkerDocumentAction,updateNotificationSettingsAction,confirmWorkerInventoryItemAction,requestDeleteWorkerInventoryItemAction} from "@/app/(workzone)/workzone/hr-actions";
import {addManualTaskAction} from "@/app/(workzone)/workzone/actions";
import {updateAdminInventoryItemAction} from "@/app/(workzone)/workzone/inventory-actions";
import {addMachineNoteAction,blockMachineAction} from "@/app/(workzone)/workzone/machine-actions";
import {moveDailyPlanItemAction} from "@/app/(workzone)/workzone/daily-plan-actions";
import {POST as phoneGps} from "@/app/api/workzone/gps/route";
import {POST as fleetGps} from "@/app/api/fleet/gps/route";
import {resolveFleetIngestTenant} from "@/lib/fleet/ingest-auth";
let tenants:Awaited<ReturnType<typeof seedSecurityTenants>>;
beforeEach(async()=>{vi.stubEnv("SESSION_SIGNING_SECRET","synthetic-phase3-security-matrix-only-signing-key");vi.stubEnv("APP_BASE_URL","http://127.0.0.1:3100");cookies.clear();storage.upload.mockClear();storage.remove.mockClear();tenants=await seedSecurityTenants();});
afterEach(async()=>{await removeSecurityTenants(tenants.map(t=>t.company.id));vi.unstubAllEnvs();});
async function as(kind:"admin"|"worker",index:number){cookies.clear();cookies.set(`bk_${kind}_id`,await createSessionCookie(kind,tenants[index][kind].id));}
function form(data:Record<string,string|File>){const f=new FormData();for(const [k,v]of Object.entries(data))f.set(k,v);return f;}
function req(path:string,body:unknown,headers:Record<string,string>={}){return new NextRequest(`http://127.0.0.1:3100${path}`,{method:"POST",headers:{origin:"http://127.0.0.1:3100","content-type":"application/json",...headers},body:JSON.stringify(body)});}

for(const kind of ["admin","worker"] as const)for(const index of [0,1]){
  it(`${kind} ${index} writes own report but cannot write foreign report/document`,async()=>{
    await as(kind,index);const a=tenants[index],b=tenants[1-index];
    const input={type:"DAILY",periodKey:"2026-10-01",note:"Synthetic report"};
    expect((await saveReportNoteAction({...input,workerId:a.worker.id})).ok).toBe(true);
    expect((await saveReportNoteAction({...input,workerId:b.worker.id})).ok).toBe(false);
    const file=new File(["%PDF-1.4\nsynthetic"],"test.pdf",{type:"application/pdf"});
    expect((await uploadWorkerAssetAction(form({workerId:b.worker.id,kind:"document",file}))).ok).toBe(false);
    expect((await deleteWorkerDocumentAction(form({workerId:b.worker.id,documentId:"guessed"}))).ok).toBe(false);
    expect(storage.upload).not.toHaveBeenCalled();expect(storage.remove).not.toHaveBeenCalled();
    expect(await prisma.workReportNote.count({where:{workerId:b.worker.id}})).toBe(0);
  });
}
it("worker and anonymous cannot invoke admin inventory, machine blocking or daily-plan writes",async()=>{
  const a=tenants[0];
  for(const logged of [false,true]){
    if(logged)await as("worker",0);
    expect(await getAdminCompanyId()).toBeNull();
    expect((await updateAdminInventoryItemAction(form({id:a.item.id,itemCode:a.marker,name:"Forged"}))).ok).toBe(false);
    expect((await blockMachineAction(form({machineId:a.machine.id,blocked:"on"}))).ok).toBe(false);
    expect((await moveDailyPlanItemAction({date:"2026-10-01",columnId:a.site.id,kind:"WORKER",itemId:a.worker.id})).ok).toBe(false);
  }
  expect(await prisma.dailyWorkPlanAssignment.count({where:{columnId:a.column.id}})).toBe(1);
});
it("same-tenant worker may report machine notes and create attention task with own-tenant office actor",async()=>{
  await as("worker",1);const a=tenants[1];
  expect((await addMachineNoteAction(form({machineId:a.machine.id,note:"Synthetic note"}))).ok).toBe(true);
  expect((await addManualTaskAction({baustelleId:a.site.id,workerId:a.worker.id,description:"Synthetic attention"})).ok).toBe(true);
  expect((await prisma.manualTask.findFirstOrThrow({where:{baustelleId:a.site.id}})).userId).toBe(a.admin.id);
});
it("anonymous report/document/machine mutation is denied",async()=>{
  const a=tenants[0];
  expect((await saveReportNoteAction({workerId:a.worker.id,type:"DAILY",periodKey:"2026-10-01",note:"Forged"})).ok).toBe(false);
  expect((await deleteWorkerDocumentAction(form({workerId:a.worker.id,documentId:"guessed"}))).ok).toBe(false);
  expect((await addMachineNoteAction(form({machineId:a.machine.id,note:"Forged"}))).ok).toBe(false);
});
it("worker phone GPS allows own live session; forged worker/session and paused session denied",async()=>{
  for(const t of tenants)await prisma.companyProfile.update({where:{id:t.company.id},data:{workerPhoneGpsEnabled:true}});
  const sessions=await Promise.all(tenants.map(t=>prisma.workSession.create({data:{workerId:t.worker.id,baustelleId:t.site.id,startTime:new Date(),isLive:true}})));
  const body={sessionId:sessions[0].id,lat:1,lng:1,companyProfileId:tenants[1].company.id,workerId:tenants[1].worker.id};
  expect((await phoneGps(req("/api/workzone/gps",body))).status).toBe(401);
  await as("worker",0);
  expect((await phoneGps(req("/api/workzone/gps",body))).status).toBe(200);
  const point=await prisma.gpsLocationPoint.findFirstOrThrow({where:{workSessionId:sessions[0].id}});
  expect(point.companyProfileId).toBe(tenants[0].company.id);expect(point.workerId).toBe(tenants[0].worker.id);
  expect((await phoneGps(req("/api/workzone/gps",{...body,sessionId:sessions[1].id}))).status).toBe(409);
  await prisma.workSessionPauseInterval.create({data:{workerId:tenants[0].worker.id,workSessionId:sessions[0].id,startedAt:new Date()}});
  expect((await phoneGps(req("/api/workzone/gps",body))).status).toBe(409);
  expect(await prisma.gpsLocationPoint.count({where:{companyProfileId:tenants[1].company.id}})).toBe(0);
});
it("fleet bearer token owns its tenant and cannot use global fallback or foreign machines in SaaS",async()=>{
  const a=tenants[0],b=tenants[1];
  await prisma.companyProfile.update({where:{id:a.company.id},data:{fleetGpsEnabled:true}});
  await prisma.machine.update({where:{id:a.machine.id},data:{gpsEnabled:true}});
  const token=`synthetic-${a.marker}`;await prisma.fleetIngestToken.create({data:{companyProfileId:a.company.id,token,label:"Synthetic"}});
  vi.stubEnv("FLEET_GPS_INGEST_TOKEN","synthetic-global-not-authority");
  expect(await resolveFleetIngestTenant("synthetic-global-not-authority",b.company.id)).toBeNull();
  const body={machineId:a.machine.id,lat:1,lng:1};
  expect((await fleetGps(req("/api/fleet/gps",body))).status).toBe(401);
  const headers={authorization:`Bearer ${token}`};
  expect((await fleetGps(req("/api/fleet/gps",{...body,machineId:b.machine.id},headers))).status).toBe(404);
  expect((await fleetGps(req("/api/fleet/gps",body,headers))).status).toBe(200);
  expect(await prisma.gpsLocationPoint.count({where:{companyProfileId:b.company.id}})).toBe(0);
});
it("all cookie API mutations reject foreign origin before auth/storage/provider effects",async()=>{
  const modules=[await import("@/app/api/admin-login/route"),await import("@/app/api/display-login/route"),await import("@/app/api/notifications/register/route"),await import("@/app/api/workzone/sync/route"),await import("@/app/api/workzone/sync/upload/route"),await import("@/app/api/assistant/route"),await import("@/app/api/assistant/worker/route")];
  await as("admin",0);
  for(const route of modules)expect((await route.POST(req("/api/probe",{}, {origin:"https://foreign.example.test"}))).status).toBe(403);
  expect((await phoneGps(req("/api/workzone/gps",{},{origin:"https://foreign.example.test"}))).status).toBe(403);
  expect(storage.upload).not.toHaveBeenCalled();
});

it("dashboard invalidation requires same-request admin tenant authority",async()=>{
  const {refreshDashboardSnapshotAction}=await import("@/app/(admin)/app/dashboard/actions");
  await expect(refreshDashboardSnapshotAction()).rejects.toThrow("Access denied");
  await as("worker",0);await expect(refreshDashboardSnapshotAction()).rejects.toThrow("Access denied");
  await as("admin",0);await expect(refreshDashboardSnapshotAction()).resolves.toBeUndefined();
});

it("SaaS display refresh denies anonymous/worker and permits tenant-bound admin/display",async()=>{
  const {refreshDisplayViewsAction}=await import("@/app/display/actions");
  await expect(refreshDisplayViewsAction()).rejects.toThrow("Access denied");
  await as("worker",0);await expect(refreshDisplayViewsAction()).rejects.toThrow("Access denied");
  await as("admin",0);await expect(refreshDisplayViewsAction()).resolves.toBeUndefined();
  const staff=await prisma.user.create({data:{email:`synthetic-display-${tenants[0].company.id}@example.test`,role:"STAFF",companyProfileId:tenants[0].company.id}});
  cookies.clear();cookies.set("bk_display_id",await createSessionCookie("display",staff.id));
  await expect(refreshDisplayViewsAction()).resolves.toBeUndefined();
});

it("notification preferences deny foreign admin/worker identities and keep owned settings usable",async()=>{
  for(const index of [0,1]){
    await as("admin",index); const a=tenants[index],b=tenants[1-index];
    for(const userId of [a.admin.id,a.worker.id]) expect((await updateNotificationSettingsAction(form({userId,tagesplan:"on"}))).ok).toBe(true);
    for(const userId of [b.admin.id,b.worker.id]) expect((await updateNotificationSettingsAction(form({userId,tagesplan:"on"}))).ok).toBe(false);
    const rows=await prisma.$queryRaw<Array<{userId:string}>>`SELECT "userId" FROM "NotificationSettings" WHERE "userId" IN (${b.admin.id},${b.worker.id})`;
    expect(rows).toHaveLength(0);
    await prisma.$executeRaw`DELETE FROM "NotificationSettings" WHERE "userId" IN (${a.admin.id},${a.worker.id})`;
    await as("worker",index);
    expect((await updateNotificationSettingsAction(form({userId:a.worker.id,tagesplan:"on"}))).ok).toBe(true);
    expect((await updateNotificationSettingsAction(form({userId:a.admin.id,tagesplan:"on"}))).ok).toBe(false);
    expect((await updateNotificationSettingsAction(form({userId:b.worker.id,tagesplan:"on"}))).ok).toBe(false);
    cookies.clear();expect((await updateNotificationSettingsAction(form({userId:a.worker.id,tagesplan:"on"}))).ok).toBe(false);
    await prisma.$executeRaw`DELETE FROM "NotificationSettings" WHERE "userId" IN (${a.admin.id},${a.worker.id})`;
  }
});

for(const action of ["confirm","delete"] as const)it(`worker inventory ${action} rejects foreign admin write and preserves own flow`,async()=>{
  const a=tenants[0],b=tenants[1];
  const items=await Promise.all([a,b].map(t=>prisma.workerAssetItem.create({data:{workerId:t.worker.id,kind:"EQUIPMENT",itemName:"Synthetic handoff",createdByRole:"WORKER",status:action === "confirm" ? "PENDING_ADMIN_CONFIRMATION" : "ACTIVE"}})));
  const run=action === "confirm" ? confirmWorkerInventoryItemAction : requestDeleteWorkerInventoryItemAction;
  expect((await run(form({itemId:items[0].id}))).ok).toBe(false);
  await as("worker",0);expect((await run(form({itemId:items[1].id}))).ok).toBe(false);
  await as("admin",0);
  expect((await run(form({itemId:items[1].id}))).ok).toBe(false);
  expect((await prisma.workerAssetItem.findUniqueOrThrow({where:{id:items[1].id}})).status).toBe(items[1].status);
  expect((await run(form({itemId:items[0].id}))).ok).toBe(true);
});
