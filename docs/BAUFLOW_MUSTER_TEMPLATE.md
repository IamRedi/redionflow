# BauFlow Musterbau — fictional steel template v1

Owner request, 14 November 2026: create a polished BauFlow sample company using
the current AL-Steel application workflows, entirely fictional data and the
approved new BauFlow logo. This is a reusable profile in the same application,
not a copy of AL-Steel's business records or a new industry-specific codebase.
Source baseline: `4c2c96331d14c4dbbb83d8c49a5499b17a0d2889`.

## Isolation and activation

The optional `steel-v1` appearance activates only when all conditions hold:
`APP_ENV=local|demo`, dedicated mode (`SAAS_MODE=false`),
`BAUFLOW_MUSTER_PROFILE=steel-v1`,
`INSTALLATION_COMPANY_ID=bauflow-muster-steel`, and the authenticated company is
exactly that ID. Pre-session and foreign-tenant pages cannot receive the marker.
Other companies retain their existing styles, logos and behavior. Production
and SaaS modes never activate this profile implicitly. Existing public demos
and their seed/reset commands are unchanged.

The preparation command is `npm run demo:steel:seed`. It is intentionally
separate from normal seeding/reset and requires the existing guarded disposable
loopback E2E database contract, an explicit private `DEMO_ADMIN_PASSWORD` of at
least 12 characters, and a six-digit `DEMO_WORKER_PIN_BASE` (100000–999980).
The command creates one company atomically in an empty test database. A rerun
against exactly the matching template preserves all user changes; any other
company or database is refused. There is no reset, deletion, cloning from a
customer database, provider call or general production bootstrap here.

The local database is a verification fixture, not a product decision to create
one production database per business template. A hosted demo or SaaS onboarding
remains a separate reviewed delivery using the platform's existing boundaries.

The local office rollout uses the existing explicit WORK/TEAM switches. Its
legacy director configuration maps `almet.adminId` to `bauflow-muster-chief`;
the distinct `megi.adminId` is an unused synthetic seat with no worker alias.
Accounting and the three other office workers enter through their enabled
staff memberships, not an alias of a nonexistent administrator. The owner's
OfficeMember ID is the canonical owner account ID, as required by office tasks.

## Connected sample data

- BauFlow Musterbau · DEMO uses reserved `.example` contacts and fictional
  Musterstadt addresses. A small existing announcement identifies the data and
  images as illustrative; names and cards are otherwise clean and readable.
- Nora König is the owner/administrator. Twelve fictional employees cover four
  office roles, factory leadership/operators, site leadership/assembly and a
  mechanic. Worker PINs derive from the explicit local base and are hashed;
  no real credential, contact, salary or employee photo is copied.
- Five office memberships cover management, accounting, project organization,
  customers/offers and purchasing. They use the existing office access rules,
  personal tasks, reception, documents, workbooks and assistant surfaces.
  Accounting's workbook switch is explicit. No title grants a new permission.
  Existing module/site access remains authoritative.
- Nordpark, Westtor and Hafenblick are separate fictional projects. One factory
  supplies all three. Each project has its own cover and a real downloadable
  text overview marked MUSTER, not a dead placeholder document link.
- Each project has four assemblies and four parts with sample quantities,
  profiles and weights. Stage evidence uses actual tenant worker IDs and
  immutable production snapshots. The existing cutting/assembly/factory/field
  calculations remain unchanged; successive production stages are not added
  together as one steel amount. Only the fully processed first assembly is
  released from the factory.
- Each site selects ten actual catalog phases: foundation, the six production
  processes, column mounting, beam mounting and touch-up. Linked phases derive
  progress from their real element evidence. They are not duplicate manual
  counters or an empty 0/0 checklist. All thirty selections have tenant-bound
  definitions, correct site trees and stable positions.
