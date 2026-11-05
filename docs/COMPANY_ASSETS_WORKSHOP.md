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
