# Betriebshandbuch (Operations)

Technische Betriebs- und Entwicklungsnotizen für RediOnFlow. Der Überblick steht im [README](../README.md).

## Stack

- Next.js (App Router) + TypeScript
- Prisma + PostgreSQL
- Tailwind CSS + shadcn/ui
- Zod
- React Hook Form

## Login rate limiter (BDF-P1-003)

The login rate limiter is durable and shared across every replica of a
deployment. Attempt buckets are stored in the app's Postgres in a small
`LoginAttempt` table (see the migration
`20260722000000_add_login_attempt_table`). Design decisions are recorded
in `docs/adr/0001-login-rate-limiter-backend.md`.

Two configuration values matter to operators:

- `LOGIN_GUARD_SALT` — **required** for any long-lived deployment. Must
  encode at least **32 random bytes**. Accepted encodings:
  - hex (recommended): **≥64 characters** from `[0-9a-fA-F]` — generate
    with `openssl rand -hex 32`;
  - base64url: **≥43 characters** from `[A-Za-z0-9_-]`.
  An arbitrary 32-character string is not accepted — the value must be a
  valid encoding of at least 32 bytes.
  Client IPs are hashed as `sha256(salt || ':' || scope || ':' || ip)`
  before being stored — raw IPs are never persisted. Rotate the salt to
  invalidate every stored bucket.
  Policy per `src/lib/auth/client-key.ts`:
  - `APP_ENV` `local` / `demo` / `test` (and not SaaS): unset or invalid
    ⇒ per-process random fallback with a one-time warning. Safe for
    developer shells; breaks cross-instance sharing.
  - `APP_ENV` `production` / `saas`, `SAAS_MODE=true`, or any unrecognised
    value: unset or invalid ⇒ **hard fail-closed** on every login attempt
    until the value is provided.
- `LOGIN_ATTEMPT_STORE` — leave empty for the Postgres adapter
  (production default). `LOGIN_ATTEMPT_STORE=memory` selects the
  in-memory adapter (unit tests only).

Retention: rows older than 24 h are deleted **primarily** by a
scheduled cleanup command that operators must run periodically:

```bash
npm run login-attempts:cleanup
# equivalently:
tsx scripts/login-attempts-cleanup.ts
```

Wire this into a cron (dedicated hosts), a scheduled function (Vercel /
Railway), or an external scheduler. Recommended cadence: **hourly**. The
in-process opportunistic cleanup (at most once per 60 s per process)
remains as defence in depth so idle deployments still trim state during
any real login attempt.

Thresholds are unchanged from before — 6 attempts for admin/display, 8
for worker, 5 for first-boot, 10-minute window, 15-minute lockout.
Failure behaviour is documented in `src/lib/auth/login-guard.ts`: the
**read** path (`ensureLoginAllowed`) and the **write** path
(`registerFailedLogin`) both fail closed on store or salt errors so an
outage cannot be timed to bypass the limiter; `clearFailedLogin` on the
success path logs and moves on (fail-open is intentional because the
user has already authenticated by that point).

## i18n coverage (BDF-P8-007)

The office/admin UI must render fully in **de**, **en**, **it**, **sq**.
Worker profile keeps **pl** and **ro** as opt-in languages; the office
admin surface may legitimately fall back to English for those.

Check the current coverage against the German source dictionary:

```bash
npm run i18n:coverage
```

The parity test (`src/lib/i18n/coverage.test.ts`) locks the number of
keys that still fall back to German per language. Any PR that adds a
German key without translating it in `en/it/sq` fails CI. When you land
real translations, lower the ceiling in that test file in the same PR.

Policy and rollout are documented in `docs/I18N_PLAN.md`.

## Toolchain

BaumdienstFlow pins the runtime and build toolchain explicitly so that local
development, CI, and the production build all agree on the same versions.

**Supported versions**

- Node.js: **v22.x** (major line only — matches CI `actions/setup-node@v4`
  with `node-version: 22`, which installs the official Node 22 tarball).
