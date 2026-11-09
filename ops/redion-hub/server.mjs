// Redion Hub: one private panel for every platform's assistant signals
// (missing features, bugs, unanswered questions, system errors).
// Node 22 built-ins + web-push; data in SQLite on a volume.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;

export function parsePairs(raw) {
  const out = new Map();
  for (const part of (raw ?? "").split(",")) {
    const at = part.indexOf("=");
    if (at > 0) out.set(part.slice(0, at).trim().toLowerCase(), part.slice(at + 1).trim());
  }
  return out;
}

const DEFAULT_REPOS = "bauflow=IamRedi/redionflow,baumdienstflow=IamRedi/redionflow,kidraht=IamRedi/kidraht-assistant,findbar=IamRedi/findbar";
const KINDS = new Set(["feature", "bug", "question", "error"]);
const STATUSES = new Set(["new", "seen", "agent", "done", "dismissed"]);
const clip = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const equal = (a, b) => {
  const x = createHash("sha256").update(String(a)).digest();
  const y = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(x, y);
};

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, platform TEXT NOT NULL, external_id TEXT NOT NULL,
    company_id TEXT NOT NULL DEFAULT '', company_name TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL, title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '', count INTEGER NOT NULL DEFAULT 1, actor_kind TEXT NOT NULL DEFAULT '', actor_name TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT '', first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
    note TEXT NOT NULL DEFAULT '', result TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, UNIQUE(source, external_id));
  CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, json TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  return db;
}

function setting(db, key, make) {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  if (row) return row.value;
  const value = make();
  db.prepare("INSERT INTO settings(key,value) VALUES(?,?)").run(key, value);
  return value;
}

/** Store or refresh one signal. Returns {id, isNew, reopened}. */
export function upsertSignal(db, source, body, now = new Date().toISOString()) {
  const kind = KINDS.has(body?.kind) ? body.kind : null;
  const title = clip(body?.title, 200);
  const externalId = clip(body?.externalId, 120);
  if (!kind || !title || !externalId) return null;
  const row = {
    platform: clip(body.platform || source, 40), company_id: clip(body.company?.id, 80), company_name: clip(body.company?.name, 120),
    details: clip(body.details, 2000), count: Math.max(1, Math.min(1e6, Number(body.count) || 1)),
    actor_kind: clip(body.actor?.kind, 20), actor_name: clip(body.actor?.name, 120), language: clip(body.language, 8),
    first_seen: clip(body.firstSeenAt, 40) || now, last_seen: clip(body.lastSeenAt, 40) || now,
  };
  const existing = db.prepare("SELECT id, count, status FROM signals WHERE source=? AND external_id=?").get(source, externalId);
  if (!existing) {
    const info = db.prepare(`INSERT INTO signals(source,platform,external_id,company_id,company_name,kind,title,details,count,actor_kind,actor_name,language,first_seen,last_seen,status,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'new',?)`).run(source, row.platform, externalId, row.company_id, row.company_name, kind, title, row.details, row.count, row.actor_kind, row.actor_name, row.language, row.first_seen, row.last_seen, now);
    return { id: Number(info.lastInsertRowid), isNew: true, reopened: false };
  }
  // A repeat of something already handled comes back to "new" (not while an agent works on it).
  const reopened = row.count > existing.count && ["seen", "done", "dismissed"].includes(existing.status);
  db.prepare(`UPDATE signals SET platform=?, company_name=?, title=?, details=CASE WHEN ?<>'' THEN ? ELSE details END, count=MAX(count,?), last_seen=?,
    status=CASE WHEN ? THEN 'new' ELSE status END, updated_at=? WHERE id=?`)
    .run(row.platform, row.company_name, title, row.details, row.details, row.count, row.last_seen, reopened ? 1 : 0, now, existing.id);
  return { id: existing.id, isNew: false, reopened };
}

export function agentPrompt(signal, repos) {
  const repo = repos.get(signal.platform.toLowerCase()) ?? repos.get(signal.source) ?? "(repo: ask Redi)";
  const type = { feature: "Feature request from a customer", bug: "Bug reported by a user", question: "Question the in-app guide could not answer", error: "System error seen by the assistant" }[signal.kind];
  return [
    `Repository: ${repo} (platform ${signal.platform})`,
    `${type}: ${signal.title}`,
    signal.details ? `Details: ${signal.details}` : "",
    `Customer: ${signal.company_name || "-"} · reported by ${signal.actor_kind || "-"} · seen ${signal.count}x, first ${signal.first_seen.slice(0, 10)}, last ${signal.last_seen.slice(0, 10)}`,
    signal.note ? `Redi's instruction: ${signal.note}` : "",
    "",
    signal.kind === "question"
      ? "Task: if the app already does this, add the answer to the assistant's platform guide; if not, propose the smallest feature."
      : signal.kind === "error" ? "Task: find the root cause in the code and fix it with a test." : "Task: implement or fix it the smallest clean way, with tests.",
    "Follow the repo's rules (AGENTS.md / CLAUDE.md). One small PR. No customer data in the repository. Report back what changed.",
  ].filter(line => line !== "").join("\n");
}

