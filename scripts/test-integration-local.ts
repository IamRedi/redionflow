/**
 * BDF-P1-001: run Vitest integration tests against a disposable Postgres 16.
 *
 * Mirrors `scripts/e2e-local.ts` but replaces the `next start` + Playwright
 * step with `vitest run --config vitest.integration.config.ts`. The
 * disposable container, tmpfs storage, credentials, and safety guards are
 * identical.
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import { provisionLocalPilotRole } from "./lib/rls-pilot-db";
import { buildIntegrationChildEnv } from "./lib/integration-env";

const POSTGRES_IMAGE = "postgres:16";
const CONTAINER_PREFIX = "baumkalk-int";
const DEV_CONTAINER_NAME = "baumkalk-db";
const READINESS_TIMEOUT_MS = 60_000;
const READINESS_POLL_MS = 1_000;

const runId = randomBytes(4).toString("hex");
const containerName = `${CONTAINER_PREFIX}-${runId}`;

const dbUser = "int";
const dbPassword = randomBytes(12).toString("hex");
const dbName = "baumkalk_integration";

let cleanedUp = false;
let child: ChildProcess | undefined;

function log(msg: string) {
  process.stdout.write(`[test-integration-local] ${msg}\n`);
}

function warn(msg: string) {
  process.stderr.write(`[test-integration-local] ${msg}\n`);
}

function redactedUrl(port: number) {
  return `postgresql://${dbUser}:***@127.0.0.1:${port}/${dbName}?schema=public`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertDockerAvailable() {
  const result = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Docker is not available. ${(result.stderr ?? "").trim() || "Is the Docker daemon running?"}`);
  }
  log(`docker server version ${result.stdout.trim()}`);
}

function assertNoUnsafeEnv() {
  if (containerName === DEV_CONTAINER_NAME) {
    throw new Error("refusing to reuse the developer container name");
  }
  const parentAppEnv = process.env.APP_ENV;
  if (parentAppEnv && !["local", "demo", "saas", "test", undefined].includes(parentAppEnv)) {
    throw new Error(`refusing to run with APP_ENV=${parentAppEnv}`);
  }
}

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
  if (cleanedUp) return;
  cleanedUp = true;
  const inspect = spawnSync("docker", ["ps", "-a", "--format", "{{.Names}}", "--filter", `name=^${containerName}$`], {
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
  });
  if ((inspect.stdout ?? "").trim() !== containerName) return;
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

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve) => {
    child = spawn(command, args, { env, shell: false, stdio: "inherit", detached: true });
    child.on("exit", (code, signal) => {
      child = undefined;
      resolve(signal ? 128 : code ?? 1);
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
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  setTimeout(() => {
    if (!child || child.pid === undefined || child.exitCode !== null) return;
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // ignore
    }
  }, 5000).unref();
}

function buildChildEnv(hostPort: number): NodeJS.ProcessEnv {
  const databaseUrl = `postgresql://${dbUser}:${dbPassword}@127.0.0.1:${hostPort}/${dbName}?schema=public`;
  return buildIntegrationChildEnv(process.env, databaseUrl);
}

function installSignalHandlers() {
  const handler = (signal: NodeJS.Signals) => {
    warn(`received ${signal}, cleaning up`);
    terminateChild();
    cleanupContainerSync();
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
  process.on("exit", () => cleanupContainerSync());
}

async function main() {
  assertNoUnsafeEnv();
  assertDockerAvailable();
  installSignalHandlers();

  const hostPort = await allocateFreePort();
  log(`allocated host port ${hostPort} for disposable postgres`);
  log(`disposable DATABASE_URL: ${redactedUrl(hostPort)}`);

  startContainer(hostPort);
  await waitForReady();

  const env = buildChildEnv(hostPort);

  log("applying prisma migrations");
  const migrateExit = await runCommand("npx", ["prisma", "migrate", "deploy"], env);
  if (migrateExit !== 0) {
    warn(`prisma migrate deploy failed (exit ${migrateExit})`);
    process.exit(migrateExit);
  }

  env.TENANT_DATABASE_URL = await provisionLocalPilotRole(env.DATABASE_URL!);
  env.TENANT_DB_POOL_MAX = "1";
  log("provisioned disposable restricted LOGIN runtime pilot role");

  log("running vitest integration suite");
  // Delegate to the same `test:integration` npm script that CI uses so the
  // exact command under test never diverges between local and CI.
  const testExit = await runCommand("npm", ["run", "test:integration"], env);
  log(`integration exit ${testExit}`);
  process.exit(testExit);
}

main().catch((err) => {
  warn(`fatal: ${err instanceof Error ? err.message : String(err)}`);
  terminateChild();
  cleanupContainerSync();
  process.exit(1);
});
