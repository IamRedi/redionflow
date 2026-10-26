-- BDF-P8-007 Phase 1 — session revocation storage.
--
-- Additive-only: adds a new NOT NULL INTEGER column with a DEFAULT of 0
-- so every existing row picks up the default without a backfill pass.
-- No existing row is modified, no destructive change, no downtime.
-- Safe to run against populated production DBs.
--
-- Semantics: every issued session cookie carries the epoch that was in
-- force when it was minted. Password rotation, an admin's "sign out
-- everywhere" action, or an operator revoking a stolen cookie bumps
-- this number by one. Enforcement compares the cookie epoch against
-- the DB epoch and rejects mismatches.
--
-- This migration only introduces the columns. The helper API + tests
-- ship in the same PR (`src/lib/auth/session-epoch.ts` +
-- `session-epoch.test.ts`) but the enforcement wiring — cookie
-- payload change, session-lookup guard, admin `Sign out everywhere`
-- UI — lands in Phase 2 so we can confirm the schema change is
-- stable before user-facing behaviour depends on it.
--
-- Rollback:
--   ALTER TABLE "User" DROP COLUMN "sessionEpoch";
--   ALTER TABLE "Worker" DROP COLUMN "sessionEpoch";

ALTER TABLE "User" ADD COLUMN "sessionEpoch" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Worker" ADD COLUMN "sessionEpoch" INTEGER NOT NULL DEFAULT 0;
