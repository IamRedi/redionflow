import { describe, expect, it } from "vitest";

import { isValidSignupInvite, signupInviteRequired } from "./signup-invite";

describe("signup invite gate", () => {
  it("keeps signup open when no code is configured", () => {
    expect(signupInviteRequired({})).toBe(false);
    expect(isValidSignupInvite(undefined, {})).toBe(true);
  });

  it("requires the exact configured code", () => {
    const env = { SIGNUP_INVITE_CODE: "pilot-2026" };
    expect(signupInviteRequired(env)).toBe(true);
    expect(isValidSignupInvite("pilot-2026", env)).toBe(true);
    expect(isValidSignupInvite(" pilot-2026 ", env)).toBe(true);
    expect(isValidSignupInvite("pilot-2027", env)).toBe(false);
    expect(isValidSignupInvite("", env)).toBe(false);
    expect(isValidSignupInvite(42, env)).toBe(false);
  });
});
