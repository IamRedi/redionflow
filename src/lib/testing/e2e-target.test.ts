import { createServer, type AddressInfo } from "node:net";
import { expect, it } from "vitest";
import { parse } from "pg-connection-string";
import { assertE2ETestDatabase, DEFAULT_E2E_BASE_URL, resolveManagedE2ETarget, selectManagedE2ETarget, validateE2ETarget } from "../../../scripts/lib/e2e-target";

it.each(["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"])("allows explicit loopback %s", value => {
  expect(validateE2ETarget(value)).toMatchObject({ baseURL: value, port: 3000 });
});

it.each([
  "https://example.com", "https://app.vercel.app", "https://something.up.railway.app",
  "https://app.supabase.co", "http://8.8.8.8:3000", "http://192.168.1.20:3000",
  "http://10.0.0.2:3000", "http://172.16.0.2:3000", "http://172.31.0.2:3000",
  "http://arbitrary-host:3000", "http://localhost.example.com:3000", "not a URL", "",
  "http://user:password@127.0.0.1:3000", "http://127.0.0.1:3000/path",
  "http://127.0.0.1:3000/?target=remote", "http://127.0.0.1:3000/#fragment",
  "https://127.0.0.1:3000", "http://127.0.0.1:0", "http://127.0.0.1:99999",
])("rejects an unsafe or unsupported target %s", value => {
  expect(() => validateE2ETarget(value)).toThrow("Unsafe E2E target");
});

it("managed runner owns its target even when the caller supplies a safe different port", () => {
  expect(resolveManagedE2ETarget({ PLAYWRIGHT_BASE_URL: "http://localhost:3000" }).baseURL).toBe(DEFAULT_E2E_BASE_URL);
  expect(resolveManagedE2ETarget({}).baseURL).toBe(DEFAULT_E2E_BASE_URL);
  expect(() => resolveManagedE2ETarget({ PLAYWRIGHT_BASE_URL: "https://example.com" })).toThrow("Unsafe E2E target");
});

it.each(["postgresql://e2e:synthetic@127.0.0.1:5432/baumkalk_e2e", "postgresql://postgres:synthetic@localhost:5432/baumkalk_ci"])("allows a disposable DB identity %s", url => {
  expect(() => assertE2ETestDatabase({ DATABASE_URL: url, DIRECT_URL: url })).not.toThrow();
});
it.each([
  undefined, "postgresql://postgres:synthetic@remote.example.test:5432/baumkalk_ci",
  "postgresql://postgres:synthetic@127.0.0.1:5432/production",
])("direct managed server rejects missing/remote/non-test DB %s", url => {
  expect(() => assertE2ETestDatabase({ DATABASE_URL: url })).toThrow("Unsafe E2E database");
});
it("safe DATABASE_URL cannot conceal a remote migration DIRECT_URL", () => {
  expect(() => assertE2ETestDatabase({ DATABASE_URL: "postgresql://e2e:synthetic@127.0.0.1:5432/baumkalk_e2e",
    DIRECT_URL: "postgresql://postgres:synthetic@remote.example.test:5432/production" })).toThrow("Unsafe E2E database");
});

it("real pg parser can override URL authority, but the managed-server guard denies it", () => {
  const url = "postgresql://e2e:synthetic@127.0.0.1:5432/baumkalk_e2e?host=remote.example.test";
  // Actual installed dependency parser; this parses only and never connects.
  expect(parse(url).host).toBe("remote.example.test");
  expect(() => assertE2ETestDatabase({ DATABASE_URL: url })).toThrow("Unsafe E2E database");
});
it.each(["host=remote.example.test", "hostaddr=192.168.1.20", "user=postgres", "database=production",
  "sslcert=sentinel", "sslkey=sentinel", "schema=public&schema=public", "schema=other"])("denies pg option override %s", query => {
  const safe = "postgresql://e2e:synthetic@127.0.0.1:5432/baumkalk_e2e";
  for (const env of [{ DATABASE_URL: `${safe}?${query}` }, { DATABASE_URL: safe, DIRECT_URL: `${safe}?${query}` }]) {
    expect(() => assertE2ETestDatabase(env)).toThrow("Unsafe E2E database");
  }
});
it("accepts only the official public schema option", () => {
  expect(() => assertE2ETestDatabase({ DATABASE_URL: "postgresql://e2e:synthetic@127.0.0.1:5432/baumkalk_e2e?schema=public" })).not.toThrow();
});

const system = "postgresql://e2e:synthetic@127.0.0.1:5432/baumkalk_e2e?schema=public";
const tenant = "postgresql://bk_saas_pilot_runtime:synthetic@127.0.0.1:5432/baumkalk_e2e";
it("accepts the restricted role only on the same disposable database, including a frozen absent URL", () => {
  expect(() => assertE2ETestDatabase({ DATABASE_URL: system, TENANT_DATABASE_URL: `${tenant}?schema=public` })).not.toThrow();
  expect(() => assertE2ETestDatabase({ DATABASE_URL: system, TENANT_DATABASE_URL: "" })).not.toThrow();
});
it.each([
  `${tenant}?host=remote.example.test`, `${tenant}?user=postgres`, `${tenant}?sslkey=sentinel`,
  tenant.replace(":5432/", ":5433/"), tenant.replace("127.0.0.1", "remote.example.test"),
  tenant.replace("bk_saas_pilot_runtime", "postgres"),
])("rejects inherited runtime-role override case %#", value => {
  expect(() => assertE2ETestDatabase({ DATABASE_URL: system, TENANT_DATABASE_URL: value })).toThrow("Unsafe E2E database");
});

it.each(["abc", "", "3101.5", "1e4", " 3101", "1023", "65536", "-1"])("rejects invalid port override %s", async value => {
  await expect(selectManagedE2ETarget({ BAUMKALK_E2E_PORT: value })).rejects.toThrow("Invalid BAUMKALK_E2E_PORT");
});
it("defaults to the dedicated Baumkalk port", () => {
  expect(resolveManagedE2ETarget({})).toMatchObject({ port: 3101, hostname: "127.0.0.1" });
});
it("explicit override changes only port and still rejects external ambient targets", () => {
  expect(resolveManagedE2ETarget({ BAUMKALK_E2E_PORT: "4101", PLAYWRIGHT_BASE_URL: "http://localhost:4000" })).toMatchObject({ port: 4101, hostname: "127.0.0.1" });
  expect(() => resolveManagedE2ETarget({ BAUMKALK_E2E_PORT: "4101", PLAYWRIGHT_BASE_URL: "https://example.com" })).toThrow("Unsafe E2E target");
});
it("skips occupied default without disturbing its listener; occupied explicit override fails", async () => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(3101, "127.0.0.1", resolve); });
  try {
    const target = await selectManagedE2ETarget({});
    expect(target.port).toBeGreaterThan(3101);
    expect(target.port).toBeLessThanOrEqual(3200);
    expect(server.listening).toBe(true);
    await expect(selectManagedE2ETarget({ BAUMKALK_E2E_PORT: "3101" })).rejects.toThrow("existing processes left untouched");
    expect(server.listening).toBe(true);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
it("accepts a free explicit override", async () => {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  expect(await selectManagedE2ETarget({ BAUMKALK_E2E_PORT: String(port) })).toMatchObject({ port, hostname: "127.0.0.1" });
});