- npm: **>=10.0.0 <12** (the official Node 22 tarball bundles npm 10.x; CI
  therefore runs on npm 10.x, and npm 11.x is also acceptable).
- TypeScript: pinned to the exact version **6.0.2** in `devDependencies` to
  prevent silent minor drift through a caret range.

**Runtime marker**

`.nvmrc` at the repository root contains `22`. Recommended setup:

```bash
nvm install
nvm use
node --version   # v22.x
npm --version    # 10.x or 11.x
npx tsc --version # 6.0.2
```

Unsupported Node or npm versions produce an `npm` warning at install time.
The `engines` field is advisory: the repository intentionally does not set
`engine-strict=true` in `.npmrc` in order to keep contributor friction low.

**Troubleshooting: `node` from nvm but `npm` from `/usr/bin`**

Some Linux distributions (notably Ubuntu 24.04+/Debian) ship `nodejs` and
`npm` as **separate** system packages, so `apt install nodejs` may pair a
current Node 22 with an older Ubuntu-packaged npm 9. If you see

```bash
$ command -v node
/usr/bin/node
$ command -v npm
/usr/bin/npm
$ npm --version
9.2.0
```

your shell is resolving Node from the system package but `npm` from Ubuntu's
`npm` .deb rather than the official Node 22 bundle. Fix by installing nvm
and using its Node 22 (which bundles npm 10.x):

```bash
# Install nvm (once) — https://github.com/nvm-sh/nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Reload your shell, then in this repo:
nvm install     # respects .nvmrc
nvm use
command -v node # should now resolve inside ~/.nvm/versions/node/...
command -v npm  # should now resolve inside the same nvm directory
npm --version   # 10.x
```

Do not replace the Ubuntu `npm` .deb globally — that is a system-level
change and is out of scope for this repository. Prefer nvm.

**Please do not upgrade the toolchain casually.** Changing the Node major,
the npm range, or the TypeScript version affects CI reproducibility and
the E2E workflow; open a dedicated PR referencing this section if the
pinning policy needs to move.

## Lokal starten

### Voraussetzungen

- Node.js (LTS empfohlen)
- Docker Desktop (für lokale PostgreSQL via Docker)

### Lokale Datenbank (MANDATORY)

Wir nutzen **ausschließlich lokale PostgreSQL** via Docker (keine Cloud/External Services).

Hinweis: Diese Regel beschreibt die lokale Entwicklungsumgebung. Die strategischen Deployment-Modi sind in `docs/DEPLOYMENT.md` dokumentiert: Railway + Supabase fuer Demo/Test/Portfolio, Docker + dedizierter Server/DB fuer Kundenproduktion.

#### Variante A: exakt wie gefordert (docker run)

```bash
docker run --name baumkalk-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=baumkalk \
  -p 5432:5432 \
  -v baumkalk-db-data:/var/lib/postgresql/data \
  -d postgres:16
```

Hinweis: Der benannte Volume `baumkalk-db-data` verhindert, dass Daten bei Container-Neustarts verloren gehen.

#### Variante B: PowerShell Script

```powershell
.\scripts\db-start.ps1
```

Sicheres Reset nur wenn explizit gewünscht:

```powershell
.\scripts\db-start.ps1 -Reset
```

Stop:

```powershell
.\scripts\db-stop.ps1
```

Container wirklich entfernen (nur wenn nötig):

```powershell
.\scripts\db-stop.ps1 -Remove
```

### Environment

Lege eine Datei `.env` an (oder nutze die mitgelieferte `.env`):

```bash
APP_ENV="local"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/baumkalk?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/baumkalk?schema=public"
OPENAI_API_KEY=""
APP_BASE_URL="http://localhost:3000"
APP_DOMAIN="localhost"
DEMO_MODE="false"
DEMO_RESET_ALLOWED="false"
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_STORAGE_BUCKET_WORKERS="worker-assets"
SUPABASE_STORAGE_BUCKET_BAUSTELLEN="baustelle-documents"
```

