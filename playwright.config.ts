import { defineConfig, devices } from "@playwright/test";
import { OWNED_E2E_READY_PATTERN } from "./scripts/lib/e2e-readiness";
import { DEFAULT_E2E_BASE_URL, validateE2ETarget } from "./scripts/lib/e2e-target";

// Also guard direct Playwright invocation, before any server or browser starts.
const target = validateE2ETarget(process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_E2E_BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: 0,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: target.baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
        command: "tsx scripts/e2e-webserver.ts",
        env: { PLAYWRIGHT_BASE_URL: target.baseURL, PORT: String(target.port) },
        // No HTTP/port readiness polling: a competitor could otherwise satisfy
        // availability during build before our Next process binds.
        wait: { stdout: OWNED_E2E_READY_PATTERN },
        reuseExistingServer: false,
        timeout: 180_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
