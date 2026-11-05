# Prüfprotokoll / Verification record

**Stand: 5. November 2026.** Dieses Protokoll trennt, was gemessen wurde, von dem, was nur im Code vorhanden ist. Zahlen ohne Quelle gibt es hier nicht.

## 5 November 2026 — shared task catalog and material process plans (not released)

Prepared on `feature/steel-shared-work-catalog-20261105`, based on the approved
PR53 production merge `df65504a5fac6fd226389636ec65c2c91c6a5235`. PR53 deployed
successfully as Railway `15f15a9c-f4c7-4df4-96fd-88cb440396ae` at13:31:16UTC.
Its two further real assistant probes remain deferred after the owner stopped
browser control; no universal semantic acceptance is claimed.

This candidate adds one tenant-owned catalog for site tasks and factory/field
processes, per-site selection, explicit material applicability, derived linked
task progress, reversible archival and private WebP/validated generated SVG
art. Existing task IDs, notes, completion attribution, material confirmations
and weight snapshots remain preserved. New material lists start unconfigured.
The shared shell/header/footer and dependency/provider versions are unchanged.
See [the workflow and recovery contract](docs/STEEL_WORK_CATALOG.md).

Measured local results: fresh additive migrations and Prisma schema drift PASS;
892 unit tests/97 files PASS (17.02s);348 PostgreSQL integration tests/27 files
PASS (147.87s) using the official isolated PostgreSQL16 integration identity and
restricted runtime role; full ESLint PASS. Final Windows Prisma generation,
TypeScript, focused UI/spec lint and staged Gitleaks PASS. Backend code stayed
unchanged during the final UI/test-only adjustments. No cloud Actions ran.

An earlier integration invocation used the E2E database name and hit the
suite's environment guards; the tests were not weakened. The corrected official
integration batch passed in full. An initial schema diff mismatch was corrected
and the fresh migration/schema comparison rerun successfully.

Independent review corrected a many-task narrow-header overflow, long-label
wrapping and keyboard focus restoration after externally opened dialogs. The
focused production-build/Chromium workflow PASS includes cross-site unchecked
choices, unchanged history through disable/archive/restore, linked2/10 partial
delivery, material plans, custom process links and real private WebP bytes with
metadata stripped/anonymous404. Desktop1440x1000 and phone390x844 light/dark
screens,44px controls, modal focus trapping and top/nested focus return PASS.
The new dialogs reuse the existing hidden-scrollbar treatment. Cua manually
verified the third process-editor opener's focus return, a many-task phone
header, keyboard-reachable actions at844x390 and natural footer/header behavior.
All screenshots use fictional data. Actual handset/on-screen keyboard behavior
is separate from viewport simulation. The final200% text-enlargement state PASS,
including usable search width, editor overflow and reachable save/cancel. Icon
touch targets retain44CSS pixels while labels enlarge and controls wrap. The
last full browser workflow PASS in66.0s (1.8m including its production build).

That additional run exposed an exit-animation race before the enlarged state:
the outgoing list toolbar remained clickable for160ms while the sheet title
already named the selected material. The mixed-plan confirmation guard stopped
the incorrect bulk apply; no material was changed. Exiting views now keep their
animation but become inert/hidden from accessibility, and the workflow asserts
the loaded detail and exact single-material scope before applying. The final
build/browser run includes this fix and all earlier scenarios.

The actual legacy SQL upgrade also PASS:67 prior migrations,10 byte-identical
task rows retaining3/10 progress,5 unchanged confirmation/snapshot rows,2 audit
rows and3 unchanged legacy material rows with NULL routes. All10 task links
were correct; another site received no selected task instances and no custom
choice crossed tenants. The verifier and detailed synthetic proof are retained
privately outside Git. Current source/test/schema files match the tested mirror
by SHA256; EVIDENCE.md is excluded from its own manifest.

A fresh encrypted production snapshot at2026-11-05T18:04:35.120Z PASS verified
isolated restoration, receipt size and independently computed archive SHA256.
Private receipts/archives and customer contents are not committed. No app/config
or business record was changed and no new offsite upload was made. The first
default-sandbox attempt could not obtain SSH config; the identical authorized
network-escalated attempt completed through the existing tenant/restore guards.

