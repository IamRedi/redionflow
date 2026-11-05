/**
 * Checks an uploaded site file by its first bytes, not by the name or the
 * type the browser claims, and returns the type the server will send back.
 */

export const SITE_FILE_MAX_BYTES = 15_000_000;

export type SiteFileKind = "document" | "photo" | "order" | "invoice";

export function sniffSiteFileMime(bytes: Uint8Array, fileName: string): string | null {
  const head = (n: number) => Array.from(bytes.slice(0, n));
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0x52, 0x49, 0x46, 0x46]) && String.fromCharCode(...head(12).slice(8)) === "WEBP") return "image/webp";
  if (starts([0x50, 0x4b, 0x03, 0x04])) {
    const ext = fileName.toLowerCase().split(".").pop();
    if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return null;
}

export function allowedForKind(mime: string, kind: SiteFileKind) {
  if (kind === "photo") return mime.startsWith("image/");
  if (kind === "order") return mime === "application/pdf";
  return true;
}

export function safeFileName(name: string) {
  const cleaned = name.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim();
  return (cleaned || "file").slice(0, 120);
}
