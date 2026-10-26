# Development Workflow

This repo uses a protected-branch workflow for production safety.

## Branch Flow

1. Create a feature branch from `main`.
2. Make changes locally in VS Code.
3. Run the local verification commands.
4. Push the feature branch to GitHub.
5. Open a pull request into `main`.
6. Wait for GitHub Actions CI to pass.
7. Merge into `main`.
8. Release to the current Railway BaumdienstFlow production environment through
   `main -> prod` after `main` is verified and the release is intentional.

Do not work directly on `main` unless the change is an emergency and the
maintainer accepts the risk.

## Current BaumdienstFlow Production Release Flow

The current live Railway environment is connected to the `prod` branch:

- Railway project/environment: `cozy-cooperation / production`
- Git branch connected to Railway: `prod`
- Public domain: `www.baumdienstflow.info`
- Product mode: dedicated/private-server BaumdienstFlow, `SAAS_MODE=false`

Use this flow to release verified `main` changes:

1. Confirm `main` is green in GitHub Actions.
2. Open a pull request from `main` into `prod`.
3. Merge only when the change is intentional for the live Railway environment.
4. Railway auto-deploys after `prod` receives the merge commit.
5. Smoke-test the live domain after Railway reports a successful deployment.

Do not push directly to `prod` unless this is an emergency rollback/fix.

## Local Verification

Run these before pushing a branch:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

For normal day-to-day work, `npm ci` is only needed after dependency or
lockfile changes. Before a pull request, run the full list.

## GitHub Actions CI

The CI workflow lives in `.github/workflows/ci.yml`.

It runs:

```bash
npm ci
npx playwright install --with-deps chromium
npm run lint
npm run typecheck
npm test
npx prisma migrate deploy
npm run build
npm run test:e2e
```

CI starts a temporary PostgreSQL service and applies Prisma migrations before
the production build and Playwright smoke tests. This keeps routes that use
Prisma, such as `/workzone/login`, testable in GitHub without touching
production data.

## Branch Protection / Ruleset

`main` should be protected with a GitHub ruleset:

- Ruleset name: `Protect main`
- Enforcement: `Active`
- Target branch: default branch / `main`
- Require a pull request before merging: enabled
- Required approvals: `0` for a solo maintainer, `1` when a second reviewer is available
- Require status checks to pass: enabled
- Required status check: `Lint, Typecheck, Test, Build, E2E`
- Require branches to be up to date before merging: enabled
- Restrict deletions: enabled
- Block force pushes: enabled

Do not enable deployment-required rules until the CI flow is stable and the
production deployment provider has been reviewed.

## Current Verified CI Run

The CI workflow was verified on GitHub for branch `i18n-admin-worker-ci`.

- Commit: `be0a2eb`
- Workflow: `CI`
- Result: success
- Run: `https://github.com/IamRedi/baumkalk/actions/runs/29241893105`

## Deployment

The current live deployment is BaumdienstFlow on Railway from `prod`.

`vercel.json` is kept for the future SaaS deployment path on Vercel. The SaaS
track will later support BaumdienstFlow, BauFlow, and PersonalFlow as tenant
modes; it is not the current production deployment. Do not change Vercel config
as part of ordinary Railway release work.

SaaS production must be deployed to a separate production environment, not to
the current Railway `prod` environment that serves BaumdienstFlow. Treat SaaS
release approval, domain, database, secrets, and deployment provider as a
separate production track.

Pull requests should be merged only after CI is green. After a `prod` merge,
Railway is responsible for deploying the live BaumdienstFlow production
environment.