Earlier disk-full/WSL I/O and180s runner startup interruptions are superseded by
recovered local execution; no fixture/migration guard was weakened. The runner
uses a local-only600s startup allowance. A test-only native ESM dictionary import
was corrected, and server-controlled checkbox assertions now wait for confirmed
saved state. Those were fixture/executor issues, not accepted failed checks.

Actual provider-generated art, owner merge/deploy approval and post-publication
runtime acceptance remain separate. Media tests use mocked generation; no paid
illustration call is claimed. Production still runs PR53. Portfolio assessment
preserves maturity and accurate general claims; affected native/showcase content
must reflect the feature after acceptance without customer data or imagery.
Read-only Railway config confirms the existing production branch, Amsterdam
instance, migrate/provision/Next start override and no staged service changes;
the Dockerfile's default startup is not substituted during this release.

## 5 November 2026 — canonical factory-production answers (follow-up candidate)

PR52/head89f52d3 was owner-approved and merged as
adc4144b5f68b97016a86e62d7d6f76df88eb049 with identical reviewed tree
0403edef935d26a3c26ba468c929b7289a0eff1d. Railway deployment
010343e7-655f-465d-bc18-b0f4b858e243 succeeded at12:51:04UTC; no pending
migration and health200/ok. A fourth authorized real read-only probe asked for
one concise factory-production sentence. It exposed a new semantic failure:
the model added cutting and assembly kg into a fabricated single output total.
The legacy qualifier guard cannot validate such invented arithmetic. The bad
turn, source trace and safe diagnostics remain in private history for audit;
no customer transcript/name/quantity is reproduced here. Stream completion is
not semantic acceptance.

This candidate renders narrowly recognized factory quantity answers directly
from successful canonical day/month summaries, with three separate processes,
pieces, legacy approximation and explicit unknown weights. Details use paged
selected-day facts rather than month/current-progress rows. Source failure or
unsupported period comparison stays unknown/clarified, never inferred zero.
Possession/stock, named-project and process/worker-specific requests retain
their normal tool path. The Albanian response-style phrase "përgjigju shkurt"
no longer mistakes a yesterday question for a February/day comparison.
No schema, business data, UI, provider, dependency or budget changes.

Local laptop validation PASS:286 assistant unit tests/19 files (17.04s),
29 PostgreSQL integration tests/5 files (44.88s), schema drift check, scoped
ESLint, application TypeScript/production build, staged Gitleaks and independent
static review.66 source/test/schema/doc SHA256 values match the tested WSL
mirror. Review found and corrected stock/project/unsupported-period overmatching;
the route regression reproduces the exact brief-answer/date wording with
fictional values and verifies delivered text equals archived text. An initial
type-check failure in inherited intent spreading was corrected and rechecked.
The new SQL payload/pagination regression passed before the final classifier-only
adjustment; unit/lint/build were rerun on the final code. No UI component changed,
so the earlier UI rendering suite was not repeated. The task DB is stopped.
This candidate requires separate owner approval and post-publication
real-provider acceptance; PR52 is already live.
Public showcase/About/portfolio assessment remains NO_CONTENT_CHANGE for this
internal accuracy correction. Existing unrelated portfolio/documentation work
remains separate; no customer data or private screenshots go to public media.

## 5 November 2026 — real-provider readback and legacy-weight precision

PR51/head a557b09 was explicitly approved and merged as
e6c23179fb937d0653c44ea136fe03abfa053258, with identical reviewed tree
8c5011a7c220c2838ee7374147b6b75aa5ad2f2a. Railway deployment
3ec86093-2f5c-4ffe-9f5f-310c5aa3701c succeeded at12:19:59UTC; the additive
history migration applied and health returned200/ok.

Three authorized real read-only questions covered started sites, yesterday's
production and requested project details. All three runs completed in two model
steps, with zero tool/provider failures, matching dates/counts/kg in their fresh
stored sources. Short replies expanded on the details request. Questions,
answers, usage and tool traces were retrieved from private history; reload
restored all three turns. No real transcripts, names or customer quantities are
copied into this repository or public media.

