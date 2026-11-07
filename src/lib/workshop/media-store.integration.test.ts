import { randomUUID } from "node:crypto";
import { afterAll,beforeEach,describe,expect,it,vi } from "vitest";
import sharp from "sharp";
import { prisma,resetWorkshopFixture } from "../../../tests/workshop/shared-fixture";
import { demoOffice } from "./custody-schema";
import { changeDemoMedia,readMediaState } from "./media-store";
import { DEMO_BRAND_TARGET,mediaKey,mediaPreference,orderMedia,type MediaCommand } from "./media";
import { DEMO_WORKSPACE_KEY,ensureWorkshopDemo,workshopSnapshot } from "./shared-store";
import { uploadWorkshopFile } from "./shared-files";
import { requestCoverImage,requestEquipmentImage } from "./image-store";
import { generateEquipmentImage,generateStudioImage } from "./image-provider";
vi.mock("./image-provider",async original=>({...await original<typeof import("./image-provider")>(),generateEquipmentImage:vi.fn(),generateStudioImage:vi.fn()}));
beforeEach(async()=>{await resetWorkshopFixture();vi.clearAllMocks();vi.stubEnv("APP_ENV","demo");vi.stubEnv("SAAS_MODE","false");vi.stubEnv("DEMO_PROFILE","baumdienst-workshop");vi.stubEnv("BAUMDIENST_IMAGE_AI_ENABLED","true");vi.stubEnv("BAUMDIENST_IMAGE_OPENAI_API_KEY","synthetic-never-sent");const bytes=await sharp({create:{width:16,height:16,channels:3,background:"#0c2b35"}}).webp().toBuffer();vi.mocked(generateEquipmentImage).mockResolvedValue(bytes);vi.mocked(generateStudioImage).mockResolvedValue(bytes);});
afterAll(async()=>{vi.unstubAllEnvs();await prisma.$disconnect();});
async function upload(target:string,color:string,kind:"asset"|"site"="asset") {const s=await workshopSnapshot(),company=await prisma.companyProfile.findFirstOrThrow(),bytes=await sharp({create:{width:32,height:32,channels:3,background:color}}).png().toBuffer();return uploadWorkshopFile({requestId:randomUUID(),revision:s.revision,kind,target},new File([bytes],"DEMO.png",{type:"image/png"}),company.id,demoOffice);}
async function change(command:MediaCommand){const s=await workshopSnapshot();return changeDemoMedia({requestId:randomUUID(),revision:s.revision,command},demoOffice);}
describe("recoverable Musterfirma media",()=>{
  it("deduplicates uploads and preserves original bytes, records and explicit cover across remove/restore",async()=>{
    await ensureWorkshopDemo();await upload("crane","#254839");let s=await upload("crane","#254839");expect(s.photos).toHaveLength(1);
    const first=s.photos[0].id,original=await prisma.baumdienstDemoFile.findUniqueOrThrow({where:{id:first}});
    s=await upload("crane","#864123");const second=s.photos.find(p=>p.id!==first)!.id,business=structuredClone(s.state);
    s=await change({kind:"asset",target:"crane",action:"cover",mediaId:first});expect(orderMedia(s.photos,mediaPreference(s.mediaPreferences,{kind:"asset",target:"crane"}))[0].id).toBe(first);
    const receipt=randomUUID(),envelope={requestId:receipt,revision:s.revision,command:{kind:"asset" as const,target:"crane",action:"remove" as const,mediaId:first}};
    s=await changeDemoMedia(envelope,demoOffice);const revision=s.revision;expect(orderMedia(s.photos,mediaPreference(s.mediaPreferences,{kind:"asset",target:"crane"}))[0].id).toBe(second);
    expect((await changeDemoMedia(envelope,demoOffice)).revision).toBe(revision);
    s=await change({kind:"asset",target:"crane",action:"restore",mediaId:first});expect(s.state).toEqual(business);expect(s.photos).toHaveLength(2);
    expect(Buffer.from((await prisma.baumdienstDemoFile.findUniqueOrThrow({where:{id:first}})).data)).toEqual(Buffer.from(original.data));
    expect((await readMediaState(prisma)).events.filter(e=>e.action==="remove")).toHaveLength(1);
  });
  it("rejects other targets, worker changes, stale races and foreign profiles",async()=>{
    await ensureWorkshopDemo();let s=await upload("crane","#254839");const file=s.photos[0].id;
    await expect(change({kind:"asset",target:"chipper",action:"remove",mediaId:file})).rejects.toMatchObject({status:404});
    const command={kind:"asset" as const,target:"crane",action:"remove" as const,mediaId:file},envelope={requestId:randomUUID(),revision:s.revision,command};
    await expect(changeDemoMedia(envelope,{key:"worker",name:"Demo",role:"worker"})).rejects.toMatchObject({status:403});
    const race=await Promise.allSettled([changeDemoMedia(envelope,demoOffice),changeDemoMedia({...envelope,requestId:randomUUID()},demoOffice)]);expect(race.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(race.filter(r=>r.status==="rejected")[0]).toMatchObject({reason:{status:409}});
    s=await workshopSnapshot();vi.stubEnv("DEMO_PROFILE","another-company");await expect(changeDemoMedia({requestId:randomUUID(),revision:s.revision,command},demoOffice)).rejects.toMatchObject({status:404});
  });
  it("keeps generated provenance and quota receipts when an illustration is removed",async()=>{
    await ensureWorkshopDemo();expect((await requestEquipmentImage("chipper",randomUUID(),demoOffice)).status).toBe("ready");
    const s=await workshopSnapshot(),image=s.illustrations!.find(i=>i.assetId==="chipper")!;
    await change({kind:"asset",target:"chipper",action:"remove",mediaId:`generated:${image.id}`});
    expect(await prisma.baumdienstDemoImageGeneration.count({where:{workspaceKey:DEMO_WORKSPACE_KEY}})).toBe(1);
    await requestEquipmentImage("chipper",randomUUID(),demoOffice);expect(generateEquipmentImage).toHaveBeenCalledTimes(1);
    await change({kind:"asset",target:"chipper",action:"restore",mediaId:`generated:${image.id}`});
    expect((await readMediaState(prisma)).preferences.find(p=>p.key===mediaKey({kind:"asset",target:"chipper"}))?.hidden).toEqual([]);
  });
  it("uses the same bounded provider ledger for site covers and the demo emblem, preserving uploaded priority",async()=>{
    await ensureWorkshopDemo();const s=await workshopSnapshot(),site=s.directory.sites[0];
    expect((await requestCoverImage(site.key,randomUUID(),demoOffice,"site")).status).toBe("ready");
    expect((await requestCoverImage(DEMO_BRAND_TARGET,randomUUID(),demoOffice,"brand")).status).toBe("ready");
    const generated=await workshopSnapshot();expect(generated.illustrations?.map(i=>i.assetId)).toEqual(expect.arrayContaining([`site-cover:${site.key}`,DEMO_BRAND_TARGET]));
    await upload(DEMO_BRAND_TARGET,"#254839");expect((await requestCoverImage(DEMO_BRAND_TARGET,randomUUID(),demoOffice,"brand")).status).toBe("photo");
    await upload(site.id,"#254839","site");expect((await requestCoverImage(site.key,randomUUID(),demoOffice,"site")).status).toBe("photo");
    expect(generateStudioImage).toHaveBeenCalledTimes(2);expect(await prisma.baumdienstDemoImageGeneration.count()).toBe(2);
  });
});
