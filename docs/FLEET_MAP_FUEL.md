# Workzone fleet map, fuel receipts and asset photos — 4 November 2026

Prepared over pilot `ea71fde`. On 4 November the owner explicitly authorized
publication after adding camera/upload covers, without repeating the previous
full test suites. Runtime deployment/readback is recorded in the canonical
project status. Real-provider and worker acceptance remain separate
from the local synthetic tests. No real customer data or credentials are fixtures.

## Daily workflow

- GPS setup uses cards: unconfirmed amber devices first, confirmed green devices
  in their own filter. Suggestions still require the boss's explicit confirmation.
  An unmatched device stays unselected; the boss can choose an existing vehicle
  or explicitly create and bind one. Company limits and duplicate plates apply.
- Workzone map mode shows sites and confirmed active company vehicles together.
  BauFlow sites use construction symbols. Popups and vehicle cards open the
  recorded coordinates in Maps, display the original report time and preserve
  offline/stale labels. Refresh is manual and uses the existing provider lease
  and cooldown; viewing a map does not poll the provider.
- Open a vehicle from the Workzone fleet rail; its detail card opens **Add fuel
  receipt** with that vehicle selected. There is no separate floating fuel shortcut.
  The office opens **Fleet → Fuel log** (`/app/machines/fuel`) for all company
  receipts and their details, paged without changing existing records. It reuses
  the authenticated tenant-scoped history and protected receipt-photo endpoint.
  Take/choose a JPG/PNG, read it, check the
  invoice date/time and confirm. Unreadable or conflicting clocks require manual
  entry. The original photo is retained before OCR and unfinished drafts resume.
- Each receipt preserves the server uploader and upload time separately from the
  actual fueler and invoice fueling time. A worker records themself; the office
  can select an active company worker. Optional receipt address, liters and total
  stay with the original document. Older history can be paged without deleting it.

## GPS evidence and limits

The confirmed invoice clock uses the company's timezone (Albania: Europe/Tirane;
Germany: Europe/Berlin). Impossible/future dates and daylight-saving gaps are
rejected; an ambiguous autumn clock needs its explicit UTC offset. OCR preserves
seconds when printed. A corrected OCR guess is marked as manual.

The event lookup requests at most the hour around that fueling time, capped at
now, using the official WanWay history endpoint with `noFilter=1`. Only the
nearest point plus the closest reports before/after the event are retained.
Their original times, signed difference and actual bracketing interval remain
visible; no location is interpolated or backdated. A point more than 15 minutes
away is explicitly unverified. Missing GPS, cooldown and provider failures do not
prevent saving the receipt. Retry retains earlier evidence and pins the original
device, so a replacement GPS cannot rewrite a past receipt from another route.
The current GPS-to-vehicle mapping is the boss's assertion; this feature does not
reconstruct historical installation periods before that mapping was confirmed.

WanWay's documented response provides coordinates, not a verified street address.
The invoice/station address is a separate optional field and Maps opens the actual
GPS point. No private fleet coordinates are sent to a public reverse-geocoder.
The public Nominatim service excludes vehicle-tracking use and confidential data.
Provider history retention/permissions and the accuracy of actual devices still
need real-pilot acceptance.