The same traces exposed an answer-quality gap: legacy kg were numerically
correct but lacked their approximation qualifier. A focused server-side delivery
guard now adds `≈` only from successful canonical legacy-weight evidence, before
the emitted text is checkpointed/archived. It preserves digits, locale formatting,
units and existing approximation signs; date/month scopes and complete-page
project derivations are explicit. It does not rewrite historical answers or
business data. Private diagnostic counts identify the guard's intervention.
Historical checkpoint: this candidate awaited approval here; PR52 was later
approved/published as recorded above. Its first real probe exposed a separate
semantic arithmetic failure, addressed by the new follow-up candidate.
Local follow-up verification:229 assistant unit tests/18 files PASS3.05s,
scoped ESLint, production build/application TypeScript, staged Gitleaks and
independent static review PASS.64 source/test/schema/doc hashes match the WSL
mirror. No new SQL/schema, DB mutation, UI component, provider or cost changes;
the earlier28 PostgreSQL cases were not repeated. Fictional tests cover scope,
locale/Markdown, complete-page grouping, missing-weight zero, transform failure
and identical delivered/archived text. The later real probe demonstrates why
this qualifier guard alone is not semantic answer validation.
Equal numbers can conservatively share a qualifier; this bounded guard is not a
general proof that all model statements are correct. Physical phone IME/text
zoom and broader owner acceptance remain separate. Public presentation/card/
About assessment is NO_CONTENT_CHANGE: existing company-scoped read-only AI
copy remains accurate, with no new readiness or perfect-accuracy claim. Existing
portfolioPR28 and documentationPR36 remain separate; the website itself is
already published although sourcePR33 remains open.

## 5 November 2026 — concise assistant answers and private diagnostic history

Owner scope: diagnose intermittent answers after the owner deployed the key,
answer briefly by default, and retain conversations to find mistakes. AL Steel
is a real operational company; the old disposable-pilot assumption is revoked.
Baseline:583e832b888a7e7a4b055424cd1f3e52fc9f96ae/PR47. The owner-triggered
Railway deployment dca7ccaf-26c7-4320-971e-8bc6f1a4b808 succeeded; key NAME is
present (no secret value read). Observed legacy chat confused the workshop/site
count and returned unavailable production answers. Old HTTP200 logs had no
execution traces, so they do not establish the exact provider/tool failure.

Fix: preserve optional Zod arguments with explicit Responses `strict:false`,
consume full SDK stream parts rather than silently filtered text errors, and
use a canonical recorded-activity tool for started sites. The server prompt
defaults to1–2 sentences/name lists and expands only when requested. Real
provider adapter tests use explicit in-memory HTTP mocks; they demonstrate the
wire contract, not paid-model answer quality. A normal real30-tool request is
28,843 bytes;12,000-character history plus12KiB result is53,685 bytes. Two24KiB
results exceed the existing65,536-byte guard and are explicitly rejected before
provider access. No model, provider, dependency, retry, timeout or cost increase.

Three additive private history tables store each accepted question, emitted
answer/status and bounded secret-redacted tool evidence/diagnostics. Tenant and
admin ownership, RLS, concurrency/idempotency, interruption and pagination are
covered. Failure to save a new question prevents paid generation. New chat
retains old conversations. Older unscoped browser caches are neither imported
nor deleted. No pre-release browser-only conversation is claimed recovered.

Local laptop verification, isolated WSL Node22/PostgreSQL16, synthetic data:

-213 assistant unit tests/17 files PASS2.26s;28 integration tests/5 files
  PASS30.03s, including nonowner/nontenant RLS, duplicate sends, stored quota
  rejection, canonical kg and started-work criteria.
- Prisma migration apply and schema diff PASS (no drift); scoped ESLint and
  production build/application TypeScript and staged Gitleaks PASS.62 source/test/schema/doc hashes
  match the tested mirror; logs/manifest remain local.
- Cua browser check on the production build with a fictional local company:
  archive restore, older-page navigation, new chat retaining history, saved
  configuration rejection and reload restore PASS. Desktop/narrow light/dark
  and760×360 composer/overflow checked;360×800 composer remains44px and visible.
  Screenshots under local outputs/assistant-history. Chrome automation became
  intermittently unavailable; remaining checks completed in the in-app browser.
