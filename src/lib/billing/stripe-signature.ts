import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * T-027 — Stripe webhook signature verification (manual, no Stripe SDK).
 *
 * Stripe sends a `Stripe-Signature` header of the form
 *   `t=<unix_ts>,v1=<hex_sig>,v1=<hex_sig>,...`
 * where each `v1` is `HMAC_SHA256(secret, "<t>.<raw_body>")`.
 *
 * We accept the request if:
 *   1. The timestamp is within `toleranceSec` of now (default 5 min), AND
 *   2. Any `v1` signature matches our HMAC.
 *
 * See https://stripe.com/docs/webhooks/signatures for the source of truth.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSec = 300,
): boolean {
  if (!signatureHeader || !secret) return false;

  const parts = new Map<string, string[]>();
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=");
    if (!key || value === undefined) continue;
    const bucket = parts.get(key.trim()) ?? [];
    bucket.push(value.trim());
    parts.set(key.trim(), bucket);
  }

  const timestamp = parts.get("t")?.[0];
  const signatures = parts.get("v1") ?? [];
  if (!timestamp || signatures.length === 0) return false;

  const timestampSec = Number(timestamp);
  if (!Number.isFinite(timestampSec)) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > toleranceSec) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest();

  for (const sig of signatures) {
    try {
      const actual = Buffer.from(sig, "hex");
      if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
        return true;
      }
    } catch {
      // fall through and try the next signature entry
    }
  }
  return false;
}