function sessionToken(secret, ttlMs = 30 * 24 * 3600 * 1000) {
  const exp = String(Date.now() + ttlMs);
  return `${exp}.${createHmac("sha256", secret).update(`redi:${exp}`).digest("base64url")}`;
}
function validSession(secret, token) {
  const [exp, mac] = String(token ?? "").split(".");
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  return equal(mac, createHmac("sha256", secret).update(`redi:${exp}`).digest("base64url"));
}
const cookies = header => Object.fromEntries(String(header ?? "").split(";").map(c => c.trim().split("=")).filter(([k]) => k).map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]));

async function readJson(req, max = 32 * 1024) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > max) throw Object.assign(new Error("too large"), { status: 413 }); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { throw Object.assign(new Error("bad json"), { status: 400 }); }
}

const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"], "/manifest.webmanifest": ["manifest.webmanifest", "application/manifest+json"],
  "/sw.js": ["sw.js", "text/javascript; charset=utf-8"], "/icon.svg": ["icon.svg", "image/svg+xml"],
  "/icon-192.png": ["icon-192.png", "image/png"], "/icon-512.png": ["icon-512.png", "image/png"],
};

export function createHub(options = {}) {
  const dataDir = options.dataDir ?? env.HUB_DATA_DIR ?? "/data";
  mkdirSync(dataDir, { recursive: true });
  const db = options.db ?? openDb(path.join(dataDir, "hub.sqlite"));
  const password = options.password ?? env.HUB_PASSWORD ?? "";
  const platformKeys = parsePairs(options.platformKeys ?? env.HUB_PLATFORM_KEYS); // source=key
  const agentKey = options.agentKey ?? env.HUB_AGENT_KEY ?? "";
  const repos = parsePairs(`${DEFAULT_REPOS},${options.repos ?? env.HUB_REPOS ?? ""}`);
  const secret = setting(db, "session_secret", () => randomBytes(32).toString("base64url"));
  const vapid = JSON.parse(setting(db, "vapid", () => JSON.stringify(webpush.generateVAPIDKeys())));
  webpush.setVapidDetails(env.HUB_PUSH_CONTACT ?? "mailto:hub@redioncekrezi.de", vapid.publicKey, vapid.privateKey);
  const sendPush = options.sendPush ?? ((sub, payload) => webpush.sendNotification(sub, payload, { TTL: 86400 }));
  const failedLogins = new Map();

  async function notify(signal) {
    const label = { feature: "Kërkesë e re", bug: "Gabim i raportuar", question: "Pyetje pa përgjigje", error: "Gabim sistemi" }[signal.kind];
    const payload = JSON.stringify({ title: `${label} · ${signal.platform}`, body: `${signal.company_name ? `${signal.company_name}: ` : ""}${signal.title}`, url: `/#s${signal.id}` });
    for (const row of db.prepare("SELECT endpoint, json FROM push_subs").all()) {
      try { await sendPush(JSON.parse(row.json), payload); }
      catch (error) { if ([404, 410].includes(error?.statusCode)) db.prepare("DELETE FROM push_subs WHERE endpoint=?").run(row.endpoint); }
    }
  }

  const send = (res, status, body, headers = {}) => {
    const json = typeof body === "string" ? body : JSON.stringify(body);
    res.writeHead(status, { "content-type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers });
    res.end(json);
  };
  const bearer = req => String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const isPanel = req => validSession(secret, cookies(req.headers.cookie).hub_session);
  const sameOrigin = req => !req.headers.origin || new URL(req.headers.origin).host === req.headers.host;

  async function handle(req, res) {
    const url = new URL(req.url, "http://hub");
    const { pathname } = url;
    if (req.method === "GET" && pathname === "/healthz") return send(res, 200, { ok: true });
    if (req.method === "GET" && STATIC[pathname]) {
      const [file, type] = STATIC[pathname];
      res.writeHead(200, { "content-type": type, "cache-control": pathname === "/" || pathname === "/sw.js" ? "no-cache" : "public, max-age=86400", "x-frame-options": "DENY", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" });
      return res.end(readFileSync(path.join(here, "public", file)));
    }

    // Platforms send signals here.
    if (pathname === "/api/signals" && req.method === "POST") {
      const token = bearer(req);
      const source = [...platformKeys].find(([, key]) => key && equal(key, token))?.[0];
      if (!source) return send(res, 401, { error: "unauthorized" });
      const result = upsertSignal(db, source, await readJson(req));
      if (!result) return send(res, 400, { error: "kind, title and externalId are required" });
      if (result.isNew || result.reopened) void notify(db.prepare("SELECT * FROM signals WHERE id=?").get(result.id)).catch(() => {});
      return send(res, 200, { ok: true, id: result.id });
    }

    // Agents (Claude/Codex) read tasks Redi sent to them.
    if (pathname.startsWith("/api/agent/")) {
      if (!agentKey || !equal(agentKey, bearer(req))) return send(res, 401, { error: "unauthorized" });
      if (req.method === "GET" && pathname === "/api/agent/tasks") {
        const tasks = db.prepare("SELECT * FROM signals WHERE status='agent' ORDER BY updated_at").all().map(s => ({ id: s.id, platform: s.platform, kind: s.kind, title: s.title, prompt: agentPrompt(s, repos) }));
        return send(res, 200, { tasks });
      }
      const done = /^\/api\/agent\/tasks\/(\d+)\/done$/.exec(pathname);
      if (req.method === "POST" && done) {
        const body = await readJson(req);
        const info = db.prepare("UPDATE signals SET status='done', result=?, updated_at=? WHERE id=? AND status='agent'").run(clip(body.result, 2000), new Date().toISOString(), Number(done[1]));
        return send(res, info.changes ? 200 : 404, { ok: Boolean(info.changes) });
      }
      return send(res, 404, { error: "not found" });
    }

    // Redi's panel.
    if (pathname === "/api/login" && req.method === "POST") {
      const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();
      const fails = failedLogins.get(ip) ?? { n: 0, until: 0 };
      if (fails.until > Date.now()) return send(res, 429, { error: "Prit pak dhe provo përsëri." });
      const body = await readJson(req, 4096);
      if (!password || !sameOrigin(req) || !equal(password, String(body.password ?? ""))) {
        fails.n += 1; if (fails.n >= 5) { fails.until = Date.now() + 10 * 60_000; fails.n = 0; } failedLogins.set(ip, fails);
        return send(res, 401, { error: "Fjalëkalim i gabuar." });
      }
      failedLogins.delete(ip);
      return send(res, 200, { ok: true }, { "set-cookie": `hub_session=${sessionToken(secret)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000` });
    }
    if (pathname.startsWith("/api/panel/")) {
      if (!isPanel(req)) return send(res, 401, { error: "login" });
      if (req.method !== "GET" && !sameOrigin(req)) return send(res, 403, { error: "origin" });
      if (req.method === "GET" && pathname === "/api/panel/signals") {
        const status = url.searchParams.get("status") ?? "open";
        const rows = status === "open"
          ? db.prepare("SELECT * FROM signals WHERE status IN ('new','seen') ORDER BY status='new' DESC, last_seen DESC LIMIT 300").all()
          : db.prepare("SELECT * FROM signals WHERE status=? ORDER BY updated_at DESC LIMIT 300").all(STATUSES.has(status) ? status : "new");
        const counts = Object.fromEntries(db.prepare("SELECT status, COUNT(*) n FROM signals GROUP BY status").all().map(r => [r.status, r.n]));
        return send(res, 200, { signals: rows.map(s => ({ ...s, prompt: agentPrompt(s, repos) })), counts, pushKey: vapid.publicKey });
      }
      const one = /^\/api\/panel\/signals\/(\d+)$/.exec(pathname);
      if (req.method === "POST" && one) {
        const body = await readJson(req);
        const status = STATUSES.has(body.status) ? body.status : null;
        const note = body.note === undefined ? null : clip(body.note, 2000);
        const info = db.prepare("UPDATE signals SET status=COALESCE(?,status), note=COALESCE(?,note), updated_at=? WHERE id=?").run(status, note, new Date().toISOString(), Number(one[1]));
        if (!info.changes) return send(res, 404, { error: "not found" });
        const s = db.prepare("SELECT * FROM signals WHERE id=?").get(Number(one[1]));
        return send(res, 200, { ok: true, signal: { ...s, prompt: agentPrompt(s, repos) } });
      }
      if (req.method === "POST" && pathname === "/api/panel/push") {
        const sub = await readJson(req, 8192);
        if (typeof sub?.endpoint !== "string" || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return send(res, 400, { error: "subscription" });
        db.prepare("INSERT INTO push_subs(endpoint,json,created_at) VALUES(?,?,?) ON CONFLICT(endpoint) DO UPDATE SET json=excluded.json").run(sub.endpoint, JSON.stringify(sub), new Date().toISOString());
        await notify({ id: 0, kind: "question", platform: "Redion Hub", company_name: "", title: "Njoftimet janë aktive në këtë pajisje." }).catch(() => {});
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: "not found" });
    }
    if (pathname === "/api/logout" && req.method === "POST") return send(res, 200, { ok: true }, { "set-cookie": "hub_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });
    return send(res, 404, "Not found");
  }

  const server = createServer((req, res) => handle(req, res).catch(error => send(res, error?.status ?? 500, { error: error?.status ? error.message : "error" })));
  return { server, db, vapid };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (!env.HUB_PASSWORD) console.warn("[hub] HUB_PASSWORD is not set: the panel cannot be opened.");
  const { server } = createHub();
  server.listen(Number(env.PORT ?? 8080), () => console.log(`[hub] listening on ${env.PORT ?? 8080}`));
}
