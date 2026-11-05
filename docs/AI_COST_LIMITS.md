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
messages cannot be supplied by the client. The browser retains its visible
transcript while sending only the bounded recent history.

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
