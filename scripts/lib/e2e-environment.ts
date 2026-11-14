import { randomBytes, createECDH } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

/** Test-only contract shared by Playwright workers and its owned Next child.
 * Never reuse an operator's application signing secret or office configuration. */
export function configureE2EEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const key = env.BAUMKALK_E2E_SESSION_KEY;
  env.BAUMKALK_E2E_SESSION_KEY = key && /^[a-f0-9]{64}$/.test(key) ? key : randomBytes(32).toString('hex');
  env.SESSION_SIGNING_SECRET = env.BAUMKALK_E2E_SESSION_KEY;
  env.SAAS_MODE = 'true'; env.APP_ENV = 'saas'; env.DEMO_MODE = 'false'; env.DEMO_RESET_ALLOWED = 'false';
  env.VIRTUAL_OFFICE_ENABLED = 'true'; env.VIRTUAL_OFFICE_WORK_ENABLED = 'true'; env.VIRTUAL_OFFICE_TEAM_ENABLED = 'true';
  env.VIRTUAL_OFFICE_AI_ENABLED = 'true'; env.OPENAI_API_KEY = ''; env.OFFICE_TASK_REMINDERS_ENABLED = 'true';
  env.INSTALLATION_COMPANY_ID = 'office-e2e-company';
  env.KIDRAHT_URL = 'https://kidraht.example.test';
  const push = createECDH('prime256v1');
  try { push.setPrivateKey(Buffer.from(env.BAUMKALK_E2E_PUSH_PRIVATE_KEY ?? '', 'hex')); }
  catch { push.generateKeys(); }
  env.BAUMKALK_E2E_PUSH_PRIVATE_KEY = push.getPrivateKey().toString('hex');
  env.WEB_PUSH_PRIVATE_KEY = push.getPrivateKey().toString('base64url');
  env.WEB_PUSH_PUBLIC_KEY = push.getPublicKey().toString('base64url');
  env.WEB_PUSH_SUBJECT = 'mailto:synthetic-push@example.test';
  env.VIRTUAL_OFFICE_ACCESS_JSON = JSON.stringify({ companyId: 'office-e2e-company', megi: { adminId: 'office-e2e-megi', workerId: 'office-e2e-worker-megi' }, almet: { adminId: 'office-e2e-almet' } });
  for (const name of ['OFFICE_EVIDENCE_DIR','FACTORY_SYNC_EVIDENCE_DIR','WORKSHOP_PRESENCE_EVIDENCE_DIR']) {
    env[name] ??= resolve('test-results', 'evidence', name.toLowerCase());
    mkdirSync(env[name]!, { recursive: true });
  }
}
