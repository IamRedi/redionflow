import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * BDF-P1-001: Vitest configuration for integration tests that need a live
 * disposable Postgres. Runners must set `DATABASE_URL` to point at the
 * disposable instance (see `scripts/test-integration-local.ts`).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    exclude: ["node_modules/**"],
    // Integration tests share one Postgres connection across the run and
    // serialise DB writes to keep assertions readable.
    forks: { singleFork: true },
    // BDF-P1-002 completion pass: also serialise test files themselves so
    // two files' `beforeEach` cleanups cannot interleave with the other's
    // in-flight test body.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
