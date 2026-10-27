# BaumdienstFlow / RediOnFlow - ROADMAP

> **Historisch.** Diese Roadmap stammt aus der Entwicklung im privaten Vorgänger *baumkalk* und beschreibt die damalige Arbeitsweise (WORKLOG, HANDOFF, PersonalFlow). Sie wird nicht mehr fortgeschrieben. Den aktuellen Stand beschreibt [PROJEKTSTAND.md](PROJEKTSTAND.md).

> Status: `todo | doing | done | blocked`

## T-001 – Initialize foundation

- **status**: done
- **why**: Legt das Fundament (Repo-Struktur, Stack, Docs-OS, App-Shell)
- **dependencies**: —
- **files touched**:
  - `package.json`, `.gitignore`, `README.md`
  - `docs/*`
  - `src/app/*`, Tailwind/TS/ESLint configs
- **acceptance criteria**
  - Next.js App Router läuft lokal (`npm run dev`)
  - `docs/`-System vorhanden und sinnvoll befüllt
  - Basis-Shell (Layout + Navigation) vorhanden

## T-002 – Define database schema (Prisma) + seed

- **status**: done
- **why**: Saubere, relationale Domänenbasis für Referenzen & Projekte
- **dependencies**: T-001
- **files touched**:
  - `prisma/schema.prisma`
  - `prisma/seed.ts`
  - `package.json` scripts
- **acceptance criteria**
  - Prisma Schema enthält Kernmodelle (User, CompanyProfile, OverheadSettings, LaborRole, Machine, Templates, Project + Position + Cost Items)
  - Migration/Push + Seed funktionieren lokal
  - Seed erzeugt kohärente Demo-Daten für Baumdienst (DE)
  - Lokale Postgres-Instanz via Docker dokumentiert (Start/Stop Scripts)
  - `.env` zeigt lokale Verbindung (postgres/postgres@localhost:5432/baumkalk)
  - Verifizierung: `npm run db:migrate` + `npm run db:seed` mit laufendem Container

## T-003 – App shell & navigation (serious B2B)

- **status**: done
- **why**: Nutzer brauchen stabile Orientierung + schnelle Zugriffe
- **dependencies**: T-001
- **files touched**: `src/app/(app)/*`, `src/components/shell/*`
- **acceptance criteria**
  - Sidebar + Header + Dark Mode
  - Navigation: Dashboard, Projekte, Templates, Lohnrollen, Maschinen, Einstellungen

## T-004 – Company settings (Overheads & modes)

- **status**: done
- **why**: Overheads sind Kern der Kalkulationslogik und müssen UI-editierbar sein
- **dependencies**: T-002, T-003
- **files touched**: settings UI + server actions + db
- **acceptance criteria**
  - Editierbar: BGK/AGK/Wagnis/Gewinn/MwSt + Modus-Flags
  - Persistiert + wird in Engine als Defaults nutzbar

## T-005 – Labor references (CRUD + derivation)

- **status**: done
- **why**: Lohn ist kritisch; effektiver Stundenverrechnungssatz muss transparent sein
- **dependencies**: T-002, T-003, T-004
- **files touched**: labor UI + engine labor module + tests
- **acceptance criteria**
  - CRUD für Lohnrollen inkl. active/inactive
  - UI zeigt Herleitung des effektiven Stundensatzes

## T-006 – Machine library (CRUD)

- **status**: done
- **why**: Maschinenkosten sind zentrale EK-Komponente
- **dependencies**: T-002, T-003
- **files touched**: machine UI + db
- **acceptance criteria**
  - CRUD Maschinen inkl. Stunden-/Tagessatz + active/inactive

## T-007 – Templates

- **status**: done
- **why**: Wiederverwendbare Defaults beschleunigen reale Büroarbeit
- **dependencies**: T-002, T-003, T-004, T-005, T-006
- **files touched**: templates UI + db + seed presets
- **acceptance criteria**
  - Templates anlegbar, Position-Presets + Standard-Overheads

## T-008 – Projects & positions (CRUD)

- **status**: done
- **why**: Kernworkflow: Projekte mit Positionen und Kostenzeilen
- **dependencies**: T-002, T-003
- **files touched**: project pages + db
- **acceptance criteria**
  - Projekte/Positionen anlegen/ändern/listen
  - Kostenzeilen: Lohn/Maschine/Material/Fremdleistung

