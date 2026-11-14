import { describe, expect, it } from 'vitest';
import { BAUFLOW_MUSTER_COMPANY_ID, bauflowMusterConfigured, isBauflowMusterCompany } from './bauflow-muster';

const configured = { APP_ENV: 'demo', SAAS_MODE: 'false', BAUFLOW_MUSTER_PROFILE: 'steel-v1', INSTALLATION_COMPANY_ID: BAUFLOW_MUSTER_COMPANY_ID };
describe('BauFlow Muster installation isolation', () => {
  it('requires the explicit profile and exact installation', () => {
    expect(bauflowMusterConfigured(configured)).toBe(true);
    expect(bauflowMusterConfigured({ ...configured, BAUFLOW_MUSTER_PROFILE: undefined })).toBe(false);
    expect(bauflowMusterConfigured({ ...configured, INSTALLATION_COMPANY_ID: 'other-demo' })).toBe(false);
  });
  it.each(['production', 'saas', 'test', ''])('does not activate in %s', APP_ENV => {
    expect(bauflowMusterConfigured({ ...configured, APP_ENV })).toBe(false);
  });
  it('never changes a foreign company or a pre-session page', () => {
    expect(isBauflowMusterCompany(BAUFLOW_MUSTER_COMPANY_ID, configured)).toBe(true);
    for (const id of ['al-steel', 'glasfaser', 'baumdienst-workshop', null]) expect(isBauflowMusterCompany(id, configured)).toBe(false);
    expect(isBauflowMusterCompany(BAUFLOW_MUSTER_COMPANY_ID, { ...configured, SAAS_MODE: 'true' })).toBe(false);
  });
});
