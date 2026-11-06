import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: vi.fn(), steel: vi.fn(), tenant: vi.fn(), read: vi.fn() }));
vi.mock('./access', () => ({ assetActor: mocks.actor }));
vi.mock('./service', () => ({ readCanonicalAssetStatuses: mocks.read }));
vi.mock('@/lib/dashboard/steel-access', () => ({ isSteelCompany: mocks.steel }));
vi.mock('@/lib/db/tenant-context', () => ({ withTenantContext: mocks.tenant }));
import { loadMachineOperationalStatusMap, machineStatusIds } from './status-data';
import { getMachineOperationalStatusAction } from '@/app/(workzone)/workzone/asset-status-actions';

const actor = { companyId: 'company-a', userId: 'admin-a', workerId: null, name: 'Fictional', canManage: true, canRepair: true };
const status = { availability: 'workshop', activeRepairPhase: 'received', activeRepairLocation: 'internal', usable: false, known: true, readAt: '2026-01-02T12:00:00.000Z' };
beforeEach(() => { vi.resetAllMocks(); mocks.steel.mockResolvedValue(true); mocks.actor.mockResolvedValue(actor); mocks.tenant.mockImplementation((_id, fn) => fn({ tenant: true })); mocks.read.mockResolvedValue([{ ref: { kind: 'machine', id: 'm-a' }, status }]); });
it('reads only exact owned IDs under the freshly authenticated tenant and returns no private fields', async () => {
  const map = await loadMachineOperationalStatusMap('company-a', ['m-a', 'm-b', 'm-a']);
  expect(mocks.tenant).toHaveBeenCalledWith('company-a', expect.any(Function));
  expect(mocks.read).toHaveBeenCalledWith({ tenant: true }, actor, [{ kind: 'machine', id: 'm-a' }, { kind: 'machine', id: 'm-b' }]);
  expect(map?.get('m-a')).toEqual(status); expect(map?.get('m-b')).toMatchObject({ known: false, usable: null });
  expect(JSON.stringify([...map!])).not.toMatch(/provider|problem|invoice|worker|notes/);
});
it('preserves non-steel behavior without querying operational state', async () => {
  mocks.steel.mockResolvedValue(false); expect(await loadMachineOperationalStatusMap('company-a', ['m-a'])).toBeNull(); expect(mocks.actor).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
});
it('denies cross-company or unauthenticated reads without a base-active fallback', async () => {
  mocks.actor.mockResolvedValue({ ...actor, companyId: 'foreign' });
  expect((await loadMachineOperationalStatusMap('company-a', ['m-a']))?.get('m-a')).toMatchObject({ known: false, usable: null }); expect(mocks.read).not.toHaveBeenCalled();
  mocks.actor.mockRejectedValue(new Error('private SQL details'));
  expect(await getMachineOperationalStatusAction(['m-a'])).toEqual({ ok: false, code: 'UNAVAILABLE', message: '' });
});
it('keeps all requested results unknown on a failed projection and rejects unrequested rows', async () => {
  mocks.read.mockRejectedValueOnce(new Error('private SQL details'));
  expect((await loadMachineOperationalStatusMap('company-a', ['m-a']))?.get('m-a')).toMatchObject({ known: false, usable: null });
  mocks.read.mockResolvedValue([{ ref: { kind: 'machine', id: 'foreign' }, status }]);
  expect((await loadMachineOperationalStatusMap('company-a', ['m-a']))?.get('m-a')).toMatchObject({ known: false, usable: null });
});
it('bounds the action at 500 exact IDs and safely renders larger server registries without a partial green subset', async () => {
  const ids = Array.from({ length: 501 }, (_, i) => `m-${i}`);
  expect(machineStatusIds(ids)).toBeNull(); expect(machineStatusIds(['a', 'a'])).toEqual(['a']); expect(machineStatusIds(['bad id'])).toBeNull();
  expect(await getMachineOperationalStatusAction(ids)).toEqual({ ok: false, code: 'INVALID_INPUT', message: '' });
  const map = await loadMachineOperationalStatusMap('company-a', ids); expect(map?.size).toBe(501); expect([...map!.values()].every(value => !value.known)).toBe(true); expect(mocks.read).not.toHaveBeenCalled();
});
it('accepts a worker session only through the same fresh actor and private read boundary', async () => {
  mocks.actor.mockResolvedValue({ ...actor, userId: null, workerId: 'worker-a', canManage: false, canRepair: false });
  expect(await getMachineOperationalStatusAction(['m-a'])).toEqual({ ok: true, data: [{ id: 'm-a', status }] });
  expect(mocks.read.mock.calls[0][1]).toMatchObject({ workerId: 'worker-a', canManage: false });
});
