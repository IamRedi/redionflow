/**
 * Central scanner seam. CONTENT_SCANNER=none (or unset) explicitly uses
 * NoOp: scanned:false and no malware protection. No real adapter is installed.
 * An unsupported configured backend refuses uploads. The EICAR header check
 * is a wiring canary only; it does not scan arbitrary PDF/Office payloads.
 */

import { logger } from "@/lib/observability/logger";

/**
 * Free-form category identifier the scanner returns so a UI or
 * audit log can render a human-friendly label. Kept as a string so a
 * plugged-in scanner can add new categories without a code change
 * here (e.g. `"eicar-test"`, `"macro-office"`, `"clamav-detected"`).
 */
export type MalwareCategory = string;

export type ScanResult =
  | {
      ok: true;
      /** `false` when the current backend is the no-op default. */
      scanned: boolean;
      /** Optional detail from the scanner (e.g. "ClamAV: OK"). */
      note?: string;
    }
  | {
      ok: false;
      scanned: boolean;
      category: MalwareCategory;
      /** Detection signature or scanner detail. Do not surface verbatim to end users. */
      detail: string;
    };

export interface ContentScanner {
  readonly name: string;
  /** True only for the permissive NoOp adapter; inspect ScanResult.scanned for evidence. */
  readonly isNoOp: boolean;
  scan(file: File): Promise<ScanResult>;
}

/**
 * Baseline no-op scanner. Always returns `{ ok: true, scanned: false }`
 * so every upload continues to work exactly as it did before this
 * module existed.
 */
class NoOpScanner implements ContentScanner {
  readonly name = "no-op";
  readonly isNoOp = true;
  async scan(_file: File): Promise<ScanResult> {
    return { ok: true, scanned: false };
  }
}

/**
 * Test-only scanner that rejects the EICAR test string
 * (a standard anti-virus canary). Selected implicitly when the file
 * body contains the EICAR signature so integration tests can prove
 * the rejection path without shipping a real backend.
 */
const EICAR_SIGNATURE = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

/**
 * Resolve the active scanner. Order:
 *   1. If `CONTENT_SCANNER=none` (default), returns the no-op.
 *   2. Any other value is reserved for a future adapter registry.
 *      Unsupported configuration refuses uploads instead of silently skipping scanning.
 */
export function resolveContentScanner(): ContentScanner {
  const configured = String(process.env.CONTENT_SCANNER ?? "").trim().toLowerCase();
  if (configured === "" || configured === "none") return new NoOpScanner();
  logger.warn(
    { event: "content_scan.unknown_backend", configured },
    "CONTENT_SCANNER has no adapter; uploads refused",
  );
  return {
    name: "unsupported", isNoOp: false,
    scan: async () => ({ ok: false, scanned: false, category: "scanner-not-configured", detail: "No scanner adapter is installed." }),
  };
}

/**
 * Facade every upload path can call. It always resolves the scanner
 * on demand so a runtime env change picks up without a restart in
 * the (unusual) case that matters.
 *
 * On refusal, emits `content_scan.refused` and returns the failure
 * shape so the caller can render an operator-safe error. The scanner
 * `detail` field is deliberately excluded from anything a customer
 * sees — it lands in structured logs so support can correlate.
 */
export async function scanFileContent(file: File): Promise<ScanResult> {
  // Fast path for the EICAR canary — accepted in every scanner mode so
  // integration tests can prove the pipeline is wired.
  const head = await file.slice(0, EICAR_SIGNATURE.length).text().catch(() => "");
  if (head === EICAR_SIGNATURE) {
    logger.warn(
      { event: "content_scan.refused", scanner: "eicar-canary", category: "eicar-test", filename: file.name },
      "EICAR test string refused",
    );
    return { ok: false, scanned: true, category: "eicar-test", detail: "eicar signature match" };
  }

  const scanner = resolveContentScanner();
  const result = await scanner.scan(file);
  if (!result.ok) {
    logger.warn(
      { event: "content_scan.refused", scanner: scanner.name, category: result.category, filename: file.name },
      "upload refused by content scanner",
    );
  } else if (result.scanned) {
    logger.info(
      { event: "content_scan.passed", scanner: scanner.name, filename: file.name },
      "upload cleared by content scanner",
    );
  }
  return result;
}
