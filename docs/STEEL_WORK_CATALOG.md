# Shared work catalog and material applicability

Review candidate for the real AL Steel company. Production records are not test
fixtures. This change is prepared over PR53/df65504; merge/publication requires
the owner's approval for the exact reviewed revision.

## Workflow

Each company has one catalog of site tasks, factory processes and field
processes. The site task picker shows every current choice with a checkbox.
Creating a task selects it at the current site only; it remains unchecked at
other sites. Editing a shared label or illustration updates that catalog asset,
without silently enabling it. Archive/restore replaces destructive deletion.

Office staff and engineers can plan applicability and manage the catalog.
Confirmation permissions remain side-specific: factory engineers confirm
factory work, field engineers confirm field work, administrators can do both.
Ordinary workers can read and report missing material, not change configuration.

After importing materials, the process editor applies choices to one material
or an explicitly identified list. Mixed plans require explicit replacement;
concurrent revisions fail instead of overwriting a newer plan. New imports
start unconfigured. Reimport preserves existing plans, confirmations and original
weight snapshots. A required process with zero confirmations stays unfinished.
An empty selection is unconfigured, never permission to release materials.

Only applicable processes contribute to current process denominators. Field
denominators include required assemblies still awaiting factory delivery, so
finishing the first partial shipment is not 100% of the site. Site tasks can
link explicitly to a factory/field process and optional list/element-kind
filter. They derive completed/required pieces from those material confirmations.
Names alone never establish that link. No applicable materials means unknown/
unconfigured completion, not automatic success. Manual task notes and original
completion attribution remain preserved. Site progress averages selected task
progress; inactive/archived tasks do not contribute.

## Historical compatibility

Stable process keys identify work. Renaming a process does not rename stored
events. Builtins keep their canonical keys; custom factory/field keys have
explicit side prefixes and a tenant-owned catalog definition.

`SiteElement.processRoutes` is nullable. NULL preserves the exact older inferred
route/finish-stamp behavior. Version1 holds independently nullable factory/field
stage arrays. A configured nonempty route is known upfront: release follows the
minimum confirmed quantity across every required stage, including zero. Old
finish stamps are retained; they do not bypass a configured requirement.

Changing a plan never deletes `SiteElementWork` or `productionSnapshot`.
Factory changes cannot take back quantities already worked on site. Planning,
confirmation, cancellation and reimport serialize on owned element locks;
catalog mutation locks precede element locks. Archived processes cannot be newly
selected, but explicitly existing routes may finish them. Unselected historical
confirmations remain readable separately from current progress. Calendar kg
still describe historical confirmations; cutting and assembly kg are separate
series and are never added into one fabricated steel total.

The additive `20261106100000_steel_work_catalog` migration seeds company choices
and binds existing fixed/custom task rows without changing their IDs, notes,
statuses or attribution. It does not create unchecked task instances in every
site and performs no AI backfill. Fresh sites start with no selected tasks.
Tenant composite references and FORCE RLS protect the three new tables.
Generic tree/offline commands cannot bypass the steel engineer/task path.
Company/site exports include the new plans and original production history.

## Photos and original illustrations

Visuals belong to the company catalog definition. Camera/file input reuses
bounded raster validation, orientation, metadata removal and WebP compression
(12MB input/24MP maximum, stored output at most180KB). Images are private and
read through authenticated same-company endpoints.

With no photo, an explicit create/edit action requests one original geometric
illustration from the existing OpenAI model. It sends only the task's label,
description, canonical type and trusted style instructions. The model returns
bounded scene JSON; trusted code renders SVG using the existing steel palette.
Arbitrary XML, JavaScript, CSS, text, external resources and embedded images are
rejected. Image responses use nosniff, same-origin policy and restrictive CSP.

The existing guarded streaming model, input/output bounds,45s timeout, zero
retries and shared durable quotas remain. Illustration generation allows one
model call, with actual usage settlement; there is no rendering-time generation,
mass paid backfill or automatic paid retry. Missing key/quota/provider/validation
failure keeps the saved task and previous image/fallback. Revision/status/time
checks prevent a late generation from overwriting a photo or newer edit.

## Verification and release

Local checks use the isolated laptop database and fictional companies. Required
coverage includes legacy route preservation, selected denominators, partial
delivery, concurrent revisions, tenant/role isolation, shared disabled choices,
archive/restore, unchanged historic kg and safe/stale visual generation.
Desktop/narrow light/dark rendered acceptance is separate from typecheck/build.
No paid illustration call or production business-data mutation is part of local
validation. Exact outcomes are recorded in EVIDENCE.md/PR after execution.

Take a verified production backup before the approved migration. Retain the
additive schema and data during any recovery. An older application does not
understand explicit routes/custom stages: after new plans or work are recorded,
blindly redeploying the old app is not a safe semantic rollback. Prefer a
forward correction or a separately approved restore with affected writes stopped.
