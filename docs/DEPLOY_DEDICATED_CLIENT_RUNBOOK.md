# Dedicated Client Runbook

## Purpose

Dedicated deployment for one real client.

This is not a separate app.

## Shape

- same codebase
- dedicated app deployment
- dedicated Postgres/Supabase database
- dedicated environment variables
- isolated infrastructure

## Environment

```bash
APP_ENV="production"
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
APP_BASE_URL="https://<client-domain>"
APP_DOMAIN="<client-domain>"
OPENAI_API_KEY="..."
SUPABASE_URL="..."
SUPABASE_SERVICE_ROLE_KEY="..."
```

## Rules

- Run migrations intentionally.
- Take backups before destructive maintenance.
- Do not run demo reset scripts in production.
- Keep business logic identical to SaaS and local development.
- Client-specific behavior belongs in data, config, environment, and `company.mode`.

## Relation To SaaS

Dedicated deployments and SaaS share:

- codebase
- Prisma schema
- domain rules
- mode config

They differ only by:

- environment
- deployment
- database ownership
- tenancy model
