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


## BauFlow buyer-information candidate ·14November2026

14 November 2026. BauFlow is the software product;AL-Steel is the public user reference. This candidate adds three FAQ and a price/setup enquiry in DE/EN/IT/SQ,without invented charges,packages or activation deadlines. It separates setup/ongoing-use quote scope,aggregate first-contact details and presentation/reference versus real company provisioning. No app,client-company data or existing AL-Steel business-profile change.

Frozen GeoFindbar a8160f1/v3,confirmed BauFlow software profile and eightDE/SQquestions: nativebefore0reviews,but allfiveBauFlow cost/enquiry checks not_applicable. Candidate0reviews with fiveexplicitcost/activation signals. Model-assisted source answers2supports/4partial/2unverified→4/2/2;numericalprice remainspartial,independentdiscoveryunverified. Known-client/source-informed case,not held-out or visibility study. Same-origin crawl includes fiveBaum sibling pages;semantic review uses onlyBauFlow. Both engine limits are retained as real calibration evidence,not retuned during the client cycle.

Provider currentProduction085ac0a7/117assets confirmed in UI;published archive5a07 and accepted117assetproof reused for this exact immutabledeployment,with10freshHTMLbytechecks. Optional repeated pages.dev download returned403;no bypass or claim of117newdownloads. OnlyfiveBauHTML+oneCSS change;112othercurrentassets/headers/Baum/legal/screens/fonts/themeJS/styles remain byte-identical. CandidateZIP6061277bytes,SHA256f1af3512515387b37c46b0baf293d9200dd633660fa7c83018f1bcbeef576844. No publication performed.

Dedicated static generation/syntax/assets and21Chrome baseline/candidate Light/Dark/responsive/locale/FAQkeyboard cases PASS on bounded local executor. Existing materials preserved. Physicaldevice/textzoom/fullownerUATNOT_VERIFIED;appNext/DB suites NOT_RUN for this static-only change. Original1158evidencefiles/original32table rows/keys/config/finances preserved;privatebackupreadbackPASS,independentrestoreNOT_RUN. Two private reportversions parsed/retrieved,all8IDs/noexternalprocessing/publication. PaidAPIactivation/calls0. No dependencies/schema/provider change or Actions.

Exact static Cloudflare publication requires owner approval;then oneactualnativeafter+agentafterreport. Never merge this website branch into Railway-connected main/pilot as a sideeffect. Existing public capability/card/About/maturity statements remainaccurate;technical companion receipts only,no newpublicmedia. Logo/PWAissue194 and concurrentALSteel/Musterfirma work are separate.


## BauFlow static client publication ·14November2026

14 November 2026. Owner-approved static PR196/source c508ed539dfddb1a08c61c7939e5c55b00fa2d21 and artifact f1af3512515387b37c46b0baf293d9200dd633660fa7c83018f1bcbeef576844 are published unchanged to existing CloudflarePagesbaumdienstflow, deployment261bad18-0879-46c6-9997-d2a37f8266d6. All118liveassets/fiveBauFlowpages byte-match;112othercurrentassets/headers/fiveBaum siblingpages unchanged;old085rollbackretained. No main/pilotmerge,Railway/app/ALSteelDBchange or paidAPIactivation/call.

Actual frozen GeoFindbar a816/v3 persistent-worker before/after:0→0reviews,with BauFlowcost checks5not_applicable→5explicit_signal_observed. Same8DE/SQquestions,agent2supports/4partial/2unverified→4/2/2,numericalquote partial/independentdiscovery unverified. Nativeafter0c04bce6,10pages/partial. The missing-topic applicability gap and same-origin fiveBau/fiveBaum sample remain documented real engine limits,not tuned away. This is a known-client source-based test,not visibility uplift or business-completeness proof.

Three private reportversions parsed/retrieved/all8IDs/noexternalpublication. Original1158evidencefiles/original32tablerows/keys/config/finances preserved;only1newsoftwareprofile,2nativeauditjobs and3privateparsejobs added. Originalalsteel.al business profile/history unchanged. Freshpre/postprivatebackuparchive-readbackPASS,independentrestoreNOT_RUN.21previewcases+5freshliveviewportlocale/theme/FAQchecksPASS;physicaldevice/textzoom/fullUATNOT_VERIFIED. Candidatepacket/screenshots retained separately;newlivecaptures labelled accurately.

Authorized client cycleDONE. No dependencies/schema/providerchange,Actions,contactsubmission,actualcompanyprovisioning or automatic successor/schedule. Nativecapabilities/portfolio/About/readinessNO_CONTENT_CHANGE;technical receipts only,no newpublicmedia. Logo/PWA194/Musterfirma/iPhone remainseparate. Publishedsource staysc508ed5;laterdoccommits do not imply another deployment.