Sources: [WanWay API contract](https://www.wanwaygps.com/iop-docs/api/iop.json),
[Tesseract command line](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html),
[Nominatim public-service policy](https://operations.osmfoundation.org/policies/nominatim/).

## Storage and access

Vehicle, site and factory covers use a small 32px camera icon with separate
camera and file choices. The company photo replaces the SVG, including detail
and fleet views. Client-side resizing reduces the phone upload; Sharp on the
server validates raster bytes, corrects orientation, removes EXIF/GPS metadata
and stores a single WebP with aspect ratio preserved, at most 1024px / 180 KB.
JPEG/PNG/WebP input is capped at 12 MB and 24 MP. No external image service or
new credentials are required. Unsupported/failed replacements retain the old
photo. Camera input uses the device's native capture support.

`20261104200000_asset_cover_photos` adds a separate private `AssetPhoto` table
with tenant-composite target FKs, exactly-one-target and byte-size checks, and
forced RLS. Common machine/site queries return only the cover timestamp, never
photo bytes. Office roles edit vehicles; field/factory engineers edit the
appropriate site/workshop under existing permissions. Workers can view their
company covers. Every read/write reauthenticates; image responses are
private/no-store/nosniff. Replacing a cover records an audit event and is atomic.
The image bytes are included in the existing PostgreSQL backup.

### Worker profile photos — 7 November 2026

`20261107160000_worker_profile_photos` extends the same private `AssetPhoto`
store with a tenant-composite worker target. Administrators edit their own
company's worker profiles; workers edit only their own photo. Every company
member can read the team's photos through authenticated, private/no-store
responses. Worker IDs from imports are supported without changing those IDs.
The shared camera/file control performs the existing bounded WebP conversion;
the worker URL, photo bytes and audit event commit together. Failed replacements
keep the prior image and return a localized message rather than a page error.
Neither photos nor credentials are sent to an additional provider. Legacy
profile-photo actions delegate to this path as well. Profile document storage
retains its separate managed-file contract; it is not moved by this migration.

`20261104170000_fuel_receipts` adds one table; it does not rewrite existing
vehicles, device bindings or customer projects. Original image bytes and SHA-256
are in PostgreSQL, covered by the existing encrypted database backup. The local
restore test now checks the exact restored receipt bytes. A company/machine
composite FK and forced tenant RLS protect the table. A vehicle with receipts
must be archived instead of hard-deleted; company deletion retains its existing
cascade semantics. Confirmation preserves the original document/identities/time.

Every action reauthenticates and resolves its company on the server. Workers see
receipts they uploaded or for which they are the recorded fueler; office roles see
their company log. Authenticated image responses are private/no-store/nosniff;
anonymous, mixed-session, coworker and other-company reads deny. Only minimal
confirmed current positions reach Workzone; worker history access is limited to
their confirmed receipt's event window, not an arbitrary route/date endpoint.

OCR is native Tesseract in the application image: no paid AI, cloud OCR or new key.
Input is limited to validated JPG/PNG, 8 MB and 20 MP; Linux applies a 256 MiB
address-space cap, 10-second CPU/wall limits and one thread. One database-wide
advisory lock bounds concurrent OCR processes across replicas. Missing/busy OCR
falls back to manual time. Upload requests are idempotent and company-limited.

## Verification and release

On the Windows laptop, Linux WSL / Node22.19.0 / isolated PostgreSQL16:
`npm run lint`, `npm run typecheck`, **559 unit / 301 integration / 28 Chromium**
passed on baseline `962e83d`. This includes real native OCR, forced RLS, exact private image retrieval,
office/worker separation, duplicate vehicle protection, historical GPS windows,
replacement-device protection, DST handling, pagination and encrypted restore.
All new browser images use synthetic companies, people, vehicles and receipts.
External map tiles loaded in the captured map; the tests assert application
markers/links, not the availability or street accuracy of a third-party tile service.
No GitHub Actions were dispatched. Exact commit and image/scan results accompany
the PR; passing local checks does not imply a production release.

Photo addition only: **3 Sharp unit / 4 PostgreSQL integration / 1 Chromium
workflow PASS**, plus build/typecheck, changed-file lint and migration/schema
comparison. These cover real WebP conversion, aspect/orientation, invalid and
oversized input, exact private bytes, failed replacement preservation, role/tenant
isolation, forced-RLS behavior and camera/upload flows for all three asset kinds
at desktop and phone widths. The earlier full suites/Docker/OCR checks were not
repeated, as explicitly requested by the owner. The new RLS probe was corrected
to grant SELECT before testing no-context/foreign/own-tenant visibility; no
production role permissions were changed.

Deployment keeps the existing Railway service, source branch and secret values.
Owner approval now covers PR32 including the photo addition. Merge into the pilot,
verify migration/health/readback, then check one boss-confirmed real
vehicle and a test receipt in the private application. Preserve existing data.
Rollback deploys the prior application revision and retains the additive receipt
and cover tables and stored images; never drop receipt or photo data automatically.

Presentation assessment: the feature PR updates the app-origin landing copy in
all six existing locales. A bounded portfolio PR describes a locally reviewed
candidate in SQ/EN/DE/IT with synthetic media and unchanged Prod/90 maturity.
The existing public product websites/app links and general GitHub About remain
accurate; public-site publication/readback is a separate pending state. No public
claim of a deployed fuel log or real-device acceptance is made by these drafts.
