import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it.each(["https://example.com", "http://192.168.1.20:3000", "http://user:password@localhost:3000"])("direct config import rejects bypass %s", async value => {
  vi.stubEnv("PLAYWRIGHT_BASE_URL", value);
  vi.resetModules();
  await expect(import("../../../playwright.config")).rejects.toThrow("Unsafe E2E target");
});

it.each(["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"])("direct config always manages local server %s", async value => {
  vi.stubEnv("PLAYWRIGHT_BASE_URL", value);
  vi.resetModules();
  const { default: config } = await import("../../../playwright.config");
  expect(config.use?.baseURL).toBe(value);
  expect(config.webServer).toMatchObject({ reuseExistingServer: false,
    env: { PLAYWRIGHT_BASE_URL: value, PORT: "3000" } });
  const server = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;
  expect(server?.url).toBeUndefined();
  expect(server?.port).toBeUndefined();
  expect(server?.wait?.stdout?.test("[baumkalk-e2e] owned Next listener ready")).toBe(true);
  expect(config.retries).toBe(0);
});
