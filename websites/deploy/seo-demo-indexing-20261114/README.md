# Product identity and demo indexing candidates

**Static pages: tested candidate. Demo patches: configuration tests passed; full application verification pending. `.info`: migration proposal only. Nothing has been published.**

The public pages retain the existing design and the German, Albanian, English and Italian market copy for Germany, especially Essen/NRW, and Albania, especially Tirana. A fifth FAQ explicitly distinguishes BauFlow for construction and steel businesses from BaumdienstFlow for tree care businesses, with separate official product links. Each SoftwareApplication keeps its own ID. `isRelatedTo` expresses a relationship, while `sameAs` points only to that product's verified portfolio page.

Existing links to the two public demos gain `nofollow`; their destination, target and security attributes remain unchanged. This is a crawler hint, not a guarantee of deindexing. Ten HTML files change; the other 109 archive entries, including the sitemap, assets and security headers, remain identical to the approved package.

## Verified topology

- BaumdienstFlow demo: source `71213a3e394ddf8e21b4e9279e7b258b527b1f5d` on its pinned release branch.
- BauFlow demo: source `9d2ead529ed36705753456321ebe2db2cb0321d2` on `main`.
- Neither inspected demo binds `.info` as a custom domain. The historical `cozy-cooperation` project currently lists no services.
- `www.baumdienstflow.info` still points to `j0btby07.up.railway.app`, but ordinary TLS verification fails because the certificate does not match the hostname. No certificate warning was bypassed.
- The inspected Cloudflare account has no `.info` zone. Historical repository records identify it as an earlier demo/test host; current registrar ownership, DNS editing access and old route contracts remain unverified.

Direct public responses confirmed that the BauFlow root and demo pages inherit BaumdienstFlow titles. Both demos lacked an observed `noindex` signal on their root, dashboard and workzone pages. Their robots.txt requests returned 404. These facts do not establish complete indexing coverage or prove the sole cause of Google's answer errors.

## Exact-source application patches

The two `*-exact-source.patch` files are review artifacts. They have **not** been applied to an active application branch. Each changes `next.config.mjs`, root layout/page metadata and adds two small helpers. Only the two exact Railway demo hostnames receive `X-Robots-Tag: noindex, follow` and product-specific demo metadata. The marketing website, `.info`, unknown hosts and private/custom application domains are excluded.

The patches add no redirect and change no login, authentication, roles, records, schema, migration, secret, provider or billing setting. Existing security headers, icons and materials remain intact. The inherited landing-page body is not redesigned. `noindex` controls indexing; it does not provide access control.

Before any application release, apply each patch on an isolated feature branch from its guarded source and run the real repository's required lint, typecheck, unit, integration, build and browser checks with synthetic fixtures. Preserve the backup and release contracts. Do not push directly to `main`, `prod` or `pilot`, or retarget the pinned BaumdienstFlow release. **Those full application gates were not run during this patch preparation.** The configuration tests below do not replace them.

## Validation

- Normal generator output matches all ten candidate HTML files.
- 38 actual Chrome baseline/candidate checks passed: desktop/mobile, four languages, themes, keyboard/pointer FAQ interaction, touch sizing, landscape, typography and materials.
- Current GeoFindbar fixture crawls checked six pages per product before and after, with no new buyer or schema findings. These are isolated fixture tests, not new live native audits.
- Next.js 16.4.3's existing configuration test utility passed 120 host/path cases, preserving prior response status and security headers.
- Fourteen pure metadata cases and syntax checks for six prepared TypeScript files passed.
- Each exact-source patch passed `git apply --check`; all five resulting files matched the prepared candidate byte for byte in disposable fixtures.

No new dependency, paid API, GitHub Actions run or live deployment was used. Physical device, text zoom and full owner UAT remain unverified.

## `.info` migration proposal

`info-migration.draft.json` contains four explicit public-route proposals and no wildcard, private, API or record redirect. Ownership, TLS and route verification are prerequisites for a separately approved provider change. No purchase, renewal, paid plan or new service is authorized.

Original evidence and prior archives remain preserved. This candidate does not prove a Google recrawl, an updated AI answer or improved ranking.
