import { beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ admin: vi.fn(), worker: vi.fn(), company: vi.fn(), enabled: vi.fn() }));
vi.mock('@/lib/auth/admin-session', () => ({ getCurrentAdmin: auth.admin }));
vi.mock('@/lib/workzone/worker-session', () => ({ getCurrentWorker: auth.worker }));
vi.mock('@/lib/db/tenant', () => ({ getCurrentCompanyId: auth.company }));
vi.mock('@/lib/demo/muster-operations', () => ({ isMusterOperationsCompany: auth.enabled }));
import { companyChatIdentity } from './identity';
beforeEach(() => { vi.clearAllMocks(); auth.company.mockResolvedValue('fictional'); auth.enabled.mockReturnValue(true); auth.admin.mockResolvedValue(null); auth.worker.mockResolvedValue({ id: 'crew', companyProfileId: 'fictional', firstName: 'Crew', lastName: 'Demo' }); });
it('resolves an active session name without accepting an author argument', async () => { expect(await companyChatIdentity()).toMatchObject({ companyId: 'fictional', key: 'worker:crew', name: 'Crew Demo', demo: false }); });
it('rejects mismatched tenant identities and mixed sessions', async () => {
  auth.worker.mockResolvedValue({ id: 'foreign', companyProfileId: 'elsewhere' }); expect(await companyChatIdentity()).toBeNull();
  auth.admin.mockResolvedValue({ id: 'owner', companyProfileId: 'fictional' }); expect(await companyChatIdentity()).toBeNull();
});
it('keeps unconfigured/pilot installations and anonymous demo adapters disabled', async () => { auth.enabled.mockReturnValue(false); expect(await companyChatIdentity()).toBeNull(); expect(auth.worker).not.toHaveBeenCalled(); expect(await companyChatIdentity(true)).toBeNull(); });
