import { validateFileSignature } from "./file-validation";
import { scanFileContent } from "./content-scan";
import type { StorageScope } from "./managed-reference";

const mimeByExtension: Record<string, string> = {
  pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",
  doc:"application/msword",xls:"application/vnd.ms-excel",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv:"text/csv",xml:"application/xml",kml:"application/vnd.google-earth.kml+xml",
};
export class UploadValidationError extends Error {}

export async function validateManagedUpload(file: File, scope: StorageScope): Promise<string> {
  if (/[\\/\x00-\x1f\x7f]/.test(file.name) || file.name.includes("..")) throw new UploadValidationError("Invalid upload filename.");
  const ext=file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime=mimeByExtension[ext];
  if (!mime) throw new UploadValidationError("Unsupported upload type.");
  const declared=file.type.split(";")[0].trim().toLowerCase();
  if (declared && declared !== mime && !(ext === "xml" && declared === "text/xml")) throw new UploadValidationError("Declared upload type does not match filename.");
  const result=await validateFileSignature(file,{maxSizeBytes:scope === "worker-assets" ? 15_000_000 : 20_000_000});
  if (!result.ok) throw new UploadValidationError(`Upload refused: ${result.reason}`);
  const valid=result.detectedType===mime ||
    (result.detectedType === "application/zip" && ["docx","xlsx","pptx"].includes(ext)) ||
    (result.detectedType === "application/x-ole-storage" && ["doc","xls"].includes(ext)) ||
    (result.category === "xml-kml" && ["xml","kml"].includes(ext));
  if (!valid || (scope === "worker-assets" && ["csv","xml","kml"].includes(ext))) throw new UploadValidationError("Upload bytes do not match the allowed type.");
  const scan=await scanFileContent(file);
  if (!scan.ok) throw new UploadValidationError("Upload refused by content scanner.");
  return mime;
}
