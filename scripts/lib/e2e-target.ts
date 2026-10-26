import { createServer } from "node:net";

export const DEFAULT_E2E_BASE_URL = "http://127.0.0.1:3101";

type TargetEnv = { PLAYWRIGHT_BASE_URL?: string; BAUMKALK_E2E_PORT?: string };

export function parseE2EPort(value: string): number {
  if (!/^[0-9]+$/.test(value)) throw new Error("Invalid BAUMKALK_E2E_PORT: integer 1024–65535 required.");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid BAUMKALK_E2E_PORT: integer 1024–65535 required.");
  return port;
}

export function isE2EPortFree(port: number, hostname = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") resolve(false);
      else reject(error);
    });
    server.listen({ port, host: hostname, exclusive: true }, () => server.close(error => error ? reject(error) : resolve(true)));
  });
}

/** Probe before Docker/DB/build side effects. Explicit occupied overrides fail closed.
 * The later exclusive Next bind / Playwright no-reuse guard closes allocation races.
 */
export async function selectManagedE2ETarget(env: TargetEnv) {
  const target = resolveManagedE2ETarget(env);
  const last = env.BAUMKALK_E2E_PORT === undefined ? Math.min(target.port + 99, 65535) : target.port;
  for (let port = target.port; port <= last; port++) {
    if (await isE2EPortFree(port, target.hostname)) return validateE2ETarget(`http://127.0.0.1:${port}`);
  }
  throw new Error("No free managed E2E port; existing processes left untouched.");
}

/** No DNS lookup: only explicit loopback HTTP origins can own a test server. */
export function validateE2ETarget(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Unsafe E2E target: expected a loopback HTTP origin."); }
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    // Never include the supplied URL: it may contain credentials.
    throw new Error("Unsafe E2E target: expected a loopback HTTP origin without credentials.");
  }
  const port = Number(url.port || 80);
  if (port < 1024 || port > 65535) throw new Error("Unsafe E2E target: invalid port.");
  return Object.freeze({ baseURL: url.origin, port, hostname: url.hostname === "[::1]" ? "::1" : url.hostname });
}

/** The disposable runner owns its loopback target; only the dedicated port setting may move it. */
export function resolveManagedE2ETarget(env: TargetEnv) {
  if (env.PLAYWRIGHT_BASE_URL !== undefined) validateE2ETarget(env.PLAYWRIGHT_BASE_URL);
  return validateE2ETarget(env.BAUMKALK_E2E_PORT === undefined ? DEFAULT_E2E_BASE_URL : `http://127.0.0.1:${parseE2EPort(env.BAUMKALK_E2E_PORT)}`);
}

/** A direct managed-server invocation must not attach a local app to a real DB. */
export function assertE2ETestDatabase(env: { DATABASE_URL?: string; DIRECT_URL?: string; TENANT_DATABASE_URL?: string }) {
  function connection(raw: string | undefined, tenant = false) {
    let url: URL;
    try { url = new URL(raw ?? ""); } catch { throw new Error("Unsafe E2E database: disposable loopback database required."); }
    const identity = `${url.pathname}/${url.username}`;
    // pg parses searchParams as connection options: ?host/?user can override
    // the validated authority and SSL options can read caller-supplied files.
    const options = [...url.searchParams];
    const safeOptions = options.length === 0 ||
      (options.length === 1 && options[0][0] === "schema" && options[0][1] === "public");
    if (!["postgres:", "postgresql:"].includes(url.protocol) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !(tenant ? identity === "/baumkalk_e2e/bk_saas_pilot_runtime" :
          ["/baumkalk_e2e/e2e", "/baumkalk_ci/postgres"].includes(identity)) || !safeOptions || url.hash) {
      throw new Error("Unsafe E2E database: disposable loopback database required.");
    }
    return url;
  }
  const system = connection(env.DATABASE_URL);
  connection(env.DIRECT_URL ?? env.DATABASE_URL);
  // Validate even when the flag is off; no inherited URL may reach Next/dotenv.
  if (env.TENANT_DATABASE_URL) {
    const tenant = connection(env.TENANT_DATABASE_URL, true);
    if (tenant.hostname !== system.hostname || tenant.pathname !== system.pathname ||
        Number(tenant.port || 5432) !== Number(system.port || 5432)) {
      throw new Error("Unsafe E2E database: runtime role must use the same disposable database.");
    }
  }
}
