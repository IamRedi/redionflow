# Steel projects: element lists, factory and site

How a steel construction project (AL-Steel pilot, BauFlow mode) moves from the
drawing office's documents through the factory to the site. Built on
3 November 2026 with the owner, step by step. This file records the rules the
code follows, so later changes keep them.

No customer data is in this repository. Real lists reach production only
through one-time Railway variables (see "Production data" below).

## 1. Project from documents

A project arrives as documents from the drawing office (Tekla Structures):

| Document | Contents | Becomes |
| --- | --- | --- |
| Lista assemblaggi (`.xls`, often an HTML table) | Assemblies: mark (`B/12`, `C/40`), BEAM/COLUMN, profile, material, quantity, length, weight, area | Factory list + field list |
| Lista parti | Cut parts: plates and profiles (`1001`, `c/83`) | Factory list, tab "Pjesët" (cutting only) |
| Porosite (`.xlsx`) | Raw material order (NR, description, unit, qty, length, kg) | Site document |
| Drawings, PDF, photos | | Site documents |

**Office: "Projekt i ri"** (button on the Workzone factory panel,
`new-project.tsx` → `createSiteFromProjectAction`):

1. Pick the files (up to 10), type the site address, the name is optional.
2. Each file is tried as an element list (`parseElementList`, columns found by
   header text in Italian, English or Albanian; the "Totale" row ends the list).
   Anything that is not a list is stored as a site document.
3. Site name = typed name, otherwise the project name from the list
   ("Progetto Pllum Stafuka"). Description = "Projekti 0132".
4. A site with the same name (case-insensitive) is updated, not created twice.
   A factory (`STEEL_WORKSHOP`) is never overwritten.
5. Type `STEEL_ASSEMBLY`. The address is geocoded (below).

**Ngarko → Partial list** is the default. Upload the project in portions; marks
absent from the next file remain, including untouched material. A matching mark
updates its existing row without doubling quantity: the file quantity is that
mark's total, not an additional shipment. Existing process routes, confirmations
and finish attribution remain. The post-upload process shortcut selects only
new marks, so it does not replace earlier materials' process plans.

**Complete list** is an explicit alternative for a full replacement export.
Only absent, untouched marks with no saved process plan or confirmations may be
removed. At most one complete file per list kind is accepted in the same upload.
Both modes reject quantities below already confirmed pieces and roll back the
whole upload, including its documents, on a conflict. Imports serialize with
process configuration and confirmations, including simultaneous first uploads.

## 2. Address → map

`src/lib/geo/geocode.ts`: on create, on "Projekt i ri" and when the address is
changed in "Dokumentet → edit", the server asks OpenStreetMap Nominatim
(country filter from the company country, 6 s timeout, outside the database
transaction) and stores `Baustelle.coordinates = {lat, lng}`. Not found →
coordinates cleared. The mission-control map also geocodes in the browser when
a site has an address but no point.

## 3. The two lists on a steel site

The site page shows two big buttons: **Lista e fabrikës** and **Lista e
terrenit**. Factory steps (`FACTORY_STEP_KEYS`): Prerje, Montim, Saldim,
Pastrim, Lyerje, Ngarkim. Field steps (`FIELD_STAGES`): Pranuar, Montuar,
Bulonuar / saldim, Ritokim boje. Cut parts only have Prerje and never go to the
field list.

Who may confirm (`canCheck`, `crew-roles.ts`): factory steps the factory
engineer, field steps the field engineer, both the office admin. The worker
list in a step shows only that side's crew (`CREW_FOR_SIDE`: factory workers +
factory engineers, or field workers + field engineers); if no roles are set yet,
everybody.

### 3.1 Pieces are counted per step

An element has a quantity (`2×`, `4×`, `8×`). Opening an element shows its
steps as tiles. Tapping a step:

1. "Sa copë u bënë në këtë proces?" pick 1…open pieces (stepper above 12).
2. Pick the workers who did them.
3. "Konfirmo Prerje · 4 copë".

Each confirmation is its own `SiteElementWork` row (`stage`, `pieces`,
`workerIds`, `workerNames`, `checkedByName`, `checkedAt`). A step can have
several rows: "4 copë · Allen" today, "4 copë · Asif" tomorrow. A wrong row is
removed with X. A step never takes more pieces than it has open. Rows without a
count (`pieces = 0`, from before this rule) mean every piece.