- Independent static review PASS. No paid OpenAI inference, business-data
  mutation, broad unrelated UI suite, cloud Actions or production migration.
  Physical phone keyboard/IME, text zoom and real provider quality remain
  NOT_VERIFIED. Publication requires the owner's approval for the exact PR.

## 5 November 2026 — grounded AL Steel assistant

Owner scope: activate and improve only agent logic for reliable operational
answers, without changing other UI/processes. This new request supersedes the
04.11 owner deferral; the owner will enter the OpenAI key directly in Railway.
Baseline: pilot `b7093069d92b3cd85ff73543e2f5892cd939ad2a` (PR46). Provider
activation/publication/real-model quality remain separate gates; no key value or
paid provider call was used in these local checks.

Confirmed gaps: legacy tree/calculation statistics instead of steel data;
host-local dates and global date overrides; first-match identity ambiguity and
unscoped admin persona search; capped lists presented as totals; persona/free
text interpolated as instructions; tool-only/empty/truncated answer risks.
The agent now uses scoped canonical steel project/product/progress/confirmation
tools plus worker/fleet/receipt/catalog reads. Company hour totals aggregate all
closed rows and calculate live hours in one repeatable-read snapshot. Strict
tenant identity, company calendar, explicit ambiguity and source/provenance
metadata prevent those known mistakes. Static capability turns cannot read
private operational tools. Errors are unknown, never inferred zero.

Local laptop verification, isolated WSL Node22/PostgreSQL16, synthetic data:

- Assistant unit suite:118 PASS/10 files,4.36s.
- Assistant PostgreSQL integration:16 PASS/3 files,23.04s, including5301 closed
  sessions, fixed live hours, tenant denial, exact steel snapshot/legacy/missing
  weight, shared-team/checker separation, pagination and durable quotas.
- Assistant ESLint and full production build/application TypeScript PASS.
-27 current source/test/fixture SHA256 values match the tested mirror. Logs and
  manifest remain local; the task-owned fixture database was stopped afterward.
- Broader UI suites, cloud Actions, external GPS/OCR and paid OpenAI inference
  were not rerun. Model/provider/packages/schema/limits/UI/business data unchanged.

The architecture/cost documentation and agent instructions reflect the new
layers. Current generic native presentation/README AI-access split remains
accurate; public demo still requires its own key/activation. Native/README/About/
portfolio NO_CONTENT_CHANGE: no public readiness increase or new activation claim
while the private pilot's key and owner acceptance remain pending. Existing
separate presentation/portfolio publication gaps are not closed by this work.

## 5 November 2026 — header transparency must show the content underneath

Linked recurrence `UI-FOOTER-HEADER-20261105`, following owner feedback on
PR44/live `9099a87`. The footer placement was accepted; the header was not.
Its computed background was transparent, but the primary scroller started below
its grid row, leaving an empty band instead of content behind the logo/team.
Earlier background-color assertions did not prove the owner's intended effect.

This bounded repair spans the working region across the header row and measures
the header's actual height for initial clearance and focus scroll padding.
The logo, team and tools remain stationary; empty header space passes pointer
input through. Map layers remain underneath the header. Existing fixed overlays
retain their viewport stacking when open. Mobile admin navigation and desktop
fleet clearance follow the measured header height. The accepted footer,
colors, card/icon design and operational data/processes are unchanged.

Focused local smoke mode: `STEEL_HEADER_UNDERLAY_SMOKE=true`, existing
`tests/e2e/steel-footer-header.spec.ts`, isolated synthetic PostgreSQL/Chromium.
Four rendered cases cover dashboard/light and Workzone/map/dark, each desktop
1440×900 and phone360×800. Assertions now include content painted behind the
header, click-through blank space, logo hit-testing above the map, stationary
header, initial clearance, no outer/horizontal overflow and footer End/Home.
The old blank-header screenshot click was adapted to its new click-through
semantics. One initial run was interrupted at that old click; a subsequent
render exposed map layering, which was corrected before publication. Final
results and deployed revision are recorded in the PR and canonical Drive status.
Wider suites, extra devices/themes, physical keyboard and cloud Actions are not
rerun for this correction. Owner requested direct pilot testing after publish;
local verification and that final owner acceptance remain separate.
Native presentation/README/About/portfolio: NO_CONTENT_CHANGE, because this
restores the agreed UI effect without adding capabilities or changing readiness.

