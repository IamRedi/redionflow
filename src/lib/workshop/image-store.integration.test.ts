import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { prisma, resetWorkshopFixture } from "../../../tests/workshop/shared-fixture";
import { demoOffice } from "./custody-schema";
import { ensureWorkshopDemo, workshopSnapshot, runWorkshopCommand, DEMO_WORKSPACE_KEY } from "./shared-store";
import { requestEquipmentImage } from "./image-store";
import { generateEquipmentImage } from "./image-provider";
import { uploadWorkshopFile } from "./shared-files";
vi.mock("./image-provider",async importOriginal=>({...await importOriginal<typeof import("./image-provider")>(),generateEquipmentImage:vi.fn()}));
const generated=vi.mocked(generateEquipmentImage);
beforeEach(async()=>{
  await resetWorkshopFixture(); vi.clearAllMocks();
  vi.stubEnv("APP_ENV","demo");vi.stubEnv("SAAS_MODE","false");vi.stubEnv("DEMO_PROFILE","baumdienst-workshop");vi.stubEnv("BAUMDIENST_IMAGE_AI_ENABLED","true");vi.stubEnv("BAUMDIENST_IMAGE_OPENAI_API_KEY","synthetic-never-sent");
  generated.mockResolvedValue(await sharp({create:{width:16,height:16,channels:3,background:"#487944"}}).webp().toBuffer());
});
afterAll(async()=>{vi.unstubAllEnvs();await prisma.$disconnect();});
async function register(name:string) {const row=await ensureWorkshopDemo(),id=randomUUID();await runWorkshopCommand({requestId:randomUUID(),revision:row.revision,command:{type:"register",assetId:id,name,inspection:"2027-11-05",details:{category:"tool",manufacturer:"",model:"",serial:"",note:""}}},demoOffice);return id;}
describe("demo image ledger in disposable Postgres",()=>{
  it("persists images, reuses identical subject cache and never overwrites a photo",async()=>{
    const first=await register("DEMO · Trimmer"),second=await register("DEMO · Trimmer"),requestId=randomUUID();
    expect((await requestEquipmentImage(first,requestId,demoOffice)).status).toBe("ready");
    expect((await requestEquipmentImage(first,requestId,demoOffice)).status).toBe("ready");
    expect((await requestEquipmentImage(second,randomUUID(),demoOffice)).status).toBe("ready");
    expect(generated).toHaveBeenCalledTimes(1);let s=await workshopSnapshot();expect(s.illustrations?.filter(i=>new Set<string>([first,second]).has(i.assetId))).toHaveLength(2);expect(new Set(s.illustrations?.map(i=>i.url)).size).toBe(1);
    const photo=await sharp({create:{width:16,height:16,channels:3,background:"#905137"}}).png().toBuffer();const company=await prisma.companyProfile.findFirstOrThrow();
    await uploadWorkshopFile({requestId:randomUUID(),revision:s.revision,kind:"asset",target:first},new File([photo],"DEMO-own.png",{type:"image/png"}),company.id,demoOffice);
    expect((await requestEquipmentImage(first,randomUUID(),demoOffice)).status).toBe("photo");s=await workshopSnapshot();expect(s.photos.some(p=>p.target===first)).toBe(true);expect(generated).toHaveBeenCalledTimes(1);
  });
  it("serializes reservations across requests and retains a photo arriving during generation",async()=>{
    const first=await register("DEMO · Saw"),second=await register("DEMO · Blower"),receipt=randomUUID();let finish!:(value:Buffer<ArrayBuffer>)=>void;
    generated.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const running=requestEquipmentImage(first,receipt,demoOffice);
    await vi.waitFor(()=>expect(generated).toHaveBeenCalledTimes(1));
    expect((await requestEquipmentImage(first,receipt,demoOffice)).status).toBe("pending");
    await expect(requestEquipmentImage(second,randomUUID(),demoOffice)).rejects.toMatchObject({code:"aiBusy",status:429});
    const s=await workshopSnapshot(),company=await prisma.companyProfile.findFirstOrThrow(),photo=await sharp({create:{width:16,height:16,channels:3,background:"#905137"}}).png().toBuffer();
    await uploadWorkshopFile({requestId:randomUUID(),revision:s.revision,kind:"asset",target:first},new File([photo],"DEMO-during.png",{type:"image/png"}),company.id,demoOffice);
    finish(await sharp(photo).webp().toBuffer());await running;expect((await workshopSnapshot()).photos.some(p=>p.target===first)).toBe(true);expect(await prisma.baumdienstDemoImageGeneration.count()).toBe(1);
  });
  it("counts failures, caps twenty per UTC day, keeps receipts and allows a new day beyond fifty total",async()=>{
    const first=await register("DEMO · Test"),receipt=randomUUID();generated.mockRejectedValueOnce(new Error("do-not-log-this-provider-body"));
    expect((await requestEquipmentImage(first,receipt,demoOffice)).status).toBe("error");await requestEquipmentImage(first,receipt,demoOffice);expect(generated).toHaveBeenCalledTimes(1);
    const base={workspaceKey:DEMO_WORKSPACE_KEY,fingerprint:"synthetic",assetId:first,actorKey:"admin",model:"synthetic",style:"synthetic",status:"error"};
    await prisma.baumdienstDemoImageGeneration.createMany({data:Array.from({length:19},()=>({...base,id:randomUUID()}))});
    await expect(requestEquipmentImage(first,randomUUID(),demoOffice)).rejects.toMatchObject({code:"aiLimit"});
    await prisma.baumdienstDemoImageGeneration.updateMany({data:{startedAt:new Date("2026-01-01")}});
    await prisma.baumdienstDemoImageGeneration.createMany({data:Array.from({length:45},()=>({...base,id:randomUUID(),startedAt:new Date("2026-01-01")}))});
    expect((await requestEquipmentImage(first,randomUUID(),demoOffice)).status).toBe("ready");expect(generated).toHaveBeenCalledTimes(2);
  });
  it("blocks workers and non-Muster profiles before calling the provider",async()=>{
    const first=await register("DEMO · Test"),s=await workshopSnapshot(),worker=s.directory.workers[0];
    await expect(requestEquipmentImage(first,randomUUID(),{key:worker.key,role:"worker",name:worker.name})).rejects.toMatchObject({code:"permission",status:403});
    vi.stubEnv("DEMO_PROFILE","another-company");await expect(requestEquipmentImage(first,randomUUID(),demoOffice)).rejects.toMatchObject({status:404});expect(generated).not.toHaveBeenCalled();
  });
});
