import { describe, expect, it } from 'vitest';
import { assertMusterFleetTarget } from './bauflow-muster-fleet';

const env = {
  APP_ENV: 'demo', SAAS_MODE: 'false', DEMO_MODE: 'true',
  BAUFLOW_MUSTER_PROFILE: 'steel-v1', INSTALLATION_COMPANY_ID: 'bauflow-muster-steel',
  BAUFLOW_MUSTER_PUBLIC_DEMO: 'true', BAUFLOW_MUSTER_FLEET_APPLY: 'true',
  APP_BASE_URL: 'https://bauflow-production-1344.up.railway.app',
  APP_DOMAIN: 'bauflow-production-1344.up.railway.app',
  DATABASE_URL: 'postgresql://bauflow_muster:fixture@postgres-d1t9.railway.internal:5432/bauflow_muster',
};
describe('Muster fleet maintenance boundary', () => {
  it('allows only the explicitly configured standalone sample', () => {
    expect(assertMusterFleetTarget(env)).toBe('demo');
  });
  it.each([
    { APP_ENV: 'production' }, { SAAS_MODE: 'true' }, { DEMO_MODE: 'false' },
    { INSTALLATION_COMPANY_ID: 'alsteel' }, { BAUFLOW_MUSTER_PROFILE: undefined },
    { BAUFLOW_MUSTER_FLEET_APPLY: undefined }, { BAUFLOW_MUSTER_PUBLIC_DEMO: 'false' },
    { APP_DOMAIN: 'redionflow-production.up.railway.app' }, { APP_BASE_URL: 'https://alsteel.example' },
    { DATABASE_URL: env.DATABASE_URL.replace('/bauflow_muster', '/railway') },
    { DATABASE_URL: env.DATABASE_URL.replace('postgres-d1t9', 'postgres') },
    { DATABASE_URL: env.DATABASE_URL.replace('bauflow_muster:fixture', 'postgres:fixture') },
    { DATABASE_URL: env.DATABASE_URL + '?host=another-database' },
    { DATABASE_URL: env.DATABASE_URL + '#override' },
  ])('refuses another installation/target or missing explicit opt-in: %j', change => {
    expect(() => assertMusterFleetTarget({ ...env, ...change })).toThrow();
  });
});
