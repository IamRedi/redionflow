# Muster office controls and company chat

Owner request, 16 November 2026. This is the first bounded shell-standardization
step for the three fictional Muster installations. It is not activation on the
AL Steel pilot, another company, another demo or the public portfolio.

## Header refinement — 16 November 2026 candidate

The three Muster shells now share one personal-utility contract. This refinement
is prepared against the published chat releases, not enabled on AL Steel or any
other installation. No database migration, provider/AI call, permission grant,
new preference store, background or business-process change is required.

- The original company logo opens the existing company chat. Its unread badge
  uses the same server-backed per-person cursor. There is no additional chat
  icon in the common header and no AI badge on this logo. During actor hydration
  the mark keeps its space and is disabled until the correct controller exists.
- Primary process links stay on the left of the second header row. They retain
  each tenant's enabled processes and permissions. The team has the full first
  row; narrow process navigation scrolls horizontally without an extra page
  scrollbar or a wrapper surface covering the scene.
- Right-side utilities have one order: own profile, Day/Night, language flag.
  Theme is a direct one-tap toggle using the existing HttpOnly cookie/POST.
  Locale cycles DE → EN → SQ → IT → PL → RO → DE through the existing language
  provider, cookie and local preference. Flags are bundled SVGs, independent of
  Windows emoji support. No popover, new translation claim or profile-preference
  migration is introduced. Open chat drafts/forms stay mounted through refresh.
- Personal notifications and KiDraht are under the own-profile disclosure.
  Regular Muster also exposes its existing assistant route with unchanged
  admin/worker authorization, settings, demo-role entry and sign-out. Baumdienst
  retains its existing fictional persona switch, own worker-profile link and
  custody-notification workflow; unread custody items mark the profile entry.
  The previous standalone bell/chat/book buttons are absent from the header.
- Native fullscreen office scenes keep their established local chat entry:
  those scenes intentionally replace the common header. Private assistants and
  own-admin management tools stay in their existing office locations. This is
  a functional scene exception, not a duplicate button in the common header.

Shared geometry and behavior live in `MusterPreferences.tsx`,
`MusterProfileMenu.tsx`, `muster-header.module.css` and the existing chat trigger.
The regular `MusterHeaderUtilities` and Baumdienst `DemoProfileMenu` adapt only
the authenticated/simulated personal actions. Existing tenant/forest material
tokens govern the ice-glass controls; artwork, palettes, typography, process
permissions, chat API limits and read logic remain unchanged. Labels and focus
remain accessible, with 44px touch targets, Escape/outside dismissal and bounded
profile-panel scrolling for short windows. No shared policy is duplicated here;
RediON Connect `plugin-source:/plugin/skills/ui-identity` and `ui-experience`
remain the shared policy sources, subordinate to the owner's explicit one-tap
Day/Night and flag request for these Muster headers.

`tests/muster/header-controls.cjs` exercises the same guarded loopback contract
for all three profiles. It checks logo/chat uniqueness, profile grouping, six
locale changes without reload, unsent chat-draft retention, theme persistence,
single-request error/retry, reachable compact controls and the profile panel at
1440×900, 390×844, 320×640 and 760×360 in Light/Night. Existing two-person chat,
read/unread, history, retry and office permission acceptance is retained.
Local checks, owner acceptance and publication remain separate evidence axes.

## Navigation and visual identity

Control panel and Dashboard view belong to the authenticated administrator's
own office. They are absent from the Muster global navigation and its duplicate
admin-sidebar shortcut. A reception, colleague visit or employee preview does
not expose the administrator's office tools. Existing route permissions remain
authoritative; moving a button never grants access. The Baumdienst simulation
uses its existing `manager` persona and only that persona's own office.

The old announcement editor/banner is replaced in these installations by one
company-chat button. Existing announcement records and the legacy interface on
other installations are preserved. Private office mail, notes, archives,
assistants, work tracking and permission boundaries remain separate.

The chat uses the product's own foreground/card/primary/ring tokens, Lucide SVG
icons, compact 44px actions and an ice-glass dialog. Messages scroll inside the
dialog; there is no extra page scrollbar or branding footer inside it. Escape
closes and restores focus. Opening does not force the phone keyboard. The
composer remains reachable in a short viewport. Dashboard/TV remains a read-only
surface without the interactive chat.

## One shared core, explicit installation adapters

`src/lib/company-chat/{contract,service,copy}.ts`, the HTTP handlers and
`src/components/company-chat/CompanyChat.tsx` are identical across the release
candidates. No third chat implementation or separate database schema is added
for each industry. Each release preserves its own baseline and lockfile.

