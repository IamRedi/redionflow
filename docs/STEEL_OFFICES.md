# Company offices — reception and Megi's office

VO-ALSTEEL-001, first implementation slice, 11 November 2026.
Prepared from production `61da78ccc78d2acf39c255bd3410bb1f803ebc25` (PR149).
Phase B shipped as PR150 / merge `1dfb0ef` on 11 November 2026. Reception and
Megi's room are enabled only for the two explicitly configured existing people.
The next candidate (private mail and office work) is described in
[OFFICE_WORK.md](OFFICE_WORK.md); its separate feature flag is off by default.

## Scope

`/workzone/offices` is reception; its administration door opens
`/workzone/offices/megi`. The new entry appears in Workzone and the existing
admin navigation only for authorized accounts. The existing transparent header,
fleet/workshop, footer and primary content scroll region remain in use.

The interior is a bundled, lightweight CSS illustration, not a real-office
photograph. It follows BauFlow surfaces and accents, with daylight/dark room
variants, a window, desk, shelving and a clickable door. No external images,
new dependency, image generation on refresh or third-party request is needed.
Phone shortcuts remain ordinary readable touch controls outside the scenery.

Reception offers shortcuts to the caller's existing operational workspace.
Megi's own room shows her work shortcuts; Almet visiting it sees only the room
and privacy explanation. With office work enabled, visitors also get a Posta
compose shortcut to the other authorized person. No colleague profile, task, hours, document or message
is fetched by the office page or included in its RSC payload. Existing target
pages retain their own authorization. Worker identities never get admin links.

## Exact access and activation

`VIRTUAL_OFFICE_ACCESS_JSON` is server-only and absent by default. Its strict
shape is:

```json
{
  "companyId": "verified-company-id",
  "megi": { "adminId": "verified-megi-admin-id", "workerId": "optional-verified-megi-worker-id" },
  "almet": { "adminId": "verified-almet-admin-id" }
}
```

Both principals must be configured with different admin IDs. Optional worker
IDs may not overlap. Invalid/absent configuration fails closed. Names/emails,
admin status and ownership alone never grant office access. Every request
requires a current active authenticated identity, valid session epoch, exactly
one session kind and the configured tenant. React cache is request-local only.
Every page checks authorization independently; a copied deep link is not access.

For approved release, resolve the actual existing Megi and Almet account IDs
in AL Steel, confirm their company/active status, and configure only those IDs
in Railway `alsteel-bauflow / app / production`. Do not create, merge or promote
accounts to make them fit. The initial mapping is now active; never infer new
access from a display name. Remove this variable to close the module;
rolling back the app also removes the feature. No migration or data rollback.

Before any production deployment, recheck the current source and the historical
one-shot provisioning flags (attendance reset, plan versions, orphan data,
live-site repair, assistant operations). Do not replay a stale cleanup script.
No production flag was read or changed during feature preparation.

## Reuse and deliberately separate phases

| Existing | This slice | Later plan phases |
| --- | --- | --- |
| Sessions, identities, account language, themes | Fresh ID/tenant office gate | Explicit departmental permissions |
| Workzone and admin shell | Reception and own/visitor room | Additional personal offices/departments |
| Daily plan, site files, dashboard, profile | Links to existing modules | Personal notes, assigned tasks |
| Existing attendance timer | No new clock or attendance write | Explicit office/field context in the same session |
| Existing assistant and allowlist | Unchanged | Office entry/context and boss enable control |
| Official document storage | No duplicate storage | Participant-only private Posta, isolated from official files |

Opening the room does not start a work timer. No automatic document receipt,
notification, assistant call, plan edit, department setup or private-message
creation is introduced. Office hours shown are the owner's existing office
schedule, Monday–Saturday 08:00–16:00, not measured attendance.

## Verification and presentation

Local Windows host REDI, isolated WSL checkout and loopback-only disposable
PostgreSQL; synthetic identities and company data only. The checked-in E2E
scenario covers reception/door, own room/visitor, owner-without-grant denial,
cross-tenant/admin/worker/mixed-session/expired-epoch/inactive/anonymous access,
desktop/narrow/landscape light/dark, footer reachability, focus and no added
work sessions. Unit policy tests cover malformed/absent/ambiguous configuration.
Exact execution results belong in the PR evidence, not inferred from this list.

Bounded baseline repairs accompany the module: make the existing phone
fullscreen CSS selector locally scoped (same behavior, webpack compatibility),
and supply the missing Polish `workResumed` text without relaxing the existing
translation coverage assertion. The shared Workzone layout rejects mixed admin
and worker sessions before its company lookup, preventing an existing tenant
error during denied office requests; no valid login changes.

Native presentation/showcase/portfolio: PR151, PR152 and portfolio PR78 were
approved and published on 11 November 2026 for phase B. Public screenshots use
the fictional Mira Steel DEMO fixture. The new private work/mail candidate is
not advertised as live. Do not publish real company/user records or raise maturity.

Canonical owner plan:
https://docs.google.com/document/d/1Rlkicmu028ndhYL42XkwbWYNpTNohUAYO_zxwoHi1eE
