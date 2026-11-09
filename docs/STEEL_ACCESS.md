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

Places: `site` (per site), `factory`, `new_project`, `fleet_gps`, `workshop`,
`warehouse`, `daily_plan`, `costs`, `staff`. Each place gets a small key
button (admin only) listing who has **Shikon** (`view`) and **Vepron** (`act`).
A grant is a row in `AccessGrant` (`scopeId` = site id, or `""` for the whole
place). `act` allows every action of that place; grants only add rights.

## Migration from crew roles

Until the switch-on, `legacyActions()` gives each crew role exactly its
current rights (crewPermissions, site document grants, asset rules), and
`shadowAccess()` logs `access.shadow_diff` when the new rules would decide
differently. Phases: 1 foundation (this), 2 key button UI, 3 switch-on,
4 apply the company's staff table (with the owner's yes).
