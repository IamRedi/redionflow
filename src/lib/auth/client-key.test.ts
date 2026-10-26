import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/saas-config", () => ({ isSaasMode: false }));

import {
  LoginGuardSaltMissingError,
  __resetClientKeyWarnings,
  computeClientKey,
  isAcceptableSaltFormat,
  resolveClientKeySalt,
} from "./client-key";

// Encodings of ≥32 bytes of entropy.
const HEX_64 = "a".repeat(64); // valid hex (32 bytes)
const HEX_128 = "b".repeat(128); // valid hex (64 bytes)
const B64URL_43 = "A".repeat(43); // valid base64url (~32 bytes)
const B64URL_64 = "B".repeat(64); // valid base64url
// A 34-char alphanumeric string that is not a valid encoding of 32 bytes.
// It matches the base64url alphabet but is <43 chars → rejected. Kept
// here so the tests explicitly document that arbitrary length alone is
// not sufficient.
const WEAK_ALPHA_34 = "abcABC012_-".padEnd(34, "x");

beforeEach(() => {
  __resetClientKeyWarnings();
  vi.resetModules();
});

describe("isAcceptableSaltFormat", () => {
  it("accepts >=64 hex chars", () => {
    expect(isAcceptableSaltFormat(HEX_64)).toBe(true);
    expect(isAcceptableSaltFormat(HEX_128)).toBe(true);
  });

  it("accepts >=43 base64url chars", () => {
    expect(isAcceptableSaltFormat(B64URL_43)).toBe(true);
    expect(isAcceptableSaltFormat(B64URL_64)).toBe(true);
  });

  it("rejects hex that is <64 chars (below the 32-byte entropy floor)", () => {
    // 42 hex-only chars: also 42 base64url chars, below both floors.
    expect(isAcceptableSaltFormat("0".repeat(42))).toBe(false);
  });

  it("rejects an arbitrary 32-character alphanumeric string that is not a valid encoding", () => {
    // 32 chars of the base64url alphabet still fail because 32 < 43.
    expect(isAcceptableSaltFormat("A".repeat(32))).toBe(false);
  });

  it("rejects the 34-char mixed alphanumeric marker (documents 'length alone is not enough')", () => {
    expect(isAcceptableSaltFormat(WEAK_ALPHA_34)).toBe(false);
  });

  it("rejects strings with characters outside both alphabets", () => {
    // Space is not hex and not in the base64url alphabet.
    expect(isAcceptableSaltFormat("a".repeat(30) + " " + "a".repeat(30))).toBe(false);
    // A `+` is base64 but NOT base64url (which uses `-`); rejected.
    expect(isAcceptableSaltFormat("A".repeat(42) + "+")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isAcceptableSaltFormat("")).toBe(false);
  });
});

