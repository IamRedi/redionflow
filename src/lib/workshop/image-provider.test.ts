import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { createWorkshopDemo } from "./demo-data";
import { generateEquipmentImage } from "./image-provider";
import { imageEnabled, imageIdentity, imagePrompt, imageSubject, IMAGE_MODEL, quotaAvailable } from "./image-identity";
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
const asset=()=>({...createWorkshopDemo().assets[0],name:"  Akku-Freischneider  ",details:{category:"tool" as const,manufacturer:"Example",model:"B 42",serial:"SECRET-SERIAL",note:"PRIVATE-NOTE"}});
describe("bounded studio generation",()=>{
  it("sends only bounded visual descriptors, excluding operational identifiers",()=>{
    const a=asset(), subject=imageSubject(a), prompt=imagePrompt(a);
    expect(subject).toEqual({name:"Akku-Freischneider",category:"tool",manufacturer:"Example",model:"B 42"});
    for(const value of [a.code,a.id,"SECRET-SERIAL","PRIVATE-NOTE"])expect(prompt).not.toContain(value);
    expect(imageIdentity(a)).toBe(imageIdentity({...a,name:"akku-freischneider",code:"other",details:{...a.details,serial:"OTHER"}}));
    expect(imageIdentity({...a,name:"Kettensäge"})).not.toBe(imageIdentity(a));
  });
  it("requires a separate explicit demo switch and key",()=>{
    vi.stubEnv("OPENAI_API_KEY","operational-key-must-not-enable-demo");vi.stubEnv("BAUMDIENST_IMAGE_AI_ENABLED","");vi.stubEnv("BAUMDIENST_IMAGE_OPENAI_API_KEY","");expect(imageEnabled()).toBe(false);
    vi.stubEnv("BAUMDIENST_IMAGE_AI_ENABLED","true");expect(imageEnabled()).toBe(false);
    vi.stubEnv("BAUMDIENST_IMAGE_OPENAI_API_KEY","synthetic-test-only");expect(imageEnabled()).toBe(true);
  });
  it("enforces UTC daily and lifetime attempt caps including failed requests",()=>{
    const now=new Date("2026-11-05T00:00:01Z"),today={startedAt:now},yesterday={startedAt:new Date("2026-11-04T23:59:59Z")};
    expect(quotaAvailable(Array(4).fill(today),now)).toBe(true);expect(quotaAvailable(Array(5).fill(today),now)).toBe(false);
    expect(quotaAvailable(Array(49).fill(yesterday),now)).toBe(true);expect(quotaAvailable(Array(50).fill(yesterday),now)).toBe(false);
  });
  it("makes exactly one fixed-model raster request and compacts the result",async()=>{
    vi.stubEnv("BAUMDIENST_IMAGE_OPENAI_API_KEY","synthetic-test-only");
    const bytes=await sharp({create:{width:16,height:16,channels:3,background:"#487944"}}).png().toBuffer();
    const fetcher=vi.fn().mockResolvedValue(Response.json({data:[{b64_json:bytes.toString("base64")}]}));vi.stubGlobal("fetch",fetcher);
    const result=await generateEquipmentImage(asset());expect((await sharp(result).metadata()).format).toBe("webp");expect(result.length).toBeLessThanOrEqual(180000);
    expect(fetcher).toHaveBeenCalledTimes(1);const [url,options]=fetcher.mock.calls[0];expect(url).toBe("https://api.openai.com/v1/images/generations");expect(JSON.parse(options.body)).toMatchObject({model:IMAGE_MODEL,n:1,quality:"medium",complexity:"low",size:"1024x1024"});expect(options.redirect).toBe("error");
  });
  it.each([401,429,500])("does not retry or expose a provider error body (%s)",async(status)=>{
    vi.stubEnv("BAUMDIENST_IMAGE_OPENAI_API_KEY","synthetic-test-only");const fetcher=vi.fn().mockResolvedValue(new Response("private provider diagnostic",{status}));vi.stubGlobal("fetch",fetcher);
    await expect(generateEquipmentImage(asset())).rejects.toThrow(status===500 ? "aiFailed":"aiUnavailable");expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([{data:[{url:"https://untrusted.invalid/picture"}]},{data:[{b64_json:Buffer.from('<svg onload="alert(1)"/>').toString("base64")}]},{data:[{b64_json:"!!!!"}]},{data:[{b64_json:"AAAA"},{b64_json:"AAAA"}]}])("rejects external URLs, XML, malformed or multiple outputs",async(body)=>{
    vi.stubEnv("BAUMDIENST_IMAGE_OPENAI_API_KEY","synthetic-test-only");const fetcher=vi.fn().mockResolvedValue(Response.json(body));vi.stubGlobal("fetch",fetcher);await expect(generateEquipmentImage(asset())).rejects.toThrow("aiFailed");expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
