import { afterEach, beforeEach, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

const folder = "prisma/migrations";
const revocation = "20261001150000_session_revocation";
const integrity = "20261001153000_tenant_reference_integrity";
let admin: Client, db: Client, database: string, connectionString: string;
let revocationSql: string, integritySql: string;

beforeEach(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/baumkalk_integration" || url.username !== "int") {
    throw new Error("Migration review requires the official disposable integration DB.");
  }
  database = `bk_review_${randomUUID().replaceAll("-", "")}`;
  admin = new Client({ connectionString: url.toString() }); await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  url.pathname = `/${database}`; connectionString = url.toString();
  db = new Client({ connectionString }); await db.connect();
  for (const name of (await readdir(folder)).sort()) {
    if (name >= revocation) continue;
    if (name === "migration_lock.toml") continue;
    await db.query(await readFile(`${folder}/${name}/migration.sql`, "utf8"));
  }
  revocationSql = await readFile(`${folder}/${revocation}/migration.sql`, "utf8");
  integritySql = await readFile(`${folder}/${integrity}/migration.sql`, "utf8");
});
afterEach(async () => {
  if (db) { await db.query("ROLLBACK"); await db.end(); }
  if (admin) { await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`); await admin.end(); }
});

async function seed() {
  for (const label of ["a", "b"]) {
    await db.query('INSERT INTO "CompanyProfile" (id,"legalName","displayName","updatedAt") VALUES ($1,$2,$2,now())', [label, `Synthetic ${label}`]);
    await db.query('INSERT INTO "Worker" (id,"companyProfileId","firstName","lastName","updatedAt") VALUES ($1,$2,$3,$4,now())', [`w${label}`,label,"Synthetic",label]);
    await db.query('INSERT INTO "Baustelle" (id,"companyProfileId",name,"updatedAt") VALUES ($1,$2,$3,now())', [`s${label}`,label,`Synthetic ${label}`]);
  }
  await db.query('INSERT INTO "WorkSession" (id,"workerId","baustelleId","startTime","updatedAt") VALUES ($1,$2,$3,now(),now())', ["valid-session","wa","sa"]);
  await db.query('INSERT INTO "WorkSession" (id,"workerId","startTime","updatedAt") VALUES ($1,$2,now(),now())', ["nullable-session","wb"]);
}
async function apply() { await db.query(revocationSql); await db.query(integritySql); }

it("clean database applies the complete SQL chain and installs 44 integrity triggers", async () => {
  await apply();
  expect(Number((await db.query("SELECT count(*) FROM pg_trigger WHERE tgname='bk_tenant_integrity' AND NOT tgisinternal")).rows[0].count)).toBe(44);
  expect((await db.query("SELECT proconfig FROM pg_proc WHERE oid='public.bk_row_tenant(text,text)'::regprocedure")).rows[0].proconfig).toContain("search_path=pg_catalog, public");
});

it("valid existing and nullable references survive; foreign inserts/updates reject; own cascade works", async () => {
  await seed(); await apply();
  expect((await db.query('SELECT "baustelleId" FROM "WorkSession" WHERE id=$1',["nullable-session"])).rows[0].baustelleId).toBeNull();
  await expect(db.query('INSERT INTO "WorkSession" (id,"workerId","baustelleId","startTime","updatedAt") VALUES ($1,$2,$3,now(),now())',["forged","wa","sb"])).rejects.toMatchObject({code:"23514"});
  await expect(db.query('UPDATE "WorkSession" SET "baustelleId"=$1 WHERE id=$2',["sb","valid-session"])).rejects.toMatchObject({code:"23514"});
  await db.query('UPDATE "WorkSession" SET "baustelleId"=NULL WHERE id=$1',["valid-session"]);
  await db.query('UPDATE "WorkSession" SET "baustelleId"=$1 WHERE id=$2',["sa","valid-session"]);
  await db.query('DELETE FROM "Baustelle" WHERE id=$1',["sa"]);
  expect((await db.query('SELECT "baustelleId" FROM "WorkSession" WHERE id=$1',["valid-session"])).rows[0].baustelleId).toBeNull();
  await db.query('DELETE FROM "CompanyProfile" WHERE id=$1',["a"]);
  expect((await db.query('SELECT id FROM "CompanyProfile"')).rows.map(r=>r.id)).toEqual(["b"]);
});

it.each(["foreign", "orphan", "ambiguous"])("pre-existing %s data refuses migration atomically and permits explicit synthetic remediation/retry", async kind => {
  await seed(); await db.query(revocationSql);
  if (kind === "foreign") await db.query('UPDATE "WorkSession" SET "baustelleId"=$1 WHERE id=$2',["sb","valid-session"]);
  else if (kind === "ambiguous") {
    await db.query('INSERT INTO "User" (id,email,"companyProfileId","updatedAt") VALUES ($1,$2,$3,now())',["wb","synthetic-ambiguous@example.test","a"]);
    await db.query('INSERT INTO "NotificationSettings" (id,"userId","createdAt","updatedAt") VALUES ($1,$2,now(),now())',["orphan","wb"]);
  } else await db.query('INSERT INTO "NotificationSettings" (id,"userId","createdAt","updatedAt") VALUES ($1,$2,now(),now())',["orphan","missing-actor"]);
  await expect(db.query(integritySql)).rejects.toMatchObject({code:"23514"});
  await db.query("ROLLBACK");
  expect((await db.query("SELECT to_regprocedure('public.bk_row_tenant(text,text)') AS fn")).rows[0].fn).toBeNull();
  expect(Number((await db.query("SELECT count(*) FROM pg_trigger WHERE tgname='bk_tenant_integrity'")).rows[0].count)).toBe(0);
  if (kind === "foreign") {
    expect((await db.query('SELECT "baustelleId" FROM "WorkSession" WHERE id=$1',["valid-session"])).rows[0].baustelleId).toBe("sb");
    await db.query('UPDATE "WorkSession" SET "baustelleId"=$1 WHERE id=$2',["sa","valid-session"]);
  } else { expect((await db.query('SELECT id FROM "NotificationSettings" WHERE id=$1',["orphan"])).rowCount).toBe(1); await db.query('DELETE FROM "NotificationSettings" WHERE id=$1',["orphan"]); }
  await db.query(integritySql);
});

it("migration closes the concurrent-write gap between preflight and trigger installation", async () => {
  await seed(); await db.query(revocationSql);
  const barrier = new Client({connectionString}), writer = new Client({connectionString});
  await barrier.connect(); await writer.connect();
  const key = 20261001153000;
  // Test-only pause at the actual preflight/trigger boundary; checks/DDL are unchanged.
  const pausedSql = integritySql.replace('END $$;\nCREATE TRIGGER bk_tenant_integrity', () => `END $$;\nSELECT pg_advisory_xact_lock(${key});\nCREATE TRIGGER bk_tenant_integrity`);
  expect(pausedSql).not.toBe(integritySql);
  const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  const writerPid = (await writer.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  await barrier.query("SELECT pg_advisory_lock($1)",[key]);
  const migration = db.query(pausedSql).then(()=>({ok:true}),e=>({ok:false,error:e}));
  let writing: Promise<{ok:boolean;error?:unknown}> | undefined;
  try {
    await expect.poll(async()=> (await barrier.query("SELECT wait_event FROM pg_stat_activity WHERE pid=$1",[pid])).rows[0]?.wait_event, {timeout:5000}).toBe("advisory");
    writing = writer.query('INSERT INTO "WorkSession" (id,"workerId","baustelleId","startTime","updatedAt") VALUES ($1,$2,$3,now(),now())',["concurrent-forged","wa","sb"]).then(()=>({ok:true}),e=>({ok:false,error:e}));
    await expect.poll(async()=> (await barrier.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",[writerPid])).rows[0]?.wait_event_type,{timeout:1000}).toBe("Lock");
  } finally {
    await barrier.query("SELECT pg_advisory_unlock($1)",[key]);
    try {
      const migrated = await migration; expect(migrated, "error" in migrated ? String(migrated.error?.message) : "migration completed").toMatchObject({ok:true});
      if (writing) expect(await writing).toMatchObject({ok:false,error:{code:"23514"}});
    } finally { await writer.end(); await barrier.end(); }
  }
});
