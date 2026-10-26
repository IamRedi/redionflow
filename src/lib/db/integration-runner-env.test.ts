import { afterEach, expect, it, vi } from "vitest";
import { buildIntegrationChildEnv } from "../../../scripts/lib/integration-env";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const parents: NodeJS.ProcessEnv[] = [{ NODE_ENV: "test" }, { NODE_ENV: "test", SAAS_MODE: "false", APP_ENV: "local", TENANT_DATABASE_URL: "postgresql://synthetic@remote.example.test/production" }];
for (const parent of parents) {
  it(`official runner initializes cached SaaS mode with parent ${JSON.stringify(parent)}`, async () => {
    const databaseUrl = "postgresql://int:synthetic@127.0.0.1:5432/baumkalk_integration";
    const child = buildIntegrationChildEnv(parent, databaseUrl);
    vi.stubEnv("SAAS_MODE", child.SAAS_MODE!);
    vi.stubEnv("APP_ENV", child.APP_ENV!);
    vi.resetModules();
    // Real application module initialization, not a mocked SaaS flag.
    const { isSaasMode, requireSaasMode } = await import("../saas-config");
    expect(isSaasMode).toBe(true);
    expect(() => requireSaasMode()).not.toThrow();
    expect(child.APP_ENV).toBe("saas");
    expect(child.DATABASE_URL).toBe(databaseUrl);
    expect(child.DIRECT_URL).toBe(databaseUrl);
    expect(child.TENANT_DATABASE_URL).toBe("");
    expect(child.RLS_ENFORCE).toBe("false");
  });
}
