import sharp from "sharp";
import { expect, it } from "vitest";
import { validateManagedUpload } from "../storage/upload-validation";

it.each(["png", "jpeg", "webp"] as const)("patched native stack decodes/resizes existing %s image format", async format => {
  const source = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#127234" } }).toFormat(format).toBuffer();
  const { data, info } = await sharp(source).resize({ width: 16 }).webp().toBuffer({ resolveWithObject: true });
  expect(info).toMatchObject({ width: 16, height: 12, format: "webp" });
  expect(data.length).toBeGreaterThan(0);
  await expect(sharp(data).metadata()).resolves.toMatchObject({ width: 16, height: 12 });
});
it.each(["baustelle-documents", "worker-assets"] as const)("AVIF remains refused in %s uploads", async scope => {
  const file = new File([new Uint8Array([0,0,0,24,102,116,121,112,97,118,105,102])], "untrusted.avif", { type: "image/avif" });
  await expect(validateManagedUpload(file, scope)).rejects.toThrow("Unsupported upload type");
});
