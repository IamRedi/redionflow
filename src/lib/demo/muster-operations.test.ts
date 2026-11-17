import { describe, expect, it } from 'vitest';
import { isMusterOperationsCompany } from './muster-operations';

const crane = { APP_ENV: 'demo', SAAS_MODE: 'false', DEMO_MODE: 'true', CRANE_MUSTER_PUBLIC_DEMO: 'true', INSTALLATION_COMPANY_ID: 'company-rheinruhr-kran-muster' };
describe('fictional operations presentation scope', () => {
  it('enables only the explicitly configured crane installation', () => {
    expect(isMusterOperationsCompany(crane.INSTALLATION_COMPANY_ID, crane)).toBe(true);
    for (const id of [null, 'al-steel', 'baumdienst-muster', 'other-company']) expect(isMusterOperationsCompany(id, crane)).toBe(false);
    for (const [key, value] of [['APP_ENV', 'production'], ['SAAS_MODE', 'true'], ['DEMO_MODE', 'false'], ['CRANE_MUSTER_PUBLIC_DEMO', 'false'], ['INSTALLATION_COMPANY_ID', 'another-installation']]) {
      expect(isMusterOperationsCompany(crane.INSTALLATION_COMPANY_ID, { ...crane, [key]: value })).toBe(false);
    }
  });
  it('preserves the existing BauFlow Muster installation lock', () => {
    const steel = { APP_ENV: 'demo', SAAS_MODE: 'false', BAUFLOW_MUSTER_PROFILE: 'steel-v1', INSTALLATION_COMPANY_ID: 'bauflow-muster-steel' };
    expect(isMusterOperationsCompany('bauflow-muster-steel', steel)).toBe(true);
    expect(isMusterOperationsCompany('al-steel', steel)).toBe(false);
    expect(isMusterOperationsCompany('bauflow-muster-steel', { ...steel, BAUFLOW_MUSTER_PROFILE: undefined })).toBe(false);
    expect(isMusterOperationsCompany('bauflow-muster-steel', { ...steel, APP_ENV: 'production' })).toBe(false);
  });
});
