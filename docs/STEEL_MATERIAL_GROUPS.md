# Steel material groups

Owner/Megi requirement, 17 November 2026: three groups in a site's material
lists: **Single Parts**, **Asamblime**, **Elementet**. Keep the accepted warm
crystal interface, tenant/site permissions, confirmed work and existing metrics.

## User flow

- **Single Parts** contains the imported part list, with its existing cutting
  workflow. Codes keep their original case. A site containing only parts opens
  that group directly and no longer labels its factory list as missing.
- **Asamblime** contains imported assemblies. An export with separate `Assemb.`
  and `Parte` columns attaches subsequent component rows to their assembly.
  `B/1` in `Assemb.` is an assembly; `b/1` in `Parte` is a different part code.
  Its composition links automatically to the exact-code Single Part in the
  **same site and company**, including when that part list arrives later.
  The composition keeps its own source filename/import date, even if a later
  assembly-only export updates the material without a replacement composition.
- **Elementet** contains standalone remainders calculated from the imported lists,
  alongside explicitly manual elements. An authorized factory planner uses
  **Shto element**, enters code/name/quantity, then chooses processes with the
  existing process editor. No process is automatically selected. An empty route
  never means completed work. Existing factory-before-field release rules apply.

Megi clarified on 17 November 2026 that component quantities are for **one
assembly**. Standalone quantity is `Single Part quantity - SUM(component quantity
per assembly * assembly quantity)`, matched by the exact part code in the same
site/company. Repeated parent export rows add assembly quantities while retaining
one identical unit composition; conflicting unit compositions reject the file.
These
references do not create more stock, duplicate production totals, assign part
work to an assembly, or automatically confirm assembly work. Missing parts are
explicitly marked; repeated codes in different assemblies retain their own
exported quantities. No component weight is embedded in this new metadata.

## Standalone elements and one-action production — 17 November follow-up

After an upload transaction completes, a complete and consistent set of lists
updates linked standalone elements automatically. For previously uploaded lists,
the authorized planner can use **Elementet → Përditëso Elementet**. Reading a
page or installing the additive migration never creates/reclassifies records.
Missing lists, missing/empty composition, unresolved codes and over-allocation
are explicit; they never mean that all parts are free. Incomplete initial
uploads stay importable without invented standalone stock. Once linked elements
exist, an inconsistent reimport is rejected atomically rather than retaining
misleading quantities. A same-code manual/assembly collision also rejects the
reconciliation; a manual record is never silently adopted.

`remainderOfId` links one standalone assembly-workflow row to its original part.
The original Single Part and cutting history retain their IDs, quantities and
checks; this is a final standalone material, not an additional Single Part stock
row. Existing canonical metrics keep cutting, assembly processing and released
materials separate. The linked element starts with empty factory/field routes,
no work and no assumed completion. **Proceset** reuses the existing company
catalog checkbox picker, including custom processes and its current permissions.
Recalculation preserves selected routes, IDs, workers, finish attribution and
work snapshots. Quantity reductions below confirmed work, or deletion of a
configured/historical standalone element, fail without changing either list.
Source-file removal is blocked while linked elements depend on the site's lists.

**Përfundo prodhimin** is for one assembly/standalone element, never a whole
site. The compact crystal dialog shows only unfinished quantities for its
required factory stages. Choose a common crew once and optionally different
workers per stage, then confirm once. One transaction creates normal per-stage
records for the remaining quantities, retaining every previous record unchanged.
It records the actual selected workers, authenticated checker, time and immutable
production weight snapshot; it does not infer workers from presence. Empty
routes cannot finish. A closed legacy route retains its intentionally skipped
steps. Company/site rights, active worker membership, catalog availability,
quantity/route/work freshness, canonical locks and completion notifications all
remain enforced. Concurrent/retried completion cannot duplicate quantities.

### Manufacturing and loading — 17 November correction

**Përfundo prodhimin** excludes the canonical `loading` stage, including on
legacy and explicitly configured routes. A payload trying to include loading
is rejected; a loading-only route cannot be completed with this shortcut.
Loading is confirmed separately through its existing process card, with real
workers, quantities, checker and timestamp. No historical loading receipt is
deleted, relabelled or retroactively assumed false.

The list/detail and factory overview distinguish manufactured quantities,
**Gati për ngarkim** (manufactured minus actual loaded pieces) and **Ngarkuar**
(actual loading confirmations). Empty manufacturing routes never invent ready
pieces. Legacy closed manufacturing routes retain their accepted skipped steps;
their finish timestamp alone is never displayed as evidence of loading. Partial
loading remains partial, even after another production confirmation. Aggregate
ready quantities are summed per element so another element's loading cannot
cancel its waiting pieces.

Existing field-release quantities, required process routes, completion events,
permissions and historical dashboard metrics remain unchanged. When loading is
still required, the shortcut does not newly stamp the route as closed, and field
access stays capped by the separately completed required route. Routes that
deliberately omit loading keep their existing release policy; the UI still does
not claim a physical load without its receipt. Existing finish attribution is
preserved. This correction adds no schema, account or configuration changes.

The nullable link/index/FK migration does not rewrite existing material or work
records. No Production files or confirmations are mutated during preparation.

## Compatibility and boundaries

The established `assembly`/`part` workflow and production snapshots remain the
calculation source. `isManual` distinguishes the third display group;
`assemblyParts` stores versioned composition references. The additive migration
defaults existing rows to imported (`isManual=false`) and does not rewrite
their IDs, process routes, work confirmations or finish attribution.

Partial and complete imports continue updating existing imported marks in
place. A plain assembly export without a composition column preserves an
earlier composition. Explicit composition exports update that metadata.
Neither snapshot imports nor source-file deletion removes manual elements.
A collision with a manual code rejects the import transaction, preserving the
existing element; imports and manual creation use the same company lock.

Manual creation uses existing office/factory planning rights, validates the
same-company steel site on the server, and gives no new grants. The existing
process editor and work actions retain their authorization, revision,
concurrency and quantity checks. Default route backfill excludes manual rows.

## Delivery

Prepare and verify on an isolated synthetic database. Production migration,
merge and deployment require the owner's version-specific approval and the
existing backup/restore gate. No live material or work record is altered during
feature preparation. Public website/portfolio descriptions remain unchanged
while this candidate is unpublished; current descriptions already cover
material lists, process selection and production tracking. No new presentation
or marketing workstream is introduced for this internal workflow refinement.
