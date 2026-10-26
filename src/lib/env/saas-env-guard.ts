type EnvMap = Record<string, string | undefined>;

export type SaasEnvValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  skipped: boolean;
};

const REQUIRED_KEYS = [
  "APP_BASE_URL",
  "APP_DOMAIN",
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET_WORKERS",
  "SUPABASE_STORAGE_BUCKET_BAUSTELLEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RLS_ENFORCE",
  "DEMO_MODE",
  "DEMO_RESET_ALLOWED",
] as const;

function read(env: EnvMap, key: string): string {
  return env[key]?.trim() ?? "";
}

function isTrue(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function isFalse(value: string): boolean {
  return ["0", "false", "no", "off"].includes(value.trim().toLowerCase());
}

function hasPlaceholder(value: string): boolean {
  return value.includes("<") || value.includes(">") || value.includes(".example");
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function looksLocal(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
}

function addMissingAndPlaceholderErrors(env: EnvMap, errors: string[]) {
  for (const key of REQUIRED_KEYS) {
    const value = read(env, key);
    if (!value) {
      errors.push(`${key} is required for SaaS test-production.`);
      continue;
    }
    if (hasPlaceholder(value)) {
      errors.push(`${key} still contains a placeholder value.`);
    }
  }
}

function validateHttpsUrl(name: string, value: string, errors: string[]): URL | null {
  const url = parseUrl(value);
  if (!url) {
    errors.push(`${name} must be a valid absolute URL.`);
    return null;
  }
  if (url.protocol !== "https:") {
    errors.push(`${name} must use https in SaaS test-production.`);
  }
  if (looksLocal(url.hostname)) {
    errors.push(`${name} must not point to localhost in SaaS test-production.`);
  }
  return url;
}

function validateDatabaseUrl(name: string, value: string, errors: string[]): URL | null {
  const url = parseUrl(value);
  if (!url) {
    errors.push(`${name} must be a valid PostgreSQL URL.`);
    return null;
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    errors.push(`${name} must use a PostgreSQL connection string.`);
  }
  if (looksLocal(url.hostname)) {
    errors.push(`${name} must not point to localhost in SaaS test-production.`);
  }
  return url;
}

export function validateSaasEnv(env: EnvMap): SaasEnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const saasMode = read(env, "SAAS_MODE");
  const appEnv = read(env, "APP_ENV");
  const isSaasTarget = isTrue(saasMode) || appEnv === "saas";

  if (!isSaasTarget) {
    return { ok: true, errors, warnings, skipped: true };
  }

  if (!isTrue(saasMode)) {
    errors.push("SAAS_MODE must be true for SaaS test-production.");
  }
  if (appEnv !== "saas") {
    errors.push("APP_ENV must be saas for SaaS test-production.");
  }

  addMissingAndPlaceholderErrors(env, errors);

  const appBaseUrl = validateHttpsUrl("APP_BASE_URL", read(env, "APP_BASE_URL"), errors);
  const appDomain = read(env, "APP_DOMAIN");
  if (appDomain) {
    if (appDomain.includes("://") || appDomain.includes("/")) {
      errors.push("APP_DOMAIN must be a hostname only, without protocol or path.");
    }
    if (looksLocal(appDomain)) {
      errors.push("APP_DOMAIN must not be localhost in SaaS test-production.");
    }
  }
  if (appBaseUrl && appDomain && appBaseUrl.hostname !== appDomain) {
    errors.push("APP_DOMAIN must match APP_BASE_URL hostname.");
  }

  const databaseUrl = validateDatabaseUrl("DATABASE_URL", read(env, "DATABASE_URL"), errors);
  const directUrl = validateDatabaseUrl("DIRECT_URL", read(env, "DIRECT_URL"), errors);
  if (databaseUrl) {
    if (databaseUrl.port !== "6543") {
      errors.push("DATABASE_URL must use the Supabase pooled port 6543 for Vercel.");
    }
    if (databaseUrl.searchParams.get("pgbouncer") !== "true") {
      errors.push("DATABASE_URL must include pgbouncer=true.");
    }
    if (databaseUrl.searchParams.get("connection_limit") !== "1") {
      errors.push("DATABASE_URL must include connection_limit=1.");
    }
  }
  if (directUrl) {
    if (directUrl.port !== "5432") {
      errors.push("DIRECT_URL must use the direct Supabase port 5432.");
    }
    if (directUrl.searchParams.get("pgbouncer")) {
      errors.push("DIRECT_URL must not include pgbouncer.");
    }
  }
  if (databaseUrl && directUrl && databaseUrl.href === directUrl.href) {
    errors.push("DATABASE_URL and DIRECT_URL must be different.");
  }

  validateHttpsUrl("SUPABASE_URL", read(env, "SUPABASE_URL"), errors);

  const stripeSecret = read(env, "STRIPE_SECRET_KEY");
  if (stripeSecret && !stripeSecret.startsWith("sk_test_") && !stripeSecret.startsWith("sk_live_")) {
    errors.push("STRIPE_SECRET_KEY must start with sk_test_ or sk_live_.");
  }
  const stripeWebhook = read(env, "STRIPE_WEBHOOK_SECRET");
  if (stripeWebhook && !stripeWebhook.startsWith("whsec_")) {
    errors.push("STRIPE_WEBHOOK_SECRET must start with whsec_.");
  }

  const rlsEnforce = read(env, "RLS_ENFORCE");
  if (rlsEnforce && !isTrue(rlsEnforce) && !isFalse(rlsEnforce)) {
    errors.push("RLS_ENFORCE must be true or false.");
  }
  if (isTrue(read(env, "DEMO_MODE"))) {
    errors.push("DEMO_MODE must be false on SaaS.");
  }
  if (isTrue(read(env, "DEMO_RESET_ALLOWED"))) {
    errors.push("DEMO_RESET_ALLOWED must be false on SaaS.");
  }
  if (read(env, "FLEET_GPS_INGEST_TOKEN")) {
    warnings.push("FLEET_GPS_INGEST_TOKEN should stay empty on SaaS; tenants should use per-company tokens.");
  }

  return { ok: errors.length === 0, errors, warnings, skipped: false };
}
