# Steel production dashboard — review candidate, 4 November 2026

## Partial parts and site priority — 12 November 2026 candidate

Owner screenshots exposed two read-model bugs: factory summaries fetched only
assemblies, excluding plate cutting and sites with parts only; the phone grid
rendered the original edit-time order rather than the canvas's priority order.
Both home and site factory summaries now read the permitted assembly/part lists.
Process progress includes confirmed piece counts on applicable factory stages,
including partial checks and selected custom routes. Closed legacy routes retain
their accepted completion; empty routes do not become complete. The percentage
is process work, not distinct finished pieces or summed process kilograms.

Keep assembly production/release, delivery, field completion and their kg totals
unchanged. Part cutting has its own compact count. A part-only project appears
without a misleading `0/0 produced` assembly line. Existing warm crystal surfaces,
orange/green meanings, pictures and controls remain; six locales share the copy.
Production/weight access is retained; restricted home users do not receive the
new production aggregate in client props. No stored confirmation, account,
permission, original image, migration, provider or business action is changed.

The board's DOM and automatic canvas layout use the same priority: sites with
current crews first (most recently activated first); idle sites alphabetically,
with stable name/ID ties. Idle timestamps cannot outrank a real crew. A currently
staffed site stays on the board even when its task counter is complete. Existing
drag/layout persistence is retained; no saved coordinates are deleted or reset.

Branch: `fix/steel-progress-site-order-20261112`, based on PR176. The concurrent
workshop-presence agent owns separate attendance/workshop changes; preserve that
checkout and reconcile any later shared-page changes before publication. This
candidate requires owner approval before merge/deploy. Exact local evidence is
recorded with its PR, separately from live acceptance.

Local verification passed: production build/TypeScript, changed-file ESLint,
18 focused factory-stage/output/order cases and an isolated synthetic browser
flow. Before/after captures cover 1440×900 light, 390×844 dark, 320×740 light and
760×390 dark. A part-only site shows 4/10 cut (40%), then 7/10 (70%) after another
saved check, on both home and detail. No assembly is created/released for it;
restricted field users get no production aggregate. The grid follows active
crews then alphabetical idle sites, and reprioritizes when the crew moves. No
real business confirmation, account or permission was written during diagnosis.

## Catalog containment and office attendance — 12 November 2026

Reception lettering follow-up: the presence list is plain engraved-style text,
without a panel, border, background, icon or backdrop blur. It follows the
original photo canvas and sits further left on the marble reception counter;
the portrait and short-screen coordinates adapt to their actual artwork.
Names are text rather than redundant navigation buttons. A transparent native
expansion keeps longer lists available in the same small area. Existing door
status, office attendance commands and access boundaries remain unchanged.

Office presence follow-up: the same own-room crystal control now stops the
current office session directly, with the existing profile's pause, break,
rounding, undo and timesheet rules. A stale office control cannot stop a site
session or a colleague's clock. Reception doors display green **Në zyrë** only
for a live office session; paused people are labelled separately. A compact
digital glass display on the reception desk lists the already-visible office
holders currently present, with extra names behind one small expansion. It
shares only names and present/paused status, never hours, private mail or tasks.
The existing realtime/focus refresh keeps the display current. No migration,
new accounts, permissions, provider or subscription changes accompany this
follow-up. PR166 warehouse registration remains in the production baseline.

The catalog's process sprite is positioned inside its own thumbnail, including
the create/edit preview. The shared visual wrapper clips to its bounds; existing
absolute factory illustrations retain their positioning.

Each office owner gets a compact crystal **Puno në zyrë** action in their own
room's floating upper navigation. The server resolves the current account's
existing worker link, never a submitted colleague ID. A manager's preview has
no attendance control. The existing locked start/resume/move engine records
`WorkSession.workplace = OFFICE`, preserving a single live clock and the same
start time when moving from a site. The additive nullable column leaves old
sessions untouched. Planned-site fill and GPS cannot override this explicit
office choice; an explicit site start clears it. Workbooks show **Zyrë**;
The subsequent office follow-up replaces the profile link with direct Ndalo. Unavailable workers
cannot start, and an absent account link gives a bounded error without guessing
identity or creating a worker. No accounts, roles or office grants are changed.

