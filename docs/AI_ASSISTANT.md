# Team Assistant – AI architecture

This document describes **how the assistant works today** (logic, tools, privacy) and **how we plan to make it smarter and more precise** without breaking safety.

Current active split:

- **Admin entry**: `POST /api/assistant` -> `src/app/api/assistant/route.ts`.
- **Worker entry**: `POST /api/assistant/worker` -> `src/app/api/assistant/worker/route.ts`.
- **Admin UI entry**: the AI-badged company logo in the shared top Flow shell opens Admin Assistant.
- **Worker UI entry**: the same AI-badged product logo visual opens Worker Helper for worker sessions.
- **Direct URL**: `/workzone/assistant` resolves by session: admin sees Admin Assistant, worker sees Worker Helper, anonymous users go to worker login.
- **Persistence rule**: admin chat may persist in session storage; worker helper chat is ephemeral across refresh.

The active split above is the current truth. Any older wording below must be interpreted through it.

## Overview

- **Entry**: `POST /api/assistant` → `src/app/api/assistant/route.ts`.
- **Model**: OpenAI `gpt-4o-mini` via `@ai-sdk/openai`; requires `OPENAI_API_KEY` in `.env` (restart dev server after changes).
- **SDK**: Vercel AI SDK `streamText` with **tool calling**; responses stream as plain text to the shared assistant UI.
- **Admin UI entry**: the Admin Assistant opens as a floating modal from the single AI-badged company logo in the shared top Flow shell.
- **Direct URL**: `/workzone/assistant` resolves Admin Assistant or Worker Helper by session.
- **Persistence rule**: when an admin moves between Workzone/Admin pages, the assistant panel should remain open until explicitly closed with `Schliessen`.
- **Rule**: **read-only**. Tools query Prisma; nothing writes to the database from the assistant.
- **Access parity rule**: the assistant should be able to answer from the same data the current user/admin can physically see in the UI with the mouse, and no more.
- **Relative date rule**: for questions like `sot`, `heute`, or `today`, the API forces the report tools to use the server's current date instead of trusting the model to infer a date.

## Separation Rule

Admin Assistant and Worker Helper must not be merged.

- Admin entry: `POST /api/assistant` -> `src/app/api/assistant/route.ts`.
- Worker entry: `POST /api/assistant/worker` -> `src/app/api/assistant/worker/route.ts`.
- Admin UI entry is the AI-badged company logo in the shared top shell.
- Worker UI entry uses the same AI-badged product logo visual, but opens Worker Helper.
- `/workzone/assistant` resolves by session: admin sees Admin Assistant, worker sees Worker Helper, anonymous users go to worker login.
- Admin Assistant can read admin-visible operational data through admin-gated tools.
- Worker Helper explains only visible Workzone UI and worker permissions.
- Worker Helper must not expose admin functions, hidden data, reports of other workers, or bypass instructions.
- Public landing/demo pages must not mount either assistant.
- Shared UI components are allowed only if endpoint, labels, storage, and access checks stay separate.

## Requester identity

- `getRequesterContext()` (`src/lib/assistant/requester.ts`) resolves the caller from cookies:
  - `bk_admin_id` → Admin (`User`)
  - `bk_worker_id` → Worker (`Worker`)
  - neither → anonymous (limited / blocked for most tools)
- Company scope is always `getOrCreateDefaultCompany()` (single-company MVP).

## Persona and privacy

- **Addressed name**: `extractAddressedName()` parses greetings like `Hej Andi`, `Hi, Gregor` to optionally resolve a **target persona** (`src/lib/assistant/identity.ts`).
- **Target resolution**: `resolveIdentityTarget()` matches Worker/Admin by name (with light fuzzy prefix matching for typos like `Redion` → `Redi`).
- **Policy**: `getPrivacyPolicy()` + `canImpersonateTarget()` enforce:
  - **Admin → worker**: full operational + HR transparency **via tools** (no invented secrets).
  - **Worker → worker**: operational data (location, plan, equipment) only; no cross-worker hour dumps unless policy is extended deliberately.
  - **Worker → admin persona**: allowed with scope limits described in the system prompt.
- **Language**: `languageForTurn()` biases reply language (DE / SQ / PL) from profile + last user message.

## Multi-step tool loop (critical)

AI SDK v6 defaults to `stopWhen: stepCountIs(1)`, which stops after a single model step and **breaks** “call tool → read result → answer”. The route sets:

- `stopWhen: stepCountIs(14)` so the model can chain tools and then answer.

If tools seem ignored, verify this setting and that the dev server was restarted after dependency upgrades.

## Tools (by audience)

