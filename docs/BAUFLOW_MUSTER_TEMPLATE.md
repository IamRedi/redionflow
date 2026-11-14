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
- The daily plan links each worker to one workplace. Closed sessions cover
  five past weekdays; current synthetic field/factory sessions show the crew
  on its project. Office history uses the existing explicit OFFICE workplace.
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
Day/Night campus. Fixed office rooms retain their own existing scenes.
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
The final database/browser acceptance is still in progress at this source
checkpoint; a successful build is not visual acceptance.

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
Native/portfolio media must use reviewed real captures of this template once
verified. Do not present the older Mira DEMO or generated UI as this profile.
