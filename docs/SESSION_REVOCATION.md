# Session revocation (BDF-P8-007)

## Why

Every SaaS platform that ships enterprise-grade auth has to answer
"what happens when a stolen laptop / a rotated password / an
off-boarded admin still has a live cookie". Today BaumdienstFlow /
BauFlow / RediOnFlow leaks that scenario: cookies remain valid for
30 days regardless of any policy the operator invokes.

We fix this with a **session epoch** attached to every `User` and
`Worker` row. Cookies carry the epoch that was in force when they
were minted; a request whose cookie epoch is lower than the DB
epoch is rejected. Password rotation, admin removal, or an
explicit "sign out everywhere" action bumps the DB epoch and
retires every outstanding cookie for that account.

## Two-phase rollout

### Phase 1 — this PR
- Additive migration `20260730000000_add_session_epoch` adds
  `sessionEpoch INTEGER NOT NULL DEFAULT 0` to `User` and `Worker`.
- `src/lib/auth/session-epoch.ts` ships four helpers:
  - `getUserSessionEpoch(prisma, userId)` — read.
  - `getWorkerSessionEpoch(prisma, workerId)` — read.
  - `revokeUserSessions(prisma, userId)` — atomic `+1`.
  - `revokeWorkerSessions(prisma, workerId)` — atomic `+1`.
  - `isEpochStillValid(cookieEpoch, dbEpoch)` — the pure predicate
    Phase 2 will call inside `getCurrentAdmin` / `getCurrentWorker`.
- Twelve unit tests cover read / rotate / null-row / missing-cookie
  cases so Phase 2 wiring can assume the API is stable.

**Nothing in the production flow reads or writes the new column
yet.** The migration is safe to deploy on its own: every existing
cookie continues to work, no rotation happens, no user is signed
out.

### Phase 2 — follow-up PR

1. **Cookie payload.** Change `ADMIN_COOKIE` and `WORKER_COOKIE` to
   carry a signed `{ id, epoch }` payload instead of the bare id.
   Legacy cookies (no epoch) still validate because
   `isEpochStillValid` treats missing epoch as 0.
2. **Guard.** Extend `getCurrentAdmin` / `getCurrentWorker` /
   `getCurrentDisplayUser` to read the epoch from the row and reject
   the cookie via `isEpochStillValid`. On mismatch, delete the
   cookie and treat the session as anonymous.
3. **Trigger points.** Wire `revokeUserSessions` into:
   - the password-reset flow (once shipped),
   - `removeAdminAction` in `profile/actions.ts`,
   - a new admin UI "Sign out everywhere" button.

   Wire `revokeWorkerSessions` into:
   - the worker-management "rotate login code" server action,
   - a per-worker "sign this worker out everywhere" button on the
     admin worker card.

4. **Telemetry.** Add a `logger.info({ event: "auth.session_revoked",
   userId | workerId, reason })` on every revocation so operators
   can correlate cookie failures to the deliberate action that
   caused them.

## Why we don't ship Phase 2 in the same PR

The migration touches every production row. Deploying and running it
for a week before we start rejecting cookies gives us:
- confirmation that the schema change is stable across replicas;
- an escape hatch (rollback: `DROP COLUMN`) if any consumer breaks;
- time to update the on-call playbook so a spike in cookie
  rejections after Phase 2 is understood, not treated as an
  incident.

## Rollback

```sql
ALTER TABLE "User" DROP COLUMN "sessionEpoch";
ALTER TABLE "Worker" DROP COLUMN "sessionEpoch";
```

Nothing else has to change — no production code path reads the
column yet.
