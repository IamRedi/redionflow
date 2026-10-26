import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer, type AddressInfo } from "node:net";
import { expect, it } from "vitest";

it("actual Playwright never probes or tests a competitor that becomes ready during startup", async () => {
  const reservation = createServer();
  await new Promise<void>(done => reservation.listen(0, "127.0.0.1", done));
  const port = (reservation.address() as AddressInfo).port;
  await new Promise<void>(done => reservation.close(() => done()));
  const folder = mkdtempSync(join(tmpdir(), "e2e-readiness-race-"));
  const activity = join(folder, "browser-test-started");
  const requests = join(folder, "foreign-http-request");
  const listening = join(folder, "competitor-listening");
  const wrapper = join(folder, "competitor.cjs");
  const config = join(folder, "playwright.config.ts");
  // The fake startup command owns a competitor HTTP server and never emits
  // the real Next child's readiness marker. It exits as a failed owned bind
  // would. No existing service, database or browser is used by this regression.
  writeFileSync(wrapper, `
    const fs = require('node:fs');
    const server = require('node:http').createServer((req,res) => {
      fs.writeFileSync(${JSON.stringify(requests)}, 'requested'); res.end('Foreign app is ready');
    });
    server.listen(${port}, '127.0.0.1', () => {
      fs.writeFileSync(${JSON.stringify(listening)}, 'listening');
      console.log('COMPETITOR_HTTP_READY');
      setTimeout(() => server.close(() => process.exit(1)), 2200);
    });
  `);
  writeFileSync(join(folder, "must-not-run.spec.ts"), `
    import { test } from ${JSON.stringify(resolve("node_modules/@playwright/test/index.mjs"))};
    import { writeFileSync } from 'node:fs';
    test('must never start against competitor', async () => { writeFileSync(${JSON.stringify(activity)}, 'started'); });
  `);
  writeFileSync(config, `
    import base from ${JSON.stringify(resolve("playwright.config.ts"))};
    export default { ...base, testDir: ${JSON.stringify(folder)}, outputDir: ${JSON.stringify(join(folder,"results"))},
      workers: 1, webServer: { ...base.webServer,
        command: ${JSON.stringify(`${process.execPath} ${wrapper}`)}, timeout: 8000 } };
  `);
  try {
    const result = spawnSync(process.execPath, [resolve("node_modules/playwright/cli.js"), "test", "--config", config], {
      env: { ...process.env, NODE_ENV: "test", PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${port}` },
      encoding: "utf8", timeout: 15_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("Process from config.webServer");
    expect(existsSync(listening)).toBe(true);
    expect(existsSync(requests)).toBe(false);
    expect(existsSync(activity)).toBe(false);
  } finally { rmSync(folder, { recursive: true, force: true }); }
}, 20_000);
