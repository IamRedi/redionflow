# Muster operations release — 16 November 2026

Only these two separately authorized deployments were published:

| Demo | PR / runtime | Railway deployment |
| --- | --- | --- |
| [BauFlow Musterbau](https://bauflow-production-1344.up.railway.app/muster) | [226](https://github.com/IamRedi/redionflow/pull/226) / `d1747094ad14b92c4de32095a33a1f69e553c7a7` | `8ac1b1a4-ebd9-464f-80d9-07422e2397ce` SUCCESS |
| [RheinRuhr Kranservice Muster](https://rheinruhr-kran-muster-production.up.railway.app/muster) | [227](https://github.com/IamRedi/redionflow/pull/227) / `84048b150c427e5e40e4095d19bb53bed8b90cbe` | `ca64dbb3-ea5a-4a5d-9c9c-12c941a34472` SUCCESS |

Each merge tree matches its approved head (`700e907` / `0be7659`). BauFlow was adapted onto its own live baseline, without the crane schema/provisioning delta. No new migration, reseed, data/photo replacement, provider connection, credential copy or manufacturing-setting change was introduced by this UI release. Existing controllers, permissions, repairs, files, custody and stock remain authoritative. Inline routes replace duplicate dialogs only for explicitly enabled Muster identities.

## Acceptance

35 read-only online UI checks passed: 17 BauFlow and 18 crane. Desktop 1440×900 and phone-emulated 390×844, Light/Night; shared navigation, continuous backgrounds, compact cards, search/clear, original equipment details and repair history, restored focus, natural footer, loaded visible photos and denied administrative warehouse access for field workers. No horizontal/redundant outer overflow or console errors in the inspected views. No business mutation commands were submitted.

Prior local verification for the exact approved UI: BauFlow lint/types/build, 1,302 unit tests and 40 Chromium cases; crane lint/types/build, 1,316 unit tests, 543 PostgreSQL integration tests and 39 Chromium cases. These are separate from the 35 fresh online cases. An optional second 78-case online Playwright probe did not start because the bounded executor was occupied: DEFERRED_BUSY, not PASS. Physical phone, camera/NFC and printing are NOT_RUN.

Only two individually rechecked online captures are accepted for this update. Their source/runtime, theme, viewport and SHA-256 receipts are in [the media manifest](assets/screenshots/muster-operations-online.json). Earlier batched screenshots remain diagnostic because SPA paint could lag navigation. Owned browser tabs/capture sessions were closed and temporary viewport changes reset; other users' tabs/jobs were preserved.

## Publication incident and boundaries

The Railway MCP `accept-deploy` approval cancellation persisted after the owner-authorized Railway-only setting change to read actions / ask before writes. Global and other app permissions were unchanged. The owner confirmed the two exact source-only changes in the native Railway dialogs; the subsequent builds reached SUCCESS at the commits above. Publication is resolved; the MCP cancellation's root cause remains unknown. No alternate command bypassed the denied tool action.

Read-only protected snapshots retained AL-Steel deployment `20d913f4-dbf4-42b7-940f-c0f16aa4f9e1` and BaumdienstFlow `53240831-27cb-4988-aed4-cd733ca44ec8`. No other demo, pilot or portfolio Production was changed.

## Presentation assessment

Native /muster entries are live for the separate fictitious companies. The general BauFlow website's existing office/site/warehouse/workshop claims and primary demo destination remain accurate: NO_CONTENT_CHANGE. Existing dated Workzone/office media, portfolio first-page card, directory links, About and stage/readiness remain accurate for this scoped room/navigation repair: NO_CONTENT_CHANGE, no new readiness score.

The existing showcase PR225 receives this release receipt and two current online captures. Existing portfolio PR95 receives a documentation-only release receipt; its previously prepared localized UI and dated images are not changed. These companion PRs remain unmerged candidates. No portfolio Production or native website publication is included. GitHub repository sync passed: 16 public repositories, no missing curated entry. The new delta is documentation/media only; prior candidate UI/build acceptance remains historical rather than being relabeled as a fresh build.
