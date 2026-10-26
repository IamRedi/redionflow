import {afterEach,expect,it,vi} from "vitest";
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.resetModules();});
async function moduleForStorage(publicBucket:boolean){
  vi.resetModules();vi.stubEnv("SUPABASE_URL","http://127.0.0.1:1/synthetic-storage");vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","synthetic-storage-key-only");vi.stubEnv("CONTENT_SCANNER","none");
  const fetcher=vi.fn(async()=>Response.json({public:publicBucket}));vi.stubGlobal("fetch",fetcher);
  return {storage:await import("./object-storage"),fetcher};
}
const file=()=>new File(["%PDF-1.4\nsynthetic"],"test.pdf",{type:"application/pdf"});
it("refuses public buckets before uploading private data",async()=>{
  const {storage,fetcher}=await moduleForStorage(true);
  await expect(storage.uploadManagedFile({scope:"worker-assets",entityId:"synthetic-worker",file:file(),fileName:"test.pdf"})).rejects.toThrow("Private storage bucket");
  expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0]).toHaveLength(2);
});
it("private writes use unique keys, no overwrite, and return only the application gateway",async()=>{
  const {storage,fetcher}=await moduleForStorage(false);
  const result=await storage.uploadManagedFile({scope:"worker-assets",entityId:"synthetic-worker",file:file(),fileName:"test.pdf"});
  expect(result).toMatch(/^\/api\/private-files\?/);expect(result).not.toContain("synthetic-storage-key");
  const options=(fetcher.mock.calls as unknown as [string,RequestInit][])[1][1];
  expect(options).toMatchObject({method:"POST",headers:{"x-upsert":"false","Content-Type":"application/pdf"}});
});
it("format failures never reach storage",async()=>{
  const {storage,fetcher}=await moduleForStorage(false);
  await expect(storage.uploadManagedFile({scope:"worker-assets",entityId:"synthetic-worker",file:new File(["%PDF-1.4"],"image.png",{type:"image/png"}),fileName:"image.png"})).rejects.toThrow("bytes");
  expect(fetcher).not.toHaveBeenCalled();
});
