import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionKind = "admin" | "worker" | "display";
type SessionClaims = { v: 1; kind: SessionKind; id: string; epoch: number; expiresAt: number };
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function signingKey(): string | null {
  const key = process.env.SESSION_SIGNING_SECRET;
  return key && key.length >= 32 ? key : null;
}

/** Bind epoch from the same row snapshot that verified credentials; never reread a newer epoch. */
export async function createSessionCookie(kind: SessionKind, id: string, authenticatedEpoch: number): Promise<string> {
  const key = signingKey();
  if (!key) throw new Error("SESSION_SIGNING_SECRET must contain at least 32 characters.");
  if (!id || !Number.isSafeInteger(authenticatedEpoch) || authenticatedEpoch < 0) throw new Error("Verified account epoch is required.");
  const claims: SessionClaims = { v: 1, kind, id, epoch: authenticatedEpoch, expiresAt: Date.now() + MAX_AGE_MS };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
}

/** Verify before any identity lookup. Missing configuration fails closed. */
export function readSessionCookie(value: string | undefined, kind: SessionKind): SessionClaims | null {
  const key = signingKey();
  if (!key || !value || value.length > 2048) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return null;
  const expected = createHmac("sha256", key).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaims;
    if (claims.v !== 1 || claims.kind !== kind || typeof claims.id !== "string" || !claims.id ||
        !Number.isSafeInteger(claims.epoch) || claims.epoch < 0 ||
        !Number.isSafeInteger(claims.expiresAt) || claims.expiresAt <= Date.now()) return null;
    return claims;
  } catch { return null; }
}
