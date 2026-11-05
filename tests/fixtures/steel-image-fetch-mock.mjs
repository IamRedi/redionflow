// Explicit disposable E2E preload only. Application source never imports this module.
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.STEEL_IMAGE_E2E_MOCK !== 'true') throw new Error('Steel image mock requires explicit E2E opt-in');
const db = new URL(process.env.DATABASE_URL ?? 'invalid:');
if (!['postgres:', 'postgresql:'].includes(db.protocol) || db.hostname !== '127.0.0.1' || db.port !== '55471' || db.pathname !== '/baumkalk_e2e' || db.username !== 'e2e' || db.hash || [...db.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
  throw new Error('Steel image mock requires the owned disposable PostgreSQL target');
}
const directory = resolve(process.cwd(), 'test-results/steel-illustrations-provider');
if (process.env.STEEL_IMAGE_E2E_DIR !== directory) throw new Error('Steel image mock output must stay in its owned test directory');
// Runs again in the owned Next child, after the managed runner blanks inherited keys.
process.env.OPENAI_API_KEY = 'synthetic-steel-image-key-never-sent';
const image = await readFile(fileURLToPath(new URL('./steel-illustration.webp', import.meta.url)));
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== 'openai.com' && !url.hostname.endsWith('.openai.com')) return originalFetch(input, init);
  if (url.hostname !== 'api.openai.com' || url.pathname !== '/v1/images/edits' || (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase() !== 'POST') {
    throw new Error('Unexpected OpenAI endpoint blocked by disposable image fixture');
  }
  const control = JSON.parse(await readFile(resolve(directory, 'control.json'), 'utf8'));
  if (!['success', 'failure'].includes(control.mode)) throw new Error('Explicit image fixture response mode required');
  const form = init?.body;
  if (!form || typeof form.get !== 'function') throw new Error('Expected image edit multipart input');
  const prompt = form.get('prompt'), model = form.get('model');
  if (typeof prompt !== 'string' || Buffer.byteLength(prompt, 'utf8') > 8192 || typeof model !== 'string') throw new Error('Unexpected image fixture input');
  await mkdir(directory, { recursive: true });
  // No headers, credentials, reference bytes or production records are logged.
  await appendFile(resolve(directory, 'calls.jsonl'), `${JSON.stringify({ endpoint: url.pathname, model, prompt, mode: control.mode })}\n`);
  if (control.mode === 'failure') return Response.json({ error: { type: 'server_error', message: 'Synthetic image provider failure' } }, { status: 503 });
  return Response.json({ data: [{ b64_json: image.toString('base64') }], usage: { input_tokens: 12, output_tokens: 34, total_tokens: 46 } });
};
