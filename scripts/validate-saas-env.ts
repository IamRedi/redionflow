import "dotenv/config";
import { validateSaasEnv } from "../src/lib/env/saas-env-guard";

const result = validateSaasEnv(process.env);

if (result.skipped) {
  console.log("[check:saas-env] skipped: SAAS_MODE is not true and APP_ENV is not saas.");
  process.exit(0);
}

for (const warning of result.warnings) {
  console.warn(`[check:saas-env] warning: ${warning}`);
}

if (!result.ok) {
  console.error("[check:saas-env] failed:");
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("[check:saas-env] ok: SaaS env shape is ready for test-production.");
