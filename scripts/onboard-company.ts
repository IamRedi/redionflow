/** Preview is offline by default. This command is deliberately absent from app startup. */
import { readFileSync, statSync } from 'node:fs';
import { planCompanySetup, setupSummary } from '../src/lib/provision/onboarding';

async function main() {
  const [file, command, digest, ...extra] = process.argv.slice(2);
  if (!file || extra.length || command && command !== '--apply' || command && !/^[a-f0-9]{64}$/.test(digest ?? '') || !command && digest)
    throw new Error('USAGE: npm run company:plan -- private-input.json [--apply REVIEWED_DIGEST]');
  if (statSync(file).size > 512_000) throw new Error('INPUT_TOO_LARGE');
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const plan = planCompanySetup(raw);
  if (!command) { console.log(JSON.stringify(setupSummary(plan), null, 2)); return; }
  if (digest !== plan.digest) throw new Error('SETUP_REVIEW_CHANGED');
  if (process.env.INSTALLATION_COMPANY_ID && process.env.INSTALLATION_COMPANY_ID !== `company-${plan.input.key}`) throw new Error('DEDICATED_INSTALLATION_MISMATCH');
  const password = process.env.PROVISION_OWNER_PASSWORD ?? '';
  if (password.trim().length < 12 || password.length > 256) throw new Error('OWNER_PASSWORD_REQUIRED_12_TO_256');
  const databaseName = process.env.ONBOARDING_DATABASE_NAME;
  if (!databaseName) throw new Error('EXPLICIT_DATABASE_NAME_REQUIRED');
  const [{ PrismaClient }, { PrismaPg }, { resolveDatabaseConnectionString }, { hashPassword }, { applyCompanySetup }] = await Promise.all([
    import('../src/generated/prisma/client'), import('@prisma/adapter-pg'), import('../src/lib/db/connection-string'),
    import('../src/lib/auth/password'), import('../src/lib/provision/create-company'),
  ]);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseConnectionString({ preferDirect: true }) }) });
  try {
    const [target] = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    if (target?.name !== databaseName) throw new Error('DATABASE_TARGET_MISMATCH');
    console.log(JSON.stringify(await applyCompanySetup(db, raw, digest!, hashPassword(password))));
  } finally { await db.$disconnect(); }
}
main().catch(error => {
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.message) ? error.message : 'INVALID_INPUT_OR_TRANSACTION_FAILED';
  console.error(`[company-setup] ${code}; no credentials or customer input logged.`); process.exitCode = 1;
});
