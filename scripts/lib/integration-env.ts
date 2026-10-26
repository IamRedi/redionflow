/** Child environment for the official disposable SaaS integration runner. */
export function buildIntegrationChildEnv(parent: NodeJS.ProcessEnv, databaseUrl: string): NodeJS.ProcessEnv {
  return {
    ...parent,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    // Freeze absent runtime connection before dotenv; provision after migration.
    TENANT_DATABASE_URL: "",
    // Establish mode before imports: isSaasMode is cached at module load.
    APP_ENV: "saas",
    SAAS_MODE: "true",
    DEMO_MODE: "false",
    DEMO_RESET_ALLOWED: "false",
    // Baseline suites retain their guards; the runtime suite enables its pilot.
    RLS_ENFORCE: "false",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}