## Workzone photographic materials — owner redesign, 12 November 2026

Owner correction after PR162: first finish **Workzone home**. Restore orange
primary actions, reuse the exact office painting
`/office-studio-v1/connected-work-artwork.webp` behind the site board, and carry
its warm stone, copper and teal tones through the surrounding workspace, glass
cards, borders, archive and factory surfaces. The painting is reused unchanged;
uploaded site/factory photos still take precedence inside their own cards.
The `data-studio-home` scope supplies these materials to the home view and its
existing dialog portals, then releases them on navigation. Site interiors,
process pages, profiles and offices initially retained their previous presentation pending
the owner's next design phase (see the later site extension below). No workflow, layout persistence, company data,
access checks or asset storage changes accompany this correction.
Desktop presentation measures the actual card heights and moves overlapping
cards down just enough to clear notes/badges, extending the board to the last
card. Saved coordinates, reset and drag persistence remain in their existing
format; this visual clearance does not write new coordinates. Phone cards keep
their existing natural two-column flow. Reduced-transparency/unsupported-blur
environments receive solid readable cards instead.

Follow-up owner correction, 12 November: keep only the header office entry
(between Home and Panel on desktop). The single desktop operational row now
contains fleet, workshop, announcements, notifications and KiDraht, beside a
reserved gap outside the scrollable team strip. The transparent header and
reachable full team remain. Comfortable team names gain one pixel and a subtle
theme-aware shadow. Shared photo replacement controls show a 20px corner camera
mark inside a transparent 44px touch target; existing camera/upload menus,
private WebP storage and role checks remain unchanged.

The next owner clarification supersedes the reserved side gap: operational
controls occupy a real header grid row **below** the full-width team, through
the existing header context/portal. No floating shell clips or covers workers.
Both rows share the logo/navigation height on desktop; phones stack them without
an empty top band. Home primary actions use lightly tinted orange crystal with
static reflections, blur, a fine rim and contrasting ink. Reduced-transparency
mode retains readable solid fallbacks. Office/reception navigation floats as
individual glass controls over a full-viewport scene. The old left reception
title is removed; the tenant's existing validated company logo is rendered on
the marble wall behind the desk with soft backlighting, without redrawing or
altering its stored image. Room objects, back destinations, office access,
manager preview restrictions and personal AI separation remain unchanged.

The next authorized phase extends these same materials into steel site interiors
and their existing process/material sheets, via `data-studio-interior`. The
painting, original uploaded photos, warm glass tokens and light orange crystal
actions are reused. Group tiles and process cards become compact, the site uses
the available width, and sheet controls retain 44px touch targets with intrinsic
widths instead of tall full-width action panels. Done/blocked colors, quantities,
routes, historical checks, mutations and server-derived role gates are unchanged.
Worker presence in the steel header is a static soft green with no expanding
pulse, including a selected worker whose product accent is copper; sick/vacation/
unavailable states and classic-company presentation remain intact. No new image,
provider, dependency, feature activation or migration accompanies this phase.
The selected phase is keyed by its existing ID, not its current list index: a
refresh/reordering after a note or confirmation must not move the open card to
another process. This is UI selection state only; command handlers, validations,
permissions, metrics and storage remain unchanged.

The owner extended the accepted Office Studio quality and warm artwork palette
to steel Workzone: photorealistic industrial environments, warm limestone,
natural steel, muted teal, copper details and restrained frosted glass. This is
an explicitly requested visual baseline; the admin dashboard's data/metrics,
permissions, operational workflows and office-private AI are unchanged.

The authenticated steel layout sets `data-steel-studio`. Its scoped body tokens
also reach existing dialog portals and naturally disappear outside that layout.
Shared Button/Card components only gain neutral presentation hooks; classic
companies retain their existing appearance and illustrations. The stationary
header/team wrapper stays transparent and the footer remains at the true end
of the content scroll region. Office scenes retain their accepted layout.

