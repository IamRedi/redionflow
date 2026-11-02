import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Optional invite gate for SaaS signup. When `SIGNUP_INVITE_CODE` is set,
 * a new company can only be created with that code; RediOnFlow hands it to
 * pilot customers personally. Unset keeps signup open (original behaviour).
 */
export function signupInviteRequired(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.SIGNUP_INVITE_CODE?.trim());
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function isValidSignupInvite(code: unknown, env: Record<string, string | undefined> = process.env): boolean {
  const expected = env.SIGNUP_INVITE_CODE?.trim();
  if (!expected) return true;
  const given = typeof code === "string" ? code.trim() : "";
  if (!given) return false;
  return timingSafeEqual(digest(given), digest(expected));
}
