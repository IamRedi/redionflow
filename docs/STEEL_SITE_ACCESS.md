# Steel site access and owner PIN

Review candidate, 7 November 2026. Local verification, owner approval,
publication and real-account activation are separate states.

| Person | Site documents | Production / tasks | Access administration |
| --- | --- | --- | --- |
| Active ordinary worker / mechanic | Read, download and acknowledge their own receipt | Read; no site task/material confirmation or material-problem mutation | None |
| Field engineer | Upload ordinary/phase documents, photos and material lists only for explicitly selected sites | Field steps and site tasks | None |
| Factory engineer | Same per-site upload grant | Factory steps | None |
| Office worker | Upload/read company site documents; existing office-only orders, costs and invoices remain protected | Existing office management; no engineer confirmation authority | Cannot grant engineer rights or create owners |
| Active administrator / owner | All company sites, documents and production | Full company authority | Select site engineers; the owner manages administrators |

Personal attendance, existing own-asset incident/defect reports and individual
document receipts remain separate from editing production. Seniority such as
Meister/foreman no longer implicitly makes a worker an engineer. An explicit
engineer role is necessary. Existing identities, inventory, vehicles, factory,
credentials and documents are not rewritten by this migration.

## Site controls

### Planned AL steel hours — 9 November 2026

An Albanian steel workspace shows the planned shift on each explicitly classified
worker's profile: OFFICE 08:00–16:00, FIELD_ENGINEER/FIELD_WORKER 07:00–17:00,
FACTORY_ENGINEER/FACTORY_WORKER 07:00–16:00, Monday through Saturday. The start
form suggests that sector's start time; the user still selects/confirms the
actual time. These plans neither create attendance nor overwrite recorded hours,
breaks, leave allowances, approvals or historical sessions. Mechanic/unclassified
roles have no inferred shift. Role/access administration is unchanged.

Attendance inputs and previews use the existing report/business timezone, also
when the browser or server runs in another timezone. A same-day restart after a
closed session suggests the current time, rather than the planned shift again.
Profile, site and offline starts share a tenant-scoped worker lock: simultaneous
starts reuse one live session and a backdated restart overlapping closed work is
rejected. Only the first successful stop records the final total and admin time
entry. Forgotten-session closure retains its existing 16:00/30-minute policy,
using that same business clock and preserving a concurrent manual stop.

The owner's 9 November test-day records are retained unchanged. Any later reset
requires a separate, bounded operation after everyone is offline; this fix does
not exclude, delete or rewrite attendance history.

Daily-plan machine cards and newly saved plan rows use the short machine name
and plate, without enlarging the picker controls. Existing saved snapshots stay
unchanged until an explicit plan save. The daily archive fits narrow screens
without a horizontal table scroll. Claude's plan layout and report calendar
changes remain in place.

Verification on host REDI, 9 November 2026, based on production revision
`ab55f80e232ed6b7be4e410795f43ba290a251fe`: local typecheck/lint, 1,131 unit
and 459 PostgreSQL integration checks passed. After the final conditional
auto-close change, the 37 affected tenant/session integration checks and
typecheck/lint passed again. The production-build browser scenario passed:
1440/360 CSS px, light/dark before/after, picker plates, explicit plan save,
archive overflow, local-clock start, overlap refusal and restart. Only synthetic
fixtures were written locally; the production attendance audit was read-only.
Local evidence is under the task's `outputs/steel-plan-hours-20261109` folder,
outside Git. Its private audit is not a public artifact. No migration is added;
the restricted disposable test-role column grant adds only `Machine.targe`.

Presentation assessment: NO_CONTENT_CHANGE for this bounded correction. The
native steel description, current public README and portfolio BauFlow card
retain the same capabilities, access boundary, links and product status; these
fixes do not introduce a new workflow or change readiness. Existing fictional
captures remain dated examples, not captures of this candidate. This assessment
does not certify unrelated copy changes introduced by other work. Publication
and real-device owner acceptance remain separate from local verification.

The ordinary worker can record their own time and acknowledgements, upload their
own profile photo, handle their own assigned-asset handovers/reports and upload
their own fuel receipts; production confirmation remains an engineer/admin task.
OFFICE handles asset management and workshop phases. MECHANIC handles workshop
phases and service evidence, without office finance/site-upload privileges.
AI access is independently restricted by the company's existing assistant-access
switch; the owner always retains it, and a worker helper never becomes the admin
assistant merely because a worker has assistant access.

