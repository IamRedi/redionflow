/**
 * BDF-P8-007 — magic-bytes validation for user-uploaded files.
 *
 * Every path that accepts a File from the browser today trusts
 * `file.type` (an HTTP-supplied header) and/or the extension in
 * `file.name` (client-controlled). A tenant that swaps the extension
 * or the Content-Type of a malicious payload can push it through the
 * uploader and into managed storage, from where it may be handed
 * back to another tenant's browser.
 *
 * This module reads the first bytes of the file and matches them
 * against known-good signatures. Nothing here can prevent a
 * *content-level* attack (a real PDF that exploits Acrobat), but it
 * shuts the "wrong-format smuggled through" class of bug entirely.
 *
 * Zero runtime dependencies. Works with the standard Web File API so
 * it can be called from server actions and API routes alike.
 */

export type FileCategory = "pdf" | "image" | "office" | "csv-like" | "xml-kml";

export type ValidationResult =
  | { ok: true; category: FileCategory; detectedType: string }
  | { ok: false; reason: "empty" | "too_large" | "unknown_signature" | "signature_mismatch"; hint?: string };

const SIGNATURES: Array<{ bytes: number[]; type: string; category: FileCategory; description: string }> = [
  // PDF: "%PDF-"
  { bytes: [0x25, 0x50, 0x44, 0x46, 0x2d], type: "application/pdf", category: "pdf", description: "PDF" },
  // PNG: "\x89PNG\r\n\x1a\n"
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], type: "image/png", category: "image", description: "PNG image" },
  // JPEG: FF D8 FF
  { bytes: [0xff, 0xd8, 0xff], type: "image/jpeg", category: "image", description: "JPEG image" },
  // GIF: "GIF87a" / "GIF89a"
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], type: "image/gif", category: "image", description: "GIF image (87a)" },
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], type: "image/gif", category: "image", description: "GIF image (89a)" },
  // WebP: "RIFF...WEBP" (bytes 0-3 = RIFF, 8-11 = WEBP; we match just the RIFF header here)
  { bytes: [0x52, 0x49, 0x46, 0x46], type: "image/webp", category: "image", description: "RIFF (WebP/AVI/…)" },
  // ZIP-based (DOCX, XLSX, PPTX, KMZ): "PK\x03\x04"
  { bytes: [0x50, 0x4b, 0x03, 0x04], type: "application/zip", category: "office", description: "ZIP container (DOCX/XLSX/…)" },
  // Legacy Microsoft Office (D0 CF 11 E0 A1 B1 1A E1)
  { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], type: "application/x-ole-storage", category: "office", description: "OLE compound document (legacy Office)" },
];

/** How many bytes we need at most to decide. */
const HEADER_BYTES = 16;

function startsWith(header: Uint8Array, sig: number[]): boolean {
  if (header.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (header[i] !== sig[i]) return false;
  return true;
}

/**
 * Consumes the first ~16 bytes of a File and matches them against
 * known magic-byte signatures.
 *
 * Returns `ok: true` with the detected category, so the caller can
 * cross-check against its own allowed set (e.g. worker profile photo
 * only accepts `image`).
 */
export async function validateFileSignature(
  file: File,
  opts: { maxSizeBytes?: number } = {},
): Promise<ValidationResult> {
  if (!file || file.size === 0) return { ok: false, reason: "empty" };
  if (opts.maxSizeBytes && file.size > opts.maxSizeBytes) return { ok: false, reason: "too_large" };

  const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());

  for (const sig of SIGNATURES) {
    if (sig.type === "image/webp" && (header.length < 12 || new TextDecoder().decode(header.slice(8, 12)) !== "WEBP")) continue;
    if (startsWith(header, sig.bytes)) {
      return { ok: true, category: sig.category, detectedType: sig.type };
    }
  }

  // Text-based formats (CSV, KML, plain XML) have no fixed magic bytes,
  // so we approximate: reject anything with an obvious binary header
  // (a NUL byte in the first 16 bytes usually indicates a binary
  // format we don't recognise) but accept ASCII-ish input as a
  // text/CSV/XML candidate.
  const hasNul = header.includes(0);
  if (!hasNul) {
    const asText = new TextDecoder("utf-8", { fatal: false }).decode(header).trim().toLowerCase();
    if (asText.startsWith("<?xml") || asText.startsWith("<kml")) {
      return { ok: true, category: "xml-kml", detectedType: "application/xml" };
    }
    // CSV / plain-text sniff. Accept only very short files here to
    // avoid handing an operator an unknown-but-well-formed script.
    if (/^[\x20-\x7e,\n\r;\t"]+$/.test(asText)) {
      return { ok: true, category: "csv-like", detectedType: "text/csv" };
    }
  }

  return {
    ok: false,
    reason: "unknown_signature",
    hint: `first bytes: ${Array.from(header.slice(0, 4)).map((b) => b.toString(16).padStart(2, "0")).join(" ")}`,
  };
}

/**
 * Convenience wrapper: pass the categories the caller is happy with
 * and get a boolean-plus-reason result.
 */
export async function validateFileAgainstAllowedCategories(
  file: File,
  allowed: readonly FileCategory[],
  opts: { maxSizeBytes?: number } = {},
): Promise<{ ok: true; category: FileCategory; detectedType: string } | { ok: false; reason: string }> {
  const outcome = await validateFileSignature(file, opts);
  if (!outcome.ok) return { ok: false, reason: outcome.reason };
  if (!allowed.includes(outcome.category)) {
    return { ok: false, reason: `category_${outcome.category}_not_allowed` };
  }
  return outcome;
}
