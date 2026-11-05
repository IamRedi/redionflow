import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertE2ETestDatabase, isE2EPortFree, validateE2ETarget } from './lib/e2e-target';

// This focused launcher reuses only the explicitly selected disposable database.
// It never provisions/resets PostgreSQL, installs dependencies or reuses an app listener.
assertE2ETestDatabase(process.env);
const database = new URL(process.env.DATABASE_URL!);
if (database.hostname !== '127.0.0.1' || database.port !== '55471' || database.pathname !== '/baumkalk_e2e' || database.username !== 'e2e') throw new Error('Select the owned55471 E2E database explicitly');
const target = validateE2ETarget('http://127.0.0.1:3217');
if (!await isE2EPortFree(target.port, target.hostname)) throw new Error('Illustration E2E port3217 is occupied; existing listener left untouched');
const cli = resolve('node_modules/@playwright/test/cli.js');
if (!existsSync(cli)) throw new Error('Reuse the verified installed Playwright dependencies; do not install from this runner');
const env = {
  ...process.env,
  PATH: `${resolve('node_modules/.bin')}${delimiter}${process.env.PATH ?? ''}`,
  DATABASE_URL: database.href, DIRECT_URL: database.href, TENANT_DATABASE_URL: '',
  SAAS_MODE: 'true', APP_ENV: 'saas', DEMO_MODE: 'false', DEMO_RESET_ALLOWED: 'false',
  NEXT_TELEMETRY_DISABLED: '1', OPENAI_API_KEY: '',
  BAUMKALK_E2E_PORT: '3217', PORT: '3217', PLAYWRIGHT_BASE_URL: target.baseURL,
  STEEL_IMAGE_E2E_MOCK: 'true', STEEL_IMAGE_E2E_DIR: resolve('test-results/steel-illustrations-provider'),
  NODE_OPTIONS: `--import=${pathToFileURL(resolve('tests/fixtures/steel-image-fetch-mock.mjs')).href}`,
};
const child = spawn(process.execPath, [cli, 'test', 'tests/e2e/steel-illustrations.spec.ts', '--workers=1'], { env, stdio: 'inherit', shell: false });
process.once('SIGINT', () => child.kill('SIGINT'));
process.once('SIGTERM', () => child.kill('SIGTERM'));
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