## 5 November 2026 — owner correction: natural footer and transparent header

Issue `UI-FOOTER-HEADER-20261105`, based on deployed PR43/`003a3d1`.
The owner rejected the always-visible footer and the header tool arrangement.
The earlier automated PASS proved the implementation against an incorrect footer
criterion; it was not owner acceptance of that layout. Root cause is confirmed:
the author footer was placed outside the content scroller in a permanent shell
row, the admin header painted a background/border, KiDraht was repeated in the
admin navigation, and desktop alerts lived in a separate reserved header area.

The bounded correction moves the existing transparent footer to the end of the
content scroller. Header/navigation retain their own stationary space. The team
wrapper is transparent and spans the available width; desktop alerts are grouped
under the single book icon with no group backplate. The controls retain their
small theme-colored circular surfaces for legibility. End padding/scroll padding
keeps the final office profile reachable past the overlaid controls. Office
profiles remain available in the team strip; the duplicate KiDraht menu entry is
removed. Public/non-steel layouts keep their established behavior. No production
metrics, calendar values, map behavior, fuel workflow, dependencies or data change.

Local state: VERIFIED_FIX / pending owner review and publication. One focused
Chromium workflow PASS (37.0s; 53.8s including the production build/application
TypeScript check) covers dashboard and Workzone, light/dark, 1440×900, 360×800,
320×640 and 760×360. It asserts: footer absent at the beginning, visible at End,
absent again at Home; stationary transparent header/team wrapper; one icon-only
book entry; centered alerts below it on desktop; reachable final office profile;
announcement popup bounds/Escape and preserved submit accent; keyboard link
focus; no outer/horizontal overflow; root-text reflow at 200%; public presentation
has no operational controls. No page errors. Baseline and final synthetic images
were reviewed; eleven current source/test files match the tested mirror by SHA256,
with the replaced mobile-only wrapper removed. Focused lint, diff and staged
secret scanning accompany the PR. Earlier GPS/OCR/fuel/import/full-dashboard
suites and cloud Actions are not repeated.

The palette, cards, fonts, logos and existing business actions are preserved.
Physical mobile keyboard acceptance remains PENDING_RECHECK. The existing pg
concurrent-query warning and pre-existing unit wrapping on unusually large demo
KPI numbers were present in the baseline; neither is a new claimed fix. Native
feature copy, README/About and portfolio capability content remain accurate:
NO_CONTENT_CHANGE for this layout correction, with earlier publication gaps
retained. Source preparation, local PASS, owner UI review and deployment remain
separate evidence; the previous pilot is not changed by preparing this branch.

## 5 November 2026 — steel workspace and fuel-history refinement candidate

Prepared on `fix/steel-workspace-density-fuel-20261105`, over pilot
`807519b1a4dea650645aa153db49000406af3a7f`. Source, local verification and
publication are separate: this change requires a new exact-PR pilot approval.

The steel admin view reclaims the unused 96px fleet gutter. Admin and Workzone
use a viewport shell with one primary content scroll area and reachable shell
rows; the Workzone vehicle rail has allocated space rather than overlaying the
workspace. The map index retains wheel/touch/keyboard scrolling with its bar
hidden and viewport-derived height. Calendar cells omit empty metric dots and
decorative section counters; dates, quantities, weight provenance and calculations
are preserved. The shared footer is transparent and 44px high, with the small
author link centered over its full width and the product mark at the side.
The production monitor also uses that shared footer. Mobile utility targets
retain their 44px size when the root text size increases.

There is no global fuel shortcut. Each vehicle retains its existing receipt
entry. Personnel & Fleet links to `/app/machines/fuel`, reusing the authenticated
company history, pagination and protected original photo. Office history shows
vehicle/plate, uploader/upload time, actual fueler, receipt time/timezone, station,
liters/amount and historical GPS clocks/differences without a second data store.

