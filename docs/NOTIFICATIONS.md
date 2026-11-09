# Workzone notifications

AL Steel's existing bell opens activation and a test for the current device.
An administrator can also explicitly test the team. Workers have the same
activation/self-test, without a team-send action. The profile activation button
uses the same client. Opening the bell never sends a message or requests OS
permission. The test endpoint is same-origin, authenticated, limited to one
identity, and rate limited to one request per person per 30 seconds.

## Delivery and setup

Standard Web Push uses `web-push` 4.0.0 (Node 22 compatible) with a persistent
VAPID pair in `WEB_PUSH_PUBLIC_KEY` / `WEB_PUSH_PRIVATE_KEY`, and a public HTTPS
contact URL in `WEB_PUSH_SUBJECT` (or `APP_BASE_URL`). These are server runtime
settings: no private key enters the browser/build, repository or continuity
notes. Generate the pair once and retain it across releases; rotating it needs
explicit authorization and device reactivation. The authenticated configuration
endpoint exposes only the public key after verifying the pair matches.

Existing Firebase devices/configuration remain supported. Standard subscriptions
are stored as canonical `webpush:` records in the existing private subscription
table; no schema migration is needed. Registration validates push-service hosts
and key lengths. A device endpoint cannot be reassigned to another identity,
even by changing key order or key bytes. Only an expired 404/410 subscription is
pruned. Shared User/Worker IDs remain fail-closed. Neither subscriptions nor
provider response bodies are written to diagnostics.

On iPhone/iPad, Web Push requires iOS/iPadOS 16.4 or newer and the installed
Home Screen app. Open that icon, open the bell, activate notifications and allow
the OS prompt. Permission is requested directly in the tap, before any network
await. Safari in a normal tab shows the installation guidance instead. Android
and desktop use the browser's Push API. Focus mode, notification settings,
connectivity and OS delivery remain outside the application's control.

The existing service worker shows one notification using `/app-icon/192`
(the installation's company logo). Notification clicks accept only the app's
own origin. This does not introduce an offline cache or change app login.

## Events and access

- An explicit changed plan save notifies all active `daily_plan.view` recipients,
  including unassigned readers and editors, for the selected date. Draft moves
  and an unchanged Save do not notify. Concurrent saves share the plan-save lock.
- A selected manual task, a material process, or a production-batch step notifies
  on its incomplete-to-complete transition. Partial piece confirmations, notes,
  failed/rolled-back actions and repeated Done do not create another completion.
- A site completion is the same positive selected-task total used by its board
  and cards. An unrelated imported row (such as `treeId=1`) is retained in storage
  but not counted as a steel phase; a completed single phase is 1/1, not 1/2.

Recipient resolution uses the current `access/rules.ts` decision, including
Shikon, Vepron, Hiq, site-specific overrides and active account state. A process
requires its `field.view` or `factory.view` plus access to its parent site;
site completion requires `site.view`. No message crosses company boundaries.
The existing personal preferences apply: plan -> `tagesplan`, completion ->
`workEnd`, team test -> `adminMessages`. Self-test is an explicit device check.

Dispatch happens only after the business transaction commits. A delivery claim
and aggregate result are recorded in tenant-scoped `notification.delivery`
audit rows, without names, document content, tokens or keys. The transition ID
prevents duplicate dispatch. Provider failures are contained and cannot undo a
saved plan or work confirmation. Push-service acceptance is not a device read
receipt; a process crash between the delivery claim and send remains visible
as `sending`, and no automatic retry/cron is introduced by this change.

The restricted RLS pilot remains a separate, disposable local rollout. Push
delivery is not enabled there: it never falls back to the privileged connection
or broadens its grants. This is separate from AL Steel's existing production
connection. No access level, grant, historical confirmation or test-day session
is changed by this feature.

## Verification and acceptance

Local PostgreSQL scenarios cover permissions, tenant separation, endpoint
ownership, saved-plan dates, deduplication, expiry and manual completion. Unit
checks cover push host validation, VAPID matching and service-worker rendering/
navigation. Browser checks use synthetic data and simulated device APIs; they
verify the activation request/registration and UI, not iPhone delivery. A real
receipt must be checked on the installed device through the existing bell after
the exact release and VAPID configuration are authorized. Do not label an API
success or a simulated browser result as a real phone receipt.

9 November local evidence, REDI, baseline `4a9a75d`: 1,135 unit checks and
464 PostgreSQL integration checks passed. Typecheck/lint and the built
Chromium flow passed at 1440/360 CSS px in light/dark, with before/after
captures, 1/1 archive progress, device registration, test feedback, keyboard
focus return and an actual synthetic-worker login (no team-test control).
The test delivery UI uses a simulated response; adapter/authorization/expiry
checks use a mocked transport. No real company action or push was used as a
test. Private read-only diagnosis and local captures remain outside Git.

Presentation assessment: NO_CONTENT_CHANGE for the public showcase/About,
native description and portfolio card. They retain the same optional company
push/operational-change capability, workflow, access boundary, links and product
status. Public demos still do not deliver notifications; the existing Firebase
path remains. This client transport/accuracy correction adds no public availability,
new readiness score or claim of real iPhone receipt. The setup/acceptance delta
is documented here rather than advertised as device acceptance.

Official references reviewed 9 November 2026:
[Web Push library 4.0.0](https://github.com/web-push-libs/web-push/tree/v4.0.0),
[Apple Web Push requirements](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).
