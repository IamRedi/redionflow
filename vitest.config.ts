import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // BDF-P1-001: integration tests require a live disposable Postgres and
    // are run separately by `npm run test:integration:local`.
    exclude: ["src/**/*.integration.test.ts", "node_modules/**"],
    // BDF-P8-007: silence the structured logger by default in unit tests so
    // migrated call sites don't spam stdout. Individual tests that assert
    // on the logger output override this via env in their own loader.
    env: { BDF_LOGGER_SILENT: "1" },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/calculation/**/*.ts"],
    },
  },
  resolve: {
    // BDF-P1-003: unit tests may reach modules that use the `@/` alias
    // (e.g. `login-attempt-store.ts` imports `@/lib/db/prisma`).
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

