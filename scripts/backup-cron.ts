/**
 * Nightly encrypted database backup that runs on Railway itself (cron
 * service), so it no longer depends on a laptop being switched on.
 *
 * 1. `scripts/database-backup.ts create` dumps the database over Railway's
 *    private network and encrypts it with the owner's PUBLIC key
 *    (AES-256-GCM + RSA-OAEP, same format as the laptop backups).
 * 2. The encrypted file goes to a private Railway bucket and is checked there.
 * 3. Copies older than BACKUP_RETENTION_DAYS (default 90) are removed.
 *
 * The private key never reaches Railway: nobody with bucket access can read
 * a backup. Restore and verify stay on the owner's machine (`backup:verify`).
 * Logs never contain connection details, keys or business data.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { DeleteObjectsCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { backupKeyFingerprint } from "../src/lib/backup/archive";
import { expiredBackupKeys, backupObjectKey } from "../src/lib/backup/bucket-retention";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

let phase = "configuration";

function runCreate(env: NodeJS.ProcessEnv) {
  return new Promise<{ file: string; sha256: string; bytes: number }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/database-backup.ts", "create"], { env, stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", (chunk: Buffer) => { out += chunk.toString("utf8"); });
    child.on("error", () => reject(new Error("backup create could not start")));
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error("backup create failed"));
      try {
        const line = out.trim().split("\n").pop() ?? "";
        const parsed = JSON.parse(line) as { file?: string; sha256?: string; bytes?: number };
        if (!parsed.file || !parsed.sha256 || !parsed.bytes) throw new Error();
        resolve({ file: parsed.file, sha256: parsed.sha256, bytes: parsed.bytes });
      } catch {
        reject(new Error("backup create returned no result"));
      }
    });
  });
}

async function main() {
  const bucket = required("AWS_S3_BUCKET_NAME");
  const publicKey = required("BACKUP_PUBLIC_KEY_PEM").replaceAll("\\n", "\n");
  const fingerprint = backupKeyFingerprint(publicKey); // throws on an invalid key
  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? 90);
  if (!Number.isInteger(retentionDays) || retentionDays < 7) throw new Error("BACKUP_RETENTION_DAYS must be at least 7");
  required("BACKUP_DATABASE_URL");
  required("BACKUP_EXPECTED_COMPANY_ID");

  const s3 = new S3Client({
    endpoint: required("AWS_ENDPOINT_URL"),
    region: process.env.AWS_DEFAULT_REGION || "auto",
    forcePathStyle: process.env.AWS_S3_URL_STYLE === "path",
    credentials: { accessKeyId: required("AWS_ACCESS_KEY_ID"), secretAccessKey: required("AWS_SECRET_ACCESS_KEY") },
  });

  const work = await mkdtemp(path.join(tmpdir(), "bauflow-backup-"));
  try {
    const keyFile = path.join(work, "recipient.pub.pem");
    await writeFile(keyFile, publicKey, { mode: 0o600 });
    phase = "create";
    const result = await runCreate({ ...process.env, BACKUP_PUBLIC_KEY_FILE: keyFile, BACKUP_OUTPUT_DIR: path.join(work, "out") });

    phase = "upload";
    const key = backupObjectKey(path.basename(result.file));
    await s3.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: await readFile(result.file), ContentType: "application/octet-stream",
      Metadata: { sha256: result.sha256, recipient: fingerprint },
    }));
    phase = "upload-check";
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (head.ContentLength !== result.bytes || head.Metadata?.sha256 !== result.sha256) throw new Error("uploaded copy does not match");

    phase = "retention";
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: "bauflow/" }));
    const expired = expiredBackupKeys((listed.Contents ?? []).map(o => ({ key: o.Key ?? "", lastModified: o.LastModified })), new Date(), retentionDays, key);
    if (expired.length) await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: expired.map(Key => ({ Key })) } }));

    console.log(JSON.stringify({ ok: true, key, bytes: result.bytes, sha256: result.sha256, recipient: fingerprint, removedOld: expired.length }));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

main().then(() => process.exit(0), () => {
  // Raw errors may contain connection details; only the phase is logged.
  console.error(JSON.stringify({ ok: false, phase, error: "Nightly backup failed; previous copies are untouched" }));
  process.exit(1);
});
