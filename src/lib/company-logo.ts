/**
 * Company logos are small images stored as data: URLs on CompanyProfile and
 * only ever rendered through <img>, so an SVG cannot run scripts. The size
 * cap keeps every page render cheap.
 */
export const COMPANY_LOGO_MAX_BYTES = 150 * 1024;
export const COMPANY_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;

export type CompanyLogoCheck = { ok: true; dataUrl: string } | { ok: false; reason: "type" | "size" | "empty" };

export function companyLogoDataUrl(mimeType: string, bytes: Uint8Array): CompanyLogoCheck {
  if (bytes.byteLength === 0) return { ok: false, reason: "empty" };
  if (!(COMPANY_LOGO_TYPES as readonly string[]).includes(mimeType)) return { ok: false, reason: "type" };
  if (bytes.byteLength > COMPANY_LOGO_MAX_BYTES) return { ok: false, reason: "size" };
  if (mimeType === "image/svg+xml") {
    const text = new TextDecoder().decode(bytes);
    if (!/<svg[\s>]/i.test(text)) return { ok: false, reason: "type" };
  }
  return { ok: true, dataUrl: `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}` };
}

/** Accept only data URLs this module would produce; anything else is dropped. */
export function safeCompanyLogo(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,[A-Za-z0-9+/=]+$/.exec(value);
  if (!match) return null;
  if (value.length > Math.ceil((COMPANY_LOGO_MAX_BYTES * 4) / 3) + 64) return null;
  return value;
}
