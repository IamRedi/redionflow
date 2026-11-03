import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, expect, it } from "vitest";
import { decryptBackup, encryptBackup } from "./archive";
const keys = () => generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
const recipient = keys();
const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), "bauflow-backup-test-")); dirs.push(dir);
  const file = path.join(dir, "snapshot.enc"), decoded = path.join(dir, "decoded.dump");
  const plaintext = Buffer.from("PGDMP synthetic customer data\n".repeat(100));
  await encryptBackup(Readable.from(plaintext), file, recipient.publicKey, { createdAt: "2026-11-03T12:00:00Z", tables: { Worker: 40, Machine: 37 } });
  return { dir, file, decoded, plaintext };
}
it("round-trips binary data and authenticated metadata without storing plaintext", async () => {
  const f = await fixture();
  expect((await readFile(f.file)).includes(f.plaintext)).toBe(false);
  expect(await decryptBackup(f.file, f.decoded, recipient.privateKey)).toMatchObject({ tables: { Worker: 40, Machine: 37 } });
  expect(await readFile(f.decoded)).toEqual(f.plaintext);
});
it.each(["ciphertext", "manifest", "tag"])("rejects changed %s and removes any partial plaintext", async kind => {
  const f = await fixture(); const bytes = await readFile(f.file);
  const at = kind === "ciphertext" ? bytes.length - 25 : kind === "tag" ? bytes.length - 1 : bytes.indexOf(Buffer.from('"Worker":40')) + 9;
  bytes[at] ^= 1; await writeFile(f.file, bytes);
  await expect(decryptBackup(f.file, f.decoded, recipient.privateKey)).rejects.toThrow();
  await expect(readFile(f.decoded)).rejects.toThrow();
});
it("rejects the wrong private key", async () => {
  const f = await fixture(); await expect(decryptBackup(f.file, f.decoded, keys().privateKey)).rejects.toThrow();
});
it("preserves an existing destination on failure", async () => {
  const f = await fixture(); await writeFile(f.decoded, "existing owner file");
  await expect(decryptBackup(f.file, f.decoded, recipient.privateKey)).rejects.toThrow();
  expect(await readFile(f.decoded, "utf8")).toBe("existing owner file");
});
it("does not publish an archive when pg_dump fails", async () => {
  const f = await fixture(); const output = path.join(f.dir, "failed.enc");
  await expect(encryptBackup(Readable.from("incomplete"), output, recipient.publicKey, { createdAt: "now", tables: {} }, Promise.reject(new Error("dump failed")))).rejects.toThrow();
  await expect(readFile(output)).rejects.toThrow();
});