The new-project document form can select engineers while creating the project.
The **Access** action on a site can change that selection later. Empty grants
mean office/administrators upload; engineers keep their appropriate process
role but cannot upload to an unassigned site. General site creation also starts
closed and can be configured by opening the site. Office staff cannot grant
access, and recreating/importing an existing project appends explicitly chosen
engineers without silently revoking the previous selection.

The same server rule protects phase files, ordinary file/photo uploads, material
list imports, legacy document attachment and the site cover. Read-only controls
are hidden without using the client as the security boundary. Office-only
invoices/orders do not become readable to workers or engineers.

`SiteDocumentEngineer` is an empty additive table with tenant-composite keys and
forced RLS. `Baustelle.documentAccessRevision` detects competing editors. Fresh
role/grant checks and site/identity locks serialize stored uploads with grant
revocation. A revoked uploader retains read/history access and cannot replace or
archive their old uploads. Changing access never rewrites receipts or file bytes.
Grant changes are audited with actual actor and before/after IDs.

All active worker accounts can read/acknowledge phase documents. The assistant's
receipt eligibility query uses that same reader rule; engineer upload grants
are not recipient assignments, reading evidence or overdue obligations.

## Owner name/PIN shortcut

An owner can configure a separate **eight-digit PIN** inside the existing admin
profile. It signs in through the name/code form and issues only the ordinary
administrator session. Full name or an unambiguous first name is required; an
ambiguous name fails closed. The email/password path and worker six-digit codes
retain their existing behavior. The PIN is never an email password.

An explicitly authorized conversion may transfer an existing six-digit credential
hash to the exact active owner account inside the database, without reading or
regenerating the code. That owner signs in through the same name/code form and
receives only an administrator session. The duplicate worker login is disabled
and its sessions revoked, while the HR record is retained. There is no automatic
owner lookup from a worker name/email and no role elevation for other workers.
New PINs and rotations entered through the profile still require eight digits.
Transferred owner codes stay reserved when issuing or changing worker codes.

Only fresh sole-session owners can create/activate a company owner or rotate
their own PIN. An already activated peer owner cannot have its PIN replaced
through this form. A prepared inactive owner with no password/PIN stays unable
to sign in until its PIN is entered in the application; no reusable credential
is generated, displayed in a report or committed by the release operator.

`User.loginPinHash` stores only the existing scrypt format. The normal worker
IP limiter runs before PIN authentication; a durable admin account limiter is
shared by full/short-name aliases. Fresh active owner/epoch checks run after
verification. PIN, owner-role, active-state and tenant changes revoke sessions
atomically through the existing DB trigger. The normal secure/HttpOnly cookie,
long-lived session and server-side authority checks are retained. Password/PIN
hashes are omitted from the resolved admin identity.

## Verification boundary

Isolated PostgreSQL cases cover ordinary workers, both engineer roles, office,
administrators, foreign identities, mixed cookies, grant revocation, competing
revisions, RLS, transactional creation, files and photo preservation. Owner cases
cover inactive activation, peer protection, hashing, ambiguity, tenant binding,
durable lockout and epoch revocation. Synthetic browser checks cover desktop,
phone, light/dark, short landscape, focus return, reading/receipts, upload
revocation and real name/PIN sign-in without a worker cookie.

No production role is elevated by schema installation. A specific real account
is prepared only under the owner's explicit identity/role authorization and
keeps its PIN unset until entered privately in the application. Publication
requires the repository's separate owner approval and a verified fresh backup.

## AI assistant access

By default every signed-in admin and worker may use the AI assistant. A
company can be limited to selected people (`CompanyProfile.assistantAccessSelected`):
then only the owner and the people the boss enabled may use it
(`User.assistantAccess`, `Worker.assistantAccess`). Everyone else sees one short
message in their language, e.g. "Nuk keni akses në AI. Aksesin jua hap shefi."
No question is stored, no quota is used and no provider is called for them.

The boss turns access on/off with the **Asistenti AI** card on a worker's
profile (any admin) or on another admin's profile (owner only). The owner always
has access.

One-time setup for a single-company installation: set
`ASSISTANT_ACCESS_ONLY="Megi,Almet"` on the app service. At boot
(`scripts/assistant-access.ts`, called from `provision-company.ts`) it limits the
company and enables each name that matches exactly one active admin or worker
(full or first name, case/accents ignored). Ambiguous or unknown names enable
nobody and are logged. It never removes access, so it can stay set.
