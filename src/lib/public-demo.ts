/**
 * The `/demo` pages render the default company without any login, so they
 * may only exist on an instance that holds demo data: `APP_ENV=demo` (the
 * public demo with the fictitious seed) or `APP_ENV=local` (development).
 * Everywhere else, including production and SaaS, they return 404.
 */
export function isPublicDemoEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const appEnv = (env.APP_ENV ?? "").trim().toLowerCase();
  const saas = (env.SAAS_MODE ?? "").trim().toLowerCase() === "true";
  return !saas && (appEnv === "demo" || appEnv === "local");
}

/** Explicit deployment profile; shared code must never opt another company in. */
export function isBaumdienstWorkshopDemoEnabled(mode: string | undefined, env: Record<string, string | undefined> = process.env): boolean {
  return mode === "baumdienst" && isPublicDemoEnabled(env)
    && (env.DEMO_PROFILE ?? "").trim().toLowerCase() === "baumdienst-workshop";
}
