# Company inventory and workshop

This feature applies to authenticated steel companies. Other company modes keep
their existing inventory and fleet behavior. The Baumdienst demonstration informed
the workflow; its public role cookie and JSON store are not used here.

## Working with assets

Warehouse separates tools, clothing and site equipment. Each row represents one
physical item with its own stable identifier/code. Registering several garments
creates separate units with a shared name and size; it does not invent bulk stock
on an existing assignment. Existing company catalog IDs, assignments, movements,
private belongings and production checks remain intact.

Flota and Oficina are the only resting dock actions. Flota opens a searchable
three-column phone grid (more columns on larger screens). Selecting a vehicle
opens its existing GPS, maps, fuel, photo and information card in a large dialog.
Warehouse and workshop details add reports, documents and operational history.
Vehicle cover uploads also update the existing fleet/map photo record atomically;
the private attachment preserves history. A retried upload cannot replace a
newer photo taken through the existing vehicle camera control.

## Who confirms what

Workers report defects, loss or an item that should leave service. Loss/retirement
remains pending until an administrator or OFFICE worker accepts or rejects it
with a note. Pending reports block new allocation. Confirmed loss/retirement
soft-disables the original asset; only management can restore it with a note.
Restoring preserves a pre-existing manually inactive base record.

An issue or return requires office and receiving/returning worker confirmation.
A colleague transfer requires both colleagues, including when management starts
it. Pending handovers reserve the item but do not change custody. A manager can
document a return from an inactive former worker without requiring that worker
to log in; the mandatory note and explicit override event remain in history.
An inactive holder cannot be silently transferred to another colleague.

The MECHANIC crew role can work on workshop jobs and their documents. It does
not grant production-engineer or office permissions. Management can also perform
workshop steps. No existing person's role is changed by this migration.

## Repair flow

Reported → received → repairing → ready for use. Reporting immediately creates
one open workshop job and cancels an unfinished handover. Reception records the
return from the previous holder while retaining the original holder on the job.
Only mechanic/management can progress the stages. During repair, internal or
external service can be selected with a note and optional provider name.

Ready requires an explicit function-test confirmation plus a repair note or
same-job evidence. A loss/retirement still awaiting a decision prevents release.
Completing a repair does not re-enable a manually disabled vehicle. A chief can
reject a mistaken defect only before reception, with a recorded explanation.
Past jobs, photos, invoices, authors and server timestamps remain attached to
the original vehicle/item. Old notes-based defects remain visible as legacy
history; their old resolve action cannot bypass the workshop.

## Compact workshop and current vehicle status

The workshop board uses small thumbnails and compact, whole-row actions, with
name/plate, problem, exact phase, repair route and update time. Desktop columns
fit their content; phone filters show phase counts and initially select a phase
with work in it. Search also matches the problem and repair provider. The Ready
column is recent completed-job history, not a claim that those vehicles are
currently available: a newer report or allocation block takes precedence.

Vehicle surfaces use the same tenant-scoped operational projection. Reported,
received and repairing remain distinct; a pending defect incident cannot keep a
received vehicle labelled Reported. Internal/external is the recorded repair
route, not a GPS location. Loss, retirement and inactive states keep their
blocking meaning. A base active flag or an online GPS device does not prove that
a vehicle is available. Availability means the system has no recorded operational
block; it is not a new inspection certificate. Missing/failed reads show unknown
instead of a green all-clear. Photos keep their existing private access boundary.

The exact-ID status read contains only current availability, open repair phase,
internal/external route and read time. It does not copy repair notes, providers,
invoices, holders or GPS into shared status badges. Reads are bounded to 500
machine IDs; larger registries render unknown status rather than crash or show
an apparently complete green subset. Opening/returning to fleet or map and
resuming a visible window refresh the scoped batch. Same-query workshop refreshes
keep card nodes and scroll position; the refresh icon remains available.

Presentation assessment for this bounded accuracy/density correction:
NO_CONTENT_CHANGE. The native six-language steel description, public showcase
README/About and portfolio card/case study already describe the same four-phase
workshop, repair history and compact fleet. Their workflow, links, access and
stage/readiness claims remain accurate. Existing explicitly historical fictional
captures are not represented as a capture of this candidate. No public demo,
new capability or maturity change is implied by this UI correction.

## Files, isolation and compatibility

Files are private database bytes behind an authenticated, tenant-scoped route.
Invoice metadata and downloads are available to mechanic/management only. Raster
images up to 12 MB are oriented, stripped of EXIF/GPS and converted to WebP up to
180 KB. Documents/invoices accept PDFs up to 5 MB. A job supports 20 attachments
and 25 MB of stored bytes. The shared scanner seam defaults to no-op; no malware
scanning capability is claimed. PDFs are downloaded with no-store, nosniff and
sandbox headers. No new AI/provider spending is introduced.

The additive migration adds seven domain tables, tenant/composite foreign keys,
FORCE RLS, one open repair/pending handover constraints and command receipts.
Mutations serialize per asset; retries retain their request UUID and changed
payloads cannot replay a previous command. Initial reads perform no backfill.
Ambiguous legacy custody is refused rather than guessed. Existing pending legacy
confirmations can finish only before a new overlay adopts the item, under the
same asset lock. Old company-inventory and vehicle forms cannot bypass the new
confirmation, repair or planning gates. Private belongings keep their old flow.

Assistant fleet, inventory and HR facts read the same current operational states.
A base `active` flag, historical responsibility row or planned machine name does
not prove availability or physical possession. Exact-ID reads report unknown
states and partial coverage on failure; provider/model/quotas remain unchanged.

