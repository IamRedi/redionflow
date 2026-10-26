# Upload content scanning (BDF-P8-007)

## Layered file-upload defence

BaumdienstFlow protects file uploads at three layers:

| Layer | What it stops | Where |
|-------|---------------|-------|
| **Magic-byte validation** | Wrong-format smuggling — `.pdf` that is actually an `.exe`. | `src/lib/storage/file-validation.ts` (PR #41). |
| **Content scanning** | Malicious content inside a genuine format — an Acrobat exploit inside a real PDF, a live macro inside a DOCX, the EICAR canary. | `src/lib/storage/content-scan.ts` (this PR). |
| **Size ceiling** | Denial-of-service via oversized uploads. | Enforced per caller (`maxSize` in `uploadWorkerAssetAction`, `bodySizeLimit` in `next.config.mjs`). |

## What ships today

`scanFileContent(file)` is called by every upload path that carries
customer content. Under the **default no-op scanner** it does two
things:

1. Rejects the EICAR canary (a standard antivirus test string).
   Confirms the pipeline is wired end-to-end and lets integration
   tests drive rejection without a live backend.
2. Returns `{ ok: true, scanned: false }` for everything else — the
   current behaviour.

Nothing else changes. No new dependency is added. The seam exists.

## Wiring a real scanner

When the operator picks a backend (ClamAV, VirusTotal, S3-native
scan, hosted), the wiring is a single method:

```ts
// src/lib/storage/content-scan.ts
function resolveContentScanner(): ContentScanner {
  if (process.env.CONTENT_SCANNER === "clamav") return new ClamAVScanner();
  // …
}
```

The `ContentScanner` interface is intentionally minimal:

```ts
interface ContentScanner {
  readonly name: string;
  readonly isNoOp: boolean;
  scan(file: File): Promise<ScanResult>;
}
```

Add the new adapter under `src/lib/storage/content-scan-adapters/`
and add the env-key branch to `resolveContentScanner`. Every upload
path benefits automatically.

## What lands in logs

- **Pass through no-op** → nothing (skipped by design; would drown
  aggregators).
- **Pass through a real scanner** → `content_scan.passed`
  (info level) with `scanner`, `filename`.
- **Refusal** → `content_scan.refused` (warn level) with `scanner`,
  `category`, `filename`. The detection detail is NEVER echoed to
  the end user — they see the generic `documentTypeAllowed`
  translation — but is available to support via the log store.

## Coverage today

Wired in:
- `uploadWorkerAssetAction` (worker profile photos + documents)

Not yet wired (still magic-byte-only):
- `baustellen/import/actions.ts` — Excel + KML parsers already
  reject mismatched content on parse; a scanner adds defence in
  depth but isn't the first line.
- `baustellen/actions.ts` document uploads.

Follow-up PR can add `scanFileContent` in front of the remaining
`uploadManagedFile` call sites. The scanner interface is stable so
nothing about the wiring will drift.
