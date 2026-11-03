# WanWay / IOPGPS: read-only fleet integration

Implementation prepared on a feature branch based on the active pilot branch,
not on the older default branch. Opening this PR must not deploy it. The pilot
branch is connected to Railway; the owner must approve the exact revision before
any merge/deploy, environment addition or live migration. No customer credentials
or operational data are included in this repository or its fixtures.

## Verified provider contract (3 November 2026)

Primary source: [WanWay documentation](https://www.wanwaygps.com/doc/view?api=iop),
its [published IOP Swagger](https://www.wanwaygps.com/iop-docs/api/iop.json), and
[IOPGPS docs](https://docs.iopgps.com/). Swagger specifies HTTPS
`open.iopgps.com`; the application has no configurable provider host.

| Method/path | Purpose and verified contract |
| --- | --- |
| POST `/api/auth` | JSON `appid`, Unix seconds `time`, lowercase `md5(md5(key)+time)`. Success `code=0`, `accessToken`, `expiresIn` **milliseconds**. |
| GET `/api/device` | `currentPage` starts at 1, `pageSize<=100`; `data[]` and `page.{count,currentPage,pageSize}`. Device discovery only. |
| GET `/api/device/status` | `account=appid`; documented status, WGS84 coordinates, GPS/signal times in seconds, speed, plate and optional `extVoltage` in **0.1 V**. |
| GET `/api/device/miles` | Explicit last-24-hour interval. `miles` is provider interval mileage in km, **not a verified vehicle odometer**. |
| GET `/api/device/track/history` | Explicit last-24-hour interval, `coordType=wgs84`, `onlyGps=1`. Provider maximum is one month per request, history within nine months; this implementation requests much less. |

All authenticated GET requests use the `accessToken` HTTP header. No key/token
appears in a URL. The transport accepts only these five paths and methods.
No command, relay, engine stop, device configuration, account creation, recharge
or provider-side vehicle binding is implemented. Local binding only changes a
reference to an existing vehicle; no vehicle is created or overwritten.

Provider authentication limit: 2/minute; other API calls: 10/second. Tokens are
encrypted in Postgres and reused until the earlier of 90 minutes or the provider
expiry minus a minute. Every provider operation has a tenant-scoped DB lease
(120 seconds), a persisted 60-second cooldown and sequential 150 ms spacing.
Credential changes and disconnect preserve cooldown state. Transient functional
HTTP 429/5xx receive at most two retries with backoff; long Retry-After is surfaced
without retry. Authentication never retries automatically. Requests time out at
8 seconds, and an adapter operation is bounded to 90 seconds. Pagination is capped
at 20 pages; incomplete/repeated pages, oversized responses and invalid schemas
fail the whole operation without committing partial discovery/position telemetry. An unavailable optional
mileage endpoint does not block valid positions; its real sanitized code appears
next to the unavailable distance. Retry-After supports seconds and HTTP dates
and extends the persisted cooldown across subsequent operations.

The individual `/api/device/location` endpoint prohibits polling; it is never
called. There is no timer, cron, background worker, paid service or automatic
polling. Page loads read cached DB snapshots and do not call WanWay.

**Account prerequisites remain unverified until the owner tests their own
account:** API entitlement, commercial licence/quotas, GS900-Wired fields actually
reported, device subscription expiry and any IP whitelist. Public documentation
does not establish this account's terms or list an IP-whitelist contract. Do not
invent these values or contact a provider with credentials. Connection errors
retain actual numeric provider/HTTP codes; untrusted response messages are not
echoed because they may contain secrets. There is no scraping/private-session
fallback.

## Administration and fleet behaviour

Route: `/app/settings/integrations/wanway`, linked from Settings → Integrations.
Every read and mutation resolves the tenant and active ADMIN from the current
session again. Worker, display, mixed and unauthenticated sessions have no
credential/telemetry access. No tenant ID is accepted from the browser.

Save/update, test, manual sync, confirmed manual device/vehicle linking and
disconnect are supported. An empty key keeps the current key only for the same
APPID. Replacing credentials clears discovered devices and bindings. Test
Connection authenticates and discovers devices; it does not set Last Successful
Sync. Manual Sync reads telemetry and updates that timestamp only on success.
Missing optional fields show as unavailable. A failed sync preserves the previous
snapshot/time and records a sanitized failure code. Missing provider devices
become unavailable; retained last positions are explicitly offline/unknown.

The existing Fleet GPS list and vehicle route view show linked WanWay data.
Online means the provider reported stationary/driving at the last sync and both
position and cache are at most 15 minutes old. It is never a claim of a continuous
live feed. Unknown/offline/sleeping status is not shown as online. Coordinates
without a valid report time do not render as a reported fix. Existing ingest GPS
bindings cannot be overwritten. Existing vehicles without GPS are untouched.
The legacy GPS ingest switch continues to govern its existing ingest path;
WanWay is separately configured per tenant.

History is fetched on demand and returned only to the authorized browser's
current view; no route history is persisted or exported. Cached current telemetry
contains one snapshot per discovered device. Disconnect deletes snapshots,
identifiers, bindings and encrypted credentials/tokens. Audit rows retain only
actor/time/action, internal binding IDs and counts; no IMEI, positions or secrets.
Full IMEI and SIM/ICCID are excluded from browser DTOs. Map tiles load only on
explicit map opening and use the application's existing OpenStreetMap provider.
UI languages: Albanian, German, English; Italian/Polish/Romanian currently use the
English integration copy.

## Storage, isolation and secrets

The additive migration introduces `WanwayIntegration` (one per company) and
`WanwayDevice`. Composite foreign/unique keys enforce same-tenant device → machine
ownership and at most one WanWay device per vehicle. Removing a linked vehicle
cascades only its provider cache row; a later discovery can list the device
unlinked. Company deletion cascades its integration and device cache. Existing operational rows,
factory, Workzone, personnel, files and KiDraht are not modified. New tables have
ENABLE + FORCE RLS using the existing transaction-local tenant context. Service
queries also scope by the authenticated company. Advisory transaction locks plus
operation leases serialize configuration, linking and sync across replicas.

API keys and access tokens use AES-256-GCM with random 96-bit IVs, authenticated
tags and tenant/purpose-bound additional data. Credentials from one company or
purpose cannot be decrypted as another. A separate versioned server keyring is
required; missing/invalid/unavailable keys fail closed. There is no fallback to
session secrets, plaintext storage or localStorage. Form keys clear on submit;
the saved key is never returned, even masked. APPID is visible only to admins.

Server-only configuration (unset by default):

- `WANWAY_GPS_ENABLED=true` exposes the optional integration. Demo mode always
  overrides it to disabled; public demo routes never query these tables.
- `WANWAY_ACTIVE_KEY_ID` identifies the active keyring entry.
- `WANWAY_ENCRYPTION_KEYS` is a JSON object from version IDs to independent
  cryptographically random 32-byte keys encoded as 64 hex characters. Generate
  and install only in the authorized environment's secret store; never copy
  values into Git, Drive, screenshots, reports or chat.

Rotation: add the new entry while retaining previous IDs, set it active, then
re-save credentials through the authorized panel. Token writes use the active ID.
Keep old key versions until all affected credentials/tokens have been rewritten
and recovery needs are satisfied. Back up the keyring separately with restricted
access; loss of required versions requires the owner to re-enter credentials.
No existing Railway variables are changed by this PR.

## Privacy and release gates

Vehicle locations can be personal data. The controller must establish purpose,
legal basis, employee notice/access rules, retention, processor arrangements and
any international-transfer requirements before real use. The panel requires an
admin confirmation of that review before saving credentials; this confirmation
is not proof of legal compliance. Reference: Albanian
[Law 124/2024, official IDPC text](https://idp.al/wp-content/uploads/2025/02/ligj-2024-12-19-124-1.pdf).
The pilot's outstanding processing agreement remains outstanding. This PR does
not enable employee tracking, payroll decisions or automatic site presences.
No real location/device data is used in public demos or test fixtures.

Approved rollout completed on 3 November 2026 after explicit owner approval.
PR #28 was merged into the existing pilot branch, without changing the Railway
source. The additive migration succeeded; the final active container at
`32add653c6d3a816e95fad0cc24324c1dfb50dcb` reports no pending migrations.
The independent encryption variables and feature flag are configured, health
returns ok and the private admin setup panel opens ready for owner entry.
No provider credentials or real location data were entered by the agent.
Rollback disables the feature and deploys the prior application revision;
retain additive tables/keyring for recovery rather than dropping data.
No destructive rollback SQL runs automatically. Existing backup and privacy
follow-ups remain open. See [deployment evidence](../EVIDENCE.md).

Owner acceptance sequence: enter APPID/KEY personally → Test Connection → confirm
a GPS mapping to one existing vehicle → Manual Sync → verify position/report time,
offline/stale labels and available metrics → optionally load last-24h history →
check existing Fleet, Workzone, factory and KiDraht. Record the actual provider
code if rejected; never replace a failed real test with mock success.

## Local verification

Unit tests: `npm test -- src/lib/fleet/wanway/adapter.test.ts src/lib/fleet/wanway/crypto.test.ts`.
Integration tests are part of the existing disposable Postgres suite and cover
authorization, mixed identities, tenant-safe binding, composite FK and forced
RLS, encryption/DTO/audit redaction, cache reuse, cooldown/leases, failure atomicity,
unchanged vehicles, privacy gating, transient history, disconnect and demo denial.

Run `npm run test:e2e:wanway:local` to reuse the existing disposable Docker
Postgres/browser runner. The managed webserver generates ephemeral encryption
keys and installs the mock only after checking its isolated DB identity.
Ordinary E2E runs disable WanWay and blank inherited encryption keys.

`tests/fixtures/wanway-fetch-mock.mjs` is an explicit local E2E preload. It refuses
anything except the disposable loopback `baumkalk_e2e/e2e` identity and intercepts
only the documented host. It is never imported by app code. With the mock
preloaded and module/keyring enabled using synthetic secrets, the WanWay browser
test exercises 37 synthetic existing vehicles, save/discovery/manual binding,
offline telemetry, history/map, responsive layout and disconnect without network
calls to WanWay. Real credentials are never required for local tests.

Exact verification results and delivery revision belong in the PR evidence.
Local pass, cloud CI, deployment, provider acceptance and owner acceptance are
separate states. Cloud Actions are opt-in under `docs/LOCAL_CI_POLICY.md` and are
not dispatched for this feature preparation. Existing required job contracts and
branch protections remain intact.
