import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/saas-config", () => ({ isSaasMode: false }));

import { resolveDemoDisplayBootstrap } from "./demo-display-bootstrap";

const OK = {
  APP_ENV: "local",
  ALLOW_DEMO_DISPLAY_BOOTSTRAP: "true",
  DEMO_DISPLAY_EMAIL: "display@example.local",
  DEMO_DISPLAY_PASSWORD: "displayhorse",
};

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...overrides } as unknown as NodeJS.ProcessEnv;
}

describe("resolveDemoDisplayBootstrap (BDF-P1-005)", () => {
  it("returns credentials when the full gate is satisfied", () => {
    expect(resolveDemoDisplayBootstrap(envWith(OK))).toEqual({
      email: "display@example.local",
      password: "displayhorse",
    });
  });

  it("accepts APP_ENV=demo", () => {
    expect(resolveDemoDisplayBootstrap(envWith({ ...OK, APP_ENV: "demo" }))).not.toBeNull();
  });

  it("refuses APP_ENV=production", () => {
    expect(
      resolveDemoDisplayBootstrap(envWith({ ...OK, APP_ENV: "production" })),
    ).toBeNull();
  });

  it("refuses APP_ENV=saas", () => {
    expect(resolveDemoDisplayBootstrap(envWith({ ...OK, APP_ENV: "saas" }))).toBeNull();
  });

  it("refuses when the flag is absent", () => {
    expect(
      resolveDemoDisplayBootstrap(
        envWith({ ...OK, ALLOW_DEMO_DISPLAY_BOOTSTRAP: undefined }),
      ),
    ).toBeNull();
  });

  it("refuses when the email is malformed", () => {
    expect(
      resolveDemoDisplayBootstrap(envWith({ ...OK, DEMO_DISPLAY_EMAIL: "no-at" })),
    ).toBeNull();
  });

  it("refuses when the password is shorter than 8 characters", () => {
    expect(
      resolveDemoDisplayBootstrap(envWith({ ...OK, DEMO_DISPLAY_PASSWORD: "short" })),
    ).toBeNull();
  });

  it("does not accept the legacy display PIN 303030 (below 8-char floor)", () => {
    expect(
      resolveDemoDisplayBootstrap(envWith({ ...OK, DEMO_DISPLAY_PASSWORD: "303030" })),
    ).toBeNull();
  });
});

describe("resolveDemoDisplayBootstrap under SaaS mode", () => {
  it("refuses regardless of every other variable", async () => {
    vi.resetModules();
    vi.doMock("@/lib/saas-config", () => ({ isSaasMode: true }));
    const { resolveDemoDisplayBootstrap: resolveUnderSaas } = await import(
      "./demo-display-bootstrap"
    );
    expect(resolveUnderSaas(envWith(OK))).toBeNull();
    vi.doUnmock("@/lib/saas-config");
    vi.resetModules();
  });
});
