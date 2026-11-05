import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const session = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (key: string) => session.values.has(key) ? { value: session.values.get(key) } : undefined }), headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/realtime/event-hub', () => ({ notifyRealtimeUpdate: vi.fn() }));
vi.mock('@/lib/notifications/sendNotification', () => ({ sendNotification: vi.fn() }));
import { prisma } from '@/lib/db/prisma';
import { assertAssistantTestDatabase } from '../../../tests/fixtures/assistant-database';
import { createTestSession, seedSecurityTenants, removeSecurityTenants } from '../../../tests/security/fixtures';
import { serializeMachineNotes } from '@/lib/workzone/machine-notes';
import { addMachineDefectAction, resolveMachineDefectAction } from '@/app/(workzone)/workzone/machine-actions';
import { moveDailyPlanItemAction, saveDailyPlanAction } from '@/app/(workzone)/workzone/daily-plan-actions';
import { runAssetMutation, readAssetDetail } from './service';
import { updateMachineWithAssetGuard } from './legacy-machine';

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
const date = '2026-01-12';
async function login(index = 0) { session.values.clear(); session.values.set('bk_admin_id', await createTestSession('admin', tenants[index].admin.id)); }
async function report() { await runAssetMutation({ requestId: crypto.randomUUID(), command: { type: 'report', asset: { kind: 'machine', id: tenants[0].machine.id }, kind: 'defect', note: 'Fictional hydraulic fault' } }); }
beforeEach(async () => {
  assertAssistantTestDatabase();
  vi.stubEnv('SESSION_SIGNING_SECRET', 'synthetic-machine-bridge-signing-key');
  tenants = await seedSecurityTenants();
  await prisma.companyProfile.update({ where: { id: tenants[0].company.id }, data: { mode: 'bau' } });
  await prisma.baustelle.update({ where: { id: tenants[0].site.id }, data: { type: 'STEEL_ASSEMBLY' } });
  await login();
});
afterEach(async () => { if (tenants) await removeSecurityTenants(tenants.map(tenant => tenant.company.id)); vi.unstubAllEnvs(); });

it('rolls back legacy activation and metadata edits when a pending workshop job blocks an inactive machine', async () => {
  const machine = tenants[0].machine;
  await prisma.machine.update({ where: { id: machine.id }, data: { isActive: false } });
  await report();
  await expect(updateMachineWithAssetGuard(tenants[0].company.id, machine.id, { isActive: true, name: 'Must not persist' })).rejects.toMatchObject({ code: 'ASSET_UNAVAILABLE' });
  expect(await prisma.machine.findUnique({ where: { id: machine.id } })).toMatchObject({ isActive: false, name: machine.name });
  expect(await prisma.companyAssetEvent.count({ where: { companyProfileId: tenants[0].company.id, type: 'machine.activated' } })).toBe(0);
});

it('permits clean legacy reactivation and keeps old defect history when editing the note body', async () => {
  const machine = tenants[0].machine;
  const defect = { id: 'legacy-fixture', text: 'Earlier fictional fault', reportedBy: 'Fixture operator', reportedAt: '2026-01-01T10:00:00Z' };
  await prisma.machine.update({ where: { id: machine.id }, data: { isActive: false, notes: serializeMachineNotes({ body: 'Earlier body', defects: [defect] }) } });
  await updateMachineWithAssetGuard(tenants[0].company.id, machine.id, { isActive: true, notes: 'Updated body' });
  expect(await prisma.machine.findUnique({ where: { id: machine.id } })).toMatchObject({ isActive: true, notes: serializeMachineNotes({ body: 'Updated body', defects: [defect] }) });
});

it('allows metadata edits on an active base row without clearing its domain repair block', async () => {
  await report();
  await updateMachineWithAssetGuard(tenants[0].company.id, tenants[0].machine.id, { name: 'Fictional revised name', isActive: true });
  expect((await readAssetDetail({ kind: 'machine', id: tenants[0].machine.id })).asset).toMatchObject({ name: 'Fictional revised name', availability: 'reported' });
});

it('routes a legacy defect report into the domain and refuses notes-only resolution', async () => {
  const machine = tenants[0].machine;
  const notes = serializeMachineNotes({ body: 'Keep historical note', defects: [{ id: 'legacy-fixture', text: 'Earlier fault', reportedBy: 'Fixture operator', reportedAt: '2026-01-01T10:00:00Z' }] });
  await prisma.machine.update({ where: { id: machine.id }, data: { notes } });
  const form = new FormData(); form.set('machineId', machine.id); form.set('defect', 'Fictional current fault');
  expect((await addMachineDefectAction(form)).ok).toBe(true);
  expect(await prisma.companyAssetRepair.count({ where: { companyProfileId: tenants[0].company.id, phase: 'reported' } })).toBe(1);
  form.set('defectId', 'legacy-fixture');
  expect((await resolveMachineDefectAction(form)).ok).toBe(false);
  expect(await prisma.machine.findUnique({ where: { id: machine.id } })).toMatchObject({ notes });
});

it('cannot force-assign a machine with a domain report and does not create a partial plan', async () => {
  await report();
  expect((await moveDailyPlanItemAction({ date, columnId: tenants[0].site.id, kind: 'MACHINE', itemId: tenants[0].machine.id, force: true, lang: 'sq' })).ok).toBe(false);
  expect(await prisma.dailyWorkPlan.count({ where: { companyProfileId: tenants[0].company.id, planDate: new Date(`${date}T00:00:00`) } })).toBe(0);
});

it('rechecks all machine availability before publishing an existing draft plan', async () => {
  await prisma.dailyWorkPlan.create({ data: { companyProfileId: tenants[0].company.id, planDate: new Date(`${date}T00:00:00`), createdByAdminId: tenants[0].admin.id,
    columns: { create: { baustelleId: tenants[0].site.id, title: 'Fictional site', assignments: { create: { kind: 'MACHINE', machineId: tenants[0].machine.id, labelSnapshot: 'Fictional machine' } } } },
  } });
  await report();
  expect((await saveDailyPlanAction({ date, lang: 'sq' })).ok).toBe(false);
  expect(await prisma.dailyWorkPlanSavedRow.count({ where: { plan: { companyProfileId: tenants[0].company.id, planDate: new Date(`${date}T00:00:00`) } } })).toBe(0);
});

it('keeps non-steel machine activation on its existing path without creating domain rows', async () => {
  await login(1);
  await prisma.machine.update({ where: { id: tenants[1].machine.id }, data: { isActive: false } });
  expect(await updateMachineWithAssetGuard(tenants[1].company.id, tenants[1].machine.id, { isActive: true })).toMatchObject({ isActive: true });
  expect(await prisma.companyOperationalAsset.count({ where: { companyProfileId: tenants[1].company.id } })).toBe(0);
});