### Workers (and shared)

| Tool | Purpose |
|------|--------|
| `getMyOperationalSnapshot` | Logged-in worker: live Baustelle + today’s plan/machine (no name required). |
| `getMyHoursSummary` | Worker: own hours over last *n* days (1–31). |
| `getMyDailyReport` | Worker: own Tagesbericht for a day, including sessions, Baustellen, colleagues, material actions, trees, tasks, and notes. |
| `getMyMonthlyTimesheet` | Worker: own Stundenzettel for a month, including daily rows, hours, locations, admin time rows, and notes. |
| `getMyVacationSummary` | Worker: own Urlaub account, remaining days, pending/approved requests, and history. |
| `getCompanyBaustellenDirectory` | Active Baustellen list (public Workzone-level info: name, type, address, snippet). |
| `getLiveLocation` | Live session Baustelle for a named worker. |
| `getAssignedMachine` | Planned machine/Baustelle for a named worker (daily plan). |
| `getEquipmentStatus` | Safety inventory net on-site (SIGN / PLATE / FENCE). |
| `getKnowledge` | `CompanyKnowledge` entries (FAQ-style). |

### Admin only

| Tool | Purpose |
|------|--------|
| `getWorkerPrivateSummary` | Sessions/hours for a named worker (rolling days). |
| `adminGetWorkerDailyReport` | Tagesbericht for a named worker (same data as admin worker day page). |
| `adminGetTeamDailyReport` | Team day overview for one date: who worked, who completed trees, Baustellen, hours, and material actions. |
| `adminGetWorkerMonthlyTimesheet` | Stundenzettel for a named worker (same data as admin worker month page). |
| `adminGetOwnDailyReport` | Admin's own Tagesbericht. |
| `getWorkerHrProfile` | Profile: `Worker.licenses`, position, level, assets, contact fields. |
| `adminGetLiveWorkforce` | Who is live now, where, since when; counts. |
| `adminGetDashboardSnapshot` | Real admin dashboard snapshot: KPI cards, weekly/monthly hours, Baustelle progress, worker rankings, safety stock. Preferred source for dashboard/panel/statistics questions. |
| `adminGetAvailabilityForDate` | Who is available on a date; checks approved Urlaub and worker profile availability (`VACATION`, `SICK`, `UNAVAILABLE`). |
| `adminQueryDailyPlan` | Tagesplan lookup by date, worker name, or Baustelle: returns groups with workers and machines. |
| `adminAnalyzeDailyPlanLicenses` | Tagesplan analysis: workers, machines, required machine licenses, worker licenses, and license mismatch warnings. |
| `adminListVacationRequests` | Urlaub requests by status (`PENDING`, `APPROVED`, `REJECTED`, `ALL`) and optional date overlap. |
| `adminGetHoursAggregate` | Sum hours today / month / date range; optional per-worker breakdown. |
| `adminSearchWorkersByLicense` | `licenses` field contains substring (e.g. `CE`). |
| `adminGetHoursRanking` | Top workers by hours in a calendar month (`YYYY-MM`). |
| `adminListBaustellenOverview` | Baustellen + tree todo/done counts, documents, description snippet. |
| `adminListProjects` | Calculation projects (title, customer, status, internal notes excerpt). |
| `adminListOpenManualTasks` | Recent `ManualTask` rows by Baustelle. |

Execute functions return `{ ok: false, message }` if the requester is not allowed.

## Data model notes (honesty)

- **Deadlines “this week” per Baustelle**: there is **no dedicated deadline field** on `Baustelle`. Clues may exist in `description`, `documents`, `ManualTask`, or project notes. The assistant should **not invent** deadlines; it can summarize what is stored.
- **Führerschein / categories**: stored as free text in `Worker.licenses` unless extended later (structured license table).

## Code map

| Path | Role |
|------|------|
| `src/app/api/assistant/route.ts` | `streamText`, system prompts, tool wiring. |
| `src/lib/assistant/requester.ts` | Who is calling (admin/worker/anonymous). |
| `src/lib/assistant/identity.ts` | Persona resolution + privacy policy. |
| `src/lib/assistant/language.ts` | Turn language. |
| `src/lib/assistant/tools.ts` | Core Prisma tools (worker + shared + HR single-worker for admin). |
| `src/lib/assistant/admin-tools.ts` | Aggregations and admin-wide queries. |
| `src/components/assistant/team-assistant.tsx` | Shared chat UI; admin logo trigger and separate worker helper trigger. |
| `src/app/(workzone)/workzone/assistant/page.tsx` | Direct page that resolves Admin Assistant or Worker Helper by session. |