Focused Chromium verification uses fictional steel projects, 24 workers,
18 vehicles, 65 receipts and a second tenant's receipt. It covers light/dark at
1440×950, 360×800, 760×360 and 320×640; monitor at 1920×1080 and 360×800;
calendar/last-row reachability, no document overflow, transparent centered
footer, retained vehicle receipt entry, office receipt details, 60→65 pagination
with unchanged row position, foreign-tenant exclusion, keyboard focus, root text
scale 200% and the public landing footer. Baseline screenshots use the same
fictional data. The short-landscape outer-scroll regression was reproduced and
corrected before acceptance. Exact final results and source head are in the PR.

The managed local workflow includes the production build and application
TypeScript check. Its local web-server startup allowance was extended from
180s to 600s after a slow build timed out; the assertions and committed default
runner remain intact. Changed-file lint, source-hash comparison and staged
secret/diff checks accompany the candidate. Existing GPS/OCR/photo/import/full
dashboard suites and cloud Actions are not rerun under the owner's instruction.
The existing pg concurrent-query deprecation warning remains separate.

Physical mobile keyboard behavior and real GPS/receipt acceptance remain
PENDING_RECHECK. The viewport requests content resizing for supported mobile
keyboards; a reduced viewport/root-font reflow check is not a physical-device
claim. No migration, dependency, provider setting, secret or real business record
changes. Rollback is the prior application revision, retaining all stored data.

Presentation assessment: native feature copy, showcase README/About and the
portfolio capability card remain accurate (NO_CONTENT_CHANGE for this navigation
and density refinement; no maturity increase). The shared native footer is updated
in source. Existing documentation/portfolio companion PRs retain their separate
publication/readback gaps; this assessment does not close them.

## 3 November 2026 — encrypted backup and assistant cost-limit candidate

Scope: `fix/pilot-backup-ai-limits-20261103`, based on exact pilot revision
`482b9920211e054ecc8105ad5baa1e6a34b852c0`. This is preparation for the
Railway-connected pilot branch, not a production application rollout. The
existing business migrations and customer data remain unchanged.

| Local gate | Verified result |
| --- | --- |
| ESLint / TypeScript | PASS, zero lint warnings; added test files checked again after the final assertions |
| Unit tests | **523 PASS**, 71 files; mock AI provider and authenticated encryption/tamper checks |
| PostgreSQL integration | **287 PASS**, 19 files; concurrent durable quotas, token reservations/refund, invalid-config fail-closed, restricted-role quota RLS and consistent encrypted dump/restore |
| Chromium E2E | **27 PASS** with SaaS/RLS pilot and synthetic storage/GPS; includes bounded chat history and visible HTTP 429 error, no paid inference |
| Production build | PASS, also through the managed browser-test server |
| Migrations / schema | **63** applied in disposable PostgreSQL 16; Prisma comparison: **No difference detected** |
| Secret scan | Gitleaks 8.30.1 on the complete staged candidate diff: **no leaks found** |

Execution: owner's Windows laptop, locally through WSL Ubuntu, Node 22.19.0,
PostgreSQL 16.15, current dependencies and fresh native loopback test clusters.
The existing restricted runtime pilot remained enabled in browser tests. No
cloud Actions were dispatched and no gates/assertions were removed. The
inherited migration concurrency fixture now normalizes CRLF before its exact
test-only pause injection; inherited hardcoded KB/kg labels use translations
so the required lint gate passes.

The private operator separately verified a real read-only pilot snapshot with
matching PostgreSQL 18.6, authenticated decryption, full isolated local restore,
all public-table counts and encrypted Drive download SHA-256 roundtrip. A
second real run exercised tunnel/config refresh, full restore and disposable
clone cleanup. Customer data, credentials, private keys, hashes/Drive receipts
and operator paths remain in private operational records, not this public repo.
The source was never restored into and no public database proxy was opened.

The configured daily local job requires the operator host and Codex desktop
to be running. Its next unattended run is **NOT YET OBSERVED**. Database-only
coverage, external object-storage exclusions and private-key recovery needs
are explicit in [DATABASE_BACKUP.md](docs/DATABASE_BACKUP.md). AI limits and
fail-closed semantics are documented in [AI_COST_LIMITS.md](docs/AI_COST_LIMITS.md).
No load benchmark, real paid-provider evaluation, independent review, owner
acceptance or production application deployment is claimed by these checks.

