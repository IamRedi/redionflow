import { describe, expect, it } from "vitest";

import { isPublicDemoEnabled } from "./public-demo";

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
