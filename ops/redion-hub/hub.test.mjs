import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { agentPrompt, createHub, parsePairs } from "./server.mjs";

async function start(extra = {}) {
  const pushes = [];
  const hub = createHub({ dataDir: mkdtempSync(path.join(tmpdir(), "hub-")), password: "pw-synthetic", platformKeys: "bauflow=key-b,kidraht=key-k", agentKey: "agent-k", sendPush: async (sub, payload) => pushes.push(JSON.parse(payload)), ...extra });
  await new Promise(resolve => hub.server.listen(0, resolve));
  const base = `http://127.0.0.1:${hub.server.address().port}`;
  return { hub, base, pushes, close: () => new Promise(resolve => hub.server.close(resolve)) };
}
const post = (url, body, headers = {}) => fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const signal = (over = {}) => ({ platform: "BauFlow", externalId: "sig1", company: { id: "c1", name: "Synthetic Steel" }, kind: "feature", title: "Faturë për klientin", details: "Duam fatura", count: 1, actor: { kind: "admin", name: "Synthetic" }, ...over });

test("parsePairs reads key=value lists", () => {
  assert.deepEqual([...parsePairs("a=1, B = x=y ,bad")], [["a", "1"], ["b", "x=y"]]);
});

test("platforms need their key; repeats count and reopen handled signals", async () => {
  const { hub, base, pushes, close } = await start();
  try {
    assert.equal((await post(`${base}/api/signals`, signal())).status, 401);
    assert.equal((await post(`${base}/api/signals`, signal(), { authorization: "Bearer wrong" })).status, 401);
    assert.equal((await post(`${base}/api/signals`, { kind: "x" }, { authorization: "Bearer key-b" })).status, 400);
    assert.equal((await post(`${base}/api/signals`, signal(), { authorization: "Bearer key-b" })).status, 200);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(pushes.length, 0, "no subscription yet, nothing sent");
    hub.db.prepare("INSERT INTO push_subs(endpoint,json,created_at) VALUES('https://push.example/1','{\"endpoint\":\"https://push.example/1\"}','now')").run();
    hub.db.prepare("UPDATE signals SET status='done'").run();
    await post(`${base}/api/signals`, signal({ count: 2 }), { authorization: "Bearer key-b" });
    await new Promise(r => setTimeout(r, 20));
    const row = hub.db.prepare("SELECT * FROM signals").get();
    assert.equal(row.count, 2); assert.equal(row.status, "new");
    assert.equal(pushes.length, 1); assert.match(pushes[0].title, /Kërkesë e re · BauFlow/);
    // Same externalId from another platform key is a different signal.
    await post(`${base}/api/signals`, signal({ platform: "KiDraht" }), { authorization: "Bearer key-k" });
    assert.equal(hub.db.prepare("SELECT COUNT(*) n FROM signals").get().n, 2);
  } finally { await close(); }
});

test("panel needs the password; agent tasks flow to done", async () => {
  const { base, close } = await start();
  try {
    await post(`${base}/api/signals`, signal(), { authorization: "Bearer key-b" });
    assert.equal((await fetch(`${base}/api/panel/signals`)).status, 401);
    assert.equal((await post(`${base}/api/login`, { password: "nope" })).status, 401);
    const login = await post(`${base}/api/login`, { password: "pw-synthetic" });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const list = await (await fetch(`${base}/api/panel/signals`, { headers: { cookie } })).json();
    assert.equal(list.signals.length, 1); assert.ok(list.pushKey);
    const id = list.signals[0].id;
    assert.equal((await post(`${base}/api/panel/signals/${id}`, { status: "agent" }, { cookie, origin: "https://evil.example" })).status, 403);
    const sent = await (await post(`${base}/api/panel/signals/${id}`, { status: "agent", note: "Vetëm për AL-Steel" }, { cookie })).json();
    assert.match(sent.signal.prompt, /IamRedi\/redionflow/); assert.match(sent.signal.prompt, /Redi's instruction: Vetëm për AL-Steel/);
    assert.equal((await fetch(`${base}/api/agent/tasks`)).status, 401);
    const tasks = await (await fetch(`${base}/api/agent/tasks`, { headers: { authorization: "Bearer agent-k" } })).json();
    assert.equal(tasks.tasks.length, 1);
    assert.equal((await post(`${base}/api/agent/tasks/${id}/done`, { result: "PR #120" }, { authorization: "Bearer agent-k" })).status, 200);
    const done = await (await fetch(`${base}/api/panel/signals?status=done`, { headers: { cookie } })).json();
    assert.equal(done.signals[0].result, "PR #120");
  } finally { await close(); }
});

test("agent prompt for an unknown platform asks for the repo", () => {
  const prompt = agentPrompt({ platform: "Other", source: "other", kind: "error", title: "db", details: "", company_name: "", actor_kind: "", count: 1, first_seen: "2026-11-09T00:00:00Z", last_seen: "2026-11-09T00:00:00Z", note: "" }, parsePairs(""));
  assert.match(prompt, /ask Redi/); assert.match(prompt, /root cause/);
});