## 3 November 2026 — WanWay feature candidate (local, not deployed)

Scope: `feat/wanway-gps-integration`, based on active pilot revision
`000ebf1cc4310de770b0efb4ccf2e7df69b50a19` (PR #27), reconciled locally
in commit `9868ecd080cbd76b4be2342bad149241468e32cd`. The pilot advanced during
verification; its new site-element features were preserved and the combined
source was rechecked. Production is still on
its existing pilot deployment; no merge, production migration, environment
change or real-provider authentication was performed for this feature.

| Local gate | Verified result |
| --- | --- |
| ESLint / TypeScript | PASS, zero lint warnings |
| Unit tests | **505 PASS**, 67 files |
| PostgreSQL integration | **277 PASS**, 17 files, including 12 WanWay security/service tests |
| Production build | PASS, including the WanWay-enabled managed E2E build |
| Chromium E2E | **26 PASS**, including discovery, confirmed mapping to an existing vehicle, offline telemetry, transient history/map initialization and disconnect with **37 synthetic vehicles preserved** |
| Additive migrations | 59 migrations applied to a fresh isolated PostgreSQL 16; schema comparison: **No difference detected** |
| Secret scan | Gitleaks 8.30.1 on the complete staged feature diff: **no leaks found** |
| Responsive visual review | Integration panel at 1440 px and 390 px; key cleared after submit, no full IMEI/secret in rendered HTML, phone panel has no horizontal overflow |

Execution: the owner's Windows laptop, locally through WSL Ubuntu, Node 22.19,
PostgreSQL 16.15. Docker Desktop was unavailable, so fresh native loopback
clusters were used, with the same migrations and restricted runtime role rather
than a shared DB. No cloud Actions were dispatched. Existing required gates
were retained; automatic ordinary CI triggers are opt-in on this branch.

Initial Windows-wide unit execution exposed three inherited platform-specific
failures; full checks passed in Linux. A timing-sensitive new token-cache test
was corrected to use a controlled clock. The new composite device/vehicle FK
was corrected and regression-tested to preserve existing deletion behaviour.
No unrelated production code was changed to hide test failures.

The map layer and route geometry initialized; external tile rendering was not an
acceptance assertion. Real GS900-Wired data, account licence/IP restrictions,
real-route accuracy, production keyring setup, privacy sign-off and owner
acceptance remain **NOT VERIFIED / PENDING APPROVAL**. Workzone and tenant
regression suites passed; no real KiDraht/provider calls were made.

Architecture, endpoint contracts, security, rollout boundaries and reproducible
local commands: [WANWAY_GPS.md](docs/WANWAY_GPS.md). The earlier CI baseline below
is historical evidence, not a cloud run on this feature.

## Automatisierte Prüfungen (CI — historische Baseline)

Quelle: GitHub Actions auf dem letzten gemergten Pull Request ([#16](https://github.com/IamRedi/redionflow/pull/16), Commit `37ddb90`). Dieselben Schritte laufen auf jedem Pull Request; gemergt wird nur mit grüner CI.

| Schritt | Ergebnis |
|---|---|
| ESLint (`--max-warnings 0`) | bestanden |
| TypeScript strict (`tsc --noEmit`) | bestanden |
| Unit-Tests (Vitest) | **423 bestanden** in 50 Dateien |
| Integrationstests gegen eine frische PostgreSQL 16 im Container, mit eingeschränkter Datenbankrolle | **263 bestanden** in 15 Dateien |
| Produktionsbuild (`next build`) | bestanden |
| Ende-zu-Ende-Tests (Playwright, Chromium) gegen den Build und eine frische Datenbank, im SaaS-Modus mit eingeschaltetem RLS-Pilot (`RLS_ENFORCE=true`: Baustellen und Tagesplan laufen über eine eingeschränkte Datenbankrolle) | **25 bestanden** |
| Secret-Scan (gitleaks) | keine Funde |
| Docker-Demo: `docker compose up`, danach Smoke-Test: Health-Endpunkt, `/demo/workzone` lädt und zeigt die Demo-Baustelle | bestanden |

Die Ende-zu-Ende-Tests prüfen unter anderem: Anmeldung beider Produkte, Anlegen und Bearbeiten von Bäumen bzw. Baustellenaufgaben in der Workzone, dass BauFlow keine Baum-Module zeigt, dass ein Mandant keine Admin-, Workzone-, Projekt-, Mitarbeiter- oder Exportdaten eines anderen Mandanten sieht, dass private Dokumente nur für den eigenen Mandanten abrufbar sind, und dass Server Actions mit fremdem `Origin` abgewiesen werden.

## Manuelle Prüfungen

| Prüfung | Beobachtung |
|---|---|
| Lighthouse 12, Mobil-Profil, lokaler Produktionsbuild (26.10.2026) | Startseite 96 / 100 / 100 / 100 (Performance, Barrierefreiheit, Best Practices, SEO); Login-Seiten 98–99 Performance, SEO 60 wegen bewusstem `noindex` |
| `npm audit` (26.10.2026) | 0 Befunde |
| Browser-Durchgang BauFlow (27.10.2026) | Alle Admin- und Workzone-Seiten mit den Glasfaser-Daten bei 1280 px und 430 px aufgerufen; Baum-Begriffe, überlaufende Karten und überlappende Kacheln gefunden und in [#16](https://github.com/IamRedi/redionflow/pull/16) behoben |
| Nächtlicher Reset der Live-Demos (27.10.2026, 02:00 UTC) | Beide Reset-Dienste protokollierten „Seed completed“: Baumdienst Musterstadt GmbH (8 Mitarbeitende, 3 Baustellen, 152 Bäume, 5 Maschinen) und Glasfaserbau Beispieltal GmbH (10 Mitarbeitende, 4 Baustellen, 114 Arbeiten, 8 Maschinen) |
| Screenshots in der README | Aufgenommen mit Playwright/Chromium gegen einen lokalen Produktionsbuild mit denselben fiktiven Daten wie die Live-Demos, 1440 × 900 und 390 × 844 Pixel; jedes Bild einzeln angesehen |

## Was nicht geprüft ist

- **Externe Dienste in der Live-Demo.** KI-Assistent (OpenAI), Push (Firebase), Dateispeicher (Supabase), Stripe und Fahrzeug-GPS sind in der Demo nicht konfiguriert. Ihr Code ist durch Unit- und Integrationstests mit Test-Doubles abgedeckt; ein Live-Aufruf wurde für diese Fassung nicht gemacht.
- **Offline-Betrieb im Feld.** Die Warteschlange im Browser existiert, ein Test mit schlechtem Mobilfunk auf einer echten Baustelle fehlt.
- **Row-Level Security außerhalb des Pilots.** Die Policies sind für alle Mandantentabellen angelegt, durchgesetzt mit eingeschränkter Rolle werden sie nur im Pilot und nur in Wegwerf-Datenbanken. In den Live-Demos und regulären Installationen ist der Mandantenfilter der Anwendung die wirksame Grenze.
- **Last und Skalierung.** Es gab keinen Lasttest. Realtime-Ereignisse laufen im Prozess und werden zwischen mehreren Instanzen nicht geteilt (siehe [SECURITY.md](SECURITY.md)).
- **Fachliche Richtigkeit der Demo-Inhalte.** Baustellen, Mengen und Abläufe sind realistisch erfunden, aber keine Arbeitsanweisung.

## Daten und Rechte

- Das Repository enthält keine echten Kunden-, Mitarbeiter- oder Baustellendaten. Alle Demo-Firmen, Namen, Adressen, Telefonnummern und Kennzeichen sind erfunden ([`prisma/seed-data.ts`](prisma/seed-data.ts), [`prisma/seed-data-bau.ts`](prisma/seed-data-bau.ts), [`prisma/seed-data-glasfaser.ts`](prisma/seed-data-glasfaser.ts)). Koordinaten liegen in echten Städten, damit die Karten realistisch aussehen.
- Bilder, Diagramme und Texte: Redion Cekrezi / RediON. Es wird keine Nutzungslizenz über die [LICENSE](LICENSE) hinaus gewährt.
