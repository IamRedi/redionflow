import { afterEach, expect, it, vi } from "vitest";
import { validateManagedUpload } from "./upload-validation";
import { managedFileReference, parseManagedReference } from "./managed-reference";
afterEach(() => vi.unstubAllEnvs());
const pdf = (name = "synthetic.pdf", type = "application/pdf") => new File(["%PDF-1.4\nsynthetic"],name,{type});
it("allows correctly labelled PDF under explicit NoOp, without claiming scanning", async () => {
  vi.stubEnv("CONTENT_SCANNER","none"); expect(await validateManagedUpload(pdf(),"worker-assets")).toBe("application/pdf");
});
it("denies declared MIME and byte mismatches",async()=>{
  await expect(validateManagedUpload(pdf("photo.png","image/png"),"worker-assets")).rejects.toThrow("bytes");
  await expect(validateManagedUpload(pdf("synthetic.pdf","image/png"),"baustelle-documents")).rejects.toThrow("Declared");
});
it.each(["../file.pdf","folder/file.pdf","folder\\file.pdf","evil\n.pdf","bad.exe"])("denies malicious/unsupported filename %s",async name=>{
  await expect(validateManagedUpload(pdf(name),"worker-assets")).rejects.toThrow();
});
it("enforces size before upload",async()=>{
  const file=pdf(); Object.defineProperty(file,"size",{value:20_000_001});
  await expect(validateManagedUpload(file,"baustelle-documents")).rejects.toThrow("too_large");
});
it("canonical references do not accept path guessing/traversal/duplicate query keys",()=>{
  const ref={scope:"baustelle-documents" as const,entityId:"site-a",fileName:"file.pdf"};
  expect(parseManagedReference(managedFileReference(ref))).toEqual(ref);
  for (const fileName of ["../x.pdf","%2e%2e.pdf","x/y.pdf"]) expect(()=>managedFileReference({...ref,fileName})).toThrow();
  expect(parseManagedReference(managedFileReference(ref)+"&entityId=site-b")).toBeNull();
});
it("RIFF AVI cannot masquerade as WebP",async()=>{
  const file=new File(["RIFFxxxxAVI "],"fake.webp",{type:"image/webp"});
  await expect(validateManagedUpload(file,"worker-assets")).rejects.toThrow();
});
