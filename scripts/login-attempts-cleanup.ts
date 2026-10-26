/**
 * BDF-P1-003 — dedicated login-attempt cleanup command.
 *
 * Runs the same `cleanup()` method the store uses opportunistically on
 * the request path, but as a top-level executable so operators can
 * schedule it (cron on dedicated hosts; a scheduled function on Vercel;
 * a Railway cron job; etc.). Production must schedule this at least
 * hourly so the `LoginAttempt` table stays bounded even during idle
 * traffic windows.
 *
 * Reuses the existing `PostgresLoginAttemptStore.cleanup()` so the
 * retention SQL lives in one place.
 *
 * Usage:
 *   npm run login-attempts:cleanup
 *   # or in production:
 *   tsx scripts/login-attempts-cleanup.ts
 *
 * Exit codes:
 *   0 — cleanup succeeded (removed count is printed to stdout)
 *   1 — the cleanup threw; error is printed to stderr
 */

import "dotenv/config";

import { PostgresLoginAttemptStore } from "../src/lib/auth/login-attempt-store";
import { prisma } from "../src/lib/db/prisma";

async function main() {
  const store = new PostgresLoginAttemptStore();
  const { removed } = await store.cleanup();
  process.stdout.write(
    `[login-attempts-cleanup] removed=${removed} at=${new Date().toISOString()}\n`,
  );
}

main()
  .catch((error) => {
    process.stderr.write(`[login-attempts-cleanup] failed: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
