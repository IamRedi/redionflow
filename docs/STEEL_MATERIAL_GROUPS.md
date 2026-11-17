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
- **Elementet** contains manual elements. An authorized factory planner uses
  **Shto element**, enters code/name/quantity, then chooses processes with the
  existing process editor. No process is automatically selected. An empty route
  never means completed work. Existing factory-before-field release rules apply.

Composition quantities are the values printed in the source export. The app
does not assume whether they are per assembly or per exported batch. These
references do not create more stock, duplicate production totals, assign part
work to an assembly, or automatically confirm assembly work. Missing parts are
explicitly marked; repeated codes in different assemblies retain their own
exported quantities. No component weight is embedded in this new metadata.

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