Hinweis:
- `APP_ENV` ist die vorbereitete Betriebsmodus-Variable fuer `local | demo | production`.
- Fuer den aktuellen Runtime-Pfad sind vor allem `DATABASE_URL`, `DIRECT_URL` und `OPENAI_API_KEY` relevant.
- `APP_BASE_URL`, `APP_DOMAIN`, `DEMO_MODE` und `DEMO_RESET_ALLOWED` sind bewusst als Deployment-/Runbook-Variablen dokumentiert, damit Railway/Supabase-Testbetrieb und spaeter Docker-Clientbetrieb dieselbe Env-Form behalten.
- Upload-/Datei-Regel:
  - Worker-Fotos, Worker-Dokumente, Baustelle-Dokumente und Import-Anhaenge werden in `Supabase Storage` gespeichert
  - ohne `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` muss der Upload klar fehlschlagen; neue Uploads duerfen nicht in `public/uploads/*` geschrieben werden
  - Standard-Buckets sind `worker-assets` und `baustelle-documents`
- Prisma-Regel:
  - `DATABASE_URL` ist die normale App-Verbindung
  - `DIRECT_URL` ist die direkte DB-Verbindung fuer Migrationen (`prisma migrate deploy`)
  - bei Supabase ist `DIRECT_URL` idealerweise **die direkte Postgres-Verbindung**, nicht der Pooler

### Install

```bash
npm install
```

### Datenbank migrieren

```bash
npm run db:migrate
```

Hinweis: Prisma ORM v7 generiert den Client nicht mehr automatisch bei `migrate`/`push`. Unsere Scripts erledigen `prisma generate` nach `db:migrate`/`db:push`.

### Dev-Server

```bash
npm run dev
```

