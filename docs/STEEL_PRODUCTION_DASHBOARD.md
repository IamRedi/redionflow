# Steel production dashboard — review candidate, 4 November 2026

This candidate replaces the generic dashboard for BauFlow companies with steel
projects/workshops. Baumdienst keeps its existing dashboard. It is prepared over
pilot d56173b; publication requires owner approval under AGENTS.md. No real data,
GPS binding or credential was changed during development.

## What the numbers mean

- **Parts cut**, **assemblies cut** and **assembled** are three distinct series.
  Their weights are never summed into a fictitious total: the same steel can
  pass several operations. Cutting uses the corresponding list; assembly uses
  the assembly-stage checks in Lista assemblaggi.
- Daily kg = confirmed pieces × per-piece weight from the imported element list.
  These are engineering-list weights, not measurements from a weighing scale.
  Calendar dates use the server confirmation timestamp in Europe/Tirane (AL)
  or Europe/Berlin (DE), not the browser/server's local day. Late entry cannot
  reconstruct the unrecorded actual work day. Days without confirmations stay
  empty; no demo trend is injected into a real company.
- New checks save an immutable versioned mark/list/quantity/unit-weight snapshot
  in SiteElementWork.productionSnapshot. An explicitly missing weight stays
  missing even if a later import adds it. Reimports do not rewrite new historical
  kg. Existing records are not backfilled: their derived weights are marked ≈
  from the current list, and may change after a reimport. Unknown-weight pieces
  are identified separately instead of presented as completed zero kg.
- Current project progress is distinct from monthly production. Only assemblies
  form its denominator; parts are not added again. Factory-ready pieces follow
  the engineer's closed route, including intentionally skipped processes.
  Current factory/site stage cards show their own pieces and known weight.
- The real confirmation action locks its owned element before checking remaining
  pieces and capturing its weight, serializing concurrent confirmations and
  reimports. Cancelled checks are excluded. This is a production confirmation
  view, not a tamper-proof ledger of deleted/cancelled records.

## UI and evidence

A monthly calendar, three independently selectable trend lines, project filter,
current project progress rings and all factory/site steps replace tree-centric
cards. A selected day exposes per-project kg and an expandable evidence list:
mark, list, quantity, unit/total weight, original worker names, confirmer and time.
Evidence pages use checkedAt/id keysets scoped to the same company/project/day;
paging does not change totals. Month/day filters do not alter records. Dates and
numeric weights have deterministic SQ/EN/DE/IT/PL/RO formats.

The floating fleet rail is suppressed only on this dashboard; other pages retain
it. The responsive UI is scoped to a CSS module, with SVG charts, keyboard
controls, native disclosure, reduced-motion handling and no new UI dependency.

## Monitor entry and access

The existing /display/dashboard entry now uses the production view for steel
companies. The dashboard opens/copies that link. A signed-in admin can preview
it; a separate active company STAFF/display account has read-only access.
There is no anonymous bearer link or newly created real account. Worker, mixed,
revoked and anonymous identities cannot use the new view. The tenant comes only
from the authenticated identity, never URL input or a first-company fallback.

The monitor receives aggregates only: personal evidence is absent from both HTML
and RSC payload, not merely hidden with CSS. It has refresh/full-screen controls
and refreshes every 60 seconds while visible. Default/today mode advances with
the company day; explicitly selected historical periods stay pinned. Projects
can be filtered when many are active. Full-HD geometry was checked with the two
synthetic demo projects; an arbitrary number of projects is not claimed to fit
one screen. The display routes are noindex.

Display login retains its scrypt/session/rate-limit/same-origin controls and now
uses a 303 POST-to-GET redirect through /display, which chooses the steel panel.
The local managed E2E runner pins APP_BASE_URL to its validated loopback target;
foreign-origin login still returns403. Unauthorized page renders now redirect
before requesting a tenant snapshot, avoiding the former parallel-render errors.

## Migration, verification and rollback

20261104210000_production_evidence adds one nullable JSONB column and a
(companyProfileId,checkedAt,id) index. No old timestamps, weights or projects are
rewritten. Source, local checks, GitHub CI and production acceptance are separate.

Local checks: 7 metric/date-format unit tests; 6 PostgreSQL integration tests
including the real write action, reimport stability, concurrent checks, cancelled
checks, company/role isolation and 52-row evidence pagination; one Chromium
workflow for project/day filters, expandable evidence, phone/desktop geometry,
Full-HD monitor, real display login, foreign-Origin denial, private payload and
native-presentation copy. Build, typecheck, changed-file lint, migration/schema
comparison and secret scan accompany the candidate. Prior full GPS/fuel/photo
suites were not rerun under the owner's instruction; no Actions were dispatched.
Exact results/revision are recorded in the PR, not inferred from this checklist.

Native presentation copy is prepared in all six existing locales. Showcase media
is real local UI with fictional companies/projects only. The portfolio companion
keeps the live core separate from this review candidate; maturity is unchanged.
Generic GitHub About remains accurate: NO_CONTENT_CHANGE. Public portfolio and
separate product-site publication keep their own approval/readback boundaries.

After approval, merge to the existing Railway pilot, retain source/config/secrets,
verify the additive migration, exact deployment, health and authenticated views.
Rollback runs the prior application revision and retains the new column/index and
stored evidence. Old app versions can continue writing legacy-null snapshots;
never drop evidence or reset customer projects as part of rollback.