## T-009 – Calculation engine (single source of truth)

- **status**: done
- **why**: zentrale deterministische Engine, unabhängig von UI
- **dependencies**: T-001
- **files touched**: `src/lib/calculation/*`, `vitest.config.ts` + tests
- **acceptance criteria**
  - Position- & Projekt-Summen inkl. EK/HK/SK/Wagnis/Gewinn/MwSt
  - Overhead-Modi unterstützt
  - Tests decken Kernfälle + Edgecases
  - Anbindung an DB/UI: `position-from-db.ts`, `overhead-map.ts`, Positions-UI

## T-010 – Live calculation UI (editor + breakdown)

- **status**: done
- **why**: Nutzer müssen sehen, wie Preise entstehen (Transparenz)
- **dependencies**: T-009, T-008
- **files touched**: position editor UI + summary components
- **acceptance criteria**
  - Live Breakdown pro Position + gesamt
  - Overrides sichtbar & nachvollziehbar

## T-011 – Dashboard summaries

- **status**: done
- **why**: schnelle Übersicht, „office friendly“
- **dependencies**: T-008
- **files touched**: dashboard UI + queries
- **acceptance criteria**
  - Projektanzahl, letzte Aktivitäten, Quick Actions

## T-012 – Print-ready quote summary

- **status**: done
- **why**: Angebotsausgabe als saubere, druckfähige Übersicht
- **dependencies**: T-010
- **files touched**: print view + styling
- **acceptance criteria**
  - Professionelles Layout, Summen, Netto/Brutto optional

## T-013 – Polish, validation, tests, cleanup

- **status**: done
- **why**: production-minded Qualität, weniger Risiken
- **dependencies**: T-012
- **files touched**: quer
- **acceptance criteria**
  - Validierung (Zod), Form UX, stabile Tests, README vollständig

## T-014 - Smart Baustellen Import

- **status**: done
- **why**: Workzone-Baustellen sollen aus realen Baumlisten in Excel/CSV und KML-GPS-Daten angelegt werden koennen.
- **dependencies**: Workzone v0.1, Baustelle/TreeItem Prisma models
- **files touched**:
  - `src/app/(admin)/app/baustellen/import/*`
  - `src/app/(admin)/app/baustellen/page.tsx`
- **acceptance criteria**
  - `/app/baustellen/import` bietet zwei Upload-Felder fuer Excel/CSV und KML.
  - Server Action liest `.xlsx`, `.xls`, `.csv` via SheetJS und KML via `fast-xml-parser`.
  - Spaltenmapping erkennt flexible Namen fuer ID, Art/Gattung/Species und StU/Stammumfang/Diameter.
  - Server Action verknuepft Baum-IDs mit KML `<name>`/`ExtendedData`.
  - Import ist idempotent: keine doppelten `TreeItem`-Eintraege pro `Baustelle`/`treeId`.
  - Re-Import aktualisiert nur `species`/`diameter`; Koordinaten und erledigte Arbeit bleiben stabil.
  - Erfolgsmeldung zeigt neue, aktualisierte und unveraenderte Baeume.

## T-015 - TreeItem Edit Audit

- **status**: done
- **why**: Worker muessen Baumstammdaten im Feld korrigieren koennen, ohne Import-/Arbeitsverlauf zu verlieren.
- **dependencies**: Workzone v0.1, T-014
- **files touched**:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260417195400_add_tree_audit_fields/migration.sql`
  - `src/app/(workzone)/workzone/actions.ts`
  - `src/app/(workzone)/workzone/baustellen/[baustelleId]/tree-list.tsx`
  - `src/lib/validation/schemas.ts`
- **acceptance criteria**
  - `TreeItem` hat `isEdited`, `lastEditedBy`, `lastEditedAt`.
  - Workzone-Liste bietet Edit-Button vor Check.
  - Modal editiert `species` und `diameter`.
  - Liste zeigt nur einen diskreten Marker fuer editierte Baeume; Auditdetails stehen im Modal.

## T-016 - HR & Fleet Management

- **status**: done
- **why**: Einsatzbetrieb braucht Worker-Stammdaten, Flottendaten und einen Live-Status getrennt von der Angebotskalkulation.
- **dependencies**: Workzone v0.1, CompanyProfile, existing Machine model
- **files touched**:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260417213208_add_hr_and_sessions/migration.sql`
  - `src/app/(admin)/app/admin/page.tsx`
  - `src/app/(admin)/app/layout.tsx`
  - `src/app/(workzone)/workzone/layout.tsx`
  - `src/app/(workzone)/workzone/login/*`
  - `src/app/(workzone)/workzone/profile/*`
  - `src/app/(workzone)/workzone/hr-actions.ts`
  - `src/lib/workzone/worker-session.ts`
  - `src/lib/validation/schemas.ts`