Four static WebPs in `public/steel-studio-v1` provide a fictional construction
site, fabrication hall, workshop and six distinct production close-ups. They
total 652,082 bytes, with original/final hashes and prompts in provenance.json.
Built-in generation did not expose a model identity or use any client records.
These are decorative environments, not photographs of the company's premises,
equipment, actual progress or engineering instructions. No runtime generation,
provider, dependency, feature activation, migration or private-file cache is
added. Uploaded site/factory/vehicle photos always take precedence. Missing
vehicle/tool photos use quiet native outline placeholders rather than invented
photographs of a specific asset. Classic SVG fallbacks are preserved outside
the steel layout; factory close-ups use the actual process key rather than its
legacy drawing alias (notably cleaning versus drilling).

Phone site cards use a stable two-column flow with natural variable row heights;
saved free-placement data is retained and desktop dragging remains available.
Photo cards open the existing site, note and location actions. Primary actions
keep 44px touch targets, with a balanced second action row when a note is present.
The workshop has a continuous photographic background and compact frosted phase
columns; current reports, accepted/repairing/ready states, external repair,
history, photos and existing role checks remain intact. Process counts and
status colors are not fabricated or merged into new totals.

Acceptance covers before/after desktop, narrow and landscape in light/dark:
site cards and daily archive, factory totals/steps, fleet search/grid, workshop
queue/detail, map navigation, uploaded-photo preservation, header/footer flow,
reachable non-overlapping phone controls and classic-company isolation. Exact
revision/executed results belong in the release PR and private continuity record;
physical PWA acceptance remains separate. Public presentations remain deferred
under the owner's existing decision.

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

The steel admin workspace uses the available width and height. Owner correction,
6 November 2026: compact Flota/Oficina triggers join the transparent header beside
alerts on desktop and between Panel and alerts on phones. Their dialogs retain
workspace-owned state and focus restoration through a React portal; no separate
side column or bottom dock row is reserved. Vehicles appear in the searchable
dialog rather than a permanently visible thumbnail rail. Fleet administration
also remains under Personnel & Fleet. Header and
navigation remain outside the primary content scroll region. The transparent
shared footer is the final content item: it appears at the end of a long view,
then scrolls away when returning to the beginning. It is not a persistent viewport
row. This owner correction supersedes the earlier PR43 footer placement.
Owner clarification after PR44: transparency must reveal the scrolling content
behind the stationary header on desktop and phone, not an empty reserved row.
The content scroller spans the header area, with measured initial top clearance
and scroll padding keeping the first item/focused controls reachable. Empty header
space passes pointer input through; logo, team and controls remain interactive.
The header/team wrapper is transparent; on desktop the announcement/bell controls
sit directly beneath the single book icon, without a group backplate. The team
can scroll underneath, with enough end space to reach its last profile. Steel
admin navigation does not repeat the KiDraht link. The map navigation pane scrolls independently with its bar hidden.
Phone dashboard controls share compact44px touch targets and intrinsic widths;
the monitor action no longer stretches across the row. Reduced gaps/padding keep
the existing metric, filter and calendar hierarchy without changing any numbers.
The author link stays centered over the full footer width, with the small product
mark at the side. Long public pages retain document scrolling.

Calendar rows fit their actual values: no placeholder dots for empty metrics,
44px minimum day targets and compact active days. Meaningful dates, quantities,
weight provenance and the three separate processes are unchanged. Decorative
section counters are removed. The responsive UI is scoped to CSS modules, with SVG charts, keyboard
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


### Warm crystal planning and production dashboard — 12 November 2026

The Workzone daily plan, saved-plan calendar and site-creation sheet reuse the established warm stone/copper glass surfaces. The desktop plan header keeps its date navigation beside the title; the phone retains the existing full-screen plan and save actions. Office return links and saved versions keep their existing destinations and behavior.

The steel dashboard reuses the same artwork and warm material language, with opaque chart canvases for legible labels and distinct production series in both themes. Refresh, monitor and copy remain the same operations, presented as three corner icons with accessible names and 44px targets. Compact filters and smaller gaps give the metrics and charts more space. This is a presentation-only change: no database, authorization, notification, attendance or production-calculation changes. Classic company screens remain outside the steel visual scope.

Focused acceptance: `tests/e2e/steel-planning-crystal.spec.ts`, the existing dashboard/theme suites, plan-hours, steel header/footer and Workzone-studio regressions. Local rendered evidence is separate from owner acceptance and a production deployment; the owner must approve merge/deploy.
