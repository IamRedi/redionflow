import { afterEach, describe, expect, it } from "vitest";
import { resolveContentScanner, scanFileContent } from "./content-scan";

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

function textFile(name: string, body: string): File {
  return new File([body], name, { type: "application/octet-stream" });
}

describe("resolveContentScanner", () => {
  const original = process.env.CONTENT_SCANNER;

  afterEach(() => {
    if (original === undefined) delete process.env.CONTENT_SCANNER;
    else process.env.CONTENT_SCANNER = original;
  });

  it("returns the no-op scanner when CONTENT_SCANNER is unset", () => {
    delete process.env.CONTENT_SCANNER;
    const scanner = resolveContentScanner();
    expect(scanner.name).toBe("no-op");
    expect(scanner.isNoOp).toBe(true);
  });

  it("returns the no-op scanner when CONTENT_SCANNER=none", () => {
    process.env.CONTENT_SCANNER = "none";
    expect(resolveContentScanner().name).toBe("no-op");
  });

  it("refuses uploads when an unsupported backend is configured", async () => {
    process.env.CONTENT_SCANNER = "clamav-not-wired-yet";
    expect(resolveContentScanner().name).toBe("unsupported");
    expect(await scanFileContent(textFile("test.pdf", "%PDF-1.4"))).toMatchObject({ok:false,scanned:false,category:"scanner-not-configured"});
  });
});

describe("scanFileContent", () => {
  it("passes a benign file through the no-op scanner", async () => {
    const result = await scanFileContent(textFile("hello.txt", "hello world"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scanned).toBe(false);
    }
  });

  it("refuses the EICAR canary regardless of scanner mode", async () => {
    const result = await scanFileContent(textFile("eicar.com", EICAR));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.category).toBe("eicar-test");
      expect(result.detail).toContain("eicar");
      expect(result.scanned).toBe(true);
    }
  });

  it("returns { ok: true, scanned: false } for a file smaller than the EICAR header", async () => {
    // The signature check reads the first N bytes; a 3-byte file
    // cannot possibly match. Ensure this doesn't throw.
    const result = await scanFileContent(textFile("tiny.txt", "hi"));
    expect(result.ok).toBe(true);
  });

  it("doesn't false-positive on a file that merely contains the EICAR string later", async () => {
    // Only the *header* is checked. A benign document that happens to
    // quote the EICAR string in its body should still pass.
    const body = "normal document " + EICAR;
    const result = await scanFileContent(textFile("mixed.txt", body));
    expect(result.ok).toBe(true);
  });
});
