/**
 * BDF-P1-001: gated demo/local admin bootstrap.
 *
 * Purpose: allow a single local or demo administrator to be seeded from
 * environment variables so contributors do not need a full first-boot UI
 * (that arrives in BDF-P1-002). The gate is intentionally narrow.
 *
 * A demo admin is bootstrapped ONLY when **all** of the following hold:
 *   - `APP_ENV` is explicitly `local` OR `demo`;
 *   - `ALLOW_DEMO_ADMIN_BOOTSTRAP=true`;
 *   - `SAAS_MODE` is NOT truthy;
 *   - `DEMO_ADMIN_EMAIL` is a plausible email;
 *   - `DEMO_ADMIN_PASSWORD` is present with at least 8 characters.
 *
 * Any other combination returns `null` and the caller must NOT create an
 * admin. `APP_ENV=production` or `APP_ENV=saas` can never satisfy the gate.
 *
 * No secret is ever read from a hard-coded fallback and no password is ever
 * logged. Callers pass the returned `password` straight into
 * `hashPassword()` before persistence.
 */

import { isSaasMode } from "@/lib/saas-config";

export type DemoAdminBootstrap = {
  email: string;
  password: string;
};

function isTruthyFlag(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

function normalizeAppEnv(raw: string | undefined): "local" | "demo" | "other" {
  const value = raw?.trim().toLowerCase();
  if (value === "local" || value === "demo") return value;
  return "other";
}

/**
 * Return the demo admin credentials when — and only when — the strict gate
 * is satisfied. Never returns credentials in production/SaaS mode.
 */
export function resolveDemoAdminBootstrap(
  env: NodeJS.ProcessEnv = process.env,
): DemoAdminBootstrap | null {
  if (isSaasMode) return null;

  const appEnv = normalizeAppEnv(env.APP_ENV);
  if (appEnv === "other") return null;

  if (!isTruthyFlag(env.ALLOW_DEMO_ADMIN_BOOTSTRAP)) return null;

  const email = env.DEMO_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = env.DEMO_ADMIN_PASSWORD ?? "";

  // Basic sanity: an @ + at least 8 characters of password. We deliberately
  // do NOT accept a random or blank fallback: the gate is meant to be
  // explicit and operator-driven.
  if (!email.includes("@") || email.length < 3) return null;
  if (password.length < 8) return null;

  return { email, password };
}

/**
 * Human-readable diagnostic for operational logs. Never includes the
 * password or the email — just which conditions are unmet.
 */
export function describeDemoAdminBootstrapGate(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const reasons: string[] = [];
  if (isSaasMode) reasons.push("SAAS_MODE=true");
  if (normalizeAppEnv(env.APP_ENV) === "other") reasons.push("APP_ENV not local|demo");
  if (!isTruthyFlag(env.ALLOW_DEMO_ADMIN_BOOTSTRAP)) reasons.push("ALLOW_DEMO_ADMIN_BOOTSTRAP not truthy");
  if (!env.DEMO_ADMIN_EMAIL) reasons.push("DEMO_ADMIN_EMAIL missing");
  if ((env.DEMO_ADMIN_PASSWORD ?? "").length < 8) reasons.push("DEMO_ADMIN_PASSWORD too short");
  return reasons.length === 0 ? "gate satisfied" : reasons.join(", ");
}
