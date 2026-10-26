import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/saas-config", () => ({ isSaasMode: false }));

import { resolveDemoAdminBootstrap } from "./demo-admin-bootstrap";

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...overrides } as NodeJS.ProcessEnv;
}

const OK = {
  APP_ENV: "local",
  ALLOW_DEMO_ADMIN_BOOTSTRAP: "true",
  DEMO_ADMIN_EMAIL: "dev@example.local",
  DEMO_ADMIN_PASSWORD: "correcthorse",
};

describe("resolveDemoAdminBootstrap (BDF-P1-001)", () => {
  it("returns credentials when the full gate is satisfied", () => {
    const result = resolveDemoAdminBootstrap(envWith(OK));
    expect(result).toEqual({ email: "dev@example.local", password: "correcthorse" });
  });

  it("accepts APP_ENV=demo", () => {
    const result = resolveDemoAdminBootstrap(envWith({ ...OK, APP_ENV: "demo" }));
    expect(result).not.toBeNull();
  });

  it("refuses when APP_ENV=production even with the flag and credentials", () => {
    const result = resolveDemoAdminBootstrap(envWith({ ...OK, APP_ENV: "production" }));
    expect(result).toBeNull();
  });

  it("refuses when APP_ENV=saas even with the flag and credentials", () => {
    const result = resolveDemoAdminBootstrap(envWith({ ...OK, APP_ENV: "saas" }));
    expect(result).toBeNull();
  });

  it("refuses when APP_ENV is unset", () => {
    const result = resolveDemoAdminBootstrap(envWith({ ...OK, APP_ENV: undefined }));
    expect(result).toBeNull();
  });

  it("refuses when the flag is absent", () => {
    const result = resolveDemoAdminBootstrap(envWith({ ...OK, ALLOW_DEMO_ADMIN_BOOTSTRAP: undefined }));
    expect(result).toBeNull();
  });

  it("refuses when the flag is exactly false", () => {
    const result = resolveDemoAdminBootstrap(envWith({ ...OK, ALLOW_DEMO_ADMIN_BOOTSTRAP: "false" }));
    expect(result).toBeNull();
  });

  it("refuses when the email is missing", () => {
    const result = resolveDemoAdminBootstrap(envWith({ ...OK, DEMO_ADMIN_EMAIL: undefined }));
    expect(result).toBeNull();
  });

  it("refuses when the email is malformed (no @)", () => {
    const result = resolveDemoAdminBootstrap(envWith({ ...OK, DEMO_ADMIN_EMAIL: "not-an-email" }));
    expect(result).toBeNull();
  });

  it("refuses when the password is missing", () => {
    const result = resolveDemoAdminBootstrap(envWith({ ...OK, DEMO_ADMIN_PASSWORD: undefined }));
    expect(result).toBeNull();
  });

  it("refuses when the password is shorter than 8 characters", () => {
    const result = resolveDemoAdminBootstrap(envWith({ ...OK, DEMO_ADMIN_PASSWORD: "short" }));
    expect(result).toBeNull();
  });

  it("does not accept the legacy PIN literals as passwords (they are too short)", () => {
    // "654321" and "202020" are 6 chars, below the 8-char minimum, so even
    // if an operator tries to reproduce the legacy PIN via env vars it is
    // rejected before hashing.
    expect(
      resolveDemoAdminBootstrap(envWith({ ...OK, DEMO_ADMIN_PASSWORD: "654321" })),
    ).toBeNull();
    expect(
      resolveDemoAdminBootstrap(envWith({ ...OK, DEMO_ADMIN_PASSWORD: "202020" })),
    ).toBeNull();
  });
});

describe("resolveDemoAdminBootstrap under SaaS mode", () => {
  it("refuses regardless of every other variable when SAAS_MODE is on", async () => {
    // Reload the module with SaaS enabled.
    vi.resetModules();
    vi.doMock("@/lib/saas-config", () => ({ isSaasMode: true }));
    const { resolveDemoAdminBootstrap: resolveUnderSaas } = await import("./demo-admin-bootstrap");
    const result = resolveUnderSaas(envWith(OK));
    expect(result).toBeNull();
    vi.doUnmock("@/lib/saas-config");
    vi.resetModules();
  });
});