## Reports and timesheets

The assistant now mirrors the report pages:

- Worker can ask for their own Tagesbericht or Stundenzettel only.
- Admin can ask for any worker's Tagesbericht or Stundenzettel.
- Admin can ask for their own Admin Tagesbericht.
- Admin team questions like "who completed trees today?" or "who worked today?" must use `adminGetTeamDailyReport` first, then `adminGetWorkerDailyReport` only for person-specific details.
- Report tools use `src/lib/workzone/reporting.ts`, the same source as the UI pages.
- Returned daily data includes sessions/hours, Baustellen, colleagues on the same Baustelle/day, material actions (Konen, Bauzaun, Halteverbot-Schilder), completed trees, manual tasks and report notes.
- Baustellen material movements can be created by workers or admins. Worker reports only show worker-owned actions; admin/team summaries may see admin actions as separate actor-based history rows.
- Returned monthly data includes daily rows, locations, hours, report notes and monthly admin time rows where available.
- Admin worker report tools also return direct UI links (`profileUrl`, `dailyReportUrl`, `monthlyTimesheetUrl`) so the assistant can point the admin to the same page they can open with the mouse.
- For questions like "wann hat X angefangen?", "kur filloi pune?", "was hat X heute gemacht?" or live hours, the assistant must use Tagesbericht/Stundenzettel data, not guesses.
- Live WorkSession rows are counted up to "now" until they are stopped. Visible times returned to the model are local German times (`startTime` / `endTime`), so the assistant must not display UTC/ISO times as work start times.

## Urlaub

The assistant mirrors the Urlaub rules from `docs/URLAUB.md`:

- Worker can ask only for their own Urlaub account and request history via `getMyVacationSummary`.
- Admin can ask who is available/einsatzbereit on a date via `adminGetAvailabilityForDate`.
- Availability excludes workers with approved Urlaub on that date and workers whose profile status is `VACATION`, `SICK`, or `UNAVAILABLE`.
- Pending Urlaub requests for that date are returned separately so the admin can see requests that are not approved yet.
- Admin can ask who requested Urlaub via `adminListVacationRequests`.
- Urlaub and availability answers should be short, natural, and without links unless the user explicitly asks for a link.

## Tagesplan and Licenses

- Admin can ask which workers and machines are planned on a given day.
- Admin can ask which machines a named worker/group has, or which workers/machines are on a named Baustelle.
- For direct plan lookup questions, use `adminQueryDailyPlan`; for patent sanity checks, use `adminAnalyzeDailyPlanLicenses`.
- Admin can ask whether machine requirements match worker licenses.
- The assistant uses `adminAnalyzeDailyPlanLicenses`.
- The Tagesplan UI also shows warnings when a column has more machines requiring a license class than assigned workers who have that class.

## Dashboard statistics

- The admin assistant can now read the same read-only snapshot used by `/app/dashboard`.
- Source of truth stays `src/lib/dashboard/dashboard-snapshot.ts`.
- For dashboard/panel/KPI/statistics questions, the assistant should prefer `adminGetDashboardSnapshot`.
- This includes:
  - active / unavailable workers
  - active / completed Baustellen
  - today net / pause / gross hours
  - week / month hours
  - workers who worked today
  - machine status
  - safety stock
  - weekly hours by Baustelle
  - Baustellen progress
  - worker hour rankings
- Important rule:
  - if the snapshot is used, the assistant should present those numbers as snapshot values and should not mix them with guessed or unrelated aggregates.

## Future work – smarter and more precise

Prioritized ideas (not all implemented):

1. **Active context from UI**: pass `activeWorkerId` / `activeBaustelleId` from Workzone layout into the assistant request body so admins do not need to type names for every question.
2. **Structured HR**: optional normalized tables for license classes instead of only `Worker.licenses` text; enables exact filters (`CE` vs partial matches) and expiry reminders.
3. **Baustelle deadlines**: add optional `targetEndDate` (or similar) on `Baustelle` or link to milestones; then expose via a dedicated tool.
4. **Document RAG**: index `Baustelle.documents` and worker PDFs (where allowed) for semantic Q&A; keep permission checks identical to API tools.
5. **Evaluation harness**: golden questions (DE/SQ) with expected tool calls + numeric tolerances for regression testing when changing prompts/models.
6. **Model routing**: cheaper model for chit-chat, stronger model when tools return large aggregates (configurable).
7. **Streaming tool UX**: show “thinking / using tool X” in the chat UI for transparency.
8. **Rate limits & audit log**: per-company logging of assistant queries (privacy/compliance).

---

Keep this file updated when adding tools or changing privacy rules.