| Installation | Identity adapter | Office placement |
| --- | --- | --- |
| BauFlow Musterbau | Exact installed synthetic tenant + active authenticated admin/worker | Own admin desk |
| RheinRuhr crane Muster | Exact installed synthetic tenant/profile + active authenticated admin/worker | Own admin desk; factory remains disabled |
| Baumdienst Musterstadt | Exact existing `requireWorkshopDemo` guard + signed public demo persona | Own manager room |

Regular installations mount one provider above the existing header portal and
route layouts. Baumdienst mounts one provider in the opted-in demo shell. Its
application children stay mounted while identity loads or changes; only the
chat controller resets. A small React external store updates chat buttons
without rebuilding searches, forms, the Workzone canvas or scene transitions.
Scene navigation keeps this wrapper unkeyed; expired field/office resolutions are aborted, and the old context is hidden immediately until the matching identity arrives.
Field and office persona selectors already use different signed-cookie paths:
the field chat lives at `/api/demo/baumdienst/chat` and the office handler at
`/api/demo/baumdienst/offices/chat`. The ordinary endpoint rejects the demo
alias, so it cannot silently resolve a restricted field cookie as the boss.
The existing cookie scope and office
permissions are not widened. Switching a fictional persona refreshes the chat
identity. The field boss and manager office share one identity/read cursor.
Public simulation is labelled as fictional; it is not operational login.

## Persistence and unread logic

The additive migration `20261116170000_company_chat` creates only
`CompanyChatMessage` and `CompanyChatReader`. Each message has a company,
monotonic company-local sequence, immutable author key/name, server timestamp,
text and idempotency request UUID. A company lock serializes sequence/rate
checks and insertion. Retrying the same UUID/text returns the original receipt;
reusing that UUID with different text is rejected. No original banner or
business record is rewritten.

Each person's watermark is stored by `(companyProfileId, actorKey)`. Unread
counts exclude their own messages. A read acknowledgement is accepted only for
an existing message in that company and advances with `GREATEST`, never
backwards. Rows and counts are bounded to the same observed head, so concurrent
later arrivals cannot be acknowledged by an earlier snapshot.

Opening the latest conversation near the bottom marks that rendered head read.
Browsing an older page or reading while hidden does not clear later arrivals.
Another device/profile reads the same database, not browser-local storage.
In a public demo, selecting the same fictional person on two devices shares
that person's read state by design.

History uses keyset pages of 40 messages with one look-ahead row, not an
unbounded DOM or a full-history download. Older/latest actions keep the window
bounded. Messages are immutable in this step; no delete/edit/attachment workflow
is introduced. The demo stops accepting new messages at 10,000 while preserving
existing history; it never silently evicts old messages.

## Notifications, safety and cost

On a new committed message, the existing company-scoped SSE channel signals the
chat. Its icon displays the unread count and a small in-app notice opens the
conversation. Visible clients also refresh on focus/online and poll every 30s
when closed / 5s when open as a fallback across replicas. There is no whole-page
refresh on each message. Hidden tabs do not poll.

Existing optional device notifications target the same company's active
accounts, excluding the sender when an account ID exists. Existing consent and
`adminMessages` preferences apply. The push contains a sender name and generic
chat notice, not message text. Delivery failure cannot undo the saved message
or unread count. Native delivery requires an already configured and authorized
device; an in-app verification does not claim actual phone push delivery.

Names and company IDs come only from the server identity adapter. HTTP commands
are strict, reject caller-supplied names/tenants and stale actor keys, require a
same-host browser origin and JSON, cap streamed bodies at 8 KiB / 5s and message
text at 1,500 characters. Sends are limited durably to 20/minute/person and
120/minute/company. Both tables have forced tenant RLS plus explicit company
filters. Text is rendered escaped. No chat text enters logs or AI requests.
No new provider, credential, subscription or AI generation is used.

## Verification and rollback

Use the repository's local verification policy and the explicitly owned,
disposable fixture. `tests/muster/company-chat.cjs` refuses hosted targets and
unknown databases. It checks two independent profiles, names, unread notices,
read persistence after reload, a 1,000-message history with at most 40 mounted
messages, keyboard focus, Light/Night, desktop/touch/short layouts and management
entry from the own office. Screenshots, exact source manifests and local gate
receipts belong to the current task evidence. Touch emulation is not a physical
phone or real provider-delivery test.

Deploy only the independently reviewed candidate for each corresponding Muster
service. The previous release remains a code rollback target; the additive
tables can remain intact, preserving history during rollback. Do not drop chat
tables, reset an installation or modify protected services to roll back UI.
Merge/deployment, runtime verification and public presentation readiness are
separate from a verified local candidate. Until publication, the native
presentation and portfolio must not claim this feature is live.
