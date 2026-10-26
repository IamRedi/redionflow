# Deployment Strategy

## Principle

One codebase supports two product tracks and one optional presentation/demo
path:

1. **BaumdienstFlow dedicated/private-server** — the current production app,
   hosted separately with its own database and `SAAS_MODE=false`.
2. **SaaS platform (RediOnFlow)** — the future multi-tenant deployment with
   BaumdienstFlow, BauFlow, and PersonalFlow selectable per tenant.
3. **Demo/presentation environments** — optional non-SaaS deployments for
   sales/testing, also with `SAAS_MODE=false`.

Deployment differences never fork the product. They live in env vars
(`SAAS_MODE`, `RLS_ENFORCE`, storage keys) and in per-deployment
infrastructure — not in application code.

## Deployment modes in practice

| | BaumdienstFlow dedicated/private-server | Demo/presentation | SaaS |
| --- | --- | --- | --- |
| Git branch | `prod` for current live, or client tag | `prod` or demo branch | `main` / SaaS release branch |
| Hosting | Docker VPS or Railway | Railway | Vercel |
| Database | Own Postgres / Supabase | Supabase (Railway-linked) | Supabase (new project) |
| `SAAS_MODE` | `false` | `false` | `true` |
| Multi-tenant | No | No | Yes |
| Signup / login | Disabled | Disabled | `/signup` + `/login` |
| Stripe | Not required | Not required | Required (webhook + keys) |
| Fleet GPS token | Env fallback | Env fallback | Per-tenant `FleetIngestToken` |
| RLS enforcement | Optional | Optional | Progressive (`RLS_ENFORCE=true` in staging first) |

## Branch strategy

- `main` — integration branch for verified application changes. Future SaaS
  work lands here behind env/mode gates and must not break the current
  dedicated BaumdienstFlow path.
- `prod` — current BaumdienstFlow live release branch. Railway auto-deploys
  this branch to the current production environment. No push to `prod` should
  ever happen accidentally.

Feature work lands through pull requests; the current Railway `prod` branch
moves only when a live BaumdienstFlow release is intentional.

As of 2026-07-13, the active live environment is Railway
`cozy-cooperation / production`, connected to the `prod` branch. This is the
BaumdienstFlow dedicated/private-server production path, not the future SaaS
deployment. Vercel is prepared for the future SaaS path but is not the current
live deployment for BaumdienstFlow.

SaaS production must be a separate production environment. Do not connect the
future RediOnFlow SaaS production to the current BaumdienstFlow Railway
`prod` environment, database, domain, or release branch. SaaS needs its own
hosting project, database/Supabase project, env vars, domain, secrets, and
deployment approvals.

`main` is expected to be protected. Normal work must land through a feature
branch, pull request, and the required GitHub Actions status check
`Lint, Typecheck, Test, Build, E2E`. See `docs/WORKFLOW.md` for the exact
operator workflow and branch ruleset settings.

## Environment shape

Baseline vars used across every deployment mode:

```
APP_ENV=local|demo|production|saas
DATABASE_URL=...          # pooled connection at runtime
DIRECT_URL=...            # direct connection for prisma migrate
APP_BASE_URL=...
APP_DOMAIN=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET_WORKERS=worker-assets
SUPABASE_STORAGE_BUCKET_BAUSTELLEN=baustelle-documents
OPENAI_API_KEY=...        # optional
```

SaaS-specific vars (see `.env.saas.example` for the full template):

```
SAAS_MODE=true
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
RLS_ENFORCE=false          # flip to true after adopting withTenantContext
FLEET_GPS_INGEST_TOKEN=""  # optional; SaaS prefers per-tenant tokens
```

Dedicated deployments keep `SAAS_MODE=false` (or omit it entirely). All
SaaS-only features (signup, Stripe, plan limits) short-circuit off.

## Runbooks

- **SaaS (Vercel + Supabase + Stripe):** `docs/DEPLOY_SAAS_RUNBOOK.md`
- **Dedicated clients:** `docs/DEPLOY_DEDICATED_CLIENT_RUNBOOK.md`
- **Row-Level Security:** `docs/RLS.md`
- **Data portability (SaaS ↔ dedicated migration):** `docs/DATA_PORTABILITY.md`
- **SaaS architecture:** `docs/SAAS_ARCHITECTURE.md`

## Storage

Structured data lives in Postgres / Supabase. File uploads live in
Supabase Storage under two buckets: `worker-assets` and
`baustelle-documents`. New company files must never be written to
`public/uploads` or into the repo — that path is legacy.

Portability exports (`GET /api/portability/export`) reference Storage
files by public URL; the actual blob copy is documented in
`docs/DATA_PORTABILITY.md`.

## Prisma at runtime

- Allowed: `prisma migrate deploy`, `prisma generate`.
- Vercel build phase: `prisma generate && next build` (default). Optional:
  prefix with `npx prisma migrate deploy && ...` to run migrations on
  every deploy.
- Never at runtime: `prisma migrate dev`, `prisma db push`, automatic
  destructive reseed.

Long-running or destructive migrations should be applied manually via
`DIRECT_URL` from an operator machine before merging the migration into
`main`.

## Emergency

- **Bad deploy on SaaS:** Vercel → Deployments → promote previous good
  deploy. If a Prisma migration is the cause, apply
  `prisma/migrations/<id>/rollback.sql` (only for our migrations that
  ship rollback SQL — currently T-034 does).
- **SaaS DB outage:** static assets keep serving; dynamic routes fail
  gracefully. Communicate via status page.
- **Demo continues serving:** the Railway demo on the `prod` branch is
  independent and can act as a fallback presentation surface during a
  SaaS incident.
