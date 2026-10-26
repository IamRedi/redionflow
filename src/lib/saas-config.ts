/**
 * T-025 — SaaS deployment mode.
 *
 * `SAAS_MODE=true`  → multi-tenant SaaS (RediOnFlow).
 * `SAAS_MODE=false` (default) → dedicated single-client deployment.
 *
 * The env flag is intentionally coarse: it gates entire subsystems
 * (signup, billing, plan limits, tenant switcher) rather than individual
 * features. Product-level differentiation still lives in `company.mode`
 * (baumdienst / bau / personal) and `modeConfig` feature flags.
 *
 * This module must stay dependency-free so it can be imported from both
 * server actions and client boundary components.
 */

function readSaasMode(): boolean {
  const raw = process.env.SAAS_MODE?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/**
 * `true` for the SaaS multi-tenant deployment, `false` for dedicated clients.
 * Cached at module load — restart the server to pick up env changes.
 */
export const isSaasMode: boolean = readSaasMode();

/**
 * Guard for features that only exist on the SaaS deployment (signup, billing,
 * tenant switcher, plan limits). Use in server actions and route handlers.
 */
export function requireSaasMode(): void {
  if (!isSaasMode) {
    throw new Error("This feature is only available in SaaS mode.");
  }
}
