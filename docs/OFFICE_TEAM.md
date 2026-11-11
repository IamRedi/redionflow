# Office team development

This extends the existing office mail/tasks release. One employee has one
office identity backed by their existing Worker login; the two configured
directors keep their existing shared admin/PIN identities. No new login or
password is created. The migration retains previous principal IDs and moves
office foreign keys to a tenant-scoped OfficeMember record.

`VIRTUAL_OFFICE_TEAM_ENABLED=true` enables the team management path and
explicitly enabled employee memberships. It is absent/off in production while
this work is under development. Disabling it denies employee office access
without deleting mail, attachments or work. Keep the existing office access
mapping and work flag; do not broaden assistant access.

Only the two explicitly configured directors can configure employee offices.
They choose an existing active employee, office title and enabled state. No
person, office or task is inferred from display names or job categories.
Employees use their existing PIN login. Operational permissions remain in the
existing document, plan, site and production modules.

The reception directory exposes names and office functions only. Visiting a
colleague's room exposes its visual presentation and an addressed compose link,
never their tasks, notes or messages. A personal room provides physical calendar
and folder controls, with mail/tasks and accessible return navigation.

Company tasks require a category and assignee. The initial five business
categories remain editable; Other is available for both an existing catalogue
and new setups. Directors see company tasks. Employees see their own private
work and company tasks assigned to or created by them; other employees' work
does not enter their payload. Category administration belongs to directors.
Private notes remain private even from directors. Mail remains participant-only.

The additive membership table uses tenant RLS and composite identity keys. The
migration backfills only principals already referenced by office records;
historical messages, files and tasks retain their IDs. Release rollback uses the
feature flag rather than dropping the new table or restoring old binaries over
the changed foreign keys. A fresh production backup/recovery check is required
before any approved future migration deployment.

Local acceptance uses synthetic employees only: enable office, assign a
categorized task, receive it with the worker login, send/reply to private mail,
deny unrelated work and revoke access. Calendar navigation, recipient selection,
desktop/phone/light/dark/landscape and overflow are checked in the browser.

Owner decision: presentation/portfolio updates are deferred until the next
agreed development milestone. No new marketing companion PRs for this task.
Contextual AI, time-context switching, decorative personalization and optional
external engines remain separate planned stages; this development does not
activate them or change real attendance or official project records.

## Resource drawers

Rooms now expose their permitted workplaces using the existing access rules.
A factory/field permission never bypasses a denied site folder. The office file
view reuses SiteFilesButton and its existing upload/download/action endpoints;
there is no second document store or copy of the factory list. Existing site,
warehouse and workshop views retain a return path into the office.

The read-only staff workbook drawer is a separate explicit membership
permission, `workbooksEnabled`, also available to people who already hold
`staff.view`. It does not grant admin/HR editing, credentials, identity numbers
or salary access. An explicit existing `staff: none` key wins over this office
drawer permission. Summaries and per-person sheets use the recorded sessions,
existing effectiveSessionHours/isReportableSession helpers and report calendar.
Open-session hours are provisional. A company-wide monthly summary and printable
individual MonthlyTimesheet reuse the same records; no attendance is rewritten.

`VIRTUAL_OFFICE_TEAM_SETUP_JSON` can hold a reviewed, company-bound office plan:
companyId and up to 500 unique people with workerId, title and workbooksEnabled.
Prepare offices is an explicit director action. The entire batch fails for a
foreign company, duplicate/protected identity, inactive or missing worker. It
creates disabled rooms and preserves existing configured rooms. The AL Steel
plan is kept privately outside Git, based on the owner's staff workbook and
fresh read-only active staff/access inventory. Personal names and account IDs
must not enter public source, screenshots or examples.

## Personal assistant boundary — sources prepared, chat not activated

`personal-context.ts` defines an employee-only namespace per tenant/member and
rechecks office and operational permissions on each call. Its sources are the
person's permitted tasks, participant-only mailbox index, permitted sites and
explicitly requested site file metadata. Reading a mailbox body requires a
specific participating thread and does not mark it read. File contents are not
OCR-read. Director identities are rejected by this personal source interface.

There is no import of director tool registries, director conversation history or
global assistant context. Task descriptions/mail/filenames remain untrusted
data. This stage performs no paid generation and does not activate employee AI.
The next stage must use a dedicated employee chat endpoint and actor-owned
conversation/history tables, a separate explicit enable switch, the existing
cost limits, and source filtering for every tool call. Reusing the provider
adapter is permitted; sharing a director conversation or privilege is not.