- **acceptance criteria**
  - `Worker` stores name, phone, position, licenses, status and unique six-digit login code.
  - `Machine` has fleet fields for nickname/model/targe/years/TÜV/AU/function/required license while calculation fields remain intact.
  - `WorkSession` stores live status and calculated hours.
  - `/app/admin` manages Workers and fleet Machines.
  - `/workzone/login` authenticates a worker without starting live status.
  - `/workzone/profile` starts/stops work, confirms/edit break minutes and end time, and shows session history.
  - Workzone header shows all active workers with grey/offline and green pulsing/live circles.

## T-017 - Worker Tagesberichte and Availability

- **status**: done
- **why**: Firma braucht saubere Tages-/Monatszettel pro Worker inklusive Baustellenleistung, ohne dass Worker Zeiten/Aktivitaeten nachtraeglich frei veraendern koennen.
- **dependencies**: T-016, Workzone Worker Identity
- **files touched**:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260417232713_add_worker_availability_and_report_notes/migration.sql`
  - `src/app/(workzone)/workzone/hr-actions.ts`
  - `src/app/(workzone)/workzone/profile/*`
  - `src/app/(admin)/app/admin/page.tsx`
  - `src/app/(admin)/app/admin/workers/[workerId]/*`
  - `src/lib/workzone/reporting.ts`
  - `src/lib/validation/schemas.ts`
- **acceptance criteria**
  - Pause default: 0 min up to 4h, 30 min over 4h.
  - Pause choices are fixed to 0/15/30/60.
  - Worker has daily Tagesbericht and monthly Stundenzettel pages with printable/downloadable browser output.
  - Tagesbericht includes only completed TreeItems and ManualTasks grouped by Baustelle, not the session/pause list.
  - Stundenzettel is a monthly table with one row per calendar day and totals so it grows into the full month document.
  - Worker can add only a report note, not edit generated activity.
  - Admin sees colored worker buttons by availability and can open printable worker day/month reports.

## T-018 - Baustelle Assisted Start/Stop Times

- **status**: done
- **why**: Worker vergessen im Feld gelegentlich START/STOP; die App soll realistische Standardzeiten anbieten und automatische Korrekturen auditieren.
- **dependencies**: T-016, T-017
- **files touched**:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260418131324_add_worksession_system_close_audit/migration.sql`
  - `src/app/(workzone)/workzone/actions.ts`
  - `src/app/(workzone)/workzone/baustellen/[baustelleId]/working-controls.tsx`
  - `src/lib/workzone/session-rules.ts`
  - `src/app/(workzone)/workzone/layout.tsx`
  - Tagesbericht pages in Workzone/Admin
- **acceptance criteria**
  - START in a Baustelle asks for now or editable 07:00.
  - STOP after 16:30 asks for now or editable 16:30.
  - Server Actions persist selected times and calculate hours from them.
  - Forgotten early day sessions auto-close at 16:00 with 30 min pause after noon on the following day.
  - Auto-closed sessions are visible in Tagesbericht via `closedBySystem` marker.

## T-019 - Deployment strategy baseline

- **status**: done
- **why**: The project now needs one clear path for fast demo/test presentation and another for dedicated client production, without splitting the app.
- **dependencies**: Current working local state
- **files touched**:
  - `docs/DEPLOYMENT.md`
  - `README.md`
  - future env/deployment files
- **acceptance criteria**
  - One-codebase strategy is documented and accepted.
  - Demo/Test/Portfolio mode is defined as Railway + Supabase.
  - Dedicated client production mode is defined as Docker + dedicated server/database.
  - Environment differences are separated from business/application code.
  - A protected baseline exists before structural deployment files or scripts are added.

## T-020 - Demo reset/reseed and environment mode hardening

- **status**: done
- **why**: Demo mode must be quickly resettable and adaptable for company presentations, while production must be protected from accidental destructive resets.
- **dependencies**: T-019
- **files touched**:
  - `.env.example`
  - `scripts/*`
  - `prisma/seed.ts`
  - deployment docs
- **acceptance criteria**
  - Required environment variables are documented.
  - An explicit app environment mode exists, for example `APP_ENV=local|demo|production`.
  - Demo reset/reseed commands are explicit and safe-by-default.
  - Production mode blocks or strongly guards destructive demo reset commands.
  - Seed/presentation data can be adapted without forking the codebase.

## T-021 - NFC tree lookup and parallel inventory scan

- **status**: done
- **why**: Einige Auftraggeber und Stadtbestaende arbeiten mit Baum-IDs oder Chip-/NFC-Tags. Der Feldfluss soll einen Baum oder Inventarartikel sofort eindeutig finden, ohne die bestehende Import- und Barcode-Logik zu verwirren.
- **dependencies**: T-014, T-015, Barcode Inventory System
- **files touched**:
  - `src/app/(workzone)/workzone/baustellen/[baustelleId]/*`
  - `src/app/(workzone)/workzone/actions.ts`
  - `src/app/(admin)/app/admin/*`
  - `src/lib/validation/schemas.ts`
  - `docs/ADN.md`
  - `docs/BAUSTELLEN_IMPORT.md`
- **acceptance criteria**
  - In der Baustellenansicht gibt es spaeter einen `NFC`-Trigger zum Scannen einer Baumkennung.
  - Ein erkannter Baum-Tag loest die Referenz auf `treeId` / Baum-ID auf und springt direkt zum passenden Baum in der aktuellen Baustellenliste.
  - Wenn die Baumkennung in der aktuellen Baustelle fehlt, bietet die UI kontrolliert `Baum hinzufuegen` an, statt Dubletten oder stille Fehler zu erzeugen.
  - Re-Import, manuelle Bearbeitung und fertige Dokumentation bleiben konsistent; ein spaeterer NFC-Scan darf erledigte Arbeit oder abgeschlossene Berichte nicht verfremden.
  - Inventarartikel koennen spaeter optional parallel ueber Barcode und NFC identifiziert werden; Barcode bleibt weiter voll gueltig.
  - Kleidung, Ausruestung und sonstige scanbare Firmenartikel nutzen fuer Barcode und NFC denselben Bewegungs- und Uebergabe-Workflow.

## T-022 - Workzone Offline Outbox Sync

- **status**: done
- **why**: Worker brauchen im Feld eine robuste Bedienung bei schlechtem Netz, ohne dass lokale Daten die Serverwahrheit ersetzen.
- **dependencies**: T-016, T-017, T-018, Supabase Storage strategy
- **files touched**:
  - future `src/lib/workzone/offline/*`
  - future `src/app/api/workzone/sync/*`
  - Workzone/Profile client actions
  - `docs/WORKZONE_OFFLINE_SYNC.md`
- **acceptance criteria**
  - Workzone zeigt offline/pending/sync-failed Zustände sichtbar.
  - Operative Aktionen werden als idempotente Pending Actions in IndexedDB gespeichert.
  - Server-Sync prueft Auth, Permissions, Payload und Konflikte.
  - `START_WORK` und `STOP_WORK` funktionieren offline mit spaeterem Sync.
  - `CHECK_TREE`/`UNDO_TREE` funktionieren offline mit Noop-/Conflict-Handling.
  - Dokument-/Foto-Uploads speichern Blobs nur temporaer lokal und landen final immer in Supabase Storage.
  - Keine Unternehmensdateien werden in `public/uploads` oder Repo-Dateisystem geschrieben.

## T-023 - SaaS mode foundation

- **status**: done
- **why**: RediOnFlow needs a SaaS foundation without splitting the current BaumdienstFlow product into separate apps.
- **dependencies**: T-019, current BaumdienstFlow production behavior, `docs/SAAS_ARCHITECTURE.md`
- **files touched**:
  - future `src/lib/mode-config.ts`
  - future branding/navigation helpers
  - future company mode fields or mapping
  - docs updates after each step
- **acceptance criteria**
  - A central `modeConfig` exists for `baumdienst`, `bau`, and `personal`.
  - Product name and top-right branding are derived from mode.
  - Navigation/module visibility reads feature flags instead of hardcoded product logic.
  - BaumdienstFlow mode stays equivalent to the current real-client system.
  - BauFlow is prepared by hiding tree-specific modules while keeping the same company/task logic.
  - PersonalFlow remains planned as a later simplified mode derived from BauFlow.
  - `docs/ADN.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, and `docs/WORKLOG.md` stay updated with what changed, how, and what comes next.

## Priority Chain (2026-07-04)

The next agent MUST work these tasks in this exact order. Skip a task only if a hard dependency blocks it, and document the reason in `WORKLOG.md`.

1. **T-025b Wholesale tenant scoping audit** — apply the T-025 pattern to every remaining server action and API route.
2. **T-026 Public signup and tenant onboarding** — create Company with `mode` from a public flow.
3. **T-027 Subscription foundation (Stripe + Plan model)** — SaaS revenue rail.
4. **T-028 Plan-based feature limits** — quota and gating layer over `modeConfig`.
5. **T-029 BauFlow terminology polish** — mode-aware i18n so `bau` stops saying "Baum".
6. **T-030 PersonalFlow simplified UI** — derive personal mode from bau by hiding surfaces.
7. **T-031 Multi-product landing** — one landing with three product tabs and signup CTA.
8. **T-032 Client data portability (SaaS ↔ dedicated)** — safe export/import per Company.
9. **T-033 Central audit log** — SaaS support and compliance visibility.
10. **T-034 Supabase RLS layer** — belt-and-braces defence on top of application scoping.

Two parallel product tracks stay in place and neither may fork the codebase:

- **BaumdienstFlow dedicated/private-server** — current production path for the live app. It runs with its own database and `SAAS_MODE=false`; current live Railway `prod` belongs to this track and should stay stable for BaumdienstFlow users.
- **SaaS platform (RediOnFlow)** — everything from T-025 onward serves this future track. It is multi-tenant, subscription-based, and will expose BaumdienstFlow, BauFlow, and PersonalFlow as selectable tenant modes.

## T-024 - Fleet inventory as calculation source

- **status**: done
- **why**: Maschinen und Geraete sollen einmal im Inventar/Flotte gepflegt werden und danach direkt in Kalkulation, QuickStart und Baustellenformularen auswählbar sein.
- **dependencies**: T-006, T-008, current Machine model
- **files touched**:
  - `src/lib/machines/display.ts`
  - `src/app/(admin)/app/admin/page.tsx`
  - `src/app/(admin)/app/admin/machines/[machineId]/page.tsx`
  - `src/app/(admin)/app/machines/page.tsx`
  - `src/app/(admin)/app/projects/[projectId]/*`
- **acceptance criteria**
  - Eine neu angelegte Maschine wie `Transporter 1`, `Hubsteiger`, `Rasenmaeher` oder `Haechsler` bleibt als einzelner Inventar-/Flottenartikel erkennbar.
  - Kategorien und Kalkulationssaetze koennen direkt an der Maschine gepflegt werden.
  - QuickStart-Felder zeigen bevorzugt die passende Kategorie statt eine ungeordnete Gesamtliste.
  - Positions-Maschinenzeilen zeigen aktive Inventarartikel gruppiert nach Kategorie.
  - Bereits verwendete Maschinen bleiben in alten Positionen sichtbar, auch wenn sie spaeter deaktiviert werden.

## T-025 - Tenant scoping foundation (SaaS prep)

- **status**: done
- **why**: Every SaaS feature depends on strict `companyId` scoping. Doing this before billing or signup keeps the change non-breaking on current dedicated deployments and prevents leaking data between tenants later.
- **dependencies**: T-023
- **files touched**:
  - `prisma/schema.prisma` (add explicit `companyId` where missing; ensure indexes)
  - server actions and queries under `src/app/(admin)/**`, `src/app/(workzone)/**`, `src/app/api/**`
  - `src/lib/auth/*` — resolve current tenant from session
  - `src/lib/db/tenant.ts` (new) — `getCurrentCompanyId()` helper
- **acceptance criteria**
  - A single helper resolves the active `companyId` for any request (admin/worker/api).
  - Every write server action asserts `companyId` matches the caller.
  - Every list/read query filters by `companyId`.
  - Dedicated deployments (single company row) keep working with zero behavior change.
  - A short doc entry in `docs/SAAS_ARCHITECTURE.md` describes the scoping rule and how to add new queries safely.
  - No Supabase RLS yet — application-layer scoping only. RLS lands in a later task.

## T-026 - Public signup and tenant onboarding

- **status**: done
- **why**: SaaS needs a self-serve entry point that creates a `Company` with the correct `mode` and a first admin user, without touching dedicated deployments.
- **dependencies**: T-025
- **files touched**:
  - `src/app/(public)/signup/*` (new)
  - `src/app/(public)/login/*` (extend for cross-tenant login)
  - `src/lib/auth/*`
  - `src/lib/onboarding/*` (new)
  - env flag `SAAS_MODE=true|false`
- **acceptance criteria**
  - `SAAS_MODE=false` (dedicated) hides signup entirely.
  - `SAAS_MODE=true` exposes `/signup` where a new user picks product: BaumdienstFlow / BauFlow / PersonalFlow.
  - Signup creates `Company` with the chosen `mode`, a primary `User(role=ADMIN)`, and empty seed defaults appropriate to that mode.
  - Trial period defaults to 14 days without a plan attached.
  - Login routes users to the correct tenant automatically; no cross-tenant leakage.
  - Dedicated deployments remain unchanged: no signup, no trial, no tenant switcher.

## T-027 - Subscription foundation (Stripe + Plan model)

- **status**: done
- **why**: SaaS clients need a billing rail. Introduce the data model and Stripe integration skeleton before wiring gates so we don't retrofit billing into every feature later.
- **dependencies**: T-026
- **files touched**:
  - `prisma/schema.prisma` — add `Plan`, `Subscription`, `Company.planId`, `Company.stripeCustomerId`
  - `src/app/api/stripe/webhook/*` (new)
  - `src/lib/billing/*` (new)
  - env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **acceptance criteria**
  - `Plan` seeds include `starter`, `pro`, `enterprise` with placeholder Stripe price IDs.
  - `Subscription` tracks `status` (`trialing | active | past_due | canceled`) and `renewsAt`.
  - Stripe webhook updates `Subscription.status` idempotently.
  - `getCurrentPlan(companyId)` returns the resolved plan or `null` (dedicated).
  - Dedicated deployments ignore billing entirely (no Stripe calls if `SAAS_MODE=false`).
  - Checkout page and customer portal are stubbed but return a working redirect in test mode.

## T-028 - Plan-based feature limits

- **status**: done
- **why**: SaaS tiers must gate concrete resources (workers, machines, storage) without touching `modeConfig` behavior; `mode` decides which features exist, `plan` decides how much of them.
- **dependencies**: T-027
- **files touched**:
  - `src/lib/mode-config.ts` (add `planLimits`)
  - `src/lib/billing/limits.ts` (new)
  - relevant server actions (create worker, create machine, upload document)
- **acceptance criteria**
  - `planLimits` central config keyed by plan: worker count, machine count, storage MB, active baustellen.
  - Server actions that create limited resources check the current company's plan quota.
  - Over-quota returns a clear UI error and a "Upgrade plan" call to action, never a silent 500.
  - Dedicated deployments bypass all limits.
  - Limits apply consistently across `baumdienst`, `bau`, and `personal` modes.

## T-029 - BauFlow terminology polish

- **status**: done
- **why**: BauFlow currently uses "Baum" terminology in i18n strings that were written for tree work. Construction customers see confusing labels even though the tree modules are hidden.
- **dependencies**: T-023
- **files touched**:
  - `src/lib/i18n/de.ts`, `pl.ts`, `ro.ts`, `sq.ts`
  - `src/lib/i18n/*` mode-aware resolver
  - navigation labels and page titles that reference tree work
- **acceptance criteria**
  - i18n keys resolve per `company.mode`: e.g. `nav.baustellen` stays generic, but `nav.trees` disappears in `bau`/`personal`.
  - Bau-specific alternate strings exist for shared surfaces (Baustelle detail, worker profile).
  - Switching a demo company from `baumdienst` to `bau` shows zero "Baum" text on visible screens.
  - Fallback rule: if a mode-specific string is missing, use the `baumdienst` default (never crash).

## T-030 - PersonalFlow simplified UI

- **status**: done
- **why**: PersonalFlow targets small teams (~5 users) and must feel lighter than BaumdienstFlow/BauFlow. Same codebase, simpler surface.
- **dependencies**: T-023, T-029
- **files touched**:
  - Admin sidebar, workzone layout — collapse into a lightweight `Tasks | Reminders | History` shell
  - dashboard — trimmed cards
  - `src/lib/mode-config.ts` — additional `personal` visibility flags
- **acceptance criteria**
  - `personal` mode shows only: Personal & Flotte, Tasks, Reminders, Einstellungen.
  - No workzone canvas; a simple task list replaces mission control.
  - Reports are limited to a single monthly summary (`reports: "limited"`).
  - Nothing in `baumdienst` or `bau` mode regresses.

## T-031 - Multi-product landing

- **status**: done
- **why**: Public visitors must be able to pick a product and start a trial. Current landing markets BaumdienstFlow only.
- **dependencies**: T-026
- **files touched**:
  - `src/app/(public)/landing/*`
  - `src/components/landing/*`
- **acceptance criteria**
  - Single landing page with three visible product tabs: BaumdienstFlow / BauFlow / PersonalFlow.
  - Each tab has scope, target audience, CTA "Start free trial" that routes to `/signup?mode=<mode>`.
  - Legal footer keeps the RediON signature.
  - When `SAAS_MODE=false`, the trial CTA is hidden or replaced by "Contact for dedicated deployment".

## T-032 - Client data portability (SaaS ↔ dedicated)

- **status**: done
- **why**: Some SaaS clients will eventually want their own database, and some dedicated clients may migrate to SaaS. The system must support export/import per Company without manual DB dumps.
- **dependencies**: T-025
- **files touched**:
  - `src/app/(admin)/app/settings/data-export/*` (new)
  - `src/lib/portability/*` (new)
  - docs: `docs/DATA_PORTABILITY.md` (new)
- **acceptance criteria**
  - Admin can request a full company export (JSON + Supabase Storage manifest).
  - Import command can rehydrate a Company into a fresh dedicated deployment.
  - Export excludes cross-tenant data by construction (uses the T-025 scoping rule).
  - Documentation covers the SaaS → dedicated migration path and dedicated → SaaS.

## T-033 - Central audit log

- **status**: done
- **why**: SaaS support and compliance need a single audit surface for sensitive actions (plan changes, admin removals, data exports, mode changes).
- **dependencies**: T-025
- **files touched**:
  - `prisma/schema.prisma` — add `AuditLog`
  - `src/lib/audit/*` (new)
  - selected server actions (billing, admin management, exports)
- **acceptance criteria**
  - `AuditLog` stores `companyId`, `actorType`, `actorId`, `action`, `payload` (JSON), `createdAt`.
  - Sensitive actions write one audit entry each, idempotently.
  - Admin can view the log for their own company; RediON support can view across companies.
  - No PII leaks in payload; sensitive fields are redacted.

## T-025b - Wholesale tenant scoping audit

- **status**: done
- **why**: T-025 shipped the tenant helpers and one reference callsite. Every remaining server action and API route must adopt the same pattern before SaaS multi-tenant traffic is allowed on the platform.
- **dependencies**: T-025
- **files touched**:
  - Every file under `src/app/(admin)/**/actions.ts`
  - Every file under `src/app/(workzone)/workzone/*actions.ts`
  - Every route under `src/app/api/**`
- **acceptance criteria**
  - Every server action that loads or mutates a company-owned entity calls `getCurrentCompanyId` and asserts ownership.
  - Every list query filters by `companyProfileId`.
  - No action reads the tenant from user-controlled input (form fields, query params).
  - Actions that reject cross-tenant access do so with a clean `ActionResult` — no leaked stack traces or entity data.
  - A short audit checklist appended to `docs/SAAS_ARCHITECTURE.md` lists reviewed files with dates.
  - Dedicated deployments still behave identically (single Company).

## T-034 - Supabase RLS layer

- **status**: done
- **why**: Application-layer scoping (T-025 / T-025b) is line one. Supabase Row Level Security is line two — it prevents any lingering query mistake from crossing tenants at the database boundary.
- **dependencies**: T-025b, T-026
- **files touched**:
  - `prisma/migrations/*_add_rls_policies/`
  - Supabase project settings (documented, not committed)
  - `docs/DEPLOYMENT.md`
- **acceptance criteria**
  - Every table with `companyProfileId` has an RLS policy that filters by the authenticated tenant.
  - Prisma still connects with a role that bypasses RLS server-side; browser code never talks to Supabase with `service_role`.
  - A migration adds and enables the policies; rollback is documented.
  - Manual test: a query without the correct tenant claim returns zero rows.
