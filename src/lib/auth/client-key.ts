/**
 * BDF-P1-003 — pseudonymous client key for the login rate limiter.
 *
 * We never persist a raw IP address. Every attempt row is keyed on
 * `sha256(salt || ':' || scope || ':' || ip)`, a 64-char hex digest.
 *
 * Salt policy (finalisation pass)
 * ===============================
 * - Every long-lived deployment MUST set `LOGIN_GUARD_SALT` to at least
 *   **32 bytes of entropy**. Accepted encodings (both floor at 32 bytes):
 *   - **hex**: ≥64 characters from `[0-9a-fA-F]`.
 *   - **base64url**: ≥43 characters from `[A-Za-z0-9_-]`.
 *   An arbitrary 32-character alphanumeric string with mixed content is
 *   NOT accepted; use `openssl rand -hex 32` (recommended) or
 *   `openssl rand -base64 32 | tr '/+' '_-' | tr -d '='`.
 * - When `APP_ENV in {local, demo, test}` **and** the salt is missing
 *   or malformed, the store falls back to a per-process random salt and
 *   logs one operational warning at boot. Safe for developer shells and
 *   unit tests but breaks cross-instance sharing.
 * - When `APP_ENV in {production, saas}` **or** `SAAS_MODE=true`, a
 *   missing/weak salt is a **hard failure**: `resolveClientKeySalt`
 *   throws `LoginGuardSaltMissingError`. Callers surface a fail-closed
 *   response so an operator misconfiguration cannot silently break
 *   cross-instance sharing.
 *
 * The salt is never logged in full and never returned to the client.
 */

import { createHash, randomBytes } from "node:crypto";

import { logger } from "@/lib/observability/logger";

import { isSaasMode } from "@/lib/saas-config";

// Entropy floors — 32 bytes of randomness represented in each encoding.
const MIN_TOKEN_HEX_LENGTH = 64;
const MIN_TOKEN_BASE64URL_LENGTH = 43;
const FALLBACK_SALT = randomBytes(32).toString("hex");
let fallbackWarningLogged = false;

/**
 * Reject anything that is not a valid hex-encoded or base64url-encoded
 * value with at least 32 bytes of entropy. Anything containing characters
 * outside both alphabets (spaces, punctuation, etc.) fails immediately.
 */
export function isAcceptableSaltFormat(value: string): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
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

export class LoginGuardSaltMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginGuardSaltMissingError";
  }
}

function normalizeAppEnv(raw: string | undefined): "local" | "demo" | "test" | "other" {
  const value = raw?.trim().toLowerCase();
  if (value === "local" || value === "demo" || value === "test") return value;
  return "other";
}

function isPermissiveEnv(env: NodeJS.ProcessEnv): boolean {
  return normalizeAppEnv(env.APP_ENV) !== "other" && !isSaasMode;
}

/**
 * Resolve the effective salt. See module docstring for the policy.
 *
 * @throws {LoginGuardSaltMissingError} when the deployment mode requires
 *         an explicit salt (production/SaaS/unknown APP_ENV) and none is
 *         configured or the configured value is too short.
 */
export function resolveClientKeySalt(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.LOGIN_GUARD_SALT?.trim() ?? "";
  if (isAcceptableSaltFormat(configured)) return configured;

  if (!isPermissiveEnv(env)) {
    // Do NOT include the salt value (present or absent) in the message.
    throw new LoginGuardSaltMissingError(
      "LOGIN_GUARD_SALT must be set to at least 32 random bytes (>=64 hex chars, e.g. `openssl rand -hex 32`) in this deployment mode. See docs/adr/0001-login-rate-limiter-backend.md.",
    );
  }

  if (!fallbackWarningLogged) {
    fallbackWarningLogged = true;
    logger.warn(
      { event: "auth.rate_limiter.salt_fallback" },
      "LOGIN_GUARD_SALT is unset or does not meet the entropy floor (>=64 hex or >=43 base64url) — using a per-process random salt. Rate limiter buckets will not share across restarts or replicas. Set LOGIN_GUARD_SALT via `openssl rand -hex 32`; required in production/SaaS.",
    );
  }
  return FALLBACK_SALT;
}

/**
 * Deterministically hash the raw IP into a pseudonymous key. The scope
 * is included so buckets for the same IP under different scopes hash to
 * different keys, preventing cross-scope leakage.
 */
export function computeClientKey(
  scope: string,
  ip: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const salt = resolveClientKeySalt(env);
  return createHash("sha256").update(`${salt}:${scope}:${ip}`).digest("hex");
}

/**
 * Testing hook — reset the module-scoped warning flag between tests so
 * the negative cases can re-assert it.
 */
export function __resetClientKeyWarnings(): void {
  fallbackWarningLogged = false;
}
