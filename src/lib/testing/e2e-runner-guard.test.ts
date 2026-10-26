import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);
it.each(["scripts/e2e-local.ts", "scripts/e2e-webserver.ts"])("actual %s rejects external ambient URL before runtime activity", entrypoint => {
  const folder = mkdtempSync(join(tmpdir(), "e2e-target-guard-"));
  const marker = join(folder, "activity");
  // If the guard is removed, these safe sentinels record the attempted spawn;
  // no real Docker, database, migration, build or HTTP call can then occur.
  const sentinel = `#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.E2E_SIDE_EFFECT_MARKER, 'spawned'); process.exit(99);\n`;
  for (const command of ["docker", "npm", "npx"]) writeFileSync(join(folder, command), sentinel, { mode: 0o700 });
  try {
    const result = spawnSync(process.execPath, [require.resolve("tsx/cli"), resolve(entrypoint)], {
      env: { PATH: `${folder}:/usr/bin:/bin`, TMPDIR: folder, NODE_ENV: "test", APP_ENV: "saas", SAAS_MODE: "true",
        PLAYWRIGHT_BASE_URL: "https://example.com", E2E_SIDE_EFFECT_MARKER: marker },
      encoding: "utf8", timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("Unsafe E2E target");
    expect(result.stdout + result.stderr).not.toContain("https://example.com");
    expect(existsSync(marker)).toBe(false);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

const databases: Array<{ label: string; url: string; tenant?: string; rls?: string }> = [
  { label: "remote DB authority", url: "postgresql://postgres:synthetic@remote.example.test:5432/production" },
  { label: "pg host override", url: "postgresql://e2e:synthetic@127.0.0.1:5432/baumkalk_e2e?host=remote.example.test" },
  { label: "runtime role host override with RLS enabled", url: "postgresql://e2e:synthetic@127.0.0.1:5432/baumkalk_e2e",
    tenant: "postgresql://bk_saas_pilot_runtime:synthetic@127.0.0.1:5432/baumkalk_e2e?host=remote.example.test", rls: "true" },
  { label: "runtime role host override with RLS disabled", url: "postgresql://e2e:synthetic@127.0.0.1:5432/baumkalk_e2e",
    tenant: "postgresql://bk_saas_pilot_runtime:synthetic@127.0.0.1:5432/baumkalk_e2e?host=remote.example.test", rls: "false" },
];
it.each(databases)("direct managed server rejects $label before runtime activity", ({ url, tenant, rls }) => {
  const folder = mkdtempSync(join(tmpdir(), "e2e-db-guard-"));
  const marker = join(folder, "activity");
  const sentinel = `#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.E2E_SIDE_EFFECT_MARKER, 'spawned'); process.exit(99);\n`;
  for (const command of ["npm", "npx"]) writeFileSync(join(folder, command), sentinel, { mode: 0o700 });
  try {
    const result = spawnSync(process.execPath, [require.resolve("tsx/cli"), resolve("scripts/e2e-webserver.ts")], {
      env: { PATH: `${folder}:/usr/bin:/bin`, TMPDIR: folder, NODE_ENV: "test",
        PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3100", DATABASE_URL: url, TENANT_DATABASE_URL: tenant,
        RLS_ENFORCE: rls, E2E_SIDE_EFFECT_MARKER: marker },
      encoding: "utf8", timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("Unsafe E2E database");
    expect(result.stdout + result.stderr).not.toContain("remote.example.test");
    expect(result.stdout + result.stderr).not.toContain("Storage mock listening");
    expect(existsSync(marker)).toBe(false);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

it("invalid port selection precedes Docker, migrations and other child activity", () => {
  const folder = mkdtempSync(join(tmpdir(), "e2e-port-guard-"));
  const marker = join(folder, "activity");
  const sentinel = `#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.E2E_SIDE_EFFECT_MARKER, 'spawned'); process.exit(99);\n`;
  for (const command of ["docker", "npm", "npx"]) writeFileSync(join(folder, command), sentinel, { mode: 0o700 });
  try {
    const result = spawnSync(process.execPath, [require.resolve("tsx/cli"), resolve("scripts/e2e-local.ts")], {
      env: { PATH: `${folder}:/usr/bin:/bin`, TMPDIR: folder, NODE_ENV: "test", BAUMKALK_E2E_PORT: "invalid", E2E_SIDE_EFFECT_MARKER: marker },
      encoding: "utf8", timeout: 10_000,
    });
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("Invalid BAUMKALK_E2E_PORT");
    expect(existsSync(marker)).toBe(false);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
