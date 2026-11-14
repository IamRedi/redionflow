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
| RediOnFlow website | Four-language parent presentation with admin/worker/demo entrances for both products | Static `flow.redioncekrezi.de` host only; existing product websites and SaaS stay unchanged |
| Ciao Marina | Real opening cartoon hero/logo, accurate 360°/reader/parent description and future Play status | Existing accepted Family core 1cb7639; no Play upload, schema or household change |
| Opportunity Engine | Native overview/SEO/entry, linked first from portfolio | Static overlay on existing accepted FastAPI/dub1 release only |
| Pulse/Home/Clip/Eye | Public product websites under their own subdomains | Private app core, ports, auth and Tailscale configuration unchanged |

## Evidence and limits

The local browser review covers 32 localized pages at desktop and phone widths.
The public-site contract checks 20 public static pages, localized metadata,
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
Only the five static product websites belong in `public/app-sites`.
The authoring kit is shared; runtime static assets are copied only to the named
target. Updates must reconcile each target and the directory in the same cycle.

## Existing website preservation

Cloudflare Production cca3cc01-597b-4def-a2f1-8b928ae7b1dd was read back on
4 November. Its newer November-3 source is not replaced by the older local
October-30 archive. The new RediOnFlow parent is hosted as a fifth static
product website on the existing portfolio Vercel project. Both existing
product websites stay at their accepted addresses. Office/Admin, worker PIN
and demo entrances are clearly available for each product on the parent.

## Published receipt — packet76f8b3eac1cf

The parent is live at https://flow.redioncekrezi.de/ in SQ/EN/DE/IT on the existing portfolio Vercel project. Approved portfolio head368e3ac was merged by PR29 as a12ab96 with the same source tree. Anonymous HTTPS, static source/body comparison, API404 isolation, responsive review, Office/Admin, worker/PIN and both demo destinations passed. The existing Cloudflare product websites are retained.

Do not merge this source PR into the Railway-connected pilot as a side effect of website publication. Provider readback also shows main is connected to four demo/reset services; documentation integration belongs with a separately scoped app release. No app source/configuration, schema, seed or SaaS deployment was changed by this website delivery. About now points to the verified public parent; stage/readiness are unchanged.


## Product branding candidate · 8 November 2026

Reciprocal footer links use each product’s actual logo and wordmark in all four locales, with “Për ndërtime çeliku” for BauFlow. Decorative role-card counters are removed; meaningful process numbers remain. Legal links sit immediately above the natural author footer.

Combined package: `deploy/baumdienstflow-bauflow-branding-2026-11-08.zip`
SHA-256: `e185597955dae6259ebad75c549d5ca0a7c97af0c796c8a2c944510c6691c797`. It preserves the previous verified combined bundle and overlays the generated product pages/assets. Never deploy only the BauFlow subtree.

Validation: generator build; ten HTML editions; 250 local image/link targets; reciprocal logos; no decorative role counters; desktop and narrow rendered review. Candidate only, pending merge/publication. Railway and customer records are outside this change.

### Returning-browser correction

Final branding package: `deploy/baumdienstflow-bauflow-branding-cache-2026-11-08.zip`
SHA-256: `ce5517e16f1057875381e1eacd17f5027a20d15dd7108d1d8ada8bd0c714add2`. Supersedes the package above only to add a stylesheet-content-hash URL in ten pages. Runtime inspection found a four-hour browser CSS cache; the hash forces the matching stylesheet for returning visitors, without changing cache policy or infrastructure. Generator and all ten hash references PASS. Same owner-approved branding publication scope.


## BaumdienstFlow public cost/setup release · 14 November 2026

14 November 2026. Owner-approved website source de4b41b was published unchanged to the existing Cloudflare Pages project baumdienstflow: deployment085ac0a7-6e12-4761-b5d1-fa8ce1161a45, success. The four-language copy clarifies quote/setup scope and the public-demo boundary without invented prices or activation deadlines. No main/pilot merge or Railway/app/customer database deployment.

The provider check caught an obsolete archive baseline before upload: candidateb15ee41a3395 was NEVER published. Packaging alone was rebuilt from the actual116-asset deployment, preserving all111othercurrentassets/currentheaders and using the exact approved fiveHTML plus oneCSS. Actual uploaded artifact SHA2565a07df9ed61592417ece1046a4237ab6423f7e0e3b50fbb4168ae85d62d1d565,6057408bytes. All117publishedassets and allfivecustomdomainpages match; previousdeployment2ecc9f5f is retained for rollback.

Frozen engine4904/v2/profilev2/eightDE-SQquestions: native beforee730618c → native liveafter7fd9b0de,5→3cost/setupreviewprompts,10pages/partial. The three root/DE/ENprompts repeat one natural-negation recognition limitation; the model-assisted agent finds the explicit boundary in source. Preserved disagreement,not threeconfirmedbusinessdefects or tuning for zero. Agentanswers2supports/4partial/2unverified→5/1/2. Numericalpricing remainspartial,independentdiscoveryunverified. Known-client case-informed work,not held-out/human/API visibility measurement. Basic12/12checks cover onlytwo rootpages,not wholeGEOscore.

1008historicalevidencefiles and originalrows across32tables,keys/config/financialstate preserved. Three private reportversions parsed/retrieved with alleightquestionIDs,externalprocessing/publicationfalse. Pre/postprivateDBarchives readbackPASS; independentrestoreNOT_RUN. PaidAPI activation/calls0. Public UI readback1280/390and844×390,FAQpointer/Enter,existingtheme/footer/signature passed;physicaldevice/textzoom/fullownerUATNOT_VERIFIED.

Authorized website/client-cycle scope DONE. Future semantic DE/ENcalibration is recorded,not started. Logo/PWAissue194 and concurrentMusterfirma are separate. Showcase/About/portfoliocards/Beta70 remainaccurate: NO_CONTENT_CHANGE for those surfaces;no new clientmedia publication. Technical documentation PRs remain reviewable;deployedsource staysde4b41b.
