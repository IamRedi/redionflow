# RediOnFlow SaaS deployment runbook

Step-by-step provisioning for the SaaS deployment on Vercel + Supabase +
Stripe. The existing demo on Railway (the `prod` git branch) stays
untouched. This runbook targets a fresh SaaS deployment that serves the
`main` branch.

Read `docs/SAAS_ARCHITECTURE.md` and `docs/RLS.md` first for the
architectural background.

## 0. Prerequisites

- GitHub repo access (`IamRedi/baumkalk`).
- A Vercel account with the target team selected.
- A Supabase account with billing plan appropriate for production
  (pooler + Storage require paid tier for production traffic).
- A Stripe account with a live-mode API key + a test-mode key for staging.
- A verified domain (e.g. `app.redionflow.example`) with DNS control.

## 1. Supabase project

1.1 Create a new project. Note the project ref, region, and the initial
    `postgres` password. Store both in the password manager.

1.2 Retrieve the connection strings:
    - **Pooled (transaction pooling, port 6543)** — used by the app.
    - **Direct (session pooling, port 5432)** — used by Prisma migrate.

    Both URLs share the same username `postgres.<project-ref>`.

1.3 Create Storage buckets:
    - `worker-assets` (public read = OFF; policies added on first upload)
    - `baustelle-documents` (public read = OFF)

    Storage keys used at the app layer come from the service role, so no
    RLS on Storage is required for T-034 to be safe — but restrict object
    access via bucket policies before rolling out public URLs.

1.4 Verify the Postgres role that Prisma uses does **not** have
    `BYPASSRLS`. Supabase's `postgres` role is the migration role; the
    application should use a dedicated role for runtime. If you keep the
    default `postgres` for both, RLS still enforces because the migration
    enables `FORCE ROW LEVEL SECURITY` on every table.

## 2. Local prep against the SaaS DB

Run these from your dev machine — Vercel builds should not do the initial
migration on their own.

```bash
# .env.local should point at the SaaS DB via DIRECT_URL for prisma migrate.
export DIRECT_URL="postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres"
export DATABASE_URL="postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Apply every migration in prisma/migrations. The RLS migration
# (20260705180000_add_rls_policies) is idempotent — it turns RLS on;
# rollback SQL sits next to it.
npx prisma migrate deploy

# Sanity check: the plan catalog was seeded by the T-027 migration.
psql "$DIRECT_URL" -c "SELECT tier, displayName, priceCents FROM \"Plan\";"
```

Do NOT run `prisma db push` or `prisma migrate dev` against the SaaS DB —
that path is only for local development.

## 3. Vercel project

3.1 Import the GitHub repo `IamRedi/baumkalk` into Vercel. Name the project
    something distinct from any demo/dedicated projects (e.g. `redionflow-saas`).

3.2 In **Project Settings → Git**:
    - Production Branch: `main`
    - Deploy on Push: **enabled**
    - Ignored branches: `prod` (that branch belongs to the demo Railway)

3.3 In **Project Settings → Environment Variables**, add every var from
    `.env.saas.example`. Use the same file as a checklist. Real values go
    in Vercel; the file itself only carries placeholders and stays in git.

    Assign each var to the correct environment (Production / Preview /
    Development). `Preview` deploys should point at a Supabase branch
    project so preview PRs don't touch production data.

3.4 In **Project Settings → Build & Development Settings** override the
    build command if you want migrations to run on every deploy:

    ```
    npx prisma migrate deploy && npm run build
    ```

    Alternatively keep the default `npm run build` and run migrations
    manually before each deploy via step 2. The former is faster to
    iterate on, the latter is safer for large migrations.

3.5 In **Project Settings → Domains** attach the SaaS domain
    (`app.redionflow.example`) and follow Vercel's DNS instructions.

## 4. Stripe

4.1 Create products in Stripe matching the seeded plans:
    - Starter — recurring monthly EUR, price ~€29
    - Pro — recurring monthly EUR, price ~€79
    - Enterprise — recurring monthly EUR, price ~€199

    Copy each `price_...` id.

