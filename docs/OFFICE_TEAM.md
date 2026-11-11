# Employee office workspace

This extends the existing office mail/tasks release. One employee has one
office identity backed by their existing Worker login; the two configured
directors keep their existing shared admin/PIN identities. No new login or
password is created. The migration retains previous principal IDs and moves
office foreign keys to a tenant-scoped OfficeMember record.

`VIRTUAL_OFFICE_TEAM_ENABLED=true` enables the team management path and
explicitly enabled employee memberships. Disabling it denies employee office access
without deleting mail, attachments or work. Keep the existing office access
mapping and work flag; do not broaden assistant access.

Only the two explicitly configured directors can configure employee offices.
They choose an existing active employee, office title and enabled state. No
person, office or task is inferred from display names or job categories.
Employees use their existing PIN login. Operational permissions remain in the
existing document, plan, site and production modules.

The reception is a fixed architectural working surface with a right-hand desk
and named glass office entrances. Directors also see prepared, disabled rooms;
employees only see enabled colleagues. The hallway scrolls continuously using
touch, trackpad, wheel, keyboard or mouse drag. Its scrollbar is hidden, while a
labelled focusable region and direct office directory keep navigation discoverable.
Dragging must not follow an office link. There is no corridor pagination.

Employees visiting a colleague see the room and addressed compose link, never
their tasks, notes or messages. The two configured directors can preview an
active employee's prepared office, even while office login is disabled. Every
preview resource is evaluated using that employee's current operational keys,
including workbook denies; the director's session/principal remains unchanged.
The preview exposes permitted document metadata, company assignments and saved
plans, with read-only workbook views when permitted. It never reads personal
notes, private mail/receipts or assistant conversations. It has no mutation or
impersonation endpoint. Inactive accounts and foreign tenants are denied.

The room itself has no shortcut cards or page scrolling. The wall calendar,
clipboard, monitor, mail tray and desk drawers are real labelled navigation links.
The document drawer uses existing permitted resources; the extra workbook drawer
and personal monitor are included only when already authorized.
Small headers link back to reception, Workzone or one's own room. The common
office entry leads directly to the signed-in person's office. Keyboard labels,
visible focus, native link behavior and separated touch targets remain available.
The existing author signature is available in the native About disclosure,
without a permanently reserved footer strip. Resource previews use a native
modal dialog with focus containment, Escape and an explicit return link.

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
Time-context switching, decorative personalization and optional external engines
remain separate planned stages. Office work never rewrites real attendance or
official project records.

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

## Purchasing workspace and personal assistant

`personal-context.ts` defines an employee-only namespace per tenant/member and
rechecks office and operational permissions on each call. Its sources are the
person's permitted tasks, participant-only mailbox index, permitted sites and
explicitly requested site file metadata. Reading a mailbox body requires a
specific participating thread and does not mark it read. File contents are not
OCR-read. Director identities are rejected by this personal source interface.

The PURCHASING work profile changes the room's project folder and the assistant's
work focus, never operational permissions. Project folders reuse the native
site files and phase-document components, including their upload permissions.
There is no duplicate material/document store. Directors preview these permitted
company resources but cannot read the employee's personal assistant history.

The separate `/api/offices/assistant` endpoint requires an active employee office,
`VIRTUAL_OFFICE_AI_ENABLED=true` and that membership's `assistantEnabled` switch.
It rejects directors and stores questions, answers, source references/hashes and
sanitized diagnostics in OfficeAssistantTurn, protected by tenant AND member RLS.
The room's monitor opens this private chat; directors retain their existing
company assistant. No director tools, global context or director history are
imported into the employee route.

Each request reads fresh permitted projects and the employee's own tasks, with
optional project metadata and up to three explicitly selected files. Text PDFs
(20 pages maximum) and Excel/CSV (first worksheet, at most 500 rows) are bounded
to 2 MiB per file and truncated with explicit limitations. Scanned documents and
unsupported formats remain metadata-only: no OCR or invented contents. Reading
a phase document for AI does not create an E mora receipt. Source text is
untrusted evidence, never authority or instructions. Offer comparisons must
identify missing specifications, units, currency, tax and delivery terms; they
cannot place orders, approve spending, infer prices or browse suppliers.

