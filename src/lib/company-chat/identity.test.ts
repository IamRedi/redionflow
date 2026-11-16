import { beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ company: vi.fn(), directory: vi.fn(), actor: vi.fn(), office: vi.fn(), Denied: class Denied extends Error {} }));
vi.mock('@/lib/workshop/shared-store', () => ({ requireWorkshopDemo: auth.company, workshopDirectory: auth.directory, SharedWorkshopError: auth.Denied }));
vi.mock('@/lib/workshop/demo-actor', () => ({ currentDemoActor: auth.actor }));
vi.mock('@/lib/workshop/offices/access', () => ({ demoOfficeActor: auth.office }));
import { companyChatIdentity } from './identity';
beforeEach(() => { vi.clearAllMocks(); auth.company.mockResolvedValue({ id: 'fictional' }); auth.directory.mockResolvedValue({ workers: [{ id: 'crew', key: 'worker-key', name: 'Crew Demo' }] }); auth.actor.mockResolvedValue({ role: 'worker', key: 'worker-key' }); auth.office.mockResolvedValue({ role: 'finance', companyId: 'fictional' }); });
it('keeps ordinary/pilot routes disabled and requires the exact installation guard', async () => {
  expect(await companyChatIdentity()).toBeNull(); expect(auth.company).not.toHaveBeenCalled();
  auth.company.mockRejectedValue(new auth.Denied()); expect(await companyChatIdentity(true)).toBeNull();
});
it('resolves the signed field profile through the real fictional directory', async () => {
  expect(await companyChatIdentity(true)).toMatchObject({ companyId: 'fictional', key: 'worker:crew', name: 'Crew Demo', notificationUserId: 'crew', demo: true });
  auth.actor.mockResolvedValue({ role: 'worker', key: 'unknown' }); expect(await companyChatIdentity(true)).toBeNull();
});
it('uses the existing separately scoped office persona and rejects field-worker office access', async () => {
  expect(await companyChatIdentity(true, true)).toMatchObject({ key: 'demo-office:finance', name: 'Anna Schneider', context: 'office' });
  auth.office.mockRejectedValue(new auth.Denied()); expect(await companyChatIdentity(true, true)).toBeNull();
});
it('keeps the boss identity and read state the same in the field and own office', async () => {
  auth.actor.mockResolvedValue({ role: 'admin', key: 'admin' }); auth.office.mockResolvedValue({ role: 'manager', companyId: 'fictional' });
  const field = await companyChatIdentity(true), office = await companyChatIdentity(true, true);
  expect(field?.key).toBe(office?.key); expect(field?.name).toBe(office?.name);
});
