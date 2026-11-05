import { describe, expect, it } from "vitest";

import { COMPANY_LOGO_MAX_BYTES, companyLogoDataUrl, safeCompanyLogo } from "./company-logo";

const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>');

describe("company logo", () => {
  it("turns an allowed image into a data URL", () => {
    const result = companyLogoDataUrl("image/svg+xml", svg);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dataUrl.startsWith("data:image/svg+xml;base64,")).toBe(true);
      expect(safeCompanyLogo(result.dataUrl)).toBe(result.dataUrl);
    }
  });

  it("rejects other types, empty files, oversize files and fake SVG", () => {
    expect(companyLogoDataUrl("text/html", svg)).toEqual({ ok: false, reason: "type" });
    expect(companyLogoDataUrl("image/png", new Uint8Array())).toEqual({ ok: false, reason: "empty" });
    expect(companyLogoDataUrl("image/png", new Uint8Array(COMPANY_LOGO_MAX_BYTES + 1))).toEqual({ ok: false, reason: "size" });
    expect(companyLogoDataUrl("image/svg+xml", new TextEncoder().encode("hello"))).toEqual({ ok: false, reason: "type" });
  });

  it("only renders well-formed image data URLs", () => {
    expect(safeCompanyLogo(null)).toBeNull();
    expect(safeCompanyLogo("https://evil.example/logo.png")).toBeNull();
    expect(safeCompanyLogo("data:text/html;base64,PGgxPg==")).toBeNull();
    expect(safeCompanyLogo("data:image/png;base64,iVBORw0KGgo=")).toBe("data:image/png;base64,iVBORw0KGgo=");
  });
});
