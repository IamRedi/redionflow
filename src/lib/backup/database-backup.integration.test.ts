import { spawn } from "node:child_process";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { afterEach, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";

let companyId = "", dir = "", restoreName = "";
function run(command: "create" | "verify", env: Record<string, string | undefined>) {
  return new Promise<{ code: number | null; data: Record<string, unknown> }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/database-backup.ts", command], { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "", diagnostics = ""; child.stdout.on("data", chunk => { output += chunk; }); child.stderr.on("data", chunk => { diagnostics += chunk; });
    child.on("error", reject); child.on("close", code => resolve({ code, data: JSON.parse((output || diagnostics).trim() || "{}") }));
  });
}
afterEach(async () => {
  if (companyId) await prisma.companyProfile.deleteMany({ where: { id: companyId } });
  if (dir) await rm(dir, { recursive: true, force: true });
  if (restoreName) {
    if (!/^bauflow_restore_[a-f0-9]+$/.test(restoreName)) throw new Error("Unsafe test cleanup target");
    const url = new URL(process.env.DATABASE_URL!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/baumkalk_integration") throw new Error("Unsafe test database");
    url.pathname = "/postgres"; const db = new Client({ connectionString: url.toString() }); await db.connect();
    try { await db.query(`DROP DATABASE "${restoreName}" WITH (FORCE)`); } finally { await db.end(); }
  }
});
it("encrypted consistent snapshot restores all tables, 40 workers, 37 vehicles and file bytes without changing source", async () => {
  const source = new URL(process.env.DATABASE_URL!);
  if (source.hostname !== "127.0.0.1" || source.pathname !== "/baumkalk_integration" || source.username !== "int") throw new Error("Disposable integration fixture required");
  dir = await mkdtemp(path.join(tmpdir(), "bauflow-db-backup-test-"));
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  await writeFile(path.join(dir, "public.pem"), keys.publicKey); await writeFile(path.join(dir, "private.pem"), keys.privateKey, { mode: 0o600 });
  const company = await prisma.companyProfile.create({ data: { legalName: "Synthetic steel fixture", displayName: "Synthetic steel fixture", mode: "bau", country: "AL" } }); companyId = company.id;
  await prisma.worker.createMany({ data: Array.from({ length: 40 }, (_, i) => ({ companyProfileId: companyId, firstName: "Synthetic", lastName: String(i) })) });
  await prisma.machine.createMany({ data: Array.from({ length: 37 }, (_, i) => ({ companyProfileId: companyId, name: `Synthetic vehicle ${i}`, category: "OTHER" as const, hourlyRateCents: 0 })) });
  const worker = await prisma.worker.findFirstOrThrow({where:{companyProfileId:companyId}});
  const machine = await prisma.machine.findFirstOrThrow({where:{companyProfileId:companyId}});
  const receiptBytes = await readFile("tests/fixtures/synthetic-fuel-receipt.png");
  await prisma.fuelReceipt.create({data:{companyProfileId:companyId, machineId:machine.id, requestId:randomUUID(), uploadedByWorkerId:worker.id, uploadedByName:"Synthetic worker", timeZone:"Europe/Tirane", currency:"ALL", fileName:"synthetic-receipt.png", mime:"image/png", size:receiptBytes.length, data:receiptBytes, sha256:createHash("sha256").update(receiptBytes).digest("hex")}});
  const site = await prisma.baustelle.create({ data: { companyProfileId: companyId, name: "Synthetic site", type: "STEEL_ASSEMBLY" } });
  const bytes = Buffer.from("%PDF-1.4\nsynthetic preserved file\n");
  await prisma.siteFile.create({ data: { companyProfileId: companyId, baustelleId: site.id, kind: "document", fileName: "synthetic.pdf", mime: "application/pdf", size: bytes.length, data: bytes } });
  const env = { BACKUP_DATABASE_URL: source.toString(), BACKUP_EXPECTED_COMPANY_ID: companyId, BACKUP_OUTPUT_DIR: dir, BACKUP_PUBLIC_KEY_FILE: path.join(dir, "public.pem"), BACKUP_PRIVATE_KEY_FILE: path.join(dir, "private.pem") };
  const created = await run("create", env); expect(created.code).toBe(0);
  expect((await readFile(String(created.data.file))).includes(bytes)).toBe(false);
  restoreName = `bauflow_restore_${randomUUID().replaceAll("-", "")}`;
  const admin = new Client({ connectionString: source.toString() }); await admin.connect();
  try { await admin.query(`CREATE DATABASE "${restoreName}"`); } finally { await admin.end(); }
  const target = new URL(source); target.pathname = `/${restoreName}`;
  const restored = await run("verify", { ...env, BACKUP_FILE: String(created.data.file), BACKUP_RESTORE_DATABASE_URL: target.toString(), BACKUP_RESTORE_ACK: "disposable-local-only" });
  expect(restored).toMatchObject({ code: 0, data: { verified: true, restored: true } });
  const check = new Client({ connectionString: target.toString() }); await check.connect();
  try {
    expect((await check.query('SELECT count(*)::int AS n FROM "Worker"')).rows[0].n).toBe(40);
    expect((await check.query('SELECT count(*)::int AS n FROM "Machine"')).rows[0].n).toBe(37);
    expect((await check.query('SELECT data FROM "SiteFile"')).rows[0].data).toEqual(bytes);
    expect((await check.query('SELECT data FROM "FuelReceipt"')).rows[0].data).toEqual(receiptBytes);
  } finally { await check.end(); }
  expect(await prisma.worker.count({ where: { companyProfileId: companyId } })).toBe(40);
  expect(await prisma.machine.count({ where: { companyProfileId: companyId } })).toBe(37);
  expect((await run("verify", { ...env, BACKUP_FILE: String(created.data.file), BACKUP_RESTORE_DATABASE_URL: source.toString(), BACKUP_RESTORE_ACK: "disposable-local-only" })).code).not.toBe(0);
});
