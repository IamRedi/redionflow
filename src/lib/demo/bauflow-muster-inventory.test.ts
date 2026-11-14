import { describe, expect, it } from 'vitest';
import { assertMusterInventoryTarget } from './bauflow-muster-inventory';

const env = {
  APP_ENV: 'demo', SAAS_MODE: 'false', DEMO_MODE: 'true',
  BAUFLOW_MUSTER_PROFILE: 'steel-v1', INSTALLATION_COMPANY_ID: 'bauflow-muster-steel',
  BAUFLOW_MUSTER_PUBLIC_DEMO: 'true', BAUFLOW_MUSTER_INVENTORY_APPLY: 'true',
  APP_BASE_URL: 'https://bauflow-production-1344.up.railway.app',
  APP_DOMAIN: 'bauflow-production-1344.up.railway.app',
  DATABASE_URL: 'postgresql://bauflow_muster:fixture@postgres-d1t9.railway.internal:5432/bauflow_muster',
};
describe('Muster inventory maintenance boundary', () => {
  it('accepts the exact isolated approved target', () => expect(assertMusterInventoryTarget(env)).toBe('demo'));
  it('does not accept fleet approval as inventory approval', () => {
    expect(() => assertMusterInventoryTarget({ ...env, BAUFLOW_MUSTER_INVENTORY_APPLY: undefined, BAUFLOW_MUSTER_FLEET_APPLY: 'true' })).toThrow();
  });
  it.each([
    { APP_ENV: 'production' }, { SAAS_MODE: 'true' }, { DEMO_MODE: 'false' },
    { INSTALLATION_COMPANY_ID: 'alsteel' }, { INSTALLATION_COMPANY_ID: 'baumdienst' },
    { BAUFLOW_MUSTER_PROFILE: undefined }, { BAUFLOW_MUSTER_PUBLIC_DEMO: 'false' },
    { APP_DOMAIN: 'redionflow-production.up.railway.app' },
    { DATABASE_URL: env.DATABASE_URL.replace('/bauflow_muster', '/railway') },
    { DATABASE_URL: env.DATABASE_URL.replace('postgres-d1t9', 'postgres') },
    { DATABASE_URL: env.DATABASE_URL + '?host=another-database' },
  ])('refuses a different/missing scope: %j', change => {
    expect(() => assertMusterInventoryTarget({ ...env, ...change })).toThrow();
  });
});
