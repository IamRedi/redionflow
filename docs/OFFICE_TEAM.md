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
