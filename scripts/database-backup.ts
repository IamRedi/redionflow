import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { decryptBackup, encryptBackup, type BackupManifest } from "../src/lib/backup/archive";

const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; };
let phase = "configuration";
function pgEnvironment(raw: string) {
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hash || [...url.searchParams.keys()].some(key => !["sslmode", "schema"].includes(key))) throw new Error("Invalid backup database configuration");
  const local = ["127.0.0.1", "localhost"].includes(url.hostname);
  if (!local && !["require", "verify-full", "verify-ca"].includes(url.searchParams.get("sslmode") ?? "")) throw new Error("TLS required for remote database backup");
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get("sslmode") ?? "disable", PGCONNECT_TIMEOUT: "15" };
}
// node-postgres treats sslmode=require as verify-full, unlike libpq/pg_dump.
// Railway's private Postgres uses a self-signed certificate, so "require"
// keeps libpq's meaning here too: encrypted, certificate not verified.
// verify-ca/verify-full still verify.
function sourceClientConfig(raw: string) {
  const url = new URL(raw);
  const mode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");
  const ssl = mode === "require" ? { rejectUnauthorized: false } : mode === "verify-full" || mode === "verify-ca" ? { rejectUnauthorized: true } : false;
  return { connectionString: url.toString(), ssl, connectionTimeoutMillis: 15_000 };
}
function pg(command: "pg_dump" | "pg_restore", args: string[], databaseUrl?: string) {
  const env = databaseUrl ? pgEnvironment(databaseUrl) : { ...process.env };
  const windows = process.platform === "win32";
  if (windows) env.WSLENV = [env.WSLENV, "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGSSLMODE", "PGCONNECT_TIMEOUT"].filter(Boolean).join(":");
  const remoteDump = command === "pg_dump" && Boolean(process.env.BACKUP_SSH_CONFIG_FILE);
  const binary = process.env.BACKUP_PG_BIN_DIR ? path.posix.join(process.env.BACKUP_PG_BIN_DIR, command) : command;
  const sshHost = process.env.BACKUP_SSH_HOST || "bauflow-private-backup";
  if (!/^[a-zA-Z0-9_-]+$/.test(sshHost)) throw new Error("Invalid backup SSH alias");
  const remoteCommand = [command, ...args].map(value => "'" + value.replaceAll("'", "'\\''") + "'").join(" ");
  const executable = remoteDump ? "ssh" : windows ? "wsl.exe" : binary;
  const wslArgs = args.map(value => /^[A-Za-z]:[\\/]/.test(value) ? `/mnt/${value[0].toLowerCase()}/${value.slice(3).replaceAll("\\", "/")}` : value);
  const childArgs = remoteDump ? ["-F", required("BACKUP_SSH_CONFIG_FILE"), "-T", "-o", "BatchMode=yes", sshHost, remoteCommand] : windows ? ["-d", process.env.BACKUP_WSL_DISTRO || "Ubuntu", "--", binary, ...wslArgs] : args;
  const child = spawn(executable, childArgs, { env, stdio: ["ignore", "pipe", "pipe"], shell: false });
  child.stderr.resume(); // Never put connection details or business data in logs.
  const timer = setTimeout(() => child.kill("SIGTERM"), 300_000); timer.unref();
  const done = new Promise<void>((resolve, reject) => {
    child.on("error", () => { clearTimeout(timer); reject(new Error(`${command} could not start`)); });
    child.on("close", code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`${command} failed; no backup accepted`)); });
  });
  void done.catch(() => {});
  return { child, done };
}
async function tableCounts(db: Client): Promise<BackupManifest["tables"]> {
  const result: Record<string, number> = {};
  const tables = await db.query<{ name: string }>("SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  for (const { name } of tables.rows) {
    const quoted = '"' + name.replaceAll('"', '""') + '"';
    const count = await db.query<{ count: string }>(`SELECT count(*) AS count FROM public.${quoted}`);
    result[name] = Number(count.rows[0].count);
  }
  return result;
}
async function create() {
  const databaseUrl = required("BACKUP_DATABASE_URL"); pgEnvironment(databaseUrl);
  const outputDir = path.resolve(required("BACKUP_OUTPUT_DIR"));
  if (outputDir === process.cwd() || outputDir.startsWith(process.cwd() + path.sep)) throw new Error("Backups must stay outside the repository");
  await mkdir(outputDir, { recursive: true, mode: 0o700 });
  const recipient = await readFile(required("BACKUP_PUBLIC_KEY_FILE"), "utf8");
  const db = new Client(sourceClientConfig(databaseUrl));
  phase = "source-connect"; await db.connect();
  try {
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    // This owner-approved destination is for AL-Steel only. Refuse a future
    // second tenant rather than copying its data into the wrong Drive folder.
    const companies = await db.query<{ id: string }>('SELECT id FROM "CompanyProfile"');
    if (companies.rows.length !== 1 || companies.rows[0].id !== required("BACKUP_EXPECTED_COMPANY_ID")) throw new Error("Backup tenant scope changed; operator review required");
    phase = "source-snapshot";
    const manifest = { createdAt: new Date().toISOString(), tables: await tableCounts(db) };
    const snapshot = (await db.query<{ snapshot: string }>("SELECT pg_export_snapshot() AS snapshot")).rows[0].snapshot;
    if (!/^[0-9a-f-]+$/i.test(snapshot)) throw new Error("Invalid exported snapshot");
    const file = path.join(outputDir, `bauflow-${manifest.createdAt.replaceAll(/[:.]/g, "-")}-${randomBytes(6).toString("hex")}.enc`);
    const dump = pg("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--compress=6", "--lock-wait-timeout=5s", `--snapshot=${snapshot}`], databaseUrl);
    try {
      phase = "dump-encrypt";
      const result = await encryptBackup(dump.child.stdout, file, recipient, manifest, dump.done);
      await db.query("COMMIT");
      console.log(JSON.stringify({ ...result, createdAt: manifest.createdAt, tableCount: Object.keys(manifest.tables).length }));
    } finally { if (dump.child.exitCode === null) dump.child.kill("SIGTERM"); }
  } finally { await db.query("ROLLBACK").catch(() => {}); await db.end(); }
}
async function verify() {
  const file = path.resolve(required("BACKUP_FILE"));
  const privatePem = await readFile(required("BACKUP_PRIVATE_KEY_FILE"), "utf8");
  const temp = await mkdtemp(path.join(path.dirname(file), ".restore-"));
  try {
    const dumpFile = path.join(temp, "verified.dump");
    phase = "decrypt-authenticate";
    const manifest = await decryptBackup(file, dumpFile, privatePem);
    phase = "archive-list";
    const list = pg("pg_restore", ["--list", dumpFile]); list.child.stdout.resume(); await list.done;
    if (process.env.BACKUP_RESTORE_DATABASE_URL) {
      const target = new URL(process.env.BACKUP_RESTORE_DATABASE_URL);
      if (!["127.0.0.1", "localhost"].includes(target.hostname) || !/^\/bauflow_restore_[a-z0-9_]+$/.test(target.pathname) || process.env.BACKUP_RESTORE_ACK !== "disposable-local-only") throw new Error("Restore target must be an explicitly acknowledged disposable loopback database");
      phase = "restore-connect";
      const db = new Client({ connectionString: target.toString(), connectionTimeoutMillis: 10_000 }); await db.connect();
      try {
        if (Object.keys(await tableCounts(db)).length) throw new Error("Restore target is not empty; no data was changed");
        phase = "restore-transaction";
        const restore = pg("pg_restore", ["--dbname", target.pathname.slice(1), "--exit-on-error", "--single-transaction", "--no-owner", "--no-acl", dumpFile], target.toString());
        restore.child.stdout.resume(); await restore.done;
        phase = "restore-counts";
        if (JSON.stringify(await tableCounts(db)) !== JSON.stringify(manifest.tables)) throw new Error("Restored table counts differ from the consistent source snapshot");
      } finally { await db.end(); }
    }
    console.log(JSON.stringify({ verified: true, restored: Boolean(process.env.BACKUP_RESTORE_DATABASE_URL), createdAt: manifest.createdAt, tableCount: Object.keys(manifest.tables).length }));
  } finally { await rm(temp, { recursive: true, force: true }); }
}
const command = process.argv[2];
try {
  if (command === "create") await create();
  else if (command === "verify") await verify();
  else throw new Error("Use create or verify");
} catch {
  // Raw driver/tool errors may contain a password, URL or customer data.
  console.error(JSON.stringify({ ok: false, operation: command, phase, error: "Database backup verification failed; no backup accepted" }));
  process.exitCode = 1;
}
