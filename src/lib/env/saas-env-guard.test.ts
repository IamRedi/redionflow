import { describe, expect, it } from "vitest";
import { validateSaasEnv } from "./saas-env-guard";

const validSaasEnv = {
  SAAS_MODE: "true",
  APP_ENV: "saas",
  APP_BASE_URL: "https://app.redionflow.test",
  APP_DOMAIN: "app.redionflow.test",
  DATABASE_URL:
    "postgresql://postgres.abc:secret@aws-0-eu.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1",
  DIRECT_URL: "postgresql://postgres.abc:secret@aws-0-eu.pooler.supabase.com:5432/postgres",
  SUPABASE_URL: "https://abc.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
  SUPABASE_STORAGE_BUCKET_WORKERS: "worker-assets",
  SUPABASE_STORAGE_BUCKET_BAUSTELLEN: "baustelle-documents",
  STRIPE_SECRET_KEY: "sk_test_secret",
  STRIPE_WEBHOOK_SECRET: "whsec_secret",
  RLS_ENFORCE: "false",
  DEMO_MODE: "false",
  DEMO_RESET_ALLOWED: "false",
};

describe("validateSaasEnv", () => {
  it("passes a complete SaaS test-production env", () => {
    const result = validateSaasEnv(validSaasEnv);

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.errors).toEqual([]);
  });

  it("skips dedicated/local envs", () => {
    const result = validateSaasEnv({ SAAS_MODE: "false", APP_ENV: "production" });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it("fails when SaaS mode is incomplete or placeholder based", () => {
    const result = validateSaasEnv({
      ...validSaasEnv,
      SAAS_MODE: "false",
      APP_BASE_URL: "https://app.redionflow.example",
      SUPABASE_SERVICE_ROLE_KEY: "<service-role-key>",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("SAAS_MODE must be true for SaaS test-production.");
    expect(result.errors).toContain("APP_BASE_URL still contains a placeholder value.");
    expect(result.errors).toContain("SUPABASE_SERVICE_ROLE_KEY still contains a placeholder value.");
  });

  it("fails on unsafe database and demo settings", () => {
    const result = validateSaasEnv({
      ...validSaasEnv,
      DATABASE_URL: "postgresql://postgres:secret@localhost:5432/postgres",
      DIRECT_URL:
        "postgresql://postgres.abc:secret@aws-0-eu.pooler.supabase.com:6543/postgres?pgbouncer=true",
      DEMO_MODE: "true",
      DEMO_RESET_ALLOWED: "true",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("DATABASE_URL must not point to localhost in SaaS test-production.");
    expect(result.errors).toContain("DATABASE_URL must use the Supabase pooled port 6543 for Vercel.");
    expect(result.errors).toContain("DIRECT_URL must use the direct Supabase port 5432.");
    expect(result.errors).toContain("DIRECT_URL must not include pgbouncer.");
    expect(result.errors).toContain("DEMO_MODE must be false on SaaS.");
    expect(result.errors).toContain("DEMO_RESET_ALLOWED must be false on SaaS.");
  });
});