describe("resolveClientKeySalt — permissive local/demo/test envs", () => {
  it("uses LOGIN_GUARD_SALT when it clears the entropy floor (hex form)", () => {
    const salt = resolveClientKeySalt({
      APP_ENV: "local",
      LOGIN_GUARD_SALT: HEX_64,
    } as unknown as NodeJS.ProcessEnv);
    expect(salt).toBe(HEX_64);
  });

  it("uses LOGIN_GUARD_SALT when it clears the entropy floor (base64url form)", () => {
    const salt = resolveClientKeySalt({
      APP_ENV: "local",
      LOGIN_GUARD_SALT: B64URL_43,
    } as unknown as NodeJS.ProcessEnv);
    expect(salt).toBe(B64URL_43);
  });

  it("falls back to a per-process random salt when the salt is missing under APP_ENV=local (and warns once)", async () => {
    // client-key now routes fallback warnings through the structured
    // logger. Rather than reason about module cache invalidation, mock
    // the logger before importing client-key and observe the mocked
    // `warn` call directly.
    vi.resetModules();
    const warnMock = vi.fn();
    vi.doMock("@/lib/observability/logger", () => ({
      logger: { debug: vi.fn(), info: vi.fn(), warn: warnMock, error: vi.fn() },
    }));
    const { resolveClientKeySalt: freshResolve } = await import("./client-key");
    const a = freshResolve({ APP_ENV: "local" } as unknown as NodeJS.ProcessEnv);
    const b = freshResolve({ APP_ENV: "local" } as unknown as NodeJS.ProcessEnv);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(warnMock).toHaveBeenCalledTimes(1);
    const [ctx, message] = warnMock.mock.calls[0];
    expect(ctx?.event).toBe("auth.rate_limiter.salt_fallback");
    // The warning must never leak the salt value.
    expect(String(message)).not.toContain(a);
    vi.doUnmock("@/lib/observability/logger");
  });

  it("accepts APP_ENV=demo as permissive", () => {
    const salt = resolveClientKeySalt({ APP_ENV: "demo" } as unknown as NodeJS.ProcessEnv);
    expect(salt).toMatch(/^[0-9a-f]{64}$/);
  });

  it("accepts APP_ENV=test as permissive", () => {
    const salt = resolveClientKeySalt({ APP_ENV: "test" } as unknown as NodeJS.ProcessEnv);
    expect(salt).toMatch(/^[0-9a-f]{64}$/);
  });

  it("falls back when the configured salt is a weak arbitrary string under permissive env", () => {
    const salt = resolveClientKeySalt({
      APP_ENV: "local",
      LOGIN_GUARD_SALT: WEAK_ALPHA_34,
    } as unknown as NodeJS.ProcessEnv);
    expect(salt).not.toBe(WEAK_ALPHA_34);
    expect(salt).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("resolveClientKeySalt — strict envs", () => {
  it("throws in APP_ENV=production when the salt is missing", () => {
    expect(() =>
      resolveClientKeySalt({ APP_ENV: "production" } as unknown as NodeJS.ProcessEnv),
    ).toThrow(LoginGuardSaltMissingError);
  });

  it("throws in APP_ENV=production when the salt is a 34-char arbitrary string", () => {
    expect(() =>
      resolveClientKeySalt({
        APP_ENV: "production",
        LOGIN_GUARD_SALT: WEAK_ALPHA_34,
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(LoginGuardSaltMissingError);
  });

  it("throws in APP_ENV=production when the salt is only 42 hex chars (below the entropy floor)", () => {
    expect(() =>
      resolveClientKeySalt({
        APP_ENV: "production",
        LOGIN_GUARD_SALT: "0".repeat(42),
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(LoginGuardSaltMissingError);
  });

  it("throws in APP_ENV=saas when the salt is missing", () => {
    expect(() =>
      resolveClientKeySalt({ APP_ENV: "saas" } as unknown as NodeJS.ProcessEnv),
    ).toThrow(LoginGuardSaltMissingError);
  });

  it("throws when APP_ENV is unset", () => {
    // An empty APP_ENV is a misconfiguration in every deployment except a
    // deliberately-local dev shell, so treat it as strict.
    expect(() => resolveClientKeySalt({} as unknown as NodeJS.ProcessEnv)).toThrow(
      LoginGuardSaltMissingError,
    );
  });

  it("throws under SaaS mode even if APP_ENV=local", async () => {
    vi.resetModules();
    vi.doMock("@/lib/saas-config", () => ({ isSaasMode: true }));
    const { resolveClientKeySalt: resolveUnderSaas, LoginGuardSaltMissingError: E } =
      await import("./client-key");
    expect(() =>
      resolveUnderSaas({ APP_ENV: "local" } as unknown as NodeJS.ProcessEnv),
    ).toThrow(E);
    vi.doUnmock("@/lib/saas-config");
    vi.resetModules();
  });

  it("accepts a strong salt (hex) in production", () => {
    const salt = resolveClientKeySalt({
      APP_ENV: "production",
      LOGIN_GUARD_SALT: HEX_64,
    } as unknown as NodeJS.ProcessEnv);
    expect(salt).toBe(HEX_64);
  });

  it("accepts a strong salt (base64url) in production", () => {
    const salt = resolveClientKeySalt({
      APP_ENV: "production",
      LOGIN_GUARD_SALT: B64URL_43,
    } as unknown as NodeJS.ProcessEnv);
    expect(salt).toBe(B64URL_43);
  });

  it("error message never contains the salt value or its length", () => {
    let caught: Error | null = null;
    try {
      resolveClientKeySalt({
        APP_ENV: "production",
        LOGIN_GUARD_SALT: WEAK_ALPHA_34,
      } as unknown as NodeJS.ProcessEnv);
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).toBeInstanceOf(LoginGuardSaltMissingError);
    expect(caught?.message).not.toContain(WEAK_ALPHA_34);
    expect(caught?.message).not.toContain(String(WEAK_ALPHA_34.length));
  });
});

describe("computeClientKey", () => {
  const env = {
    APP_ENV: "local",
    LOGIN_GUARD_SALT: HEX_64,
  } as unknown as NodeJS.ProcessEnv;

  it("returns a 64-char lowercase hex digest", () => {
    const key = computeClientKey("admin", "192.0.2.1", env);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same (scope, ip, salt)", () => {
    const a = computeClientKey("admin", "192.0.2.1", env);
    const b = computeClientKey("admin", "192.0.2.1", env);
    expect(a).toBe(b);
  });

  it("produces the same key across independent store instances using the same salt", () => {
    const first = computeClientKey("admin", "192.0.2.1", env);
    __resetClientKeyWarnings();
    const secondEnv = {
      APP_ENV: "local",
      LOGIN_GUARD_SALT: HEX_64,
    } as unknown as NodeJS.ProcessEnv;
    const second = computeClientKey("admin", "192.0.2.1", secondEnv);
    expect(second).toBe(first);
  });

  it("differs across scopes for the same IP", () => {
    const a = computeClientKey("admin", "192.0.2.1", env);
    const b = computeClientKey("worker", "192.0.2.1", env);
    expect(a).not.toBe(b);
  });

  it("differs across IPs for the same scope", () => {
    const a = computeClientKey("admin", "192.0.2.1", env);
    const b = computeClientKey("admin", "192.0.2.2", env);
    expect(a).not.toBe(b);
  });

  it("differs when the salt is rotated (invalidates every stored bucket)", () => {
    const a = computeClientKey("admin", "192.0.2.1", env);
    const b = computeClientKey("admin", "192.0.2.1", {
      APP_ENV: "local",
      LOGIN_GUARD_SALT: "b".repeat(64),
    } as unknown as NodeJS.ProcessEnv);
    expect(a).not.toBe(b);
  });

  it("never includes the raw IP in the digest string", () => {
    const key = computeClientKey("admin", "203.0.113.42", env);
    expect(key).not.toContain("203.0.113.42");
    expect(key).not.toContain("203");
  });
});
