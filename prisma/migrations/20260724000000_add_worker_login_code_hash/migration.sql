-- BDF-P1-005 — scrypt-hashed worker login code storage.
--
-- Additive-only: adds a new nullable column. No existing row is modified,
-- no destructive change. Safe to run against populated production DBs.
--
-- Transition policy: any worker whose `loginCodeHash` is NULL cannot
-- authenticate — the operator must set a fresh code via the admin
-- worker-management UI, which now goes through `hashPassword` and writes
-- into `loginCodeHash`.
--
-- Rollback: `ALTER TABLE "Worker" DROP COLUMN "loginCodeHash";`

ALTER TABLE "Worker" ADD COLUMN "loginCodeHash" TEXT;
