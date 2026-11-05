import { describe, expect, it } from "vitest";

import { isBaumdienstWorkshopDemoEnabled, isPublicDemoEnabled } from "./public-demo";

describe("isPublicDemoEnabled", () => {
  it.each([
    [{ APP_ENV: "demo" }, true],
    [{ APP_ENV: "local" }, true],
    [{ APP_ENV: " Demo " }, true],
    [{ APP_ENV: "production" }, false],
    [{ APP_ENV: "saas" }, false],
    [{}, false],
    [{ APP_ENV: "demo", SAAS_MODE: "true" }, false],
  ])("%j -> %s", (env, expected) => {
    expect(isPublicDemoEnabled(env)).toBe(expected);
  });
});

describe("Baumdienst workshop deployment profile", () => {
  it.each([
    ["baumdienst", { APP_ENV: "demo", DEMO_PROFILE: "baumdienst-workshop" }, true],
    ["baumdienst", { APP_ENV: "local", DEMO_PROFILE: "baumdienst-workshop" }, true],
    ["baumdienst", { APP_ENV: "demo" }, false],
    ["baumdienst", { APP_ENV: "demo", DEMO_PROFILE: "other-company" }, false],
    ["bau", { APP_ENV: "demo", DEMO_PROFILE: "baumdienst-workshop" }, false],
    ["personal", { APP_ENV: "demo", DEMO_PROFILE: "baumdienst-workshop" }, false],
    ["baumdienst", { APP_ENV: "saas", DEMO_PROFILE: "baumdienst-workshop" }, false],
    ["baumdienst", { APP_ENV: "production", DEMO_PROFILE: "baumdienst-workshop" }, false],
    ["baumdienst", { APP_ENV: "demo", SAAS_MODE: "true", DEMO_PROFILE: "baumdienst-workshop" }, false],
  ])("%s / %j -> %s", (mode, env, expected) => {
    expect(isBaumdienstWorkshopDemoEnabled(mode, env)).toBe(expected);
  });
});