- The daily plan links each worker to one workplace. Closed sessions cover
  five past weekdays; current synthetic field/factory sessions show the crew
  on its project. Office history uses the existing explicit OFFICE workplace.
  Seven unique assignments are published as four workplace rows and one
  immutable snapshot on the existing Berlin business-day key. Both the owner
  and ordinary office workers can see the saved plan through existing access
  rules; workers retain the read-only plan. UTC midnight is not substituted
  for the platform's business-day boundary.
- Four machines and five tools each have one canonical operational asset.
  Licensed vehicles use their fictional plate; tools have tenant-scoped codes.
  One hydraulic inspection demonstrates a received repair. Inventory, fleet
  and workshop reuse the existing relations, history and permissions.
- AI/email/GPS/provider integration is not activated. Assistant availability is
  shown honestly through the existing configuration; no fabricated reply is
  seeded. There are no external calls or background generation on refresh.

## Visual identity and media

Keep the existing warm stone/copper/graphite crystal UI, Manrope, compact
controls and the original office scenes. An explicitly scoped body marker only
replaces the shared steel workspace atmosphere with the matching clear
Day/Night campus, including Inventory, Workshop and phone planning surfaces.
Fixed office rooms retain their own existing scenes.
There is no white veil, extra mock dashboard or generated UI. The map, plan,
worker strip, project actions and all ordinary controls keep their actual code.

Five original images were generated once through the built-in image tool:
the same campus in daylight/evening and three distinct project illustrations.
Optimized WebP derivatives, full prompts and checksums are in
`public/bauflow-muster-v1/media-provenance.json`. They are conceptual artwork,
not photographs of real customers, measurements, construction instructions or
proof of app functionality. Product screenshots must come from the real app.

The BauFlow logo is the owner's original Brand Kit v1, not a generated remake
or the AL-Steel client mark. Kit SHA256:
`256844da4d60cc21b5aaa6a1e655bc1ef0d9fc62fe9ea48b6ed9c01d6cc0d928`.
All supplied checksums passed. The existing company-logo and installation-brand
paths render it in Workzone, profile, reception and install identity. Approved
192/512/apple originals are retained. Issue194 stays open until both products'
remaining app/PWA installation/update and physical-device checks pass.

## Delivery and verification

Implementation, local tests, real browser capture, owner acceptance and public
deployment are separate. The new source stays off the Railway-connected pilot
and app main. Never seed/reset an existing demo or reuse customer credentials.
Required checks: explicit activation/foreign-company guards, seed idempotence
and refusal against a nonmatching installation, type/lint/build, actual
Workzone/office/project/inventory/workshop rendering and narrow/Day/Night review.
No public application release is claimed from a generated image or source build.

Local verification on the bounded mini-PC (Node22.22.1, four CPU threads,
4GiB job limit; separate owned 512MiB tmpfs PostgreSQL16 fixture): 1,253 unit
tests in141 files, full ESLint, Next production build, application TypeScript
and a separate typecheck of the seed all pass. The original lockfile is
unchanged. The existing `unpdf` webpack warning remains; no dependency was
upgraded to hide it. Earlier failing preparation/type/harness logs are retained.
The final application/fixture revision is `d7ac5e4` (PR206); subsequent changes
only add documentation and genuine review captures. Final-delta checks rebuild
the production app, typecheck/lint the seed, scan changed source with Gitleaks,
and validate the recreated synthetic database. Six activation tests are part
of the unit suite. Browser checks cover eight routes at 1440×900 and 390×844 in
both themes, plus four accounting-worker views: 36 cases, no page errors or
horizontal document overflow. They assert the actual Day/Night app background,
readable phone inventory controls and the four saved plan rows for both roles.
Fixture checks cover all thirty phases, UUID task IDs, normalized tool codes,
bounded steel quantities, one workplace per worker, business-day publication,
one plan version, rerun preservation and refusal of another installation.

