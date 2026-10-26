import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/saas-config", () => ({ isSaasMode: false }));

import {
  MIN_PASSWORD_LENGTH,
  isAcceptableTokenFormat,
  isValidAdminEmail,
  normalizeAdminEmail,
  readFirstBootSetupConfig,
  validateFirstBootInput,
  verifyToken,
} from "./first-boot-setup";

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...overrides } as NodeJS.ProcessEnv;
}

const HEX64 = "a".repeat(64);
const HEX128 = "b".repeat(128);
const B64URL_43 = "A".repeat(43);
// 42 chars of hex-only content: <64 chars AND <43 chars so it fails both
// entropy floors.
const SHORT_HEX = "0".repeat(42);
// A string that contains a character outside both alphabets (space) so no
// regex matches even after trimming to a substring.
const HAS_INNER_SPACE = "a".repeat(30) + " " + "a".repeat(30);

beforeEach(() => {
  vi.resetModules();
});

describe("isAcceptableTokenFormat", () => {
  it("accepts >=64 hex characters", () => {
    expect(isAcceptableTokenFormat(HEX64)).toBe(true);
    expect(isAcceptableTokenFormat(HEX128)).toBe(true);
  });
  it("accepts >=43 base64url characters", () => {
    expect(isAcceptableTokenFormat(B64URL_43)).toBe(true);
  });
  it("rejects strings below both entropy floors", () => {
    // 42 hex-only chars: also 42 base64url chars → below >=43. Below >=64
    // for the hex-only path too. Fails both.
    expect(isAcceptableTokenFormat(SHORT_HEX)).toBe(false);
  });
  it("rejects a string containing a character outside both alphabets", () => {
    // Inner space is not hex and not in the base64url alphabet, so no
    // regex matches at all.
    expect(isAcceptableTokenFormat(HAS_INNER_SPACE)).toBe(false);
  });
  it("rejects an empty string", () => {
    expect(isAcceptableTokenFormat("")).toBe(false);
  });
});

describe("verifyToken (constant-time)", () => {
  it("returns true when tokens match exactly", () => {
    expect(verifyToken(HEX64, HEX64)).toBe(true);
  });
  it("returns false when tokens differ but have the same length", () => {
    expect(verifyToken("a".repeat(64), "b".repeat(64))).toBe(false);
  });
  it("returns false when lengths differ", () => {
    expect(verifyToken("a".repeat(64), "a".repeat(65))).toBe(false);
  });
  it("returns false when submitted is not a string", () => {
    expect(verifyToken(undefined, HEX64)).toBe(false);
    expect(verifyToken(null, HEX64)).toBe(false);
    expect(verifyToken(123, HEX64)).toBe(false);
    expect(verifyToken({}, HEX64)).toBe(false);
  });
});

describe("readFirstBootSetupConfig", () => {
  it("returns enabled=true when the full gate is satisfied", () => {
    const cfg = readFirstBootSetupConfig(
      envWith({ FIRST_BOOT_SETUP_ENABLED: "true", FIRST_BOOT_SETUP_TOKEN: HEX64 }),
    );
    expect(cfg.enabled).toBe(true);
    if (cfg.enabled) expect(cfg.token).toBe(HEX64);
  });
  it("returns disabled when the flag is missing", () => {
    const cfg = readFirstBootSetupConfig(
      envWith({ FIRST_BOOT_SETUP_ENABLED: undefined, FIRST_BOOT_SETUP_TOKEN: HEX64 }),
    );
    expect(cfg.enabled).toBe(false);
  });
  it("returns disabled when the flag is exactly false", () => {
    const cfg = readFirstBootSetupConfig(
      envWith({ FIRST_BOOT_SETUP_ENABLED: "false", FIRST_BOOT_SETUP_TOKEN: HEX64 }),
    );
    expect(cfg.enabled).toBe(false);
  });
  it("returns disabled when the token is missing", () => {
    const cfg = readFirstBootSetupConfig(
      envWith({ FIRST_BOOT_SETUP_ENABLED: "true" }),
    );
    expect(cfg.enabled).toBe(false);
  });
  it("returns disabled when the token is too short", () => {
    const cfg = readFirstBootSetupConfig(
      envWith({ FIRST_BOOT_SETUP_ENABLED: "true", FIRST_BOOT_SETUP_TOKEN: SHORT_HEX }),
    );
    expect(cfg.enabled).toBe(false);
  });
  it("returns disabled under SaaS mode regardless of env", async () => {
    vi.doMock("@/lib/saas-config", () => ({ isSaasMode: true }));
    const { readFirstBootSetupConfig: readUnderSaas } = await import("./first-boot-setup");
    const cfg = readUnderSaas(
      envWith({ FIRST_BOOT_SETUP_ENABLED: "true", FIRST_BOOT_SETUP_TOKEN: HEX64 }),
    );
    expect(cfg.enabled).toBe(false);
    vi.doUnmock("@/lib/saas-config");
  });
});

describe("normalizeAdminEmail / isValidAdminEmail", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeAdminEmail("  Admin@Example.LOCAL ")).toBe("admin@example.local");
  });
  it("accepts a valid email", () => {
    expect(isValidAdminEmail("dev@example.local")).toBe(true);
  });
  it("rejects an email without @", () => {
    expect(isValidAdminEmail("nope")).toBe(false);
  });
  it("rejects an email without a domain", () => {
    expect(isValidAdminEmail("dev@")).toBe(false);
  });
});

describe("validateFirstBootInput", () => {
  const goodInput = {
    email: "dev@example.local",
    password: "correcthorse-strong",
    confirmation: "correcthorse-strong",
    token: HEX64,
  };
  it("accepts valid input", () => {
    const result = validateFirstBootInput(goodInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.email).toBe("dev@example.local");
      expect(result.password).toBe(goodInput.password);
    }
  });
  it("rejects an invalid email", () => {
    expect(validateFirstBootInput({ ...goodInput, email: "not-an-email" }).ok).toBe(false);
  });
  it("rejects a legacy admin email", () => {
    const r = validateFirstBootInput({ ...goodInput, email: "redi@baumdienst.flow" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("legacy_email");
  });
  it(`rejects a password shorter than ${MIN_PASSWORD_LENGTH}`, () => {
    const r = validateFirstBootInput({ ...goodInput, password: "short", confirmation: "short" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("password_too_short");
  });
  it("rejects a password/confirmation mismatch", () => {
    const r = validateFirstBootInput({ ...goodInput, confirmation: "different-value-12" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("password_mismatch");
  });
  it("rejects a password equal to the token", () => {
    const r = validateFirstBootInput({
      ...goodInput,
      password: HEX64,
      confirmation: HEX64,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("password_equals_token");
  });
  it("rejects a password equal to the email", () => {
    const r = validateFirstBootInput({
      ...goodInput,
      email: "twelvechars@x.local",
      password: "twelvechars@x.local",
      confirmation: "twelvechars@x.local",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("password_equals_email");
  });
  it("rejects the legacy PIN 121985 as password even when it satisfies length checks", () => {
    // The legacy-PIN blocklist runs against the trimmed password before
    // the length check so the specific rejection reason is preserved.
    const r = validateFirstBootInput({
      ...goodInput,
      password: "121985",
      confirmation: "121985",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("password_is_legacy_pin");
  });
});
