import {afterEach,beforeEach,expect,it,vi} from "vitest";
import type {ReactElement} from "react";
import {readFile} from "node:fs/promises";
const request=vi.hoisted(()=>({values:new Map<string,string>()}));
vi.mock("next/headers",()=>({cookies:async()=>({get:(n:string)=>request.values.has(n)?{value:request.values.get(n)}:undefined,set:(n:string,v:string)=>request.values.set(n,v),delete:(n:string)=>request.values.delete(n)}),headers:async()=>new Headers({"accept-language":"en"})}));
vi.mock("next/cache",()=>({revalidatePath:()=>undefined,unstable_cache:(f:unknown)=>f}));
vi.mock("next/navigation",()=>({notFound:()=>{throw new Error("NOT_FOUND");},redirect:()=>{throw new Error("REDIRECT");}}));
import {prisma} from "./prisma";
import {seedSecurityTenants,removeSecurityTenants} from "../../../tests/security/fixtures";
import {createTestSession as createSessionCookie} from "../../../tests/security/fixtures";
import {getCurrentAdmin} from "@/lib/auth/admin-session";
import {hashPassword} from "@/lib/auth/password";
import {loginAction} from "@/app/(public)/login/actions";
import LaborDetail from "@/app/(admin)/app/labor/[laborRoleId]/page";
import LaborList from "@/app/(admin)/app/labor/page";
import TemplateDetail from "@/app/(admin)/app/templates/[templateId]/page";
import TemplateList from "@/app/(admin)/app/templates/page";
import MachineDetail from "@/app/(admin)/app/machines/[machineId]/page";
import FleetDetail from "@/app/(admin)/app/admin/machines/[machineId]/page";
import AdminPage from "@/app/(admin)/app/admin/page";
let tenants:Awaited<ReturnType<typeof seedSecurityTenants>>;
beforeEach(async()=>{vi.stubEnv("SESSION_SIGNING_SECRET","synthetic-independent-review-signing-key-only");request.values.clear();tenants=await seedSecurityTenants();});
afterEach(async()=>{vi.restoreAllMocks();await removeSecurityTenants(tenants.map(t=>t.company.id));vi.unstubAllEnvs();});
async function asAdmin(i=0){request.values.clear();request.values.set("bk_admin_id",await createSessionCookie("admin",tenants[i].admin.id));}
function form(values:Record<string,string>){const f=new FormData();for(const [k,v]of Object.entries(values))f.set(k,v);return f;}
// Read actual React element action closures; no rewritten production implementation/test export.
function elements(node:unknown):ReactElement<Record<string,unknown>>[]{
 if(Array.isArray(node))return node.flatMap(elements);
 if(!node||typeof node!=="object"||!("props" in node))return [];
 const el=node as ReactElement<Record<string,unknown>>;return [el,...elements(el.props.children)];
}
function actions(node:unknown){return elements(node).filter(el=>el.type==="form"&&typeof el.props.action==="function").map(el=>el.props.action as (data:FormData)=>Promise<unknown>);}
async function run(action:(data:FormData)=>Promise<unknown>,data:FormData){try{await action(data);}catch(e){if(!(e instanceof Error)||!["NOT_FOUND","REDIRECT","Access denied."].includes(e.message))throw e;}}
async function seedRefs(){return Promise.all(tenants.map(t=>Promise.all([
 prisma.laborRole.create({data:{companyProfileId:t.company.id,name:t.marker,wageType:"HOURLY",grossHourlyCents:100}}),
 prisma.calculationTemplate.create({data:{companyProfileId:t.company.id,name:t.marker,templatePositions:{create:{title:t.marker,sortOrder:1,quantity:1,unit:"unit"}}},include:{templatePositions:true}}),
])));}
it("foreign labor/template/machine/fleet detail reads deny before rendering",async()=>{
 const refs=await seedRefs();await asAdmin();const b=tenants[1];
 for(const render of [()=>LaborDetail({params:Promise.resolve({laborRoleId:refs[1][0].id})}),()=>TemplateDetail({params:Promise.resolve({templateId:refs[1][1].id})}),()=>MachineDetail({params:Promise.resolve({machineId:b.machine.id})}),()=>FleetDetail({params:Promise.resolve({machineId:b.machine.id})})])await expect(render()).rejects.toThrow("NOT_FOUND");
});
it("labor/template creation ignores forged tenant authority and never writes B",async()=>{
 await asAdmin();const a=tenants[0],b=tenants[1];
 await run(actions(await LaborList())[0],form({companyId:b.company.id,name:"Forged labor",wageType:"HOURLY"}));
 await run(actions(await TemplateList())[0],form({companyId:b.company.id,name:"Forged template"}));
 expect(await prisma.laborRole.count({where:{companyProfileId:b.company.id,name:"Forged labor"}})).toBe(0);
 expect(await prisma.calculationTemplate.count({where:{companyProfileId:b.company.id,name:"Forged template"}})).toBe(0);
 await run(actions(await LaborList())[0],form({companyId:a.company.id,name:"Own labor",wageType:"HOURLY"}));
 await run(actions(await TemplateList())[0],form({companyId:a.company.id,name:"Own template"}));
 expect(await prisma.laborRole.count({where:{companyProfileId:a.company.id,name:"Own labor"}})).toBe(1);
 expect(await prisma.calculationTemplate.count({where:{companyProfileId:a.company.id,name:"Own template"}})).toBe(1);
});
it("actual labor save rejects forged foreign ID but preserves own update",async()=>{
 const refs=await seedRefs();await asAdmin();const action=actions(await LaborDetail({params:Promise.resolve({laborRoleId:refs[0][0].id})}))[0];
 await run(action,form({id:refs[1][0].id,name:"Forged labor",wageType:"HOURLY"}));
 expect((await prisma.laborRole.findUniqueOrThrow({where:{id:refs[1][0].id}})).name).toBe(refs[1][0].name);
 await run(action,form({id:refs[0][0].id,name:"Own changed",wageType:"HOURLY"}));
 expect((await prisma.laborRole.findUniqueOrThrow({where:{id:refs[0][0].id}})).name).toBe("Own changed");
});
it.each(["machine","fleet"])("actual %s save rejects forged target",async kind=>{
 await asAdmin();const [a,b]=tenants;const page=kind==="machine"?MachineDetail:FleetDetail;
 const action=actions(await page({params:Promise.resolve({machineId:a.machine.id})}))[0];
 await run(action,form({id:b.machine.id,nickname:"Forged machine"}));
 expect((await prisma.machine.findUniqueOrThrow({where:{id:b.machine.id}})).name).toBe(b.machine.name);
 await run(action,form({id:a.machine.id,nickname:"Own changed"}));
 expect((await prisma.machine.findUniqueOrThrow({where:{id:a.machine.id}})).name).toBe("Own changed");
});
it("actual inline machine deletion cannot delete B",async()=>{
 await asAdmin();const [a,b]=tenants;
 const forms=elements(await AdminPage()).filter(el=>el.type==="form");
 const target=forms.find(el=>elements(el.props.children).some(child=>child.type==="input"&&child.props.name==="id"&&child.props.value===a.machine.id));
 expect(target).toBeTruthy();const action=target!.props.action as (data:FormData)=>Promise<unknown>;
 await run(action,form({id:b.machine.id}));expect(await prisma.machine.findUnique({where:{id:b.machine.id}})).not.toBeNull();
 await run(action,form({id:a.machine.id}));expect(await prisma.machine.findUnique({where:{id:a.machine.id}})).toBeNull();
});
it("actual template and preset writes/deletes reject forged foreign IDs",async()=>{
 const refs=await seedRefs();await asAdmin();const [a,b]=refs.map(r=>r[1]);
 const list=actions(await TemplateDetail({params:Promise.resolve({templateId:a.id})}));
 await run(list[0],form({id:b.id,name:"Forged"}));expect((await prisma.calculationTemplate.findUniqueOrThrow({where:{id:b.id}})).name).toBe(b.name);
 await run(list[1],form({templateId:b.id}));expect(await prisma.templatePositionPreset.count({where:{templateId:b.id}})).toBe(1);
 const preset=b.templatePositions[0];
 await run(list[2],form({id:preset.id,templateId:a.id,title:"Forged",quantity:"1",unit:"unit"}));expect((await prisma.templatePositionPreset.findUniqueOrThrow({where:{id:preset.id}})).title).toBe(preset.title);
 await run(list[3],form({id:preset.id,templateId:a.id}));expect(await prisma.templatePositionPreset.findUnique({where:{id:preset.id}})).not.toBeNull();
 await run(list[0],form({id:a.id,name:"Own changed"}));expect((await prisma.calculationTemplate.findUniqueOrThrow({where:{id:a.id}})).name).toBe("Own changed");
});
it("SaaS login cannot turn stale verified credentials into the post-rotation epoch",async()=>{
 const a=tenants[0];const lookup=prisma.user.findFirst.bind(prisma.user);
 vi.spyOn(prisma.user,"findFirst").mockImplementationOnce((async (args: Parameters<typeof prisma.user.findFirst>[0])=>{
  const snapshot=await lookup(args);await prisma.user.update({where:{id:a.admin.id},data:{passwordHash:hashPassword("synthetic-new-password")}});return snapshot;
 }) as unknown as typeof prisma.user.findFirst);
 try{await loginAction({email:a.admin.email,password:"synthetic-test-password-only",lang:"en"});}catch(e){if(!(e instanceof Error)||e.message!=="REDIRECT")throw e;}
 expect(await getCurrentAdmin()).toBeNull();
});
it("preflight rejects orphan sole-owner notification records without modifying data",async()=>{
 const sql=await readFile("prisma/migrations/20261001153000_tenant_reference_integrity/migration.sql","utf8");const preflight=sql.match(/DO \$\$ BEGIN[\s\S]*?END \$\$;/)![0];
 await expect(prisma.$transaction(async tx=>{
  await tx.$executeRawUnsafe('ALTER TABLE public."NotificationSettings" DISABLE TRIGGER bk_tenant_integrity');
  await tx.$executeRaw`INSERT INTO "NotificationSettings" (id,"userId","createdAt","updatedAt") VALUES ('synthetic-orphan-notification','synthetic-missing-actor',now(),now())`;
  await tx.$executeRawUnsafe(preflight);
 })).rejects.toThrow(/Tenant integrity preflight failed: NotificationSettings.userId/);
 expect(await prisma.notificationSettings.count({where:{id:"synthetic-orphan-notification"}})).toBe(0);
});