Actual before/after captures were reviewed for Workzone, reception, offices,
site phases, planning, inventory and workshop. The narrow warehouse search and
category tabs were corrected only inside the Muster marker; existing companies
keep their original CSS. The inherited office German fallback contains some
English labels; this delivery does not claim a complete six-language audit.
Physical phones, NFC/printing and installed-PWA update checks remain NOT_RUN.
Existing report-only legacy CSP eval notices and the unpdf build warning are
retained as upstream observations, not hidden by weaker checks.

This source is LOCAL_READY for review, not a public demo release. PR206 targets
a non-deploying baseline branch pinned to the inspected AL-Steel source. No
Actions run, pilot/main merge, Railway/Vercel app publication, new hosted
service or customer-database write is part of this delivery. The disposable
preview/database are task-owned verification resources, not a new live URL.

The five original images and prompts are also preserved in the existing BauFlow
Drive media folder as DRAFT archive `1xDjjSg8Oxn2zzT8qVyNxP1usfGdz45oZ`.
Upload/readback SHA256: `7770772870c8a3be9f8010e4770d443fe642b1c56ccc3e66b6e662ee75f1e00e`.
The existing media index retains all published captures and adds a separate
unpublished draft profile. No new public demo URL, capability, device acceptance
or readiness increase is advertised. Existing About/native/portfolio claims
remain accurate for the accepted releases: NO_CONTENT_CHANGE until this
candidate's real captures and public delivery have been reviewed.

The prior website correction PR204 is independently owner-approved and
published; it does not authorize replacing any demo with this new profile.
README media in this PR uses real captures of this local Muster candidate,
clearly labelled as unpublished. Its source/route/theme/size and capture hashes
are in `docs/assets/screenshots/bauflow-muster-captures.json`. No portfolio
Production or native website claim is changed to imply a live steel demo.
The current native information page and portfolio entry still describe their
accepted releases and existing app/demo links: NO_CONTENT_CHANGE for those
public claims; new-profile publication/media promotion stays PENDING_PUBLICATION.
Do not present the older Mira DEMO or generated UI as this profile.


## Owner-approved public-demo release, 14 November 2026

The owner explicitly approved PR206 as a separate public Muster demo and the
retirement of the former Glasfaser sample. Release preparation reuses the
existing isolated BauFlow service and URL, separate from AL-Steel and
BaumdienstFlow. The shared AL-Steel baseline was reread at `4c2c963`; it has not
advanced since the first Muster review. The ordinary app workflows are reused,
not recreated in older read-only `/demo` screens.

Public entry is a separate opt-in: `BAUFLOW_MUSTER_PUBLIC_DEMO=true` and
`DEMO_MODE=true` in addition to the original profile/installation gates.
`/` and `/demo` lead to `/muster` only there. The entry offers five fixed sample
roles: owner, accounting, field worker, factory worker and mechanic. A role
cannot supply a user/tenant ID. Each POST rechecks the sole exact Muster
company, its fictional identity, active account, role and session epoch, then
uses the existing signed HttpOnly/SameSite/Secure session cookies and clears
the other identities. Existing authorization remains authoritative after entry.
Next Server Actions retain their same-origin protection. An independent durable
`demo` limiter counts all entries: 30 per 10-minute window, with the existing
15-minute lock. It does not consume real admin/worker login buckets.

The five-role public demo is intentionally editable and shared. Changes remain
stored between browsers/devices; no reset cron is added. Its entry identifies
all business records as fictional and requests test data only. AI, external
email, GPS and provider credentials remain off/unconfigured. Built-in images
are pre-generated assets, without a generation on navigation/refresh.

The website privacy link is explicitly labelled as applying to the information
website. It is not represented as a formal privacy policy for application
processing. Dedicated app-policy/legal acceptance remains outside this
engineering acceptance; no compliance claim is made.

Provisioning preserves the seed's strict loopback-E2E guard. A fresh synthetic
local fixture is exported and restored only into the new empty
`bauflow_muster` database with its own non-superuser/non-createdb role. The
existing isolated Postgres capacity is reused, without another database
process. The old Glasfaser database is archived before retirement; independent
PostgreSQL18 restore succeeded with all constraints, one fictional company,
ten workers and four sites. Archive SHA256:
`704de0a2c824633ad6d9822630b84626be11c252e842c12d9450f41aa9828b34`.
Original app variables have a private encrypted recovery copy; no credentials
are committed or copied from the AL-Steel or Baumdienst services.