`stagePieces(element, stage)` = sum of the rows, capped at the quantity
(field steps: capped at the pieces that came from the factory).

Tile colours: grey = nothing, orange = some pieces, green = every piece.

### 3.2 Finishing and the route

Not every element needs every step. **"Përfundo elementin"** means: the steps
done so far are this element's route, the others are not needed (they show
"Nuk iu desh", crossed out). It needs at least one confirmed step. If every
step has rows, the route is closed without pressing the button.

Pieces out of the factory = `doneQty(element, "factory")` = the minimum of
`stagePieces` over the route steps, once the route is closed. Example with 8
pieces: Prerje 8, Montim 3, Saldim 3, finished → **3 pieces go to the field
list, 5 stay in the factory**, shown as "Copët e tjera presin: Montim, Saldim".
Adding pieces to those steps later moves them on by itself.

Status: Në pritje (nothing), Në proces (some steps or pieces), Përfunduar
(every piece passed the route; the row bar turns fully green).

"Rihap" removes the finish. The factory cannot reopen an element, or remove a
step row, when that would take back pieces the site already worked on
(`takesBackFromSite`, `removeElementWorkAction`).

### 3.3 Field list

The field list shows **every** assembly. Elements with no piece out of the
factory yet are visible but locked: grey, dashed, a lock and "Në fabrikë"; they
cannot be opened (filter "Në fabrikë"). Once pieces are out, the element opens
and the field engineer works the same way: step → pieces (at most those that
came) → workers → confirm, then "Përfundo elementin në kantier". The piece strip
shows green = finished on site, orange = arrived, grey = still in the factory.

## 4. Factory views: only to look at

No buttons to confirm or finish in factory views; confirming happens only on
each site's factory list.

- **Site page, "Materialet nga fabrika"** (`SiteFactoryView`): for this site,
  pieces produced / in the factory / mounted on site, and per step how many
  elements had all pieces through it and how many pieces.
- **Workzone, factory panel** (`FactoryPanel` → `AllSitesFactoryView`): the
  same totals for all active sites together, the six steps with pictures, then
  one card per site with its per-step numbers. "Projekt i ri" is here.

Both come from `src/lib/elements/factory-output.ts` (assemblies only). The
older material-group line (`ProductionBatch`, PDF order import) is no longer
shown in these views; the site page shows it only for a site that still has
batches.

## 5. Code map

| Concern | Where |
| --- | --- |
| Rules (route, pieces, status) | `src/lib/elements/stages.ts` (+ `stages.test.ts`) |
| Tekla list parser | `src/lib/elements/tekla-list.ts` |
| Import / re-import | `src/lib/elements/import.ts` |
| Factory numbers | `src/lib/elements/factory-output.ts` |
| Server actions | `src/app/(workzone)/workzone/element-actions.ts`: `addElementWorkAction`, `removeElementWorkAction`, `setElementDoneAction`, `importElementListsAction`, `createSiteFromProjectAction` |
| Lists UI | `src/app/(workzone)/workzone/baustellen/[baustelleId]/element-lists.tsx` |
| Factory views | `src/app/(workzone)/workzone/production/factory-output-view.tsx`, `factory-panel.tsx` |
| New project UI | `src/app/(workzone)/workzone/new-project.tsx` |
| Geocoding | `src/lib/geo/geocode.ts` |
| Tables | `SiteElement` (`factoryDoneAt/By`, `fieldDoneAt/By`), `SiteElementWork` (`pieces`), RLS like every tenant table |
| Tests | `element-work.integration.test.ts` (tenant isolation, pieces, route, take-back guard) |

Migrations: `20261103160000_site_elements`, `20261103180000_site_element_done`,
`20261103190000_site_element_done_qty` (superseded),
`20261103200000_element_work_pieces` (pieces per step, drops the qty columns).

## 6. Production data

Real lists, workers and vehicles never enter the repository.
`scripts/import-roster.ts` reads one-time Railway variables
(`ROSTER_IMPORT_JSON`, pieces `_2`…`_n`, checked by `ROSTER_IMPORT_SHA256`; one
variable must stay under 128 KB) on start; they are blanked right after the run.
For new projects the office now uses "Projekt i ri" in the app instead.
