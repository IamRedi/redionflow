/**
 * BDF-P1-003 — login rate-limiter facade.
 *
 * This module used to hold an in-memory `Map` of attempt buckets that
 * reset on every process restart and could not share state across
 * replicas. Per SEC-004 and ADR-0001
 * (`docs/adr/0001-login-rate-limiter-backend.md`), the storage layer now
 * lives behind a swappable `LoginAttemptStore` interface — Postgres in
 * production, in-memory only when explicitly selected for unit tests.
 *
 * The public API preserves the four exports the codebase already
 * depends on (`ensureLoginAllowed`, `registerFailedLogin`,
 * `clearFailedLogin`, `getClientIp`) so the six call sites only needed
 * to `await` the calls that were previously synchronous. Thresholds and
 * scopes (`admin: 6`, `display: 6`, `worker: 8`, `firstBoot: 5`) are
 * unchanged.
 *
 * Fail-closed: if the backing store throws (DB outage, unavailable
 * Redis, etc.), `ensureLoginAllowed` returns `ok: false` with a short
 * retry hint. This mirrors "the app is broken anyway" and prevents an
 * attacker from timing an outage to bypass the limiter.
 */

import { computeClientKey } from "@/lib/auth/client-key";
import { logger } from "@/lib/observability/logger";
import {
  getDefaultLoginAttemptStore,
  type LoginScope,
} from "@/lib/auth/login-attempt-store";

// Re-export the type so existing imports (`type LoginScope`) keep
// working from a single module.
export type { LoginScope } from "@/lib/auth/login-attempt-store";

function normalizeIp(value: string | null | undefined) {
  if (!value) return "unknown";
  return value.split(",")[0].trim().toLowerCase();
}

export function getClientIp(headers: Headers) {
  return normalizeIp(
    headers.get("x-forwarded-for") ??
      headers.get("x-real-ip") ??
      headers.get("cf-connecting-ip"),
  );
}

/**
 * Documented failure behaviour (BDF-P1-003 finalisation pass).
 *
 * `ensureLoginAllowed` (read path):
 *   - store read error → **fail closed**: return
 *     `{ok:false, retryAfterSeconds:60}` so an outage cannot be timed to
 *     bypass the limiter.
 *   - salt missing/weak in production/SaaS → **fail closed** for the
 *     same reason (also emits an operational log line naming the env
 *     var).
 *
 * `registerFailedLogin` (write path):
 *   - store write error → **fail closed at the caller level**: the
 *     function signals failure via `retryAfterSeconds: 60`. Existing
 *     callers already redirect with a generic "too many attempts" or
 *     "unavailable" response, so the failed attempt is not silently
 *     forgotten. This avoids the previous silent-swallow behaviour that
 *     could weaken enforcement if the store was flaky.
 *   - salt missing/weak → **fail closed** the same way.
 *
 * `clearFailedLogin` (write path, success side):
 *   - store error → log and continue. Failing to clear the counter is
 *     annoying (the user's next failure may be counted twice) but
 *     never authorises a login; the outer success path has already
 *     signed the user in. Fail-**open** is acceptable here.
 *   - salt missing/weak → same: log and continue.
 */
export async function ensureLoginAllowed(
  scope: LoginScope,
  ip: string,
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const store = getDefaultLoginAttemptStore();
  let key: string;
  try {
    key = computeClientKey(scope, ip);
  } catch (error) {
    logger.error(
      { event: "auth.rate_limiter.salt_missing", scope },
      "LOGIN_GUARD_SALT missing/weak; failing closed",
      error,
    );
    return { ok: false, retryAfterSeconds: 60 };
  }
  try {
    return await store.ensureAllowed(scope, key);
  } catch (error) {
    logger.error(
      { event: "auth.rate_limiter.ensure_allowed_failed", scope },
      "ensureAllowed failed; failing closed",
      error,
    );
    return { ok: false, retryAfterSeconds: 60 };
  }
}

export async function registerFailedLogin(scope: LoginScope, ip: string) {
  const store = getDefaultLoginAttemptStore();
  let key: string;
  try {
    key = computeClientKey(scope, ip);
  } catch (error) {
    logger.error(
      { event: "auth.rate_limiter.salt_missing", scope, phase: "registerFailed" },
      "LOGIN_GUARD_SALT missing/weak on registerFailed; failing closed",
      error,
    );
    return { attempts: 0, lockedUntil: Date.now() + 60_000, retryAfterSeconds: 60 };
  }
  try {
    const result = await store.registerFailed(scope, key);
    return {
      attempts: result.attempts,
      lockedUntil: result.retryAfterSeconds
        ? Date.now() + result.retryAfterSeconds * 1000
        : null,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  } catch (error) {
    // Fail closed on write errors so a flaky store cannot silently allow
    // continued attempts. Callers already redirect on any non-null
    // retryAfterSeconds.
    logger.error(
      { event: "auth.rate_limiter.register_failed_failed", scope },
      "registerFailed failed; failing closed",
      error,
    );
    return { attempts: 0, lockedUntil: Date.now() + 60_000, retryAfterSeconds: 60 };
  }
}

export async function clearFailedLogin(scope: LoginScope, ip: string): Promise<void> {
  const store = getDefaultLoginAttemptStore();
  let key: string;
  try {
    key = computeClientKey(scope, ip);
  } catch (error) {
    // Non-fatal — the caller has already authenticated successfully. Log
    // and move on. Fail-open on the success side is intentional.
    logger.warn(
      { event: "auth.rate_limiter.salt_missing", scope, phase: "clearFailed" },
      "LOGIN_GUARD_SALT missing/weak on clearFailed; leaving counter untouched",
      error,
    );
    return;
  }
  try {
    await store.clear(scope, key);
  } catch (error) {
    logger.warn({ event: "auth.rate_limiter.clear_failed_failed", scope }, "clearFailed failed", error);
  }
}
