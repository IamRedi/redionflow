import { describe, expect, it } from "vitest";
import { validateFileAgainstAllowedCategories, validateFileSignature } from "./file-validation";

function makeFile(name: string, bytes: number[], mime = "application/octet-stream"): File {
  return new File([new Uint8Array(bytes)], name, { type: mime });
}

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]; // "%PDF-1.4"
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];
const DOCX_HEADER = [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00];
// "not-a-real-file" — just ASCII text with a NUL byte in the middle so
// the text-sniff path rejects it.
const BINARY_JUNK = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07];

describe("validateFileSignature", () => {
  it("accepts a real PDF header regardless of the reported MIME", async () => {
    const file = makeFile("report.pdf", PDF_HEADER, "text/plain");
    const outcome = await validateFileSignature(file);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.category).toBe("pdf");
      expect(outcome.detectedType).toBe("application/pdf");
    }
  });

  it("accepts a PNG header", async () => {
    const outcome = await validateFileSignature(makeFile("photo.png", PNG_HEADER, "image/png"));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.category).toBe("image");
  });

  it("accepts a JPEG header", async () => {
    const outcome = await validateFileSignature(makeFile("photo.jpg", JPEG_HEADER, "image/jpeg"));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.detectedType).toBe("image/jpeg");
  });

  it("accepts a DOCX (ZIP-based) header", async () => {
    const outcome = await validateFileSignature(makeFile("cv.docx", DOCX_HEADER));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.category).toBe("office");
  });

  it("rejects unknown binary content — extension alone can't smuggle it through", async () => {
    // A file that claims to be a PDF but is actually binary junk.
    const outcome = await validateFileSignature(
      makeFile("evil.pdf", BINARY_JUNK, "application/pdf"),
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("unknown_signature");
  });

  it("rejects an empty file", async () => {
    const outcome = await validateFileSignature(makeFile("empty.pdf", []));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("empty");
  });

  it("enforces the size ceiling", async () => {
    const outcome = await validateFileSignature(makeFile("big.pdf", PDF_HEADER), { maxSizeBytes: 4 });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("too_large");
  });

  it("recognises XML/KML plain text", async () => {
    const xmlBytes = Array.from(new TextEncoder().encode("<?xml version=\"1.0\"?>"));
    const outcome = await validateFileSignature(makeFile("route.kml", xmlBytes));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.category).toBe("xml-kml");
  });

  it("recognises CSV plain text", async () => {
    const csvBytes = Array.from(new TextEncoder().encode("id,name,size\n1,alpha,3"));
    const outcome = await validateFileSignature(makeFile("data.csv", csvBytes));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.category).toBe("csv-like");
  });
});

describe("validateFileAgainstAllowedCategories", () => {
  it("rejects a valid file whose category is not on the allow-list", async () => {
    const outcome = await validateFileAgainstAllowedCategories(
      makeFile("photo.jpg", JPEG_HEADER),
      ["pdf", "office"],
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("category_image_not_allowed");
  });

  it("passes when the detected category matches an allowed one", async () => {
    const outcome = await validateFileAgainstAllowedCategories(
      makeFile("photo.jpg", JPEG_HEADER),
      ["image"],
    );
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.category).toBe("image");
  });

  it("propagates the underlying signature failure reason", async () => {
    const outcome = await validateFileAgainstAllowedCategories(
      makeFile("evil.jpg", BINARY_JUNK),
      ["image"],
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("unknown_signature");
  });
});
