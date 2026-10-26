/**
 * BDF-P1-005 — gated demo/local display-user bootstrap.
 *
 * Parallel to `demo-admin-bootstrap.ts`. The default display user is no
 * longer seeded with the hard-coded PIN `303030`. A local/demo operator
 * can still seed one display user by setting all of:
 *
 *   - APP_ENV=local or demo,
 *   - SAAS_MODE unset/false,
 *   - ALLOW_DEMO_DISPLAY_BOOTSTRAP=true,
 *   - DEMO_DISPLAY_EMAIL=<plausible email>,
 *   - DEMO_DISPLAY_PASSWORD=<>= 8 chars>.
 *
 * Every other combination returns `null` and the caller must not create
 * a display user. Production/SaaS can never satisfy the gate.
 */

import { isSaasMode } from "@/lib/saas-config";

export type DemoDisplayBootstrap = {
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

export function resolveDemoDisplayBootstrap(
  env: NodeJS.ProcessEnv = process.env,
): DemoDisplayBootstrap | null {
  if (isSaasMode) return null;
  if (normalizeAppEnv(env.APP_ENV) === "other") return null;
  if (!isTruthyFlag(env.ALLOW_DEMO_DISPLAY_BOOTSTRAP)) return null;

  const email = env.DEMO_DISPLAY_EMAIL?.trim().toLowerCase() ?? "";
  const password = env.DEMO_DISPLAY_PASSWORD ?? "";
  if (!email.includes("@") || email.length < 3) return null;
  if (password.length < 8) return null;

  return { email, password };
}

export function describeDemoDisplayBootstrapGate(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const reasons: string[] = [];
  if (isSaasMode) reasons.push("SAAS_MODE=true");
  if (normalizeAppEnv(env.APP_ENV) === "other") reasons.push("APP_ENV not local|demo");
  if (!isTruthyFlag(env.ALLOW_DEMO_DISPLAY_BOOTSTRAP))
    reasons.push("ALLOW_DEMO_DISPLAY_BOOTSTRAP not truthy");
  if (!env.DEMO_DISPLAY_EMAIL) reasons.push("DEMO_DISPLAY_EMAIL missing");
  if ((env.DEMO_DISPLAY_PASSWORD ?? "").length < 8)
    reasons.push("DEMO_DISPLAY_PASSWORD too short");
  return reasons.length === 0 ? "gate satisfied" : reasons.join(", ");
}
