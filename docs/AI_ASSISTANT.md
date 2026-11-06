# Team Assistant — grounded operational answers

The admin assistant reads the authenticated company's operational records. It
does not change business data, confirm work, upload files or operate devices.
Unknown information stays unknown; it cannot answer facts that are not recorded
or available through its tools. The existing logo/dialog remain; the admin chat
adds a small conversation selector and a new-chat action.

`POST /api/assistant` serves administrators. `/api/assistant/worker` remains a
separate restricted Worker Helper. A provider key does not grant workers admin
data tools. Admin conversations are archived privately for their tenant and
administrator. Only bounded recent context is sent to the model; previous
answers are never evidence for a fresh operational answer.

## Rule layers

| Layer | Enforcement |
| --- | --- |
| Identity | Fresh active ADMIN and authenticated company membership. Mixed role sessions fail closed; no default-company fallback or creation. |
| Input | Same-origin protection, body/message/history bounds, timeout and no client system messages. |
| Calendar | Company timezone, strict dates/DST, chained follow-ups and independent dates/months/range endpoints. |
| Data | Tenant-filtered read-only functions. New steel/company/hour tools also revalidate admin membership; ambiguous names/marks require selection. |
| Instructions | Trusted server prompt; names, descriptions, personality notes, knowledge and returned free text are untrusted data, never permissions or instructions. |
| Retrieval | Operational turns require a data tool first. Greetings/capability turns register only the static capability tool, then answer without private reads. |
| Answer | Actual sources/times, exact totals versus page rows, explicit missing/legacy/approximate data. Errors are unknown, never zero. |
| Execution | Existing four admin steps/one worker step,45s cancellation,64KiB actual model input and1,024 output tokens. Final admin step starts no new lookup. |
| Delivery | Consume the SDK full stream, discard tool-call introductions, and detect error/abort/empty/length/tool-only endings. An unfinished answer gets a localized notice. Raw provider/SQL errors stay private. |
| History | Persist each accepted question before paid generation; save emitted answer, status, usage and safe diagnostics. Actor-owned history/traces require fresh ADMIN membership and tenant/admin RLS. |

Answers default to one or two sentences or a compact name list. Expand only on
an explicit request for details, evidence or a report. Necessary date, source,
uncertainty and partial-page qualifiers remain brief. A workshop is not counted
as a construction site. A project is not considered started just because its
list was imported or its status is active.

`admin-prompt.ts` defines trusted rules. `grounding.ts` adds source/retrieval time,
rejects invalid dates before queries and explicitly rejects a report over24KiB
instead of silently clipping rows into a false total. The existing64KiB actual
model-input guard can reject accumulated context earlier. Quota metadata may be
written; business data remain read-only.

