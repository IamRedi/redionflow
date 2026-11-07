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
