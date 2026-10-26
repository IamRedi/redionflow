import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * T-026 / BDF-P1-001: password hashing for all interactive credentials
 * (SaaS signup and dedicated admin bootstrap).
 *
 * Storage format: `scrypt$N$salt_hex$hash_hex`
 * - `N` reserved for future cost-parameter changes; currently always `1`.
 * - Salt is 16 bytes.
 * - Hash is 64 bytes (scrypt with N=16384, r=8, p=1).
 *
 * Any `passwordHash` value that is not prefixed with `scrypt$` is legacy
 * plaintext and **must not** authenticate (BDF-P1-001): admin login rejects
 * such rows and requires an operator-driven reset via the first-boot flow
 * (BDF-P1-002).
 */

const SCRYPT_VERSION = "1";
const KEY_LEN = 64;
const SALT_LEN = 16;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_VERSION}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt" || parts[1] !== SCRYPT_VERSION) {
    return false;
  }
  try {
    const salt = Buffer.from(parts[2], "hex");
    const expected = Buffer.from(parts[3], "hex");
    const actual = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function isHashedPassword(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("scrypt$");
}

/**
 * BDF-P1-001: true when a stored value exists but is NOT scrypt-formatted,
 * i.e. it is a legacy plaintext PIN or password. Callers use this to reject
 * such rows on login without leaking whether the account exists.
 */
export function isLegacyPlaintextHash(value: string | null | undefined): boolean {
  return typeof value === "string" && value.length > 0 && !isHashedPassword(value);
}
