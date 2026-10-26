import { expect, test } from "@playwright/test";

/**
 * BDF-P1-002 smoke test.
 *
 * The `/first-boot` endpoint is 404 by default. Enabling the full setup
 * flow requires `FIRST_BOOT_SETUP_ENABLED=true` + `FIRST_BOOT_SETUP_TOKEN`
 * in the deployment environment; the E2E web server does not set them
 * (see `scripts/e2e-webserver.ts` and the CI workflow), so the disabled
 * behaviour is the correct scenario to assert here.
 *
 * Concurrency, gate enforcement, and successful-setup behaviour are
 * covered by the integration suite
 * (`src/lib/auth/first-boot-setup.integration.test.ts`).
 */
test.describe("first-boot smoke", () => {
  test("returns 404 when setup is not enabled", async ({ request }) => {
    const response = await request.get("/first-boot", { failOnStatusCode: false });
    expect(response.status()).toBe(404);
  });
});
