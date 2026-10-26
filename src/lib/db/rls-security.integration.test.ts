import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { seedSecurityTenants, removeSecurityTenants } from "../../../tests/security/fixtures";
import { prisma } from "@/lib/db/prisma";
import { withTenantContext, isRlsEnforced } from "@/lib/db/tenant-context";
import { Pool } from "pg";
import { readFile } from "node:fs/promises";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
const role = "baumkalk_security_probe";
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/baumkalk_integration") {
    throw new Error("RLS probe requires the official disposable integration DB.");
  }
  tenants = await seedSecurityTenants();
  await prisma.$executeRawUnsafe(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
  await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await prisma.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION public.bk_notification_tenant(text) TO ${role}`);
  await prisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
});
afterAll(async () => {
  vi.unstubAllEnvs(); await removeSecurityTenants(tenants.map(t => t.company.id));
  await prisma.$executeRawUnsafe(`DROP OWNED BY ${role}`);
  await prisma.$executeRawUnsafe(`DROP ROLE ${role}`);
});
async function restricted<T>(tenant: string | null, fn: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
    if (tenant) await tx.$queryRaw`SELECT set_config('app.current_tenant_id', ${tenant}, true)`;
    return fn(tx);
  });
}
for (const flag of ["false", "true"]) {
  describe(`DB RLS runtime, RLS_ENFORCE=${flag}`, () => {
    it("probe role is non-superuser and NOBYPASSRLS", async () => {
      vi.stubEnv("RLS_ENFORCE", flag); expect(isRlsEnforced()).toBe(flag === "true");
      const rows = await restricted(null, tx => tx.$queryRawUnsafe<Array<{rolsuper:boolean;rolbypassrls:boolean}>>(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`));
      expect(rows).toEqual([{rolsuper:false,rolbypassrls:false}]);
    });
    it("SELECT with no context returns no tenant rows", async () => {
      const rows = await restricted(null, tx => tx.worker.findMany()); expect(rows).toEqual([]);
    });
    for (const [actor,foreign] of [[0,1],[1,0]]) {
      it(`SELECT and child joins scope ${actor} and exclude ${foreign}`, async () => {
        const a=tenants[actor],b=tenants[foreign];
        const result = await restricted(a.company.id, async tx => ({
          workers: await tx.worker.findMany(), sites: await tx.baustelle.findMany(),
          trees: await tx.treeItem.findMany({ include:{baustelle:true} }),
          plans: await tx.dailyWorkPlanAssignment.findMany({include:{worker:true,column:true}}),
          inventory: await tx.companyInventoryItem.findMany(), machines: await tx.machine.findMany(),
          users: await tx.user.findMany(), companies: await tx.companyProfile.findMany(), projects: await tx.project.findMany(),
        }));
        expect(JSON.stringify(result)).toContain(a.marker); expect(JSON.stringify(result)).not.toContain(b.marker);
        expect(result.workers.map(x=>x.id)).toEqual([a.worker.id]); expect(result.trees.map(x=>x.id)).toEqual([a.tree.id]);
      });
      it(`INSERT foreign tenant ${foreign} fails WITH CHECK`, async () => {
        const a=tenants[actor],b=tenants[foreign];
        await expect(restricted(a.company.id, tx => tx.worker.create({data:{companyProfileId:b.company.id,firstName:"Forged",lastName:"Synthetic"}}))).rejects.toThrow(/row.level security/i);
        expect(await prisma.worker.count({where:{companyProfileId:b.company.id}})).toBe(1);
      });
      it(`UPDATE and DELETE foreign tenant ${foreign} affect zero rows`, async () => {
        const a=tenants[actor],b=tenants[foreign];
        const result=await restricted(a.company.id, async tx=>({
          update:await tx.worker.updateMany({where:{id:b.worker.id},data:{firstName:"Forged"}}),
          remove:await tx.worker.deleteMany({where:{id:b.worker.id}}),
          child:await tx.treeItem.updateMany({where:{id:b.tree.id},data:{species:"Forged"}}),
        }));
        expect(result).toEqual({update:{count:0},remove:{count:0},child:{count:0}});
        expect((await prisma.worker.findUniqueOrThrow({where:{id:b.worker.id}})).firstName).toBe(b.marker);
      });
    }
    it("own insert/update/delete succeeds rather than denying all traffic", async () => {
      const a=tenants[0];
      await restricted(a.company.id,async tx=>{
        const row=await tx.worker.create({data:{companyProfileId:a.company.id,firstName:"Own",lastName:"Synthetic"}});
        expect((await tx.worker.update({where:{id:row.id},data:{firstName:"Updated"}})).firstName).toBe("Updated");
        expect((await tx.worker.delete({where:{id:row.id}})).id).toBe(row.id);
      });
    });
    it("withTenantContext binds and clears the connection-local tenant", async () => {
      vi.stubEnv("RLS_ENFORCE",flag);
      const rows=await withTenantContext(tenants[0].company.id,async tx=>{
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`); return tx.worker.findMany();
      });
      expect(rows.map(x=>x.id)).toEqual([tenants[0].worker.id]);
      expect(await restricted(null,tx=>tx.worker.findMany())).toEqual([]);
    });
    it("bootstrap role bypass is explicit and sees both tenants", async () => {
      const roleInfo=await prisma.$queryRawUnsafe<Array<{rolsuper:boolean;rolbypassrls:boolean}>>('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
      expect(roleInfo[0].rolsuper || roleInfo[0].rolbypassrls).toBe(true);
      expect(await prisma.worker.count({where:{id:{in:tenants.map(t=>t.worker.id)}}})).toBe(2);
    });
  });
}
// Phase 2 accepted this cross-tenant secondary FK; Phase 3 must reject it.
it("restricted role cannot create own-worker session referencing a foreign site",async()=>{
  const a=tenants[0],b=tenants[1];
  await expect(restricted(a.company.id,tx=>tx.workSession.create({data:{workerId:a.worker.id,baustelleId:b.site.id,startTime:new Date(),isLive:false}}))).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
});
it("bypass/bootstrap also cannot insert/update cross-tenant secondary references",async()=>{
  const a=tenants[0],b=tenants[1];
  await expect(prisma.workSession.create({data:{workerId:a.worker.id,baustelleId:b.site.id,startTime:new Date()}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
  const session=await prisma.workSession.create({data:{workerId:a.worker.id,baustelleId:a.site.id,startTime:new Date()}});
  await expect(prisma.workSession.update({where:{id:session.id},data:{baustelleId:b.site.id}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
  await prisma.workSession.delete({where:{id:session.id}});
  await expect(prisma.dailyWorkPlanAssignment.create({data:{columnId:a.column.id,kind:"WORKER",workerId:b.worker.id,labelSnapshot:"Forged"}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
  await expect(prisma.dailyWorkPlanAssignment.update({where:{id:a.assignment.id},data:{machineId:b.machine.id}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
  const position=await prisma.projectPosition.create({data:{projectId:a.project.id,title:"Synthetic position",unit:"unit",quantity:1}});
  await expect(prisma.positionMachineItem.create({data:{positionId:position.id,machineId:b.machine.id,machineNameSnapshot:"Forged",quantity:1}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
});

it("one physical pooled connection clears tenant and role after commit, rollback and failure", async () => {
  const pool = new Pool({connectionString:process.env.DATABASE_URL,max:1});
  const pids = new Set<number>();
  try {
    let requestIndex=0;
    for (const tenant of [tenants[0],tenants[1],null,tenants[0],null]) {
      const client = await pool.connect();
      try {
        pids.add((await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
        const before = (await client.query("SELECT current_user AS role, current_setting('app.current_tenant_id',true) AS tenant")).rows[0];
        expect(before.role).not.toBe(role); expect(before.tenant ?? "").toBe("");
        await client.query("BEGIN"); await client.query(`SET LOCAL ROLE ${role}`);
        if (tenant) await client.query("SELECT set_config('app.current_tenant_id',$1,true)",[tenant.company.id]);
        const rows = (await client.query('SELECT id FROM "Worker" ORDER BY id')).rows;
        expect(rows.map(r=>r.id)).toEqual(tenant ? [tenant.worker.id] : []);
        if (tenant) {
          const ownId=`pooled-own-${tenant.company.id}`;
          await client.query('INSERT INTO "Worker" (id,"companyProfileId","firstName","lastName","updatedAt") VALUES ($1,$2,$3,$4,now())',[ownId,tenant.company.id,"Own","Synthetic"]);
          expect((await client.query('UPDATE "Worker" SET "firstName"=$1 WHERE id=$2',["Updated",ownId])).rowCount).toBe(1);
          expect((await client.query('DELETE FROM "Worker" WHERE id=$1',[ownId])).rowCount).toBe(1);
          const foreign = tenants.find(t=>t.company.id!==tenant.company.id)!;
          expect((await client.query('UPDATE "Worker" SET "firstName"=$1 WHERE id=$2',["forged",foreign.worker.id])).rowCount).toBe(0);
          expect((await client.query('DELETE FROM "Worker" WHERE id=$1',[foreign.worker.id])).rowCount).toBe(0);
          await client.query("SAVEPOINT forged_insert");
          await expect(client.query('INSERT INTO "Worker" (id,"companyProfileId","firstName","lastName","updatedAt") VALUES ($1,$2,$3,$4,now())',["pooled-forged",foreign.company.id,"Forged","Synthetic"])).rejects.toThrow(/row.level security/i);
          if(requestIndex===0){await client.query("ROLLBACK TO SAVEPOINT forged_insert");await client.query("COMMIT");}
          else await client.query("ROLLBACK");
        } else await client.query("COMMIT");
      } finally { await client.query("ROLLBACK"); client.release(); }
      requestIndex++;
    }
    expect(pids.size).toBe(1);
  } finally { await pool.end(); }
});

it("secondary actor, document, GPS and child references reject forged inserts/updates",async()=>{
  const a=tenants[0],b=tenants[1];
  await expect(prisma.manualTask.create({data:{baustelleId:a.site.id,userId:b.admin.id,workerId:a.worker.id,description:"Forged"}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
  const task=await prisma.manualTask.create({data:{baustelleId:a.site.id,userId:a.admin.id,workerId:a.worker.id,description:"Own"}});
  await expect(prisma.manualTask.update({where:{id:task.id},data:{resolvedByWorkerId:b.worker.id}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
  await expect(prisma.treeItem.update({where:{id:a.tree.id},data:{completedByWorkerId:b.worker.id}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
  await expect(prisma.treeItem.update({where:{id:a.tree.id},data:{baustelleId:b.site.id}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
  await expect(prisma.workLog.create({data:{baustelleId:a.site.id,userId:b.admin.id,date:new Date()}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
  await expect(prisma.workerAssetItem.create({data:{workerId:a.worker.id,companyInventoryItemId:b.item.id,kind:"EQUIPMENT",itemName:"Forged",status:"PENDING_ADMIN_CONFIRMATION",createdByRole:"WORKER"}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
  const session=await prisma.workSession.create({data:{workerId:a.worker.id,baustelleId:a.site.id,startTime:new Date()}});
  await expect(prisma.workSessionPauseInterval.create({data:{workSessionId:session.id,workerId:b.worker.id,startedAt:new Date()}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
  const ownGps={companyProfileId:a.company.id,workerId:a.worker.id,workSessionId:session.id,source:"WORKER_PHONE" as const,lat:1,lng:1,recordedAt:new Date()};
  await expect(prisma.gpsLocationPoint.create({data:{...ownGps,machineId:b.machine.id}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
  const gps=await prisma.gpsLocationPoint.create({data:ownGps});
  await expect(prisma.gpsLocationPoint.update({where:{id:gps.id},data:{baustelleId:b.site.id}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
  await expect(prisma.worker.update({where:{id:a.worker.id},data:{companyProfileId:b.company.id}})).rejects.toThrow(/Tenant reference mismatch|Tenant ownership cannot be reassigned|Pause worker/i);
  // Own cascade deletion must still succeed (all synthetic fixtures are removed in afterAll).
});

it("migration preflight refuses inconsistent legacy references and rollback restores the trigger",async()=>{
  const sql=await readFile("prisma/migrations/20261001153000_tenant_reference_integrity/migration.sql","utf8");
  const preflight=sql.match(/DO \$\$ BEGIN[\s\S]*?END \$\$;/)![0];
  const a=tenants[0],b=tenants[1];
  await expect(prisma.$transaction(async tx=>{
    // Official disposable DB only (identity asserted by beforeAll); rollback undoes this DDL.
    await tx.$executeRawUnsafe('ALTER TABLE public."WorkSession" DISABLE TRIGGER bk_tenant_integrity');
    await tx.workSession.create({data:{workerId:a.worker.id,baustelleId:b.site.id,startTime:new Date()}});
    await tx.$executeRawUnsafe(preflight);
  })).rejects.toThrow(/Tenant integrity preflight failed: WorkSession.baustelleId/);
  const rows=await prisma.$queryRawUnsafe<Array<{tgenabled:string}>>(`SELECT tgenabled::text AS tgenabled FROM pg_trigger WHERE tgname='bk_tenant_integrity' AND tgrelid='public."WorkSession"'::regclass`);
  expect(rows).toEqual([{tgenabled:"O"}]);
  expect(await prisma.workSession.count({where:{workerId:a.worker.id,baustelleId:b.site.id}})).toBe(0);
});

it("ambiguous User/Worker actor IDs cannot expose one notification row to two tenants",async()=>{
  const a=tenants[0],b=tenants[1];
  const sub=await prisma.notificationSubscription.create({data:{userId:b.worker.id,fcmToken:`synthetic-ambiguous-${b.worker.id}`}});
  expect((await restricted(b.company.id,tx=>tx.notificationSubscription.findMany({where:{id:sub.id}}))).map(row=>row.id)).toEqual([sub.id]);
  expect(await restricted(a.company.id,tx=>tx.$queryRaw<Array<{tenant:string|null}>>`SELECT public.bk_notification_tenant(${b.worker.id}) AS tenant`)).toEqual([{tenant:null}]);
  const collided=await prisma.user.create({data:{id:b.worker.id,email:`synthetic-collision-${b.company.id}@example.test`,companyProfileId:a.company.id,role:"ADMIN"}});
  try{
    for(const tenant of [a,b])expect(await restricted(tenant.company.id,tx=>tx.notificationSubscription.findMany({where:{id:sub.id}}))).toEqual([]);
    const {getNotificationSubscriptions,ensureNotificationSettings,registerNotificationSubscription}=await import("@/lib/notifications/notification-store");
    expect(await getNotificationSubscriptions([b.worker.id])).toEqual([]);
    await expect(ensureNotificationSettings(b.worker.id)).rejects.toThrow(/Tenant reference mismatch/);
    await expect(registerNotificationSubscription(b.worker.id,sub.fcmToken)).rejects.toThrow(/Tenant reference mismatch/);
    await expect(prisma.notificationSettings.create({data:{userId:b.worker.id}})).rejects.toThrow(/Tenant reference mismatch/);
  }finally{
    await prisma.notificationSubscription.delete({where:{id:sub.id}});await prisma.user.delete({where:{id:collided.id}});
  }
});
