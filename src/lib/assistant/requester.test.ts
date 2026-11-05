import { beforeEach, expect, it, vi } from 'vitest';
const dependencies = vi.hoisted(() => ({
  admin: vi.fn(), worker: vi.fn(), companyId: vi.fn(),
  db: { companyProfile: { findUnique: vi.fn() }, user: { findFirst: vi.fn() }, worker: { findFirst: vi.fn() } },
}));
vi.mock('@/lib/db/prisma', () => ({ prisma: dependencies.db }));
vi.mock('@/lib/db/tenant', () => ({ getCurrentCompanyId: dependencies.companyId }));
vi.mock('@/lib/auth/admin-session', () => ({ getCurrentAdmin: dependencies.admin }));
vi.mock('@/lib/workzone/worker-session', () => ({ getCurrentWorker: dependencies.worker }));
import { getRequesterContext } from './requester';

beforeEach(() => {
  vi.clearAllMocks();
  dependencies.admin.mockResolvedValue(null); dependencies.worker.mockResolvedValue(null);
  dependencies.companyId.mockResolvedValue('company-a');
  dependencies.db.companyProfile.findUnique.mockResolvedValue({ country: 'AL' });
});

it('does not resolve/create a default tenant for anonymous or dual-role sessions', async () => {
  expect(await getRequesterContext()).toMatchObject({ kind: 'anonymous', companyId: '' });
  dependencies.admin.mockResolvedValue({ id: 'admin-one' }); dependencies.worker.mockResolvedValue({ id: 'worker-one' });
  expect(await getRequesterContext()).toMatchObject({ kind: 'anonymous', companyId: '' });
  expect(dependencies.db.companyProfile.findUnique).not.toHaveBeenCalled();
  expect(dependencies.companyId).not.toHaveBeenCalled();
});
it('binds the admin role to the authenticated tenant and its local clock', async () => {
  dependencies.admin.mockResolvedValue({ id: 'admin-one' });
  dependencies.db.user.findFirst.mockResolvedValue({ id: 'admin-one', companyProfileId: 'company-a', name: 'Admin Demo', email: 'admin@example.test', preferredLanguage: 'SQ' });
  expect(await getRequesterContext()).toMatchObject({ kind: 'admin', companyId: 'company-a', timeZone: 'Europe/Tirane', preferredLanguage: 'SQ' });
  expect(dependencies.db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'admin-one', companyProfileId: 'company-a', role: 'ADMIN', isActive: true } }));
});
it('refuses an admin with a missing or different tenant instead of using a default company', async () => {
  dependencies.admin.mockResolvedValue({ id: 'admin-one' });
  for (const companyProfileId of [null, 'company-b']) {
    dependencies.db.user.findFirst.mockResolvedValue({ id: 'admin-one', companyProfileId });
    expect(await getRequesterContext()).toMatchObject({ kind: 'anonymous', companyId: '' });
  }
});
it('binds a worker to the active same-tenant profile and refuses foreign worker data', async () => {
  dependencies.worker.mockResolvedValue({ id: 'worker-one' });
  dependencies.db.worker.findFirst.mockResolvedValue({ id: 'worker-one', companyProfileId: 'company-a', firstName: 'Mira', lastName: 'Demo', preferredLanguage: 'SQ' });
  expect(await getRequesterContext()).toMatchObject({ kind: 'worker', companyId: 'company-a', workerId: 'worker-one' });
  expect(dependencies.db.worker.findFirst.mock.calls[0][0].where).toEqual({ id: 'worker-one', companyProfileId: 'company-a', status: 'active' });
  dependencies.db.worker.findFirst.mockResolvedValue({ id: 'worker-one', companyProfileId: 'company-b' });
  expect(await getRequesterContext()).toMatchObject({ kind: 'anonymous', companyId: '' });
});
it('fails closed when the authenticated tenant cannot be resolved', async () => {
  dependencies.admin.mockResolvedValue({ id: 'admin-one' });
  dependencies.companyId.mockResolvedValue(null);
  expect(await getRequesterContext()).toMatchObject({ kind: 'anonymous', companyId: '' });
  expect(dependencies.db.companyProfile.findUnique).not.toHaveBeenCalled();
});
