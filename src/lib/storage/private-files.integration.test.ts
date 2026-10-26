import { afterEach, beforeEach, expect, it, vi } from "vitest";
const request=vi.hoisted(()=>({values:new Map<string,string>()}));
const storage=vi.hoisted(()=>({read:vi.fn(async()=>new Response("%PDF synthetic private",{headers:{"content-type":"application/pdf"}}))}));
vi.mock("next/headers",()=>({cookies:async()=>({get:(key:string)=>request.values.has(key)?{value:request.values.get(key)!}:undefined})}));
vi.mock("@/lib/storage/object-storage",()=>({readManagedFile:storage.read}));
import { prisma } from "@/lib/db/prisma";
import { seedSecurityTenants, removeSecurityTenants } from "../../../tests/security/fixtures";
import { createTestSession as createSessionCookie } from "../../../tests/security/fixtures";
import { managedFileReference } from "./managed-reference";
import { GET } from "@/app/api/private-files/route";
let tenants:Awaited<ReturnType<typeof seedSecurityTenants>>;
let siteUrl:string,workerUrl:string;
beforeEach(async()=>{
 vi.stubEnv("SESSION_SIGNING_SECRET","synthetic-security-test-signing-key-only-20261001");tenants=await seedSecurityTenants();request.values.clear();storage.read.mockClear();
 siteUrl=managedFileReference({scope:"baustelle-documents",entityId:tenants[0].site.id,fileName:"synthetic.pdf"});
 workerUrl=managedFileReference({scope:"worker-assets",entityId:tenants[0].worker.id,fileName:"synthetic.pdf"});
 await prisma.baustelle.update({where:{id:tenants[0].site.id},data:{documents:[siteUrl]}});
 await prisma.worker.update({where:{id:tenants[0].worker.id},data:{documents:[{id:"synthetic-document",label:"Synthetic",url:workerUrl}]}});
});
afterEach(async()=>{await removeSecurityTenants(tenants.map(t=>t.company.id));vi.unstubAllEnvs();});
async function actor(role:"admin"|"worker",index:number){request.values.clear();request.values.set(role==="admin"?"bk_admin_id":"bk_worker_id",await createSessionCookie(role,tenants[index][role].id));}
const read=(url:string)=>GET(new Request(`http://127.0.0.1:3100${url}`));
it("anonymous private body read is denied before storage",async()=>{expect((await read(siteUrl)).status).toBe(401);expect(storage.read).not.toHaveBeenCalled();});
it.each(["admin","worker"] as const)("foreign %s cannot access site or worker document",async role=>{
 await actor(role,1);expect((await read(siteUrl)).status).toBe(404);expect((await read(workerUrl)).status).toBe(404);expect(storage.read).not.toHaveBeenCalled();
});
it.each(["admin","worker"] as const)("own %s can access assigned site and own worker document",async role=>{
 await actor(role,0);for(const url of [siteUrl,workerUrl]){const response=await read(url);expect(response.status).toBe(200);expect(await response.text()).toContain("private");expect(response.headers.get("cache-control")).toContain("no-store");}
});
it("same-company coworker cannot access private worker documents",async()=>{
 const colleague=await prisma.worker.create({data:{companyProfileId:tenants[0].company.id,firstName:"Colleague",lastName:"Synthetic"}});
 request.values.set("bk_worker_id",await createSessionCookie("worker",colleague.id));expect((await read(workerUrl)).status).toBe(404);expect(storage.read).not.toHaveBeenCalled();
});
it("guessed/traversed and metadata-deleted objects are denied",async()=>{
 await actor("admin",0);const guessed=siteUrl.replace("synthetic.pdf","guessed.pdf");expect((await read(guessed)).status).toBe(404);
 expect((await read(siteUrl.replace("synthetic.pdf","..%2Fforeign.pdf"))).status).toBe(404);
 await prisma.baustelle.update({where:{id:tenants[0].site.id},data:{documents:[]}});expect((await read(siteUrl)).status).toBe(404);expect(storage.read).not.toHaveBeenCalled();
});
it("revoked session cannot read an otherwise attached object",async()=>{
 await actor("admin",0);await prisma.user.update({where:{id:tenants[0].admin.id},data:{sessionEpoch:{increment:1}}});expect((await read(siteUrl)).status).toBe(401);expect(storage.read).not.toHaveBeenCalled();
});
it("missing storage body returns safe denial",async()=>{await actor("admin",0);storage.read.mockResolvedValueOnce(new Response("missing",{status:404}));expect((await read(siteUrl)).status).toBe(404);});