Generation reuses the existing worker-tier provider adapter and unchanged shared
company/person quotas: one step, no provider retries, existing timeout/input/output
ceilings. The request is archived before provider access. A UUID request ID and
content hash deduplicate uncertain network retries; conversations are private to
their owner and every fresh request rechecks access. Current document selection
is rechecked after parsing. History shows up to 30 turns per selected conversation
and 20 recent conversations; previous assistant answers are never evidence.

AL Steel's reviewed private office recipe prepares existing staff only. The
owner subsequently authorized activation of all eleven reviewed staff offices
and their individual assistants. This changes only OfficeMember activation;
no account roles, PINs, global Helper flags or project permissions change.
The assistant receives its own office title/position and allowed workspace
capabilities as work focus, never as extra permission or evidence of contents.

## Office Studio visual baseline — owner redesign, 11 November 2026

The owner explicitly requested a distinct photorealistic office style rather than
the factory/field illustration language. The office area uses walnut, smoked
glass, brushed metal, limestone and restrained warm lighting. Its own scoped
workspace tokens do not restyle operational factory, field or vehicle screens.
Functional text, identities and controls remain HTML, never baked into images.
The reception counter occludes glass entrances in the foreground; entrances
share one floor line and slide through one native horizontal region.

Four fictional decorative architectural images were generated with the built-in
image tool (model identity not exposed), then converted locally to pre-sized
WebP: wide/portrait companions for the room and reception. They are not photos
of client premises, measured CAD or business evidence. No client documents,
photos or employee identities were inputs. Original image hashes, final hashes
and byte sizes are in `public/office-studio-v1/provenance.json`; all four WebPs
total under 400 KiB. Project copies are durable and do not reference a generator
cache path. Native picture selection serves the appropriate static companion;
there is no generation call, provider credential, new dependency or AI request
on page load. Room controls remain tied to the current server permission map.

The calendar prints the current report month/day using the existing report clock;
it opens the existing daily plan and never creates attendance. Drawers, private
mail, tasks and assistants reuse their existing destinations and authorization.
Compact-height arrangements preserve reachable controls; the room has no page
scroll or bottom shortcut bar. About/author and management move into the header.

## Personal artwork in the office

The calendar and task clipboard now form a smaller side column, leaving the
middle of the wall for a framed picture. The default is a fictional, text-free
painting connecting construction and office through subtle digital light.
Its prompt and original/final hashes are retained in the same asset provenance.
The static WebP is 155,222 bytes; no provider is called when opening a room.

Only the signed-in occupant can replace or reset their picture. The server
derives the target from their canonical office identity, including both director
login methods. Manager preview and other authorized room visitors can see the
decoration, but cannot edit it. Decoration never enters personal AI evidence,
mail, tasks, avatars, site documents or the operational permission model.

`OfficeArtwork` is an additive tenant/member-bound table. It stores at most one
WebP of 180,000 bytes per office. The existing bounded raster decoder handles
JPG/PNG/WebP up to 12 MB, auto-orients and strips EXIF/GPS. Uploads respect the
existing scanner configuration and serialized native-conversion lock. An atomic
write and version check preserve the old picture on invalid or stale uploads.
Reset clears image bytes while preserving the monotonic version. Authenticated
image reads recheck current office visibility and return private, no-store bytes;
tenant RLS and owner-only write policies provide a second boundary.

The small pencil on the frame opens a native modal with photo, camera and
restore-default actions. The whole frame is the touch target. Back/Escape
return to the same room. Before deploying the additive migration, take the
approved encrypted company backup and verify a full isolated restore. An app
rollback can leave this unused table intact; never drop user pictures merely
to roll back the layout. Public presentation work remains owner-deferred.
