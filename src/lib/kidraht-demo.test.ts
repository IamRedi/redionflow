import { describe, expect, it } from "vitest";

import { kidrahtAppUrl, kidrahtBriefingUrl, kidrahtDemoUrl } from "./kidraht-demo";

describe("kidrahtDemoUrl", () => {
  it("defaults to the Musterstadt company in KiDraht", () => {
    expect(kidrahtDemoUrl("baumdienst", {})).toBe("https://kidraht-production-bc4a.up.railway.app/f/baumdienst-musterstadt");
  });
  it("can be switched off or pointed elsewhere, https only", () => {
    expect(kidrahtDemoUrl("baumdienst", { KIDRAHT_DEMO_URL: "off" })).toBeNull();
    expect(kidrahtDemoUrl("baumdienst", { KIDRAHT_DEMO_URL: "https://example.test/f/x/" })).toBe("https://example.test/f/x");
    expect(kidrahtDemoUrl("baumdienst", { KIDRAHT_DEMO_URL: "javascript:alert(1)" })).toBeNull();
    expect(kidrahtDemoUrl("baumdienst", { KIDRAHT_DEMO_URL: "http://evil.test" })).toBeNull();
  });
  it("BauFlow shows it only with its own link", () => {
    expect(kidrahtDemoUrl("bau", {})).toBeNull();
    expect(kidrahtDemoUrl("bau", { KIDRAHT_DEMO_URL: "https://k.test/f/bau" })).toBe("https://k.test/f/bau");
  });
  it("opens the briefings tab", () => {
    expect(kidrahtBriefingUrl("https://k.test/f/a")).toBe("https://k.test/f/a#briefing");
  });
});

describe("kidrahtAppUrl", () => {
  it("is hidden until the company sets its own link", () => {
    expect(kidrahtAppUrl({})).toBeNull();
    expect(kidrahtAppUrl({ KIDRAHT_URL: "https://k.test/f/firma/" })).toBe("https://k.test/f/firma");
    expect(kidrahtAppUrl({ KIDRAHT_URL: "http://evil.test" })).toBeNull();
  });
});
