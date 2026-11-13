# Company offices — reception and Megi's office

## Task journal and personal reminders — 13 November 2026 candidate

The personal task drawer uses compact crystal cards, a simple title/status/
importance composer and optional notes. Open work precedes completed work;
within each group high importance comes first, followed by stable creation
order. Editing does not move a card to a newer creation date. A card opens its
detail with Done/Reopen, Edit and reversible Archive. Existing notes, shared
categories, assignees and deliberate private-to-company sharing remain available
under Sharing and due date. Their server authorization is unchanged.

An optional reminder belongs to the signed-in office member, not everyone who
can read a shared task. The additive `OfficeTaskReminder` table has composite
tenant/task/member foreign keys and tenant RLS. The snapshot returns only that
reader's reminder metadata. Task and reminder save in one transaction; stale
versions or invalid times roll back both. Local date/clock controls convert
explicit Europe/Tirane time to an absolute UTC instant using the existing
business-clock converter. New schedules require a future time within 366 days.

The opt-in Node worker uses `src/instrumentation.ts`, alongside `src/app`.
The pre-existing root instrumentation helper is not the framework entry in this
layout and remains unchanged. A production build must contain
`.next/server/instrumentation.js`; helper unit tests alone are insufficient.
`OFFICE_TASK_REMINDERS_ENABLED=true` activates the loop only when the configured
installation and office company agree. It stays off in the restricted RLS
rollout. No HTTP cron endpoint, browser-open requirement, paid provider, new
credential, attendance write or operational task change is introduced.

Every 30 seconds the worker claims at most ten due reminders, with a two-minute
durable lease and at most three attempts. Transient failures retry after five
minutes. Fresh task visibility, current account and office membership are
checked at delivery. Only that task is serialized with completion/archive;
unrelated office tasks do not wait for its network request. Completion/archive
cancel pending reminders; reopening/restoring does not silently reschedule them.
The existing push transport filters active identities in the installed company.
Configured director admin/PIN identities represent the same authorized person.

Lock-screen copy is generic: no private title or note. The notification opens
`/workzone/offices/me/tasks?task=<id>` and the normal office gate still applies.
Provider acceptance is not a read receipt. Missing devices and failed delivery
are shown honestly; network/OS delivery is best effort, with a stable tag to
reduce duplicate visible alerts after a crash. Users still enable notification
permission themselves; iPhone requires the installed Home Screen app.

Production remains unchanged until the owner approves the exact PR/revision,
the additive migration and activation flag. Before publication, recheck the
current production branch and fresh encrypted backup/restore evidence. Existing
roles, official documents, factory/site progress, inventory, service/GPS/fuel
and attendance calculations are outside this change.

Evidence is retained in the private local task output
`outputs/steel-office-journal-20261113`: unit/integration/build logs, synthetic
restore, before/after browser captures and the runtime reminder check. Browser
viewport checks are distinct from physical iPhone acceptance. The standalone
Playwright scenario is updated for the new flow and normal fixture login;
its execution status is recorded separately, not inferred from compilation.
The company-day operational audit is read-only, with private details kept out
of GitHub/public media. A bounded HTTP log sample is not a complete-day error
guarantee; the legacy structured request-error hook is not currently wired.

Public presentation/portfolio still describe the last accepted live release.
The unaccepted reminder candidate is not advertised as live; reassess the
bounded content/media delta after acceptance, respecting the owner's existing
deferral of routine presentation packages.

## Office work surface correction — 13 November 2026

The manager's employee-view plan, documents, tasks and workbooks use the same
warm stone/teal crystal as the existing office. Read-only previews remain
read-only. Office work drawers and saved plan cards reuse that material;
return links use compact, legible semibold glass controls with 44px touch
targets. Room photographs, artwork, object positions and assistant surfaces
remain unchanged.

Reception doors and the directory prioritize the already-resolved real office
presence. Within the remaining rooms, the configured Megi principal precedes
Almet, followed by the existing staff order. Names and job titles are not used
to infer identity, access or attendance. Paused office sessions keep their
existing label; no work timer or presence write is introduced by sorting.

This is a presentation correction, without a schema, permission, calculation,
file-storage or provider change. Local acceptance and publication are separate;
AGENTS.md still requires owner approval before merge/deploy. Native presentation
and portfolio: NO_CONTENT_CHANGE, since existing capabilities and approved
office imagery stay accurate.

## Released office UI — 12 November 2026

Owner-approved PR175 is merged and live at `f79798cba4410329d687dbdb40d2e336a4b1d9f6`.
Railway deployment `d480b28e-29a3-4b42-9ccc-3417c0b328b6` succeeded. Bounded
readback verified 16 runtime source hashes, room/assistant/task responses and
unchanged permission, configuration, original artwork and photo fingerprints.
PR174 is the unchanged parent. No migration or provider call was introduced.

Owner direction: the existing photographic office is the visual baseline.
Furniture actions belong to the scene: drawer names and small Lucide line-art
icons sit directly on wood, without a label plate; mail remains a paper envelope,
tasks a clipboard and the assistant the computer screen. Keep the original
wide/portrait room and artwork assets, object positions, keyboard labels and
44px touch targets. This supersedes the initial CSS-room description below.

Work windows use the office's warm stone/teal crystal material, shared typography
and compact controls. Preserve existing action hues, including orange primary
actions and the company chat's green message/send colors. Glass changes material,
not action meaning. Mail, task lists/editors, documents, workbooks and team pages
share one viewport-sized work surface with a single primary scroll region; the
daily plan gets this treatment only through its existing verified `office=desk`
entry. Work pages keep the existing author signature at the true end of their
scrolling content; scene/chat surfaces retain the existing About exception.
No new legal destination or unrelated application-wide style is introduced.

For the two **configured admin principals**, with office work enabled, the tenant
logo is branding only. The existing company assistant opens from the monitor at
`/workzone/offices/me/assistant`, beside it on a wide screen and within the visible
viewport on phones/short windows. Native modal focus containment and Escape/close
return to the monitor. The durable company conversation component, archives,
read-only tools, access/quotas/provider and business APIs are unchanged. Each
principal sees their own archive; visitors get no private scene actions. Other
admins and workers retain their existing logo-assistant entries. The separately
authorized staff assistant keeps its existing identity and permission checks.

Preparation branch was `feat/office-scene-crystal-ui-20261112`. It includes PR174
(`872002b`) without modifying the other agent's attendance/production work. No
schema, real records, permissions, provider/feature configuration or original
photos change. Local visual evidence and exact check outcomes belong in PR175;
the owner separately approved its merge and application publication.

Local verification: production build, scoped ESLint, 31 office-policy/private
history checks and the office UI browser flow passed on isolated WSL/synthetic
data. Before/after captures cover room, company chat, mail, tasks, documents and
workbooks at 1440×900 light, 390×844 dark, 320×740 light and 760×390 dark. Checks
include private archives for both principals, disabled-assistant denial, the
unchanged logo entry for another admin, visitor privacy, Escape/focus return,
internal editor/footer scrolling, plan entry and a 200% visual viewport. No
provider request, real task/mail submission or physical-phone keyboard test was
performed. The original action-color variables match the captured baseline.

The remaining sections record the original phase-B implementation/history.

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
