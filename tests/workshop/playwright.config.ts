import { defineConfig } from "@playwright/test";

// This suite exercises a shared synthetic database against an explicitly started
// loopback demo. Fixture resets additionally require the exact disposable DB.
// It cannot target the pilot or either public demo.
const baseURL = process.env.WORKSHOP_DEMO_BASE_URL || "http://127.0.0.1:8765";
const target = new URL(baseURL);
if (target.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(target.hostname) || target.username || target.password || target.pathname !== "/") throw new Error("Workshop E2E requires a loopback demo URL.");
export default defineConfig({ testDir: ".", testMatch: "workshop-*.spec.ts", workers: 1, timeout: 180000, expect: { timeout: 10000 }, reporter: "list", outputDir: "../../test-results/workshop", use: { baseURL, browserName: "chromium", viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Berlin", actionTimeout: 15000, navigationTimeout: 60000, trace: "retain-on-failure" } });
