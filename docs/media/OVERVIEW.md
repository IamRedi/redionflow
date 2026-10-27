# RediOnFlow overview films - 27 October 2026

Status: **REVIEW CANDIDATES / DRAFT RELEASE / NOT PUBLISHED**.

The films show the unchanged application at `3a5dda24c1eeba2691cb4114e6fd57040dfff290`. Each version uses its own real language setting, Chrome footage, fictional isolated PostgreSQL data and Azure Neural narration. No application screen is invented or translated by DOM replacement.

## Assets

[Draft media release](https://github.com/IamRedi/redionflow/releases/tag/untagged-707c1ef68d95293886e7) (authorized repository access required). It contains `redionflow-overview-de.mp4`, `redionflow-overview-en.mp4`, two thumbnails, final transcripts, DE/EN SRT and VTT for each film, QA records and the source archive. Large media and raw footage are not committed to Git.

| Film | Duration | Encoded loudness | True peak | SHA-256 |
|---|---:|---:|---:|---|
| DE | 86.57 s | -16.12 LUFS | -1.35 dBTP | `168bb99bc0531e54122b97ba325675961d0941c75bb3afb43d0dc0be32f599c7` |
| EN | 87.87 s | -16.14 LUFS | -1.36 dBTP | `cd4a964f0bcb10ccca22ef53f0235804dd10b882ceead3dca0373d179b731f45` |

Voices: German `de-DE-ConradNeural`; English `en-GB-RyanNeural`. The existing Speech resource was verified as Free/F0 in Germany West Central. Incremental generation cost is estimated at EUR 0 from that tier, not measured from an invoice. No paid resource or subscription was created. No music or third-party stock media is used.

## What was actually verified

- Local production build and both fictional product databases.
- Daily-plan note save and saved table; worker tree completion; pause/resume; work stop and confirmed hours; office daily report; cost-estimate page; BauFlow worksite/task list and inventory.
- Full decode of each delivered video and audio stream, 1920x1080, 30fps, H.264/AAC, yuv420p and MP4 faststart.
- Sentence-based DE/EN subtitle timing, with only one language selected by default.
- One sampled frame per second and full-resolution key frames. This is separate from full-speed human viewing and listening.

## Review limits and product observations

Human listening, naturalness/brand-pronunciation review and full-speed motion review are **not performed** by the agent. Browser playback and technical decode cannot establish those checks.

React hydration error #418 was observed during pre-roll on worksite detail pages. The settled recordings contain no observed page error during their selected action intervals, but this is not a clean-console acceptance of the whole product. The application has partial/legacy wording, and fictional German job/item names remain in the English version. No localization or product-fix project was opened.

The films do not claim active AI, GPS, Stripe, push services, global RLS enforcement, measured savings, customer endorsements or platform completion. See the repository's EVIDENCE.md and SECURITY.md for product boundaries.

## Reproduce and publish

The source ZIP includes the real captures, final sentence WAVs, JSON timelines and FFmpeg scripts. `REPRODUCE.md` in the release documents the cached-audio workflow; no cloud call is needed to re-edit.

Publication requires review of the exact MP4 hashes above, then explicit approval to publish this media release. No app redeploy, Railway/DNS change or merge into main is required or performed. Once approved, publish the existing draft release and update the README entry points to the verified public asset links in one documentation change.