Active queues are independent of the paginated item list. Bounded queue/history
views signal when more records exist; no complete-history claim is made by a
short workshop board. Opening an asset shows its own historical records.

## Local acceptance and publication

Use the repository's local lint, typecheck, unit/integration and production-build
gates. `steel-assets-workshop.spec.ts` exercises actual server actions against an
isolated synthetic database, worker/mechanic roles, invoices/photos, phone grid,
search, focus, themes and unchanged production records. The existing
`steel-footer-header.spec.ts` verifies the transparent stationary header and footer
at the true content end. No production fixture or paid provider is used.

Merge/deployment requires the owner's approval under AGENTS.md. Before applying
the additive migration to AL Steel, take a fresh verified backup and independent
restore, preserve Railway's migrate+provision+start override, and verify the exact
deployed revision. Local test results and owner acceptance remain separate.

Local candidate evidence (5 November UTC / 6 November CET): full lint and
typecheck passed; 957 unit tests and 385 integration tests passed, including the
restricted planning-role checks. A subsequent focused photo/asset batch passed
19 cases, including the new current-photo/history/retry regression. The final
production build and all four browser flows passed on the final runtime source:
confirmed issue/loss/restore, mechanic/external repair/private invoice/photo/tested
release, responsive fleet/workshop, and the existing header/footer regression.
The latter preserves all assertions; short landscape uses two PageDown steps to
reach the same underlay threshold. Phone grids, both themes, landscape/text zoom,
actual content behind the header, click-through, focus return, and first/last
content were checked. No real camera/GPS or paid AI provider was exercised.

The fresh production backup at 2026-11-05T22:49:29.010Z passed independent restore.
No production migration, deployment or real role/asset mutation was performed
during preparation. Native presentation, showcase and portfolio copy are prepared
in their existing companion PRs, held until the core release is authorized.

The final client refresh correction keeps same-query card nodes, focus and scroll
position intact while refreshing; category/search changes immediately hide old
results. The three affected asset browser flows passed after this correction
(the final visual case also asserts a delayed real filter response). Primary
light-theme action text now exceeds 4.5:1 contrast; both themes are measured in
the browser. The unchanged shell retains its preceding full header/footer PASS.
Camera capture also honors the selected attachment kind: a receipt selected as
Invoice stays a private invoice. The affected mechanic browser flow passed with
both PDF and camera-image invoices denied to an ordinary worker, followed by
tested repair release. No physical camera was opened by the automated test.


## Vehicle editing and service entry — 6 November 2026

Vehicle cards now expose a management-only editor for identity, model, plate,
years, function/license, ownership, weight, active flag and paper expiry dates.
The same editor uses the established photo pipeline and private attachment
store. Vehicle papers remain unbound to repair jobs. No GPS configuration,
financial rates or unrelated machine fields are overwritten. Server-side fresh
tenant/role checks and the existing asset lock/activation guard remain mandatory.
A checksum of editable metadata rejects competing drafts without treating an
intervening GPS or cover update as a conflicting paperwork edit. Legacy defects
are retained when the free-text note changes.

The vehicle's Workshop action opens a short choice between defect reporting (or
its current repair) and service history. The home Workshop action opens the full
workspace: small vehicle cards in four illustrated bays. Cards and the service
history carry the exact repair ID, including a historical completed visit while
the same vehicle has a newer open job. Current vehicle availability stays visible
separately. The selected visit owns its attachments; invoices remain private.
Notes, external routing and evidence use progressive disclosure. One final
All details button reveals the established exhaustive asset record. Warehouse
flows keep their complete default presentation. No process transition or release
permission changed: mechanic/management, saved evidence and an explicit successful
function test remain required. No migration or new dependency/provider was added.

The workshop illustration follows the existing fleet SVG palette and uses native
vector shapes. KEEP_CURRENT: suitable existing native graphics avoid a new image
provider/cost path. Official Images API model documentation was consulted
(https://developers.openai.com/api/reference/resources/images/methods/generate);
GPT Image 2.6 candidates are documented, not account-tested or adopted here.

Local acceptance on the Windows laptop, using its isolated WSL databases and
synthetic identities only:
- Full unit suite: 1,087 tests / 114 files passed.
- Full database integration suite: 416 tests / 34 files passed, including fresh
  office/worker/mechanic and foreign-tenant checks, invalid input, stale drafts,
  GPS/photo concurrency, retained defects and blocked repair reactivation.
- All three asset browser flows passed on the final app source: warehouse
  regression; worker report to mechanic/external/private-evidence/tested-ready;
  and fleet/editor/workshop/history on desktop/390px/360px in light and dark.
  The last flow also checks an actual photo and document upload while editing
  papers, exact historical/current job selection and dialog focus return.
- The bounded visual follow-up passed with the vehicle editor at 200% text size
  in an 844×390 window: Save and close stay reachable; no horizontal overflow.
- Full lint and explicit typecheck passed; the guarded browser runner performed
  npm run build and started the production build successfully. Before/after
  renders were inspected. The asset regression rechecks the header underlay
  and click access. Footer code is unchanged; its preceding PR71 acceptance is
  retained rather than claimed as a newly repeated full footer-suite result.

Artifacts are in the local steel-fleet-workshop-flow evidence directory. Camera,
printer, real customer browser and production role mutation were not exercised.
All checks above concern preparation, not deployment or owner production acceptance.
The native presentation is updated in six locales. Companion showcase/portfolio
changes use synthetic workshop media, keep readiness unchanged and are held for
approval plus core live verification; their source, local checks and publication
are separate states. No paid provider call or production write was performed.
