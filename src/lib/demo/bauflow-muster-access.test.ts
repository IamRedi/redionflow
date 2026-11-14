import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  companyProfile: { count: vi.fn(), findUnique: vi.fn() },
  user: { findFirst: vi.fn() }, worker: { findFirst: vi.fn() },
}));
vi.mock('@/lib/db/prisma', () => ({ prisma: db }));
import { getBauflowDemoAccount } from './bauflow-muster-access';

beforeEach(() => {
  vi.resetAllMocks();
  for (const [key, value] of Object.entries({ APP_ENV: 'demo', SAAS_MODE: 'false', DEMO_MODE: 'true', BAUFLOW_MUSTER_PROFILE: 'steel-v1', BAUFLOW_MUSTER_PUBLIC_DEMO: 'true', INSTALLATION_COMPANY_ID: 'bauflow-muster-steel' })) vi.stubEnv(key, value);
  db.companyProfile.count.mockResolvedValue(1);
  db.companyProfile.findUnique.mockResolvedValue({ mode: 'bau', legalName: 'BauFlow Musterbau GmbH · Fiktive Demofirma' });
});
afterEach(() => vi.unstubAllEnvs());

describe('Muster entry database boundary', () => {
  it('resolves the fixed active fictional owner and its current epoch', async () => {
    db.user.findFirst.mockResolvedValue({ id: 'bauflow-muster-chief', sessionEpoch: 4 });
    expect(await getBauflowDemoAccount('owner')).toEqual({ id: 'bauflow-muster-chief', sessionEpoch: 4, kind: 'admin' });
    expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'bauflow-muster-chief', companyProfileId: 'bauflow-muster-steel', role: 'ADMIN', isOwner: true, isActive: true } }));
  });
  it('uses the ordinary worker identity for accounting', async () => {
    db.worker.findFirst.mockResolvedValue({ id: 'bauflow-muster-finance', sessionEpoch: 2 });
    expect((await getBauflowDemoAccount('office'))?.kind).toBe('worker');
    expect(db.worker.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'bauflow-muster-finance', companyProfileId: 'bauflow-muster-steel', role: 'OFFICE', status: 'active' } }));
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });
  it('does not touch the database when public access is disabled', async () => {
    vi.stubEnv('BAUFLOW_MUSTER_PUBLIC_DEMO', 'false');
    expect(await getBauflowDemoAccount('owner')).toBeNull();
    expect(db.companyProfile.count).not.toHaveBeenCalled();
  });
  it('refuses an installation containing another company', async () => {
    db.companyProfile.count.mockResolvedValue(2);
    expect(await getBauflowDemoAccount('owner')).toBeNull();
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });
  it.each([null, { mode: 'baumdienst', legalName: 'Baumdienst' }, { mode: 'bau', legalName: 'Real client' }])('refuses a mismatching company record %s', async company => {
    db.companyProfile.findUnique.mockResolvedValue(company);
    expect(await getBauflowDemoAccount('owner')).toBeNull();
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });
  it('does not manufacture a missing/deactivated demo account', async () => {
    db.user.findFirst.mockResolvedValue(null);
    expect(await getBauflowDemoAccount('owner')).toBeNull();
  });
});
