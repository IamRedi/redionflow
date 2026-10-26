/**
 * BDF-P1-002: safe first-boot administrator setup — pure helpers.
 *
 * This module contains no Prisma or Next.js imports so it can be unit-tested
 * in isolation. The actual DB-touching service lives in
 * `first-boot-setup-service.ts` and the HTTP surface lives in
 * `src/app/(public)/first-boot/*`.
 *
 * Design summary
 * ==============
 * - First-boot is **disabled by default** in every deployment mode.
 * - Activation requires `FIRST_BOOT_SETUP_ENABLED=true` **and** a valid
 *   high-entropy `FIRST_BOOT_SETUP_TOKEN` (>=64 hex chars or >=43 base64url
 *   chars, corresponding to >=32 random bytes).
 * - **SaaS is never allowed.** SaaS tenants create their admin via
 *   `/signup`; there is no defined platform-admin bootstrap requirement.
 * - Dedicated production / local / demo are allowed under the same gate.
 * - The submitted token is compared with `crypto.timingSafeEqual`. The
 *   token is never logged, persisted, or returned to the client. It is
 *   accepted only via a POST body (server action / API), never a URL.
 * - The activation check does **not** by itself imply a valid admin can
 *   be created — the service must additionally verify that no admin
 *   identity row already exists (see `first-boot-setup-service.ts`) and
 *   run the creation inside a transactional advisory lock.
 */

import { timingSafeEqual } from "node:crypto";

import { isSaasMode } from "@/lib/saas-config";

// ---------------------------------------------------------------------------
// Env parsing
// ---------------------------------------------------------------------------

const MIN_TOKEN_HEX_LENGTH = 64; // 32 random bytes → 64 hex chars
const MIN_TOKEN_BASE64URL_LENGTH = 43; // 32 random bytes → 43 base64url chars

function isTruthyFlag(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

/**
 * Reject tokens that do not clear the entropy floor. We accept two safe
 * encodings so operators can pick either `openssl rand -hex 32` or
 * `openssl rand -base64 32` (once padding is stripped).
 */
export function isAcceptableTokenFormat(token: string): boolean {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  if (trimmed.length === 0) return false;
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length >= MIN_TOKEN_HEX_LENGTH) return true;
  if (
    /^[A-Za-z0-9_-]+$/.test(trimmed) &&
    trimmed.length >= MIN_TOKEN_BASE64URL_LENGTH
  ) {
    return true;
  }
  return false;
}

export type FirstBootConfig =
  | { enabled: false; reason: string }
  | { enabled: true; token: string };

/**
 * Decide whether the *server-side* gate is open for this deployment. Does
 * NOT compare the submitted token — that happens in `verifyToken` below.
 *
 * Returns a diagnostic reason string when disabled so an operational log
 * line can explain the situation. The reason is safe to log; it never
 * contains the token, credentials, or user input.
 */
export function readFirstBootSetupConfig(
  env: NodeJS.ProcessEnv = process.env,
): FirstBootConfig {
  if (isSaasMode) return { enabled: false, reason: "SAAS_MODE=true" };
  if (!isTruthyFlag(env.FIRST_BOOT_SETUP_ENABLED)) {
    return { enabled: false, reason: "FIRST_BOOT_SETUP_ENABLED not truthy" };
  }
  const token = env.FIRST_BOOT_SETUP_TOKEN?.trim() ?? "";
  if (!isAcceptableTokenFormat(token)) {
    return { enabled: false, reason: "FIRST_BOOT_SETUP_TOKEN missing or too short" };
  }
  return { enabled: true, token };
}

/**
 * Constant-time comparison of the submitted token against the configured
 * token. Returns false when either side is not a string, when the encoded
 * lengths differ (which itself does not leak the token because we compare
 * lengths of the *encoded* input rather than any secret material), or when
 * the bytes differ.
 */
export function verifyToken(submitted: unknown, expected: string): boolean {
  if (typeof submitted !== "string" || typeof expected !== "string") return false;
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Credential validation
// ---------------------------------------------------------------------------

export const MIN_PASSWORD_LENGTH = 12;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAdminEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidAdminEmail(value: string): boolean {
  return value.length >= 3 && value.length <= 200 && EMAIL_RE.test(value);
}

export type FirstBootInputValidation =
  | { ok: true; email: string; password: string }
  | {
      ok: false;
      reason:
        | "invalid_email"
        | "password_too_short"
        | "password_mismatch"
        | "password_equals_token"
        | "password_equals_email";
    };

export function validateFirstBootInput(input: {
  email: unknown;
  password: unknown;
  confirmation: unknown;
  token: unknown;
}): FirstBootInputValidation {
  const email = normalizeAdminEmail(input.email);
  if (!isValidAdminEmail(email)) return { ok: false, reason: "invalid_email" };

  const password = typeof input.password === "string" ? input.password : "";
  const confirmation = typeof input.confirmation === "string" ? input.confirmation : "";
  // Order: identify more specific rejection reasons before falling back to
  // the generic length check.
  if (typeof input.token === "string" && password === input.token) {
    return { ok: false, reason: "password_equals_token" };
  }
  if (password.toLowerCase() === email) {
    return { ok: false, reason: "password_equals_email" };
  }
  if (password.trim().length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: "password_too_short" };
  }
  if (password !== confirmation) return { ok: false, reason: "password_mismatch" };

  return { ok: true, email, password };
}
