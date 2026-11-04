# Presentation-first delivery — 4 November 2026

PRESENTATION_FIRST_20261104 · Prepared for review; no production mutation.

The owner corrected the earlier launcher design: every primary shortcut opens a
public presentation first. App sign-in follows from there. The earlier approved
packet c2ccfe20f8eb and portfolio PR26 are already published; this is a new,
materially different candidate and does not reuse their publication approval.

## Targets

| Target | Change | Runtime boundary |
| --- | --- | --- |
| Portfolio | Presentation-first links, one RediOnFlow entry, public static-host routing | Current production 0acf249 stays until approval/readback |
| KiDraht/Findbar | Remove top-right duplicate Findbar CTA; replace planned Business Assistant slot with actual KiDraht Assistant and company-pilot status | Accepted runtime bc601f1 + bounded UI/static overlay; do not deploy unrelated source work |
| KiDraht Assistant | Public root → localized information page; real company-code/link form → existing company SPA | No company enumeration, credential collection, DB/env or PIN change |
| RediOnFlow website | Four-language parent presentation; both product websites get admin/worker/demo entrances | Full combined static Cloudflare upload only; no SaaS app deploy |
| Ciao Marina | Real opening cartoon hero/logo, accurate 360°/reader/parent description and future Play status | Existing accepted Family core 1cb7639; no Play upload, schema or household change |
| Opportunity Engine | Native overview/SEO/entry, linked first from portfolio | Static overlay on existing accepted FastAPI/dub1 release only |
| Pulse/Home/Clip/Eye | Public product websites under their own subdomains | Private app core, ports, auth and Tailscale configuration unchanged |

## Evidence and limits

The local browser review covers 32 localized pages at desktop and phone widths.
The public-site contract checks 16 public static pages, localized metadata,
local assets and private links inside owner disclosures. Portfolio required
lint/types/content/build/14 raw-HTML locale checks and GitHub sync are executed
locally on the owner's authorized mini-PC. Assistant checks include real HTTP
root redirects, existing company-SPA preservation and rejection of external
redirect URLs. Per-run technical results are recorded separately; failed or
missing app gates are never labelled PASS by this document.

The owner explicitly confirmed guardian/media rights for the selected Marina
cartoon's public website use. The native Marina PR records exact hero and logo
checksums and the narrow website scope. This does not approve public app access,
new households, Play distribution, paid AI or other family media.

Anonymous production readback, final artwork review, exact-version publication
approval and public hostname assignment remain pending. A local review is not
PRESENTATION_PASS. After publication, update public showcase README/About via
the standing milestone workflow without inventing readiness increases.

## Rebuilding

Public static sites: `node tools/public-presentations/build.mjs .presentation-first --public-only`.
Private review including Marina: use `--marina-assets=<authorized local public asset root>`.
Do not upload the private review's complete source bundle into the public repo.
Only the four network-app information sites belong in `public/app-sites`.
The authoring kit is shared; runtime static assets are copied only to the named
target. Updates must reconcile each target and the directory in the same cycle.
