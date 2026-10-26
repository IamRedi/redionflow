/**
 * BDF-P0-002 — Disposable Postgres E2E orchestration.
 *
 * Starts an isolated PostgreSQL 16 container, applies committed Prisma
 * migrations against it, then runs the existing `npm run test:e2e` command
 * (which invokes `scripts/e2e-webserver.ts` → `npm run build` + `next start`
 * → Playwright). The disposable DB is torn down on success, failure, and
 * SIGINT/SIGTERM. The developer's local `baumkalk-db` container and every
 * shared/production database are never touched.
 *
 * This script implements BDF-P0-002. It intentionally does not import
 * Prisma or any application module.
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import { provisionLocalPilotRole } from "./lib/rls-pilot-db";
import { selectManagedE2ETarget } from "./lib/e2e-target";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const POSTGRES_IMAGE = "postgres:16";
const CONTAINER_PREFIX = "baumkalk-e2e";
const DEV_CONTAINER_NAME = "baumkalk-db"; // Never touch this.
const READINESS_TIMEOUT_MS = 60_000;
const READINESS_POLL_MS = 1_000;

const runId = randomBytes(4).toString("hex");
const containerName = `${CONTAINER_PREFIX}-${runId}`;

// Test-only credentials scoped to this run. Never written to disk.
const dbUser = "e2e";
const dbPassword = randomBytes(12).toString("hex");
const dbName = "baumkalk_e2e";

let cleanedUp = false;
let containerStarted = false;
let child: ChildProcess | undefined;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  process.stdout.write(`[e2e-local] ${msg}\n`);
}

function warn(msg: string) {
  process.stderr.write(`[e2e-local] ${msg}\n`);
}

function redactedUrl(port: number) {
  return `postgresql://${dbUser}:***@127.0.0.1:${port}/${dbName}?schema=public`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Safety checks
// ---------------------------------------------------------------------------

function assertNoUnsafeEnv() {
  if (containerName === DEV_CONTAINER_NAME) {
    throw new Error("refusing to reuse the developer container name");
  }
  const rawUrl = process.env.DATABASE_URL;
  if (rawUrl && !rawUrl.includes("127.0.0.1") && !rawUrl.includes("localhost")) {
    // Not fatal: we ignore the parent DATABASE_URL entirely, but warn so the
    // operator knows we are overriding it.
    warn(
      `ignoring inherited DATABASE_URL pointing at a non-loopback host; disposable DB will be created locally.`,
    );
  }
  // Refuse to run under APP_ENV=production or saas without an explicit override.
  const parentAppEnv = process.env.APP_ENV;
  if (parentAppEnv && !["local", "demo", "saas", "test", undefined].includes(parentAppEnv)) {
    throw new Error(`refusing to run with APP_ENV=${parentAppEnv}`);
  }
}

function assertDockerAvailable() {
  const result = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim();
    throw new Error(`Docker is not available. ${stderr || "Is the Docker daemon running?"}`);
  }
  log(`docker server version ${result.stdout.trim()}`);
}

// ---------------------------------------------------------------------------
// Port allocation
// ---------------------------------------------------------------------------

function allocateFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("failed to allocate a free port"));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

// ---------------------------------------------------------------------------
// Container lifecycle
// ---------------------------------------------------------------------------

function startContainer(hostPort: number) {
  const args = [
    "run",
    "-d",
    "--rm",
    "--name",
    containerName,
    "-p",
    `127.0.0.1:${hostPort}:5432`,
    "--tmpfs",
    "/var/lib/postgresql/data:rw",
    "-e",
    `POSTGRES_USER=${dbUser}`,
    "-e",
    `POSTGRES_PASSWORD=${dbPassword}`,
    "-e",
    `POSTGRES_DB=${dbName}`,
    "--health-cmd",
    `pg_isready -U ${dbUser} -d ${dbName}`,
    "--health-interval",
    "2s",
    "--health-timeout",
    "3s",
    "--health-retries",
    "10",
    POSTGRES_IMAGE,
  ];
  const result = spawnSync("docker", args, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`docker run failed: ${(result.stderr ?? "").trim()}`);
  }
  containerStarted = true;
  log(`container ${containerName} started on 127.0.0.1:${hostPort}`);
}

async function waitForReady() {
  const deadline = Date.now() + READINESS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const probe = spawnSync(
      "docker",
      ["exec", containerName, "pg_isready", "-U", dbUser, "-d", dbName],
      { stdio: "ignore" },
    );
    if (probe.status === 0) {
      log("postgres is ready");
      return;
    }
    await sleep(READINESS_POLL_MS);
  }
  throw new Error(`postgres did not become ready within ${READINESS_TIMEOUT_MS} ms`);
}

function cleanupContainerSync() {
  if (cleanedUp || !containerStarted) return;
  cleanedUp = true;
  const inspect = spawnSync("docker", ["ps", "-a", "--format", "{{.Names}}", "--filter", `name=^${containerName}$`], {
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
  });
  if ((inspect.stdout ?? "").trim() !== containerName) {
    return;
  }
  const removed = spawnSync("docker", ["rm", "-f", "-v", containerName], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (removed.status === 0) {
    log(`removed container ${containerName}`);
  } else {
    warn(`failed to remove container ${containerName}: ${(removed.stderr ?? "").trim()}`);
  }
}

// ---------------------------------------------------------------------------
// Child process execution
// ---------------------------------------------------------------------------

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve) => {
    // `detached: true` places the child in a new process group so we can
    // signal every descendant (npm → sh → playwright → tsx → next start …)
    // via `process.kill(-pid, signal)` in the cleanup path. Without this,
    // grandchildren survive SIGINT and leak its managed `next start` listener.
    child = spawn(command, args, { env, shell: false, stdio: "inherit", detached: true });
    child.on("exit", (code, signal) => {
      child = undefined;
      if (signal) {
        resolve(128);
        return;
      }
      resolve(code ?? 1);
    });
    child.on("error", (err) => {
      warn(`child process error: ${err.message}`);
      child = undefined;
      resolve(1);
    });
  });
}

function terminateChild() {
  if (!child || child.exitCode !== null || child.killed || child.pid === undefined) return;
  const pid = child.pid;
  try {
    // Kill the whole process group. Negative pid targets the group.
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  // Escalate to SIGKILL if the group is still alive after 5 s. spawnSync-safe
  // because we do not await this.
  setTimeout(() => {
    if (!child || child.pid === undefined || child.exitCode !== null) return;
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // ignore
    }
  }, 5000).unref();
}

// ---------------------------------------------------------------------------
// Environment plumbing
// ---------------------------------------------------------------------------

function buildChildEnv(hostPort: number, baseURL: string, storagePort: number): NodeJS.ProcessEnv {
  const databaseUrl = `postgresql://${dbUser}:${dbPassword}@127.0.0.1:${hostPort}/${dbName}?schema=public`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Disposable DB — override anything the caller had set.
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    // A stale operator runtime URL must not reach migrations or the app.
    TENANT_DATABASE_URL: "",
    // Mirror the CI E2E execution mode. `npm run test:e2e` also sets these
    // via its script definition, but we pass them explicitly so migrate
    // deploy sees the same tenant-context configuration as the app under test.
    APP_ENV: "saas",
    SAAS_MODE: "true",
    // Never enable destructive demo behaviour from this workflow.
    DEMO_MODE: "false",
    DEMO_RESET_ALLOWED: "false",
    // Preserve optional pilot activation; the CI E2E step explicitly enables it.
    RLS_ENFORCE: process.env.RLS_ENFORCE ?? "false",
    // Playwright / Next.js
    PORT: String(new URL(baseURL).port),
    BAUMKALK_E2E_PORT: new URL(baseURL).port,
    PLAYWRIGHT_BASE_URL: baseURL,
    E2E_STORAGE_MOCK_PORT: String(storagePort),
    // Speed up Next telemetry-off during E2E
    NEXT_TELEMETRY_DISABLED: "1",
    // The managed server always supplies its local mock. Clear inherited
    // values before migrations/test setup as well.
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    SUPABASE_STORAGE_BUCKET_WORKERS: "",
    SUPABASE_STORAGE_BUCKET_BAUSTELLEN: "",
  };
  return env;
}

// ---------------------------------------------------------------------------
// Signal handling
// ---------------------------------------------------------------------------

function installSignalHandlers() {
  const handler = (signal: NodeJS.Signals) => {
    warn(`received ${signal}, cleaning up`);
    terminateChild();
    cleanupContainerSync();
    // Preserve the shell convention exit code (128 + signum) via re-raise.
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
  process.on("SIGHUP", handler);
  process.on("uncaughtException", (err) => {
    warn(`uncaught exception: ${err.stack ?? err.message}`);
    terminateChild();
    cleanupContainerSync();
    process.exit(1);
  });
  // Always attempt cleanup at process exit.
  process.on("exit", () => {
    cleanupContainerSync();
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Must precede Docker probes, DB ports/creation, migrations and child startup.
  const target = await selectManagedE2ETarget(process.env);
  log(`selected managed app target ${target.baseURL}`);
  assertNoUnsafeEnv();
  assertDockerAvailable();
  installSignalHandlers();

  const hostPort = await allocateFreePort();
  log(`allocated host port ${hostPort} for disposable postgres`);
  log(`disposable DATABASE_URL: ${redactedUrl(hostPort)}`);

  startContainer(hostPort);
  await waitForReady();

  const storagePort = await allocateFreePort();
  const env = buildChildEnv(hostPort, target.baseURL, storagePort);

  log("applying prisma migrations");
  const migrateExit = await runCommand("npx", ["prisma", "migrate", "deploy"], env);
  if (migrateExit !== 0) {
    warn(`prisma migrate deploy failed (exit ${migrateExit})`);
    process.exit(migrateExit);
  }

  if (["true", "1", "yes"].includes(String(env.RLS_ENFORCE).toLowerCase())) {
    env.TENANT_DATABASE_URL = await provisionLocalPilotRole(env.DATABASE_URL!);
    env.TENANT_DB_POOL_MAX = "1";
    log("provisioned disposable restricted LOGIN runtime pilot role");
  }

  log("running npm run test:e2e against disposable DB");
  const testExit = await runCommand("npm", ["run", "test:e2e"], env);
  log(`test:e2e exited with code ${testExit}`);
  process.exit(testExit);
}

main().catch((err) => {
  warn(`fatal: ${err instanceof Error ? err.message : String(err)}`);
  terminateChild();
  cleanupContainerSync();
  process.exit(1);
});