The live start command migrates and starts Next only; it must not call the
ordinary `prisma/seed.ts` or demo reset. Release source is pinned to the approved
PR merge, with one sleeping replica. Only after public desktop/narrow/theme and
role checks pass is the disabled `bauflow-reset` service retired and the old
Glasfaser schema removed. Baumdienst's app/database/reset and AL-Steel's
app/database/backup service remain outside the mutation set.

Release verification: 1,265 unit tests in142 files, full lint, application/seed
types and production build passed at `5743aec`. The final pre-optimized logo
flag at `88d07f5` passed another production build and 45 real browser cases,
including all five public roles, opposite-cookie removal, readable narrow
controls, both themes and a loaded original logo. Runtime files were compared
to the exact committed source. Earlier failed lint/worker-role/logo observations
were corrected before publication; the original assertions were preserved.
The new database restore passed at the actual online target with94 migrations,
30 selected phases and4 published plan rows. Seeded password/PIN hashes were
cleared under the existing tenant context and audit constraints; public role
entry reads the new session epoch. No local test credential is needed online.

Current release state: PUBLISHED / ONLINE_PASS. PR206 merged as
`67cd096f597a3c3dc6022a36d91e32c1fed038e2`; the release branch is pinned to this
merge. Railway deployment `dcf275b9-704e-4bb0-b3dd-acf0f690dac6` succeeded at
<https://bauflow-production-1344.up.railway.app/demo>. The earlier LOCAL_READY
record above remains the first review checkpoint.

Actual online desktop/narrow and Day/Night review passed for the public entry,
all five roles, Workzone, the saved daily plan, reception, personal offices,
site phases, inventory/asset detail and workshop. Accounting sees the same four
plan rows read-only. No page errors or horizontal overflow were observed.
Physical-device, PWA update, camera/NFC and printing acceptance remains NOT_RUN.
The capture manifest distinguishes actual online PNGs from older local reviews;
the JPEG-to-PNG normalization changes only file encoding, not UI content.

The dedicated runtime role remains non-superuser and does not bypass RLS.
Its database-scoped default tenant context is `bauflow-muster-steel`; real role
login, company reads and a rollback-only LoginAttempt write were verified.
The old Glasfaser schema was removed only after independent archive restoration
and online Muster checks; its old app deployment is REMOVED. The obsolete
`bauflow-reset` service is OFFLINE, with no active deployment, source or cron.
Permanent service deletion was twice refused by Railway's approval layer even
after explicit owner confirmation, so the empty disabled service remains.
No running Glasfaser workload or attached volume remains on that service.
The Postgres capacity now serving Musterfirma is retained.

Publication changed only the independent BauFlow app and its former Glasfaser
sample database/reset. AL-Steel and Baumdienst app/database/reset were not
mutated. A concurrent Baumdienst release from another task was observed;
its independent source/deployment is not claimed as unchanged by this task.
Portfolio/native presentation assessment is separate from this app release:
the existing BauFlow URL remains valid; new real media/content are prepared
through bounded companion PRs, without portfolio Production publication.


## Fleet glass and catalogue refinement, 14 November 2026

The fleet picker and its vehicle detail receive clearer warm ice glass in Light and deep green
crystal glass in Night, with a size derived from its content and the viewport.
Six compact vehicle cards fit one desktop row and two phone columns. The list
retains its own scroll area on short screens; search, close, keyboard focus and
return focus remain reachable. Translucent borders, compact text and full
uncropped transparent vehicle images retain the BauFlow identity. Reduced
transparency and forced-colour preferences retain a solid accessible variant.
The standard backdrop-filter declaration must follow its prefixed counterpart
so production CSS optimization retains Chromium's actual blur.

