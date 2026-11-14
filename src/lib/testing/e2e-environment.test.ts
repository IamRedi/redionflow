import { expect, it } from 'vitest';
import { configureE2EEnvironment } from '../../../scripts/lib/e2e-environment';

it('replaces operator configuration with a shared ephemeral synthetic test contract', () => {
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'test', SESSION_SIGNING_SECRET: 'operator-secret-must-not-be-used', VIRTUAL_OFFICE_ACCESS_JSON: 'operator-tenant' };
  configureE2EEnvironment(env);
  expect(env.SESSION_SIGNING_SECRET).toMatch(/^[a-f0-9]{64}$/);
  expect(env.SESSION_SIGNING_SECRET).toBe(env.BAUMKALK_E2E_SESSION_KEY);
  const child = { ...env }; configureE2EEnvironment(child);
  expect(child.SESSION_SIGNING_SECRET).toBe(env.SESSION_SIGNING_SECRET);
  expect(child.WEB_PUSH_PRIVATE_KEY).toBe(env.WEB_PUSH_PRIVATE_KEY);
  expect(child.WEB_PUSH_PUBLIC_KEY).toBe(env.WEB_PUSH_PUBLIC_KEY);
  expect(env.WEB_PUSH_SUBJECT).toBe('mailto:synthetic-push@example.test');
  expect(JSON.parse(env.VIRTUAL_OFFICE_ACCESS_JSON!)).toMatchObject({ companyId: 'office-e2e-company' });
  expect(env.OFFICE_TASK_REMINDERS_ENABLED).toBe('true');
  expect(env.VIRTUAL_OFFICE_AI_ENABLED).toBe('true'); expect(env.OPENAI_API_KEY).toBe('');
});
