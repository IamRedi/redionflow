# Steel access model (2026-11-09)

Simple rules for who sees and does what in a steel company. Code:
`src/lib/access/rules.ts` (pure, unit tested) and `src/lib/access/load.ts`.

## Levels

| Level | Who | Sees | Does |
|---|---|---|---|
| Bazë (`BASE`) | workers | Workzone, site cards (no "Open"), daily plan, own profile, Fleet: fuel receipts and defect reports | start/stop own work, fuel, defect |
| Shikim i plotë (`FULL_VIEW`) | engineers, office | every place except costs and other people's profiles | nothing without a key-button grant |
| Admin | company admins (Users) | everything | everything |

`Worker.accessLevel` stores the level. While it is empty the level is derived:
any crew role other than FIELD_WORKER / FACTORY_WORKER means `FULL_VIEW`.

## Places and the key button

Places: `site` (per site: plan, documents, details), `field` (the field /
assembly list and site phases, per site), `factory` (the factory list per
site, and the factory line), `new_project`, `fleet_gps`, `workshop`,
`warehouse`, `daily_plan`, `costs`, `staff`. Each place gets a small key
button (admin only) with **Vepron** (`act`), **Shikon** (`view`) and **Hiq**
(`none`) for every person. The site page has three keys: the site, the
factory list and the field list. A grant is a row in `AccessGrant`
(`scopeId` = site id, or `""` for the whole place). `act` allows every action
of that place. The most specific choice decides: this site, then the whole
place, then the level; `none` takes away what the level gives.

## Warehouse equipment registration (2026-11-12, PR preparation)

The warehouse key and the worker profile's access card also offer
**Regjistron pajisje** (`register`), only for the company-wide warehouse.
This grants `warehouse.view` and `warehouse.register`, never
`warehouse.manage` or access to other places. Only an active company admin
can assign or revoke it. The existing `AccessGrant` row is reused; the
additive migration widens its constraint without changing anyone's grants.

Registration UI, unknown-code intake and the registration server command use
fresh `warehouse.register` access. The registration command records the worker's
actual identity and checks permission before idempotency receipts, including
after revocation. Existing office management, repair and personal handover
permissions stay unchanged; this new grant does not confer any of them.
Registration-only workers may print labels for their own registered inventory
items; existing equipment and vehicle labels remain restricted.

An engineer can use the existing Workzone warehouse and registration form
without changing their crew role or becoming an administrator. No employee's
real permissions are activated by deploying this feature. Change `register`
to `view` to stop adding equipment, or `none` to remove warehouse page access.
On the employee's profile, **Regjistro pajisje** opens the shared warehouse
with the form ready. Unknown-code intake also goes there, rather than adding
an unassigned item inside the profile's holder-filtered inventory list.
Release/activation still requires the owner's separate approval.

## Migration from crew roles

Until the switch-on, `legacyActions()` gives each crew role exactly its
current rights (crewPermissions, site document grants, asset rules), and
`shadowAccess()` logs `access.shadow_diff` when the new rules would decide
differently. Phases: 1 foundation (this), 2 key button UI, 3 switch-on,
4 apply the company's staff table (with the owner's yes).

## Switch-on (phase 3, 2026-11-09)

- `currentCompanyActor()` builds its rights from `can()`; `actor.at(siteId)` adds
  site grants, `actor.allows(action)` checks one action.
- Workers without `site.view` see site cards without "Open" and get start/stop
  on the card; opening a site URL shows "Nuk ke akses këtu. Aksesin ta jep shefi.".
- Factory panel, vehicle GPS, warehouse and workshop pages need their `view`.
  Fleet (fuel receipts, defect reports) stays open to everyone.
- Site documents upload follows `site.documents`; cost files follow
  `site.details` (office) or `costs.view`.
- Setting a worker's level the first time turns the crew role's rights into
  visible grants; from then on only level + grants count.
- Still admin-only: editing the daily plan, staff/vacation management and
  uploading invoices (a `costs` grant gives viewing).
