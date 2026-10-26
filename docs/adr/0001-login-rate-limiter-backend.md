# ADR-0001 — Login rate limiter backend

- **Status**: Accepted
- **Date**: 2026-07-22
- **Context**: BDF-P1-003 (security remediation backlog)

## Context

The audit finding SEC-004 flagged the current login guard
(`src/lib/auth/login-guard.ts`) as **in-memory only**. Its `Map<string, …>`
of attempt buckets:

- resets on every process restart;
- is not shared across replicas or serverless functions;
- has no bounded retention beyond passive expiry;
- would leak raw IP addresses if the process ever dumped its state.

BDF-P1-003 must replace it with a durable, shared, privacy-respecting
store while preserving the existing callers (admin login route + server
action, first-boot server action, worker login server action, display
login route, public SaaS login server action — 6 call sites in total).

Two backend candidates were evaluated:

- **A. PostgreSQL-backed** (Prisma table + advisory or per-row locking).
- **B. Redis / KV / other shared durable store** (Upstash, in-cluster
  Redis, Vercel KV, etc.).

## Decision

Adopt **Option A (PostgreSQL-backed)** with a swappable
`LoginAttemptStore` interface. Provide two adapters:

- **`PostgresLoginAttemptStore`** — production default. Uses a new
  `LoginAttempt` Prisma model, one row per `(scope, clientKey)` pair.
- **`InMemoryLoginAttemptStore`** — retained as a test-only fallback so
  unit tests can exercise the caller logic without a database.

## Decision criteria

| Criterion | PostgreSQL | Redis / KV |
| --- | --- | --- |
| Multi-instance / serverless | ✅ single DB shared by every replica | ✅ if provisioned |
| Cleanup guarantee | ✅ scheduled/opportunistic `DELETE` on updatedAt | ⚠ TTLs need explicit `EX` on every write; missing = leak |
| Bounded retention | ✅ single `WHERE updatedAt < now() - 24h` | ✅ if TTLs are set correctly everywhere |
| Privacy / IP pseudonymisation | ✅ store only `sha256(salt || ip || scope)` — never raw IP | ✅ same |
| Storage growth | ✅ small (dozens of rows on a real deployment; capped by cleanup) | ✅ same |
| Failure behaviour | ✅ shares the app DB; if the DB is down, login is already broken | ⚠ new failure domain; needs fail-closed policy |
| Local dev compat | ✅ same disposable Postgres BDF-P0-002 already provisions | ⚠ needs a second `docker run` or an external dev key |
| CI compat | ✅ CI already exposes `postgres:16` service (BDF-P1-001 completion) | ⚠ CI would need a Redis service |
| Operational cost | ✅ zero new infrastructure | ⚠ new dependency, new secrets to rotate, new monitoring |
| Reversibility | ✅ ADR-only decision; interface swap out later if needed | ✅ same |

## Consequences

**Positive**:

- No new infrastructure — every current deployment (Railway+Supabase,
  dedicated Docker+Postgres, and the CI job) already has a Postgres 16.
- The disposable-Postgres harness from BDF-P0-002 handles integration
  tests with zero additional setup.
- Cleanup, privacy, and retention live in one place (the store) rather
  than sprinkled across TTL calls.
- The `LoginAttemptStore` interface keeps the choice reversible — if a
  future deployment justifies a Redis backend, swap the adapter without
  touching call sites.

**Negative / accepted**:

- Every failed login attempt costs one row-level `UPSERT` on the shared
  DB. Expected traffic is small (audit thresholds allow ≤8 attempts per
  IP per 10 minutes before lockout). Adding a dedicated index keeps the
  reads O(1).
- If the DB is unreachable, all login attempts are rejected (fail
  closed). This matches the fact that the app is unusable without its
  DB anyway; it prevents an attacker from timing an outage to bypass the
  rate limiter.

**Neutral**:

- The migration is additive-only. No existing table is touched.

## Implementation details

- One row per `(scope, clientKey)`:
  - `scope`: `admin | display | worker | firstBoot`.
  - `clientKey`: `sha256(LOGIN_GUARD_SALT ‖ ':' ‖ scope ‖ ':' ‖ ip)` —
    64 hex chars. **Raw IPs are never persisted.**
- `LOGIN_GUARD_SALT` env var. Salt policy (finalisation pass):
  - Entropy floor: **32 random bytes**. Accepted encodings:
    - hex (recommended): ≥64 characters from `[0-9a-fA-F]` — generate
      with `openssl rand -hex 32`;
    - base64url: ≥43 characters from `[A-Za-z0-9_-]`.
    An arbitrary 32-character string is NOT sufficient; the format check
    (`isAcceptableSaltFormat`) rejects anything that is not a valid
    encoding.
  - `APP_ENV in {local, demo, test}` and not SaaS: unset or invalid ⇒
    per-process random fallback with one operational warning. Safe for
    developer shells; breaks cross-instance sharing.
  - `APP_ENV in {production, saas}`, `SAAS_MODE=true`, or any
    unrecognised `APP_ENV`: unset or invalid ⇒ **hard fail-closed** —
    `resolveClientKeySalt` throws `LoginGuardSaltMissingError` and every
    login attempt receives a 60 s retry hint until the operator fixes
    the configuration. The salt value is **never logged**, in full or
    in part.
- Retention has two layers:
  1. **Primary**: an operator-scheduled cleanup command
     (`npm run login-attempts:cleanup` /
     `tsx scripts/login-attempts-cleanup.ts`). Deletes rows with
     `updatedAt < now() - 24 hours`. Recommended cadence: hourly.
     Delegates to `PostgresLoginAttemptStore.cleanup()` so the retention
     SQL lives in one place.
  2. **Defence in depth**: the same `cleanup()` runs opportunistically
     from the write path at most once per 60 s per process. This
     guarantees retention even if the cron misfires for a short window,
     without incurring per-request DB writes.
- Existing thresholds preserved (`admin: 6`, `display: 6`, `worker: 8`,
  `firstBoot: 5`) with the same 10-minute window and 15-minute lockout.
- Fail closed on backing-store errors: `ensureLoginAllowed` throws → the
  route/action treats it as a failed login and redirects with the
  generic "unavailable" response (a fresh session cannot open under a DB
  outage).
- The `InMemoryLoginAttemptStore` remains available for unit tests via
  an explicit `LOGIN_ATTEMPT_STORE=memory` env override. Every other
  environment (dev, CI, production) uses the Postgres adapter.

## Alternatives considered and rejected

- **Do nothing / accept the in-memory limiter.** Rejected: SEC-004 is
  a High-severity finding and the audit explicitly requires durable
  storage.
- **File-backed sqlite side store.** Rejected: introduces a second
  database technology for a single feature.
- **Redis (Upstash / Vercel KV / in-cluster).** Rejected for now because
  no deployment currently runs Redis, CI would need a new service, and
  the `LoginAttemptStore` interface lets us reverse this decision later
  if a customer justifies it.

## Reversibility

Adding a Redis adapter later requires:

1. implement `RedisLoginAttemptStore` against the same interface;
2. flip `LOGIN_ATTEMPT_STORE=redis` and provide connection env vars;
3. delete unused `LoginAttempt` rows during the cutover.

The application code and every call site remain untouched.
