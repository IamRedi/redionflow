# Private office work and Posta

Continuation of VO-ALSTEEL-001, based on production PR150 and the owner's
11 November category clarification. Candidate only; separate activation is
required. No new provider, dependency, account, role, timer or AI agent.

## User flow

Reception → My office → Tasks & notes / Mail. Megi keeps her existing room;
Almet has a personal desk using the same room component. Visiting Megi exposes
only the room and a compose shortcut, never her workspace. A compact unread
indicator in reception/office refreshes every 45 seconds while visible and on
window focus. Mail/task lists refresh metadata while visible without replacing
an open editor. This is an in-app notice, not a new email or push integration.

Notes and personal tasks are private to their owner. A note can become a
personal task with one action. Tasks support To do / In progress / Done,
optional date and priority, search, Today/status/category filters, edit and
reversible archive. Optimistic versions reject stale edits. Explicitly changing
private work into an office task requires a UI confirmation; it cannot silently
become private again after sharing.

Office tasks require a category and one of the two enabled people as assignee.
Both enabled directors can see/edit these shared tasks. Five initial labels can
be configured explicitly: Finance/purchases–sales, offer modelling, production
preparation, design/permit/site files, and tenders. Labels are editable and
archivable; they are not departments or access grants. Existing tasks keep an
archived label, while new assignments cannot use it.

Production processes, site tasks and daily plans stay in their existing modules.
Office work does not copy or complete them. Site/document shortcuts reuse the
authorized pages; this slice does not add document attachments to tasks or
extend task assignment to staff whose office access is not yet authorized.

Posta supports private two-person threads, text, replies and up to three original
attachments (PDF, JPEG/PNG/WebP, DOCX/XLSX; 5 MB each, 10 MB total). File content
validation and the existing scan adapter are reused; an unconfigured scanner
does not imply antivirus scanning. Files download through an authenticated,
participant-scoped no-store route with attachment disposition, nosniff and a
restrictive CSP. No public object URL or official document receipt is created.

Return controls lead to the current desk, reception or daily plan. Date changes
in the plan retain the validated office origin. Site files/dashboard/profile
entered from the office retain a scoped return link, including nested site-file
pages. Form cancel/back returns to the current list without leaving the office.
The existing shell/footer stays in use; no additional scroll container.
New work copy is Albanian/English; other account languages use English for this
slice while existing office/navigation translations remain unchanged.

## Access and persistence

`VIRTUAL_OFFICE_WORK_ENABLED=true` is a separate server-only flag, off by default.
It also requires the existing strict `VIRTUAL_OFFICE_ACCESS_JSON` allowlist.
Both session kinds resolve to the same configured canonical admin principal.
Active account, session epoch, single-session-kind and tenant checks run on
every action/page/download. Generic admin/owner status is not an access bypass.
No extra person is admitted by this candidate.

Five additive tables: OfficeCategory, OfficeTask, OfficeThread, OfficeMessage,
OfficeAttachment. Composite company/user/thread/category foreign keys and
tenant RLS supplement application checks. Private owner and thread participant
checks are mandatory in the service; tenant membership alone is insufficient.
No new assistant retrieval source reads these tables. Official production,
attendance, invoices and documents are not modified by office writes.

Message+attachments are atomic. A client request UUID makes retries idempotent;
changed payloads with the same UUID fail. Per-company advisory locks serialize
quota/idempotency checks. Bounds: 2,000 tasks including archived, 50 labels,
500 threads, 500 messages per thread, 250 MB attachment bytes per company and
10 messages/person/minute. Lists return the bounded complete set, not a silent
partial result. Reaching a bound returns an explicit limit message. These are
initial safeguards; no storage/provider billing is enabled.

## Release and rollback

Review the additive migration, local gates, current production head and backup
readiness before requesting merge/deploy approval. Do not activate merely by
merging the candidate. After approved migration deployment, set only
`VIRTUAL_OFFICE_WORK_ENABLED=true`; preserve the verified account mapping and
empty one-shot operational flags. Do not seed production demo records.

Disable the new flag to return to phase B. The five tables are retained for
recovery; do not drop private messages/tasks during rollback. Reverting the app
is compatible with these additive tables. No original records are rewritten.

Unit policy tests, isolated database integration tests and
`tests/e2e/steel-office-work.spec.ts` cover the new behavior. Test data is
synthetic. Executed evidence is recorded in the PR; a test definition is not
proof of passing. Production acceptance remains separate.