Registered tools explicitly use `strict:false` at the Responses boundary to
preserve their existing optional Zod parameter contract. Server-side Zod and
authorization checks still apply before execution. Omitting this setting can
let Responses normalize optional fields into required/null arguments that fail
the application's non-null optional schema. See the official
[function-calling contract](https://developers.openai.com/api/docs/guides/function-calling#strict-mode).

## AL Steel production

Steel mode removes legacy tree/dashboard/calculation tools from its registry.
Those tools retain their own non-steel audience.

| Tool | Evidence |
| --- | --- |
| `adminSearchSteelProjects` | Production projects/sites, exact match count and cursor page. |
| `adminGetStartedSteelProjects` | Exact count and names with recorded factory/site activity. Excludes import/status alone, workshops, future/invalid/deleted confirmations and unrelated legacy notes; site-only and factory-only scopes are explicit. |
| `adminSearchSteelElements` | Imported assembly/part marks with project/list identity and pagination. |
| `adminGetSteelElement` | Exact product properties, quantity/weight/dimensions/material, applicable process quantities and closed-route state. |
| `adminGetSteelProductionSummary` | Canonical current progress and monthly/daily kg, from the same steel dashboard service; project details paginate separately. |
| `adminGetSteelProductionEvidence` | Confirmation events filtered by project/product/stage/credited worker/day/month, full-period aggregates and cursor-page evidence. |
| `adminGetSteelProjectBatches` | Legacy order groups and recorded steps/state in their original units, separately from element throughput. |

Calculations reuse `steelDashboardData`, `steel-metrics` and element-stage helpers.
Cut parts, cut assemblies and assembly can describe the same steel at successive
stages: never add their kg into one produced-steel total. Ready-for-site is a
separate current-progress measure. A historical month is not historical stock.

Snapshots preserve original weight; legacy entries using current-list weight
remain approximate. Missing weight is unknown. Canonical cancellations/exclusions
remain in effect. Confirmation date is not actual work start/end. `workerIds`
credit a team; `checkedBy` identifies the checker. Shared-team kg are not each
member's individual output. Old unlinked name text is not silently attributed.

The delivery guard also preserves the legacy qualifier if a model omits it:
successful canonical day/month/evidence metrics can add `≈` to matching quoted
kg values before delivery and archival. It changes no values or historical
transcripts. Day and month scopes remain separate; project sums are derived only
from a complete first evidence page. Snapshot-only values do not supply legacy
qualifiers. Equal numeric values can conservatively share a qualifier; this is
not semantic verification of every sentence. Private run diagnostics record the
number of observed legacy values and inserted qualifiers.

Standard factory-production quantity questions use a bounded canonical answer
renderer after a successful summary lookup. It reports cutting/assembly series
separately, with pieces, legacy approximation and missing weights; a model's
invented combined kg total is replaced before delivery and archival. Requested
project details use the selected day's per-project facts (or the selected
month's facts), with explicit page completeness. This is confirmation throughput,
not stock, unique steel output or evidence of every factory process. Unsupported
period comparisons and incomplete sources return a short clarification instead
of an inferred total. Private diagnostics record whether the renderer applied.
Unrelated, specific-product/process/person and stock questions keep their normal
read-only tools. This bounded renderer does not certify arbitrary model answers.
The Albanian style instruction `përgjigju shkurt` is distinguished from February
when resolving a requested day; an explicit February comparison remains mixed.

## Private conversation archive

The additive `20261105120000_assistant_history` migration creates three tables
only: `AssistantConversation`, `AssistantRun`, `AssistantToolTrace`. No business
record is seeded, rewritten or reset. History is separate from quota buckets
and sensitive-action audit logs. Apply it before serving this version.

`POST /api/assistant` accepts optional `conversationId` and UUID
`clientMessageId`; the latter makes retries idempotent across lost responses.
Only one run can be in progress per conversation. A stale interrupted run is
marked incomplete rather than silently rerun. An archive start failure makes
no paid provider call. Valid rate/configuration/quota rejections and calendar
clarifications are saved too; malformed/unauthenticated requests are not a
private transcript. Responses carry conversation/run identifiers in headers.

`GET /api/assistant/conversations`, `/conversations/[id]` and
`/api/assistant/runs/[runId]/traces` paginate private owned records with no-store
responses. New chat retains the previous archive. The browser loads the latest
50 turns and can navigate older pages; prompt history keeps its existing
16-message/12,000-character bound. The old unscoped sessionStorage cache is
neither trusted/imported nor erased. Pre-release browser-only chats cannot be
claimed as recovered server history.

Questions and emitted answers retain timestamps, terminal status and explicit
redaction/truncation flags. Tool inputs/results/evidence are sanitized and
bounded (8KiB input,24KiB result,256KiB aggregate/run,128 traces). Raw exceptions,
keys, credentials and provider headers are excluded. Safe diagnostics distinguish
provider authorization/quota/rate failures, invalid tool arguments, database
categories, input/step/time limits, interruption and empty/incomplete output.
Application logs contain only safe run metadata; no transcript or tool payload.
There is no automatic transcript pruning. Normal company backups must include
these private tables. Worker Helper has no access to this archive.

## Other operational sources

| Tool/source | Scope and limits |
| --- | --- |
| `adminSearchCompanyWorkers` | Operational profile/availability/license discovery with matching counts; no auth credentials, national IDs or file contents. |
| `adminSearchCompanyFleet` | Vehicle/plate/properties and last stored GPS report time/age/staleness. No provider refresh or device command. |
| `adminGetCompanyFuelReceipts` | Metadata, upload/fueling actors and dates, captured GPS provenance, confirmation filters and exact sums by currency. Select uploaded/fueled date basis; latest uses that selected event time. No image/OCR read. |
| `adminSearchCompanyInventory` | Catalog and active worker assignments, not physical stock/available balances. |
| `adminSearchCompanyAssets` (steel admin) | Canonical warehouse/fleet assets with recorded holder, assigned site, availability, pending versus completed handovers and current repair. Exact filters/counts before cursor pagination. |
| `adminGetCompanyWorkshop` (steel admin) | Current active repair jobs, filtered by vehicle/tool, phase and internal/external route before counts/pages. Reported, received and repairing remain separate; ready/cancelled history is excluded. |
| Hours/timesheets | Existing reports. Company totals/rankings aggregate all closed rows in PostgreSQL and live hours at one as-of instant in a repeatable-read transaction; no5,000/8,000-session clipping. |
| Plan/licenses/availability/vacation | Existing authorized plan/report/profile data with company-calendar boundaries and explicit limitations. |
| `getKnowledge` | Bounded stored CompanyKnowledge excerpts, not external or complete document search. |

Long/capped lists declare completeness where supported. Partial hour samples
return `totalHours:null` and separately named `returnedHours`. Returned rows with
no completeness claim must not be treated as a company total. License fields
remain free text. Manual-task entries do not establish open/closed status.

No tool reads PDF/image content, performs OCR, searches KiDraht content, queries
external GPS history or knows unstored deadlines. Legacy batch steps are not a
complete ProductionEvent history. State which evidence is unavailable instead
of inventing a completion, promise, duration, forecast or worker productivity.

### Warehouse custody and workshop questions

The steel admin tools reuse the asset service's canonical availability projection
and a narrow read-only projection. They revalidate current ADMIN membership in
the authenticated company and expose no worker-private belongings, file bytes,
invoice contents, authentication keys or unbounded history. Worker Helper gains
no company asset lookup. No schema, model/provider, quota or UI change is needed.

For “who has this drill?”, search by name/code and ask which one if several
assets match. For a worker's equipment list, resolve the worker first, then filter
by `holderWorkerId`: only current recorded responsibility matches, not a pending
recipient or a repair's former origin worker. A pending issue/return/transfer
does not change custody until its required confirmations complete. Legacy
assignment responsibility is labelled separately from completed handover evidence.
Lost/retired responsibility records do not prove current physical possession.

Assigned site, recorded workshop route and a vehicle's last stored GPS fix are
separate sources. Available/unassigned does not prove physical warehouse stock
or a bin/shelf location. A defect report does not prove workshop reception;
reception clears current custody, and the repair origin remains historical.
External provider text does not establish a street address. Use the existing
fleet GPS tool when requested, retaining its report time/staleness.

Workshop queries default to active jobs (reported, received, repairing). Use an
explicit phase for a narrower question and name the returned phases accurately.
Results use cursor pages of at most 20 rows (8 by default) with exact matching totals,
coverage and current-read time. Earlier chat answers remain no evidence. Short
answers give the asset name/code/plate plus holder or repair phase and one useful
recorded location/route; expand only when asked for details. The existing private
conversation and sanitized tool-trace archive records these reads automatically.

## Activation and limits

The existing OpenAI `gpt-4o-mini` provider and installed AI SDK remain unchanged.
Model capabilities were checked against the [official model page](https://developers.openai.com/api/docs/models/gpt-4o-mini).
Installed SDK docs/source govern the API; see [tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling).

Activation requires `OPENAI_API_KEY` in deployment secret configuration. The
owner enters it directly in Railway, never in chat/Git/Drive/evidence. Missing
configuration returns localized503 with no provider call. A key's presence does
not prove provider access, billing, answer quality or owner acceptance.

Durable quotas, reservation/refund, cancellation and input/output bounds remain
in [AI_COST_LIMITS.md](AI_COST_LIMITS.md). No model/provider/dependency migration
or cost-limit increase is included. Quotas store no transcript/tool outputs and
do not cap other applications using the provider account.

## Code and evidence

- `route.ts`: request gates/composition; `requester.ts`, `identity.ts`, `turn-context.ts`: scope/ambiguity/calendar.
- `admin-prompt.ts`, `grounding.ts`: trusted rules/result envelope/step control.
- `business-tools.ts`, `legacy-tools.ts`: capability registries by company mode.
- `steel-tools.ts`, `company-tools.ts`, `hours-data.ts`, `tools/`: read functions.
- `generation.ts`, `quota.ts`, `limits.ts`: existing provider/budget boundaries.

Focused unit tests cover permissions, ambiguity, dates/DST/mixed scopes, body
bounds, tool routing, error/empty/truncated streams and quota settlement. Disposable
PostgreSQL tests cover exact kg/snapshots, team credit, tenant guards, pagination,
more than5,000 sessions and durable quotas. No paid model inference occurs in
these tests. Local PASS, deployed revision, provider-enabled evaluation and owner
acceptance remain separate evidence.