Wenn Port `3000` blockiert ist oder ein alter `next dev` Prozess hängt:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen
taskkill /PID <PID> /F
npm run dev
```

## Workzone Daily Planner (aktuell)

### Rollen

- `Krijo plani e punes ditore` (`/workzone/plan`) ist **nur für Admin**.
- `Calendar` auf der Workzone-Startseite ist für **Admin + Worker** (read-only Planansicht im Popup).

### Tagesplanung erstellen (Admin)

1. Öffne `Workzone` → `Krijo plani e punes ditore`.
2. Wähle das Datum oben im Planer.
3. Plane per Drag-and-Drop:
   - links: `Worker (drag)`
   - rechts: `Makineri (drag)`
   - Mitte: **nur reale Baustellen** als Drop-Zonen (keine manuelle Extra-Kolonne).
4. Ziehe Worker/Maschinen auf die gewünschte Baustelle.
   - Ein Worker/eine Maschine kann pro Tag nur einmal zugeordnet sein.
5. Optional: Admin-Notiz pro Baustelle im Notizfeld setzen.
6. Klick `Ruaj diten`.

### Kalender öffnen (Admin + Worker)

1. Öffne `Workzone`.
2. Klick `Calendar`.
3. Im Popup Datum wählen.
4. Die gespeicherte Tages-Tabelle wird als saubere Karte angezeigt.

## Wiederholbarer Tagesablauf (immer gleich)

1. DB starten: `.\scripts\db-start.ps1`
2. App starten: `npm run dev`
3. Admin plant den Tag in `/workzone/plan`.
4. Team nutzt Workzone normal für Live-Arbeit (Baustelle, Tree-Checks, Tasks, Sessions).
5. Reports bei Bedarf drucken (Tagesbericht/Stundenzettel).
6. Lokal sauber beenden:
   - App-Prozess stoppen (`taskkill /PID <PID> /F`)
   - DB stoppen: `.\scripts\db-stop.ps1`

## Tests

Unit tests only (Vitest; excludes `*.integration.test.ts`):

```bash
npm test
```

Live-database integration suite (introduced by BDF-P1-001 to cover the
admin authentication surfaces end-to-end):

- **CI form** — expects `DATABASE_URL` (and `DIRECT_URL`) to point at an
  already-provisioned Postgres 16 whose migrations are up to date. This is
  what GitHub Actions runs after `prisma migrate deploy`:

  ```bash
  npm run test:integration
  ```

- **Local form** — provisions its own disposable Postgres 16 container,
  applies migrations, then delegates to the same `test:integration`
  script above; cleans up on exit / SIGINT / failure:

  ```bash
  npm run test:integration:local
  ```

## E2E locally

Run the Playwright suite against a disposable Postgres 16 without touching
the developer's `baumkalk-db` container or any shared database.

**Prerequisites**

- Docker Desktop or Docker Engine running.
- Node 22 and dependencies installed (`npm ci`).
- Playwright browser installed (`npx playwright install --with-deps chromium`),
  or the runtime will download it on first use.

**Command**

```bash
npm run test:e2e:local
```

**What the command creates**

- One PostgreSQL 16 container named `baumkalk-e2e-<random-id>` bound only to
  `127.0.0.1` on a dynamically allocated free port.
- Container storage is a `tmpfs` mount (`/var/lib/postgresql/data:rw`) so
  data lives only in memory and is discarded on stop; no persistent Docker
  volume is created.
- Test-only database credentials generated per run and passed only through
  environment variables to child processes.
- A Supabase Storage HTTP mock started inside `scripts/e2e-webserver.ts`
  (its default behaviour when `SUPABASE_URL` is empty).

**Isolation guarantees**

- The developer's normal `baumkalk-db` container is never referenced, started,
  stopped, or connected to. The disposable name always begins with the
  `baumkalk-e2e-` prefix.
- Any inherited `DATABASE_URL`/`DIRECT_URL` is overridden with the disposable
  values; the script refuses to run with `APP_ENV` outside the safe set.
- `DEMO_MODE=false` and `DEMO_RESET_ALLOWED=false` are forced in the child
  environment so `scripts/reset-*` scripts cannot activate.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are cleared so the built-in
  storage mock is used and no real bucket is contacted.
- No credentials, ports, or database URLs are written to disk. `.env` files
  are not modified.

**Expected runtime flow**

1. Verify Docker is available.
2. Allocate a free host port.
3. Start the disposable Postgres 16 container.
4. Wait for `pg_isready`.
5. Apply all committed Prisma migrations (`npx prisma migrate deploy`).
6. Invoke `npm run test:e2e`, which:
   - runs `scripts/e2e-webserver.ts`,
   - starts the Supabase Storage mock,
   - runs `npm run build` (production build),
   - starts `next start` on port 3100,
   - runs the Playwright suite against the production build.
7. Propagate the real Playwright exit code.
8. Remove the disposable container (and its `tmpfs`) in a `finally`/signal
   handler.

**Common failures**

- **`Docker is not available`** — Docker Desktop / Engine is not running.
- **`postgres did not become ready within 60000 ms`** — the base image is
  still being pulled or your host is heavily loaded. Re-run once the image
  cache is warm.
- **Playwright browser missing** — run `npx playwright install --with-deps chromium`.
- **Port collision** — the script requests a random free port for Postgres
  and reuses port `3100` for Next.js. If `3100` is occupied by a leftover
  `next start`, terminate it and retry.

**Verify nothing lingers**

After the command exits (success or failure):

```bash
docker ps -a --filter 'name=baumkalk-e2e-'
docker volume ls --filter 'name=baumkalk-e2e-'
```

Both should return an empty list. If a container ever survives an abrupt
kill (e.g. `kill -9` on this process), remove it manually:

```bash
docker rm -f $(docker ps -aq --filter 'name=baumkalk-e2e-')
```

**Warning**

This workflow **does not** use the developer's `baumkalk-db` container and
does not connect to any preview, staging, or production database. It also
does not run `scripts/reset-*` or any
seed script beyond `prisma migrate deploy`. Existing E2E specs create their
own test data as part of the smoke flows.

## Dashboard Snapshot (Admin)

- `/app/dashboard` nutzt jetzt eine read-only Snapshot-Schicht fuer die operative Uebersicht.
- Quelle sind ausschliesslich bestehende Tabellen: `WorkSession`, `Worker`, `Baustelle`, `TreeItem`, `Machine`.
- Aggregation + Cache leben in `src/lib/dashboard/dashboard-snapshot.ts`.
- Cache-Laufzeit: 60 Sekunden.
- UI-Verhalten:
  - 4 Kennzahlenkarten
  - 2 leichte Balkencharts
  - Zusatzmetriken fuer heute / Woche / Monat (`Netto`, `Pause`, `Brutto`)
  - Anzahl Worker mit heutiger Arbeit
  - verfuegbarer Safety-Lagerbestand gesamt + nach Kategorien
  - Auto-Refresh alle 60 Sekunden
  - manueller Refresh-Button mit gezielter Snapshot-Invalidierung
- Guardrails:
  - keine Aenderung an Workzone-Logik
  - keine Aenderung an Calculation Engine
  - keine DB-Schema-Aenderung
  - keine Realtime-Subscriptions fuer das Dashboard

## Admin Login (lokal / Testbetrieb)

**BDF-P1-001 + BDF-P1-002 update.** The admin login flow no longer contains
hard-coded plaintext PINs and no longer bootstraps demo admins by default.
Automatic admin creation is disabled on every deployment except a strictly
gated local/demo path (BDF-P1-001) or the operator-driven `/first-boot`
flow (BDF-P1-002).

Admins sign in at `/admin-login` with **e-mail and password**. Passwords
set in the app (first boot, owner adding or editing an admin) need at
least 12 characters. The API route and the form's server action share one
login rate limiter. Only workers and the display login keep 6-digit codes.

## First-boot administrator setup (BDF-P1-002)

Use this when you deploy a **fresh dedicated** BaumdienstFlow installation
and the admin table is still empty.

- The `/first-boot` endpoint is **404 by default** on every deployment
  mode (dedicated production, local, demo, SaaS). Presence of the URL
  itself does not reveal internal state.
- Activation requires **all** of:
  - `FIRST_BOOT_SETUP_ENABLED=true`
  - `FIRST_BOOT_SETUP_TOKEN=<>=32 random bytes as hex or base64url>`
  - `SAAS_MODE` unset or false — SaaS deployments always ignore first-boot
    and route their admin creation through `/signup` instead.
  - `APP_ENV` unrestricted; the flow is available on any dedicated
    deployment where the two env vars above are set.
- Generate a token with `openssl rand -hex 32` (recommended) or
  `openssl rand -base64 32` (strip padding).
- The token is compared with `crypto.timingSafeEqual`, is never
  logged/persisted/returned to the client, and is accepted only in the
  POST body (never URL, query, header without the CSRF surface).
- The page hosts a small form (setup token, admin email, display name,
  password, confirmation). Any input error, any wrong token, and any
  already-configured admin all yield the same generic `?error=denied`
  redirect so an attacker cannot enumerate.
- **Any** existing administrator identity row blocks first-boot — active,
  inactive, or a legacy plaintext row. A legacy plaintext installation
  therefore cannot be seized via first-boot; it must be recovered by
  operator intervention.
- Concurrency: setup runs inside a Postgres advisory-lock transaction
  (`pg_advisory_xact_lock`). Two racing valid requests serialise; the
  winner creates the admin, the loser sees `admin_exists` and yields the
  generic denied response.
- Password policy: at least 12 characters, cannot equal the setup token
  or the admin email. The first admin becomes the company owner
  (`User.isOwner`) and is the only one who can manage other admins.

**Operator sequence**

```bash
# 1. Verify no admin row exists yet in this database.
# 2. Generate a token and export it into the app process only.
export FIRST_BOOT_SETUP_ENABLED=true
export FIRST_BOOT_SETUP_TOKEN=$(openssl rand -hex 32)
# 3. Start the app (or restart it so the env vars are picked up).
# 4. Visit https://<host>/first-boot in a browser you trust. Submit the
#    token plus the admin email/password. You will be signed in and
#    redirected to /app/dashboard.
# 5. IMMEDIATELY unset both env vars and restart:
unset FIRST_BOOT_SETUP_ENABLED FIRST_BOOT_SETUP_TOKEN
# 6. Rotate any channel (Slack, email, chat log) that carried the token.
```

**Rate limiting**: setup shares the login-guard machinery under a
dedicated `firstBoot` scope (in-memory only, per BDF-P1-003 the durable
limiter is future scope). Excess failures lock the endpoint for the
standard 15-minute cooldown.

**Difference from the demo bootstrap**

| Path | Purpose | Env vars | Deployment |
| --- | --- | --- | --- |
| Demo bootstrap (BDF-P1-001) | Local dev convenience | `ALLOW_DEMO_ADMIN_BOOTSTRAP=true` + `DEMO_ADMIN_EMAIL` + `DEMO_ADMIN_PASSWORD` + `APP_ENV in {local, demo}` | Local/demo only, never production/SaaS |
| First-boot (BDF-P1-002) | Fresh production admin | `FIRST_BOOT_SETUP_ENABLED=true` + `FIRST_BOOT_SETUP_TOKEN=<>= 32 bytes>` | Dedicated (any APP_ENV); never SaaS |



- Admin login accepts only `passwordHash` values in scrypt format
  (`scrypt$1$…`). Any row whose stored hash is not scrypt-formatted is a
  **legacy plaintext record**: it cannot authenticate and the login route
  redirects with `?error=reset`. The operational warning does not include
  the email, the code, or the stored value.
- **No automatic admin creation in production or SaaS.** Bootstrap only
  runs when **all** of these hold:
  - `APP_ENV` is explicitly `local` or `demo`;
  - `ALLOW_DEMO_ADMIN_BOOTSTRAP=true`;
  - `SAAS_MODE` is unset or false;
  - `DEMO_ADMIN_EMAIL` is set to a plausible email;
  - `DEMO_ADMIN_PASSWORD` is set to at least 8 characters.
- No password is ever generated silently. Demo credentials come entirely
  from environment variables and are hashed with scrypt before they touch
  the database. See `.env.example` for the exact variables.
- The `prisma/seed.ts` script no longer creates any admin. Contributors
  either set the demo bootstrap env vars above or wait for **BDF-P1-002**,
  which will introduce the real first-boot admin setup flow.
- Legacy plaintext admin records (from old dedicated databases) cannot
  authenticate and must be reset.
- Source: `src/lib/auth/password.ts`,
  `src/lib/auth/demo-admin-bootstrap.ts`,
  `src/lib/auth/admin-session.ts`,
  `src/app/api/admin-login/route.ts`.
- **BDF-P1-005 update.** Worker and display authentication are now
  scrypt-only. See below.

## Worker / display credentials (BDF-P1-005)

- **Display login** (`/display-login`) mirrors the admin path. Legacy
  plaintext `passwordHash` rows (e.g. the removed `303030`) cannot
  authenticate; the login route returns `?error=reset`. Every write
  through the admin UI or the demo bootstrap now goes through
  `hashPassword` (scrypt).
- Demo display bootstrap requires all of:
  - `APP_ENV=local` or `demo`;
  - `ALLOW_DEMO_DISPLAY_BOOTSTRAP=true`;
  - `SAAS_MODE` unset or false;
  - `DEMO_DISPLAY_EMAIL` and `DEMO_DISPLAY_PASSWORD` (≥8 chars).
  Production/SaaS ignore these variables.
- **Worker login** (`/workzone/login`) uses a new nullable
  `Worker.loginCodeHash` column (additive migration
  `20260724000000_add_worker_login_code_hash`). Admin worker create/edit
  writes the 6-digit code as `hashPassword(code)` into `loginCodeHash`
  and clears the legacy `loginCode` column.
- Any worker whose `loginCodeHash` is NULL cannot authenticate.
  Recovery: an admin re-enters the code through the worker-management UI
  in `/app/admin`; the write path hashes it and clears the legacy
  column. This preserves existing UI ergonomics — the operator does not
  need to know the old plaintext code to migrate.
- **Snapshot hygiene (BDF-P4-004).** `npm run db:export` writes business
  data only: passwords, login codes, hashes, tokens, secrets, reset codes,
  and session-like fields are removed. Exports land in `data/`, which is
  ignored by Git; no data snapshots are committed.
- The `LoginAttempt` rate limiter (BDF-P1-003) still applies —
  `worker` and `display` scopes are unchanged.

## Admin Assistant + Dashboard

- Der Admin-Assistant kann jetzt dieselben read-only Dashboard-Zahlen verwenden wie `/app/dashboard`.
- Quelle dafuer bleibt die gecachte Snapshot-Schicht in `src/lib/dashboard/dashboard-snapshot.ts`.
- Fuer KPI-/Panel-/Dashboard-Fragen soll der Assistant bevorzugt den Dashboard-Snapshot verwenden:
  - Worker aktiv / nicht verfuegbar
  - Baustellen aktiv / heute abgeschlossen
  - Netto / Pause / Brutto heute
  - Stunden Woche / Monat
  - Worker mit Arbeit heute
  - Maschinenstatus
  - Safety-Lagerbestand
  - Wochenstunden nach Baustelle
  - Baustellen-Fortschritt
  - Worker-Rankings
- Ziel: menschliche, kurze Antworten auf Basis realer Snapshot-Daten, ohne Halluzinationen oder gemischte Fremd-Summen.

## Deployment

- Dedicated clients use isolated deployment and database.
- Future SaaS runs under RediOnFlow with Vercel + Supabase.
- Both paths keep the same codebase and Prisma schema.
- Product differences belong to `company.mode` and central feature flags.
- Strategic docs:
  - `docs/DEPLOYMENT.md`
  - `docs/SAAS_ARCHITECTURE.md`
  - `docs/DEPLOY_DEDICATED_CLIENT_RUNBOOK.md`

## Datei-Storage

- Strukturierte Daten bleiben in `Supabase Postgres`.
- Datei-Uploads laufen ueber `Supabase Storage`:
  - Worker-Profilbilder
  - Worker-Dokumente
  - Baustelle-Dokumente
  - Baustelle-Importanhaenge
- Die bestehenden DB-Felder bleiben unveraendert:
  - `Worker.profileImageUrl`
  - `Worker.documents`
  - `Baustelle.documents`
- Legacy `/uploads/...` URLs koennen weiter angezeigt/migriert werden, aber neue Uploads schreiben nicht mehr in `public/uploads/*`.
- Geplante Workzone-Offline-Faehigkeit ist dokumentiert in `docs/WORKZONE_OFFLINE_SYNC.md`; sie nutzt spaeter IndexedDB-Outbox + Server-Sync, nicht lokale Dateiablage im Repo.

## Validierung (Formulare)

- Zentrale Schemas: `src/lib/validation/schemas.ts` (Zod).
- React Hook Form + `@hookform/resolvers/zod` für u. a. **Einstellungen**, **Projekt anlegen**, **Projekt-Stammdaten**, **Vorlage → Positionen**.
- Server Actions validieren Payloads serverseitig (keine „nur Client“-Validierung).

## Prisma (v7) Architekturhinweis

- Der Prisma Client wird nach `src/generated/prisma` generiert (siehe `prisma/schema.prisma`).
- App-Code nutzt den Postgres Driver Adapter (`@prisma/adapter-pg`) – siehe `src/lib/db/prisma.ts`.
- CLI/Seed-Konfiguration liegt in `prisma.config.ts` (inkl. `dotenv`-Load).

## Docs Operating System (Kontinuität)

Die Wahrheit über Produkt/Architektur lebt unter `docs/`:

- `docs/ADN.md`: Produkt-DNA, Non‑Negotiables, Domain-Regeln
- `docs/SAAS_ARCHITECTURE.md`: RediOnFlow, Produktmodi, SaaS und Skalierung
- `docs/DEPLOYMENT.md`: Deployment- und Environment-Strategie
- `docs/ROADMAP.md`: task-basierte Planung mit Dependencies & AC
- `docs/DECISIONS.md`: Architektur-Entscheidungen (ADR light)
- `docs/adr/`: einzelne Architecture Decision Records

## Demo-Instanz

- `docker compose up --build` startet PostgreSQL und die App mit `APP_ENV=demo`. Beim Start laufen `prisma migrate deploy` und `prisma/seed.ts`.
- Der Seed ist idempotent: Existiert die Demo-Firma schon, passiert nichts. Die Daten sind vollständig erfunden.
- `DEMO_SEED_MODE` wählt das Produkt: ohne Wert oder `baumdienst` entsteht „Baumdienst Musterstadt GmbH“ (BaumdienstFlow, `prisma/seed-data.ts`), mit `bau` „Bau Beispielstadt GmbH“ (BauFlow, `prisma/seed-data-bau.ts`). Eine Datenbank enthält immer nur eine Demo-Firma.
- `npm run demo:reset` leert die Demo-Tabellen und spielt den Seed neu ein. Das Skript verweigert den Lauf bei `APP_ENV=production|saas` und verlangt bei `APP_ENV=demo` zusätzlich `DEMO_MODE=true` und `DEMO_RESET_ALLOWED=true`.
- Für eine öffentliche Demo den Reset nächtlich planen (z. B. 03:00 Uhr), damit Arbeitszeiten und Tagesplan zum aktuellen Tag passen und Änderungen von Besuchern verschwinden.
- `/demo/*` ist schreibgeschützt und ohne Login erreichbar, aber nur bei `APP_ENV=demo|local` (siehe `src/lib/public-demo.ts`).
- Der Demo-Container ist kein gehärtetes Produktions-Image. `SESSION_SIGNING_SECRET` hat in `docker-compose.yml` einen lokalen Standardwert; für jede von außen erreichbare Instanz einen eigenen Wert setzen.

### Live-Demo auf Railway

Laut `docs/DEPLOYMENT.md` läuft die Demo auf Railway. `railway.json` legt fest: Build über das `Dockerfile`, Healthcheck `/api/healthz`. Der Container führt beim Start Migrationen und Seed selbst aus.

1. Railway-Service mit `IamRedi/redionflow`, Branch `main`, verbinden.
2. **Eine neue, leere Datenbank** anlegen (Railway Postgres oder ein neues Supabase-Projekt). Nie eine Datenbank mit echten Kundendaten wiederverwenden.
3. Variablen setzen:
   - `APP_ENV=demo`, `DEMO_MODE=true`, `DEMO_RESET_ALLOWED=true`
   - `DATABASE_URL`, `DIRECT_URL` (neue Datenbank)
   - `APP_BASE_URL`, `APP_DOMAIN` (öffentliche Demo-URL)
   - `SESSION_SIGNING_SECRET` und `LOGIN_GUARD_SALT` (je `openssl rand -hex 32`)
   - Optional Admin-Zugang: `ALLOW_DEMO_ADMIN_BOOTSTRAP=true`, `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD` (12+ Zeichen)
4. Nächtlicher Reset: zweiter Service aus demselben Repo mit denselben Variablen, Start-Befehl `npm run demo:reset`, Cron `0 2 * * *` (UTC, also ca. 03:00/04:00 Uhr deutscher Zeit).
5. BauFlow-Demo: dieselben Schritte noch einmal mit eigener, neuer Datenbank und `DEMO_SEED_MODE=bau` auf App- und Reset-Service. Die beiden Demos teilen sich nichts außer dem Code.
