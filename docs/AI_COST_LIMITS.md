# Assistant cost limits

Both assistant routes reserve quota in PostgreSQL before calling the existing
`gpt-4o-mini` model. Valid requests count towards quota, including requests that
later fail or are cancelled. Invalid requests keep the existing login/IP abuse
guard. Client-side history trimming is for usability; the server independently
validates every bound.

| Scope | Default | Server override |
| --- | --- | --- |
| User / fixed 10-minute window | 6 requests | `ASSISTANT_USER_BURST_REQUESTS` |
| Company / fixed 10-minute window | 30 requests | `ASSISTANT_COMPANY_BURST_REQUESTS` |
| User / UTC day | 50 requests | `ASSISTANT_USER_DAILY_REQUESTS` |
| Company / UTC day | 200 requests | `ASSISTANT_COMPANY_DAILY_REQUESTS` |
| User / UTC day | 500,000 tokens | `ASSISTANT_USER_DAILY_TOKENS` |
| Company / UTC day | 1,000,000 tokens | `ASSISTANT_COMPANY_DAILY_TOKENS` |

Actor identity and company come from the authenticated server context, never
request headers or JSON. A per-company advisory transaction lock serializes
reservations across both routes and all replicas. Tenant RLS also applies to
`AssistantQuotaBucket`. Old buckets expire by window and are pruned after 32
days on the next request for that company. No transcript, prompt, tool output,
IP or provider key is stored in this table.

Each provider call is bounded to 64 KiB of serialized prompt/tool schemas
including framing headroom, and 1,024 output tokens. Before each paid call, SDK
middleware checks the actual prompt, including accumulated tool results. Admin
requests allow four calls/steps; worker help allows one. Retries are disabled.
Generation stops after 45 seconds or client cancellation.

Admin operational turns require an initial data-tool call and reserve the final
step for the answer. Greetings/capability turns register only a harmless static
tool, then disable further tools. A tool report over24KiB is explicitly
unavailable and must be narrowed/paginated; the64KiB actual model-input guard
still applies to accumulated context. Empty/error/length-limited output is
marked incomplete. No budget/model/provider was raised for AL Steel grounding.

Before generation, reserve `steps * (65,536 + 1,024)` tokens from **both** daily
budgets. Byte count is a conservative input-token bound, not a token estimate
shown to users. A completed SDK response refunds the reservation down to actual
total usage once. Missing usage, aborts and errors keep the full reservation
until the day expires; a settlement failure also keeps it. Consequently token
budgets can reject a request before the request-count limit is reached, notably
when several admin requests run concurrently. This deliberately bounds exposure
even when processes restart or streams disconnect.

HTTP bodies have a 96 KiB byte limit and a 10-second read timeout. Only user and
assistant messages are accepted: at most 16 messages, 4,000 characters each and
12,000 characters total, ending with a nonempty user question. Server/system
messages cannot be supplied by the client. The admin's durable private archive
is separate from the bounded recent history sent to the model. The archive does
not increase model context, output, retries, quotas or timeout. Saving a new
question must succeed before paid generation; idempotent client message IDs
replay saved answers without a second reservation or provider call.

Rate/budget rejections return localized HTTP 429 with `Retry-After`. Quota-store
or configuration failures return 503 and make no provider call. The chat shows
these messages. Environment overrides must be positive safe integers within the
explicit ceilings in `src/lib/assistant/quota.ts`; invalid values fail closed.

## Rollout and verification

Apply the additive `20261103210000_assistant_quota` migration before serving the
new application. It creates only quota metadata; existing customer tables and
rows are untouched. No new environment variables are required for the defaults.
There is no in-memory fallback when the table/store is unavailable.

Unit tests use mock SDK providers. PostgreSQL integration tests exercise
concurrent reservations, shared company ceilings, tenant separation, UTC day
rollover, exactly-once refunds, and valid requests through both routes. Browser
tests cover bounded history and the visible quota error without paid inference.

The quotas limit these two routes. They do not impose a provider-account billing
cap on other applications or integrations. No throughput/load benchmark or real
paid-provider quality evaluation is claimed here.

## Steel work illustrations — separate image contract

The illustration path uses the existing OpenAI account and the pinned
`gpt-image-2.5-flare-2026-09-08` image model, not the assistant's text model or
token reservation. One explicit create/edit/regenerate request allows exactly
one Image API edit with a shipped synthetic style reference,1024×768,medium
quality,transparent WebP80,120s deadline and zero retries. No batches,automatic
backfill,render-time jobs or failure retries are started. Publication/activation
of this new image-model contract requires the owner's concrete PR approval.

The existing tenant/RLS quota table stores separate `image-burst` and `image-day`
request counters; their token field stays zero and chat counters are untouched.
All scopes are checked and charged atomically under a company advisory lock:

| Scope | Fixed image requests |
| --- | --- |
| Authenticated actor / fixed10-minute window |1|
| Company / fixed10-minute window |2|
| Authenticated actor / UTC day |5|
| Company / UTC day |10|

Actor/company identity is revalidated from the server context; request fields
cannot choose either. Failure keeps the image reservation, so an uncertain
provider outcome cannot silently refund a possibly paid call. Authentication or
quota-store failure stops before provider access. These hard-coded ceilings
cannot be raised by the chat-model environment overrides. Quota rejection keeps
the current image and reports a localized illustration-limit message.

This bounds image request count and output settings, not the entire OpenAI
account bill. Image-input/output billing differs from text inference; exact
cost/access/quality depends on the provider account and actual request. See the
[official model pricing notes](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare).
Safe diagnostic usage counts are recorded separately as `steel.visual_image_usage`.
The owner's existing photo is never sent as a style reference or overwritten.
