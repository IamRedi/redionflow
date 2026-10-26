# SaaS pre-deploy checklist

Tick every item before the first production deploy to Vercel. This is the
short version — `docs/DEPLOY_SAAS_RUNBOOK.md` has the full step-by-step.

## Provider accounts

- [ ] Vercel account + team selected
- [ ] Supabase account with billing plan enabled
- [ ] Stripe account with live keys ready
- [ ] Domain registered + DNS access confirmed (`app.redionflow.example`)

## Supabase

- [ ] New project created (SaaS-only, not shared with demo)
- [ ] Region matches Vercel region (`fra1` → Frankfurt or nearest EU)
- [ ] `postgres` password stored in password manager
- [ ] Pooled URL (`:6543`) copied for `DATABASE_URL`
- [ ] Direct URL (`:5432`) copied for `DIRECT_URL`
- [ ] Storage buckets created: `worker-assets`, `baustelle-documents`
- [ ] Storage bucket policies restrict object access to service role
- [ ] Migrations applied via `npx prisma migrate deploy` (see runbook §2)
- [ ] `SELECT tier, "displayName" FROM "Plan";` returns the three seeded rows

## Stripe

- [ ] Products created for `starter`, `pro`, `enterprise`
- [ ] Recurring prices set (monthly, EUR)
- [ ] Price IDs copied into the DB via `UPDATE "Plan" SET "stripePriceId" = ...` (see runbook §4)
- [ ] Webhook endpoint pointed at `https://<domain>/api/stripe/webhook`
- [ ] Webhook subscribes to `customer.subscription.{created,updated,deleted}` + `invoice.payment_{succeeded,failed}`
- [ ] Webhook signing secret saved for env
- [ ] Live secret key saved for env

## Vercel

- [ ] Repo `IamRedi/baumkalk` imported into a NEW Vercel project (not the demo)
- [ ] Production branch set to `main`
- [ ] `prod` branch marked as ignored (via Vercel git settings or `vercel.json`)
- [ ] All env vars from `.env.saas.example` filled in
  - [ ] `SAAS_MODE=true`
  - [ ] `APP_ENV=saas`
  - [ ] `APP_BASE_URL`, `APP_DOMAIN`
  - [ ] `DATABASE_URL`, `DIRECT_URL`
  - [ ] `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `SUPABASE_STORAGE_BUCKET_WORKERS`, `SUPABASE_STORAGE_BUCKET_BAUSTELLEN`
  - [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - [ ] `RLS_ENFORCE=false` (flip later)
  - [ ] `FLEET_GPS_INGEST_TOKEN=""` (SaaS uses per-tenant tokens)
  - [ ] `DEMO_MODE=false`, `DEMO_RESET_ALLOWED=false`
- [ ] Custom domain attached and DNS verified
- [ ] Build succeeds (`npm run build`)
- [ ] `vercel.json` regions match the Supabase region

## Smoke tests after first deploy

- [ ] `/` renders with three-product tabs
- [ ] Landing CTA reads `14 Tage kostenlos starten` (SaaS-gated)
- [ ] `/signup?mode=baumdienst` creates a Company + admin User + trialing Subscription
- [ ] `/login` accepts the credentials created via signup
- [ ] `AuditLog` shows `signup.completed` for the new tenant
- [ ] `/api/portability/export` returns valid JSON for the new tenant
- [ ] Stripe test event triggers a webhook and records `subscription.status_changed` in `AuditLog`
- [ ] Demo Railway (`prod` branch) is unaffected — still serves the demo

## Post-launch

- [ ] Vercel alerts on 5xx and function duration limits
- [ ] Supabase alerts on connection saturation and Storage quota
- [ ] Stripe dashboard alerts on payment failures
- [ ] Backup schedule: Supabase daily + weekly `GET /api/portability/export` cron per tenant
- [ ] Env rotation calendar reminders (Stripe, Supabase — every 90 days)
- [ ] Adopt `withTenantContext` on server actions incrementally; when the
      sweep is complete flip `RLS_ENFORCE=true` in preview first, then prod

## Follow-ups tracked in HANDOFF

- Cross-tenant support view for RediON staff
- Checkout redirect + customer portal link
- `scripts/import-company.ts` for portability imports
- Password reset flow
- Localize `ProductsSection` strings
