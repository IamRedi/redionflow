import { randomBytes } from "node:crypto";
import { Client } from "pg";

/** Provision only inside the official disposable runners after migrations. */
export async function provisionLocalPilotRole(databaseUrl: string): Promise<string> {
  const url = new URL(databaseUrl);
  // pg query options can override a parsed authority or read SSL files.
  const options = [...url.searchParams];
  const safeOptions = options.length === 0 ||
    (options.length === 1 && options[0][0] === "schema" && options[0][1] === "public");
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !safeOptions || url.hash || url.hostname !== "127.0.0.1" || !["/baumkalk_integration", "/baumkalk_e2e"].includes(url.pathname) ||
      !["int", "e2e"].includes(url.username)) throw new Error("Refusing role provisioning outside an official disposable database.");
  const password = randomBytes(24).toString("hex");
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    await db.query(`CREATE ROLE bk_saas_pilot_runtime LOGIN PASSWORD '${password}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    await db.query(`GRANT CONNECT ON DATABASE "${url.pathname.slice(1)}" TO bk_saas_pilot_runtime`);
    await db.query(`GRANT USAGE ON SCHEMA public TO bk_saas_pilot_runtime`);
    await db.query(`GRANT SELECT ON "CompanyProfile", "OverheadSettings", "TreeItem", "ManualTask", "Subscription", "Plan" TO bk_saas_pilot_runtime`);
    await db.query(`GRANT SELECT (id,"companyProfileId",name,email) ON "User" TO bk_saas_pilot_runtime`);
    await db.query(`GRANT SELECT (id,"companyProfileId","firstName","lastName",licenses,availability,status,"isTemporary",level) ON "Worker" TO bk_saas_pilot_runtime`);
    await db.query(`GRANT SELECT (id,"companyProfileId",name,nickname,"isActive","patentaEnevojshme") ON "Machine" TO bk_saas_pilot_runtime`);
    await db.query(`GRANT SELECT (id,"companyProfileId","workerId",status,"startDate","endDate") ON "VacationRequest" TO bk_saas_pilot_runtime`);
    await db.query(`GRANT SELECT (id,"workerId","baustelleId","startTime","isLive","endTime") ON "WorkSession" TO bk_saas_pilot_runtime`);
    // Initial tree and import-clear are existing dependent parts of Baustelle CRUD.
    await db.query(`GRANT INSERT, DELETE ON "TreeItem" TO bk_saas_pilot_runtime`);
    await db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON "Baustelle", "DailyWorkPlan", "DailyWorkPlanColumn",
      "DailyWorkPlanAssignment", "DailyWorkPlanSavedRow", "DailyWorkPlanSnapshot", "DailyWorkPlanSnapshotRow" TO bk_saas_pilot_runtime`);
  } finally { await db.end(); }
  url.username = "bk_saas_pilot_runtime"; url.password = password;
  return url.toString();
}
