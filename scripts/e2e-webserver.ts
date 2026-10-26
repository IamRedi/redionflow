import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import { assertE2ETestDatabase, DEFAULT_E2E_BASE_URL, isE2EPortFree, validateE2ETarget } from "./lib/e2e-target";

import { createOwnedNextReadiness, OWNED_E2E_READY } from "./lib/e2e-readiness";

const storagePort = Number(process.env.E2E_STORAGE_MOCK_PORT ?? 54321);

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function startStorageMock(key: string) {
  const objects = new Map<string, { contentType: string; body: Buffer }>();

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `127.0.0.1:${storagePort}`}`);
    const publicPrefix = "/storage/v1/object/public/";
    const objectPrefix = "/storage/v1/object/";
    const privatePrefix = "/storage/v1/object/authenticated/";
    const privateBuckets = new Set(["worker-private", "baustelle-private"]);
    const authorized = request.headers.authorization === `Bearer ${key}` && request.headers.apikey === key;
    if (url.pathname.startsWith("/storage/v1/bucket/")) {
      const bucket = url.pathname.slice("/storage/v1/bucket/".length);
      sendJson(response, authorized && privateBuckets.has(bucket) ? 200 : 403, { id: bucket, public: false }); return;
    }
    if (request.method === "POST" && url.pathname.startsWith(objectPrefix) && !authorized) {
      sendJson(response,403,{error:"Unauthorized"});return;
    }
    if (request.method === "GET" && url.pathname.startsWith(privatePrefix)) {
      if (!authorized) { sendJson(response,403,{error:"Unauthorized"});return; }
      const object = objects.get(decodeURIComponent(url.pathname.slice(privatePrefix.length)));
      if (!object) {sendJson(response,404,{error:"Not found"});return;}
      response.writeHead(200,{"Content-Type":object.contentType});response.end(object.body);return;
    }

    if (request.method === "POST" && url.pathname.startsWith(objectPrefix) && !url.pathname.startsWith(`${objectPrefix}remove`) && !url.pathname.startsWith(`${objectPrefix}list/`)) {
      const objectKey = decodeURIComponent(url.pathname.slice(objectPrefix.length));
      const body = await readBody(request);
      objects.set(objectKey, {
        contentType: request.headers["content-type"] ?? "application/octet-stream",
        body,
      });
      sendJson(response, 200, { Key: objectKey });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith(publicPrefix)) {
      const objectKey = decodeURIComponent(url.pathname.slice(publicPrefix.length));
      if (privateBuckets.has(objectKey.split("/")[0])) {sendJson(response,404,{error:"Not found"});return;}
      const object = objects.get(objectKey);
      if (!object) {
        sendJson(response, 404, { error: "Object not found" });
        return;
      }
      response.writeHead(200, { "Content-Type": object.contentType });
      response.end(object.body);
      return;
    }

    if (request.method === "POST" && url.pathname === `${objectPrefix}remove`) {
      const body = await readBody(request).catch(() => Buffer.from("{}"));
      const payload = JSON.parse(body.toString("utf8") || "{}") as { bucketId?: string; prefixes?: string[] };
      for (const prefix of payload.prefixes ?? []) {
        objects.delete(`${payload.bucketId}/${prefix}`);
      }
      sendJson(response, 200, {});
      return;
    }

    if (request.method === "POST" && url.pathname.startsWith(`${objectPrefix}list/`)) {
      sendJson(response, 200, []);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  });

  server.listen(storagePort, "127.0.0.1");
  await once(server, "listening");
  return server;
}

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(command, args, { env, shell: false, stdio: "inherit" });
  return new Promise<number>((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const target = validateE2ETarget(process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_E2E_BASE_URL);
  assertE2ETestDatabase(process.env);
  if (process.env.PORT && Number(process.env.PORT) !== target.port) throw new Error("E2E server port does not match its managed target.");
  if (!Number.isInteger(storagePort) || storagePort < 1 || storagePort > 65535) throw new Error("Invalid local E2E storage port.");
  if (!(await isE2EPortFree(target.port, target.hostname))) throw new Error("Managed E2E port occupied; existing process left untouched.");
  let storageServer: Server | undefined;
  const env: NodeJS.ProcessEnv = { ...process.env,
    // Freeze the validated fallback before dotenv/Next can fill a missing key.
    DIRECT_URL: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    TENANT_DATABASE_URL: process.env.TENANT_DATABASE_URL ?? "",
    SAAS_MODE: "true", APP_ENV: "saas", DEMO_MODE: "false", DEMO_RESET_ALLOWED: "false" };
  // Ephemeral test-only signing key; never inherit a provider key for this mock runner.
  env.SESSION_SIGNING_SECRET = randomBytes(32).toString("hex");

  // BDF-P1-003: SaaS requires a valid salt. Own a fresh test-only value rather
  // than inheriting an operator's durable secret into this managed test app.
  env.LOGIN_GUARD_SALT = randomBytes(32).toString("hex");
  // Blank provider inputs also prevent Next/dotenv from loading local secrets.
  for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "OPENAI_API_KEY",
    "FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "GOOGLE_APPLICATION_CREDENTIALS",
    "GOOGLE_CLOUD_PROJECT", "FIREBASE_CONFIG",
    "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_FIREBASE_VAPID_KEY"]) env[key] = "";

  // This test-only server always owns a local mock, including direct CI startup.
  // Supplied provider URLs/keys cannot suppress it or reach a real bucket.
  {
    env.SUPABASE_URL = `http://127.0.0.1:${storagePort}`;
    env.SUPABASE_SERVICE_ROLE_KEY = randomBytes(32).toString("hex");
    env.SUPABASE_STORAGE_BUCKET_WORKERS = "worker-assets";
    env.SUPABASE_STORAGE_BUCKET_BAUSTELLEN = "baustelle-documents";
    env.SUPABASE_STORAGE_PRIVATE_BUCKET_WORKERS = "worker-private";
    env.SUPABASE_STORAGE_PRIVATE_BUCKET_BAUSTELLEN = "baustelle-private";
    storageServer = await startStorageMock(env.SUPABASE_SERVICE_ROLE_KEY!);
    console.log(`[e2e-webserver] Supabase Storage mock listening on ${env.SUPABASE_URL}`);
  }

  const buildCode = await runCommand("npm", ["run", "build"], env);
  if (buildCode !== 0) {
    storageServer?.close();
    process.exit(buildCode);
  }

  const next = spawn("npx", ["next", "start", "-H", target.hostname, "-p", String(target.port)], {
    env, shell: false, stdio: ["ignore", "pipe", "inherit"],
  });
  const observeReady = createOwnedNextReadiness(() => console.log(OWNED_E2E_READY));
  next.stdout.on("data", chunk => {
    process.stdout.write(chunk);
    observeReady(chunk);
  });
  next.on("error", error => {
    console.error("[e2e-webserver] Next child failed", error);
    storageServer?.close();
    process.exit(1);
  });

  function shutdown() {
    next.kill("SIGTERM");
    storageServer?.close();
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  next.on("exit", (code) => {
    storageServer?.close();
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("[e2e-webserver] failed", error);
  process.exit(1);
});