Only the `data-bauflow-muster` installation marker activates these CSS rules,
including the existing Radix portals. Other firms retain the same shared
components and original appearance. The shared component changes are inert
overlay data attributes for the picker and vehicle detail, plus an explicit
return-focus reference to the original fleet button. Reopening the picker from
a vehicle no longer captures the closing card as its final focus destination. No framework, dependency, schema or theme setting
is changed.

The catalogue contains Montage-Transporter, LKW 7,5 t, Teleskopstapler,
Scherenbühne 12 m, Kran-LKW and Bauleiter-Kombi. The last two are additional
fictional vehicles with deterministic sample IDs, plates MU BF 103/104, canonical
operational-asset records and registration history. Four existing IDs, plates,
rates, assignments and the received hydraulic repair are preserved. Road
vehicles use their plates; no barcode is invented for this update.

Six original illustrative product images were created with built-in image_gen;
its exact model selection is not exposed. Transparent alpha is retained in
896×672 WebP files, about 90–140KB each. No actual vehicle brand/customer photo
is represented. Prompt/source/derivative hashes are in
`public/bauflow-muster-v1/fleet/provenance.json`. Originals remain in the task's
existing private outputs. No API credential/provider activation, navigation-time
generation or change to either product's generation limits is involved.

Fresh local seeds use the six-entry catalogue. Existing Muster data uses the
separate explicit `scripts/augment-bauflow-muster-fleet.ts` command, never app
startup or reset. It requires profile/installation/local-or-demo gates and an
explicit fleet-apply opt-in. A live call additionally verifies the exact public
Muster origin and its dedicated database/user/host; local calls still require
the original disposable loopback E2E database guard. The transaction rechecks
the exact sole fictional company, refuses ambiguous/missing original identities
and creates only the two additions. Reruns keep stable IDs and registration
history. An existing image URL, uploaded AssetPhoto, cover timestamp or cover
file prevents replacement; a conditional update also preserves a concurrent
upload. Added illustrative covers receive an existing cover-added audit event.

Source gates: full ESLint, 1,280 unit tests in143 files, production build and
application/seed/maintenance TypeScript passed. Real before/after browser
captures cover desktop, phone, 320px and short landscape in both themes.
Database fixture checks prove upload preservation, repeat calls without
duplicates and unchanged original IDs/plates/repair. Failed harness observations
(port conflict, unit-test origin/OCR environment and timestamp decoding) remain
recorded; assertions were retained and the correct executor/fixture restored.
The production-only CSS blur omission was fixed and rechecked in real renders.
Physical-phone acceptance remains NOT_RUN.

A scoped encrypted rollback snapshot of the actual live Muster fleet was saved
and successfully decrypted/hash-checked before the additive update. Final live
publication and online readback are recorded separately; this chapter by itself
is not a claim that the candidate was published. Native/portfolio capability
claims and links remain accurate for this bounded material/sample-data repair;
the existing showcase companion PR209 is updated rather than creating another
public presentation or changing Portfolio Production.


Fleet release receipt: PR211 merged as
`60e90ddfff9b15adc671d811dbcf9ebfef0db84d`; Railway deployment
`90a23664-bc82-4fc6-8dbb-84f3a4db24a1` is SUCCESS. The tree matches the reviewed
`4b42944` source exactly. The additive command ran once online: two vehicles
added and six illustrative covers filled, with eleven canonical assets total.
All original fields except imageUrl/updatedAt and the existing repair history
matched the encrypted preflight snapshot. Actual online desktop/phone and
Day/Night review passed, including plate search and opening/back from the new
vehicle. The temporary viewport and theme were restored. Genuine captures and
source PNG hashes are in `docs/assets/screenshots/bauflow-muster-fleet-online.json`.
The archive upload/readback SHA256 is
`588fc82fd039206917d06ebfb4d5b81d445103f6908a41bb489e6e2b6410a44e`.
No main/AL-Steel/Baumdienst or Portfolio Production deployment was performed.
