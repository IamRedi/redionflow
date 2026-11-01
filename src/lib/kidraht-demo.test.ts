import { describe, expect, it } from "vitest";

import { kidrahtBriefingUrl, kidrahtDemoUrl } from "./kidraht-demo";

describe("kidrahtDemoUrl", () => {
  it("defaults to the Musterstadt company in KiDraht", () => {
    expect(kidrahtDemoUrl({})).toBe("https://kidraht-production-bc4a.up.railway.app/f/baumdienst-musterstadt");
  });
  it("can be switched off or pointed elsewhere, https only", () => {
    expect(kidrahtDemoUrl({ KIDRAHT_DEMO_URL: "off" })).toBeNull();
    expect(kidrahtDemoUrl({ KIDRAHT_DEMO_URL: "https://example.test/f/x/" })).toBe("https://example.test/f/x");
    expect(kidrahtDemoUrl({ KIDRAHT_DEMO_URL: "javascript:alert(1)" })).toBeNull();
    expect(kidrahtDemoUrl({ KIDRAHT_DEMO_URL: "http://evil.test" })).toBeNull();
  });
  it("opens the briefings tab", () => {
    expect(kidrahtBriefingUrl("https://k.test/f/a")).toBe("https://k.test/f/a#briefing");
  });
});
