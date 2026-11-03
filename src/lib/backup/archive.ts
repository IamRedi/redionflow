import { createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, constants, privateDecrypt, publicEncrypt, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { appendFile, open, readFile, rename, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

const MAGIC = "BAUFLOW-BACKUP-V1\n";
export type BackupManifest = { createdAt: string; tables: Record<string, number> };
type Header = { version: 1; algorithm: "AES-256-GCM+RSA-OAEP-SHA256"; recipient: string; iv: string; key: string; manifest: BackupManifest };
export function backupKeyFingerprint(pem: string) {
  return createHash("sha256").update(createPublicKey(pem).export({ type: "spki", format: "der" })).digest("hex");
}
export async function backupHash(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

/** Stream encryption: no plaintext dump is ever written during backup. */
export async function encryptBackup(input: Readable, output: string, recipientPem: string, manifest: BackupManifest, sourceCompleted: Promise<unknown> = Promise.resolve()) {
  void sourceCompleted.catch(() => {});
  const key = randomBytes(32), iv = randomBytes(12);
  const wrapped = publicEncrypt({ key: recipientPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key);
  const header: Header = { version: 1, algorithm: "AES-256-GCM+RSA-OAEP-SHA256", recipient: backupKeyFingerprint(recipientPem), iv: iv.toString("base64"), key: wrapped.toString("base64"), manifest };
  const prefix = Buffer.from(MAGIC + JSON.stringify(header) + "\n");
  const partial = `${output}.${randomBytes(8).toString("hex")}.partial`;
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(prefix);
  try {
    const destination = createWriteStream(partial, { flags: "wx", mode: 0o600 });
    destination.write(prefix);
    await pipeline(input, cipher, destination);
    await sourceCompleted;
    await appendFile(partial, cipher.getAuthTag());
    // Never replace a previous backup. Names include fresh random entropy.
    if (await stat(output).then(() => true, () => false)) throw new Error("Backup destination already exists");
    await rename(partial, output);
    return { file: output, sha256: await backupHash(output), bytes: (await stat(output)).size, recipient: header.recipient };
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  } finally { key.fill(0); }
}

/** Decrypt only to a private temporary directory, and verify GCM before restore. */
export async function decryptBackup(input: string, plaintext: string, privatePem: string) {
  const handle = await open(input, "r");
  let key: Buffer | undefined;
  let createdPlaintext = false;
  try {
    const size = (await handle.stat()).size;
    const first = Buffer.alloc(Math.min(size, 65_536));
    await handle.read(first, 0, first.length, 0);
    if (!first.subarray(0, MAGIC.length).equals(Buffer.from(MAGIC))) throw new Error("Invalid backup format");
    const newline = first.indexOf(10, MAGIC.length);
    if (newline < 0 || newline + 17 >= size) throw new Error("Invalid backup header");
    const prefix = first.subarray(0, newline + 1);
    const header = JSON.parse(first.subarray(MAGIC.length, newline).toString()) as Header;
    if (header.version !== 1 || header.algorithm !== "AES-256-GCM+RSA-OAEP-SHA256" || header.recipient !== backupKeyFingerprint(createPublicKey(createPrivateKey(privatePem)).export({ type: "spki", format: "pem" }).toString())) throw new Error("Invalid backup recipient");
    key = privateDecrypt({ key: privatePem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(header.key, "base64"));
    const tag = Buffer.alloc(16); await handle.read(tag, 0, 16, size - 16);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(header.iv, "base64"));
    decipher.setAAD(prefix); decipher.setAuthTag(tag);
    const destination = await open(plaintext, "wx", 0o600);
    createdPlaintext = true;
    try {
      await pipeline(createReadStream(input, { start: prefix.length, end: size - 17 }), decipher, destination.createWriteStream());
    } finally { await destination.close().catch(() => {}); }
    return header.manifest;
  } catch (error) {
    if (createdPlaintext) await rm(plaintext, { force: true });
    throw error;
  } finally { key?.fill(0); await handle.close(); }
}

export const readBackupKey = (file: string) => readFile(file, "utf8");