it.each(["worker","display"] as const)("%s credential snapshot cannot mint a fresh epoch after concurrent rotation",async kind=>{
  const {createSessionCookie:mint}=await import("@/lib/auth/session-cookie");
  const a=tenants[0];
  if(kind === "worker"){
    const {authenticateWorkerByCode}=await import("@/lib/auth/authenticate-worker");
    const {getCurrentWorker}=await import("@/lib/workzone/worker-session");
    await prisma.worker.update({where:{id:a.worker.id},data:{loginCodeHash:hashPassword("synthetic-worker-epoch-proof")}});
    const proof=await authenticateWorkerByCode(prisma,"synthetic-worker-epoch-proof");expect(proof.ok).toBe(true);if(!proof.ok)throw new Error("Missing test proof");
    await prisma.worker.update({where:{id:proof.worker.id},data:{loginCodeHash:hashPassword("synthetic-rotated-worker")}});
    request.values.set("bk_worker_id",await mint(kind,proof.worker.id,proof.worker.sessionEpoch));expect(await getCurrentWorker()).toBeNull();
    const fresh=await authenticateWorkerByCode(prisma,"synthetic-rotated-worker");if(!fresh.ok)throw new Error("Missing fresh test proof");
    request.values.set("bk_worker_id",await mint(kind,fresh.worker.id,fresh.worker.sessionEpoch));expect((await getCurrentWorker())?.id).toBe(fresh.worker.id);
  }else{
    const {authenticateDisplayByCode}=await import("@/lib/auth/authenticate-display");
    const {getCurrentDisplayUser}=await import("@/lib/auth/display-session");
    const staff=await prisma.user.create({data:{email:`synthetic-display-${a.company.id}@example.test`,companyProfileId:a.company.id,role:"STAFF",passwordHash:hashPassword("synthetic-display-old")}});
    const proof=await authenticateDisplayByCode(prisma,staff.email,"synthetic-display-old");if(!proof.ok)throw new Error("Missing test proof");
    await prisma.user.update({where:{id:staff.id},data:{passwordHash:hashPassword("synthetic-display-new")}});
    request.values.set("bk_display_id",await mint(kind,proof.userId,proof.sessionEpoch));expect(await getCurrentDisplayUser()).toBeNull();
    const fresh=await authenticateDisplayByCode(prisma,staff.email,"synthetic-display-new");if(!fresh.ok)throw new Error("Missing fresh test proof");
    request.values.set("bk_display_id",await mint(kind,fresh.userId,fresh.sessionEpoch));expect((await getCurrentDisplayUser())?.id).toBe(staff.id);
  }
});

it("shared worker codes across tenants refuse ambiguous credential authority",async()=>{
  const {authenticateWorkerByCode}=await import("@/lib/auth/authenticate-worker");
  expect(await authenticateWorkerByCode(prisma,"synthetic-worker-code-only")).toEqual({ok:false,reason:"invalid_code"});
});
it("successful worker credential proof contains no stored hash or raw login code",async()=>{
  const {authenticateWorkerByCode}=await import("@/lib/auth/authenticate-worker");
  await prisma.worker.update({where:{id:tenants[0].worker.id},data:{loginCodeHash:hashPassword("synthetic-unique-proof-code")}});
  const proof=await authenticateWorkerByCode(prisma,"synthetic-unique-proof-code");
  expect(proof.ok).toBe(true);expect(JSON.stringify(proof)).not.toMatch(/loginCode|scrypt\$/);
});