4.2 Update the seeded plans with their Stripe price ids:

    ```sql
    UPDATE "Plan" SET "stripePriceId" = 'price_starter_...'   WHERE tier = 'starter';
    UPDATE "Plan" SET "stripePriceId" = 'price_pro_...'       WHERE tier = 'pro';
    UPDATE "Plan" SET "stripePriceId" = 'price_enterprise_...' WHERE tier = 'enterprise';
    ```

4.3 Create a webhook endpoint pointing at
    `https://app.redionflow.example/api/stripe/webhook` and subscribe to:
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.payment_succeeded`
    - `invoice.payment_failed`

4.4 Copy the webhook signing secret into Vercel as `STRIPE_WEBHOOK_SECRET`.
    Copy the live secret key into `STRIPE_SECRET_KEY`.

4.5 Test the webhook using the Stripe CLI:

    ```bash
    stripe listen --forward-to app.redionflow.example/api/stripe/webhook
    stripe trigger customer.subscription.created
    ```

    Check `AuditLog` for `subscription.status_changed` entries after the
    trigger fires.

## 5. First deploy

5.1 Push a trivial change to `main` (or trigger a redeploy in Vercel).
    Verify the Vercel build succeeds; open the deploy URL.

5.2 Smoke-test the landing:
    - `/` renders with the three-product tab section.
    - CTA text says `14 Tage kostenlos starten` (SAAS_MODE gating).

5.3 Sign up a test tenant:
    - Pick `baumdienst` as the product.
    - Verify you land on `/app/dashboard`.
    - `AuditLog` shows `signup.completed`.
    - `Subscription` for the new company has `status = trialing` and
      `currentPeriodEnd` set 14 days out.

5.4 Verify `/api/portability/export` returns a well-formed JSON snapshot
    for the new tenant (should include only the tenant's own rows).

5.5 Confirm dedicated deployments do not regress: pull the demo Railway
    URL and verify it still works. The demo runs on the `prod` branch, so
    Vercel's `main` push should not have touched it.

## 6. RLS rollout

`RLS_ENFORCE=false` is the safe default at first launch. Once every server
action and API route wraps DB access in `withTenantContext(companyId, fn)`:

1. Set `RLS_ENFORCE=true` in a **preview** environment.
2. Run smoke tests as multiple tenants; confirm no cross-tenant leakage.
3. Ship to production. Watch `AuditLog` for unexpected `.rejected` /
   `.retryable_error` outcomes coming from RLS blocks.

Rollback: set `RLS_ENFORCE=false` OR apply
`prisma/migrations/20260705180000_add_rls_policies/rollback.sql` if you
need to disable RLS at the DB layer entirely.

## 7. Ongoing operations

- **Monitoring** — set up Vercel alerts on 5xx and Supabase on connection
  saturation.
- **Backups** — enable Supabase's daily backups. On top of that,
  scheduled `GET /api/portability/export` runs give per-tenant snapshots
  useful for disaster recovery + customer-support "restore last week".
- **Support access** — cross-tenant admin view is on the T-034 follow-up
  list. Until it lands, RediON support reads audit trails via direct DB
  queries against the pooler (staff role, MFA required).
- **Env rotation** — Stripe and Supabase keys rotate every 90 days. Add
  a calendar reminder.

## 8. Emergency rollback

If a bad deploy makes SaaS unusable:

1. Vercel → Deployments → previous good deploy → **Promote to Production**.
   This reverts the frontend without a git push.
2. If a Prisma migration is the cause, apply the migration's rollback SQL
   from `prisma/migrations/<id>/rollback.sql` (only migrations we author
   ship with rollback SQL; T-034 has one).
3. If Supabase itself is down, Vercel keeps serving cached static assets
   but every dynamic route will fail. Communicate via the status page and
   wait for Supabase.

The demo Railway deployment on the `prod` branch is untouched by any of
this and can serve as a fallback demo for prospects during an outage.
