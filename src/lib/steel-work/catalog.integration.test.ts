import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (key: string) => request.values.has(key) ? { value: request.values.get(key) } : undefined }), headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { assertAssistantTestDatabase } from '../../../tests/fixtures/assistant-database';
import { createTestSession, seedSecurityTenants, removeSecurityTenants } from '../../../tests/security/fixtures';
import { getSteelWorkCatalogAction, saveSteelWorkDefinitionAction, setSteelTaskSelectionAction, archiveSteelWorkDefinitionAction } from '@/app/(workzone)/workzone/steel-catalog-actions';
import { removeSteelTaskAction, updateSteelPhaseAction } from '@/app/(workzone)/workzone/steel-phase-actions';
import { ensureSteelWorkCatalog, steelPhaseAddedBy } from './catalog';

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
async function login(index = 0, worker = false) {
  request.values.clear();
  request.values.set(worker ? 'bk_worker_id' : 'bk_admin_id', await createTestSession(worker ? 'worker' : 'admin', worker ? tenants[index].worker.id : tenants[index].admin.id));
}
beforeEach(async () => {
  assertAssistantTestDatabase();
  vi.stubEnv('SESSION_SIGNING_SECRET', 'synthetic-steel-catalog-signing-key-only'); request.values.clear();
  tenants = await seedSecurityTenants();
  for (const tenant of tenants) {
    await prisma.companyProfile.update({ where: { id: tenant.company.id }, data: { mode: 'bau' } });
    await prisma.baustelle.update({ where: { id: tenant.site.id }, data: { type: 'STEEL_ASSEMBLY' } });
  }
  await login();
});
afterEach(async () => { if (tenants) await removeSecurityTenants(tenants.map(tenant => tenant.company.id)); vi.unstubAllEnvs(); });
async function create(label = 'Example task', extra = {}) {
  const result = await saveSteelWorkDefinitionAction({ kind: 'site', label, siteId: tenants[0].site.id, ...extra });
  expect(result.ok).toBe(true); return result;
}

it('binds every existing fixed/custom task with unchanged state and never seeds unchecked history', async () => {
  const tenant = tenants[0];
  const fixed = await prisma.treeItem.create({ data: { baustelleId: tenant.site.id, treeId: 'steel-foundation', species: 'foundation', diameter: 0, status: 'done', notes: 'original fixed note', completedAt: new Date('2026-01-01T10:00:00Z') } });
  const custom = await prisma.treeItem.create({ data: { baustelleId: tenant.site.id, treeId: 'steel-task-example', species: 'task', diameter: 0, status: 'blocked', notes: JSON.stringify({ label: 'Example legacy task', material: 'Example missing part' }) } });
  const other = await prisma.baustelle.create({ data: { companyProfileId: tenant.company.id, name: 'Example second site', type: 'STEEL_ASSEMBLY' } });
  await ensureSteelWorkCatalog(tenant.company.id); await ensureSteelWorkCatalog(tenant.company.id);
  expect(await prisma.treeItem.findUnique({ where: { id: fixed.id } })).toMatchObject({ status: 'done', notes: fixed.notes, completedAt: fixed.completedAt });
  expect(await prisma.treeItem.findUnique({ where: { id: custom.id } })).toMatchObject({ status: 'blocked', notes: custom.notes });
  expect(await prisma.treeItem.count({ where: { baustelleId: other.id } })).toBe(0);
  const catalog = await getSteelWorkCatalogAction({ siteId: other.id });
  expect(catalog.definitions?.find(item => item.key === 'steel-task-example')).toMatchObject({ enabled: false, label: 'Example legacy task' });
  expect(await prisma.steelSiteTask.count({ where: { companyProfileId: tenant.company.id } })).toBe(2);
});

it('shares definitions company-wide, enables only the creating site and reuses matching kind/label', async () => {
  expect((await saveSteelWorkDefinitionAction({ kind: 'site', label: '' })).ok).toBe(false);
  const other = await prisma.baustelle.create({ data: { companyProfileId: tenants[0].company.id, name: 'Example second site', type: 'STEEL_ASSEMBLY' } });
  const first = await create();
  const again = await create('example TASK');
  expect(again.definitionId).toBe(first.definitionId);
  const catalog = await getSteelWorkCatalogAction({ siteId: other.id });
  expect(catalog.definitions?.find(item => item.id === first.definitionId)).toMatchObject({ enabled: false, phaseItemId: null });
  expect(await prisma.steelSiteTask.count({ where: { definitionId: first.definitionId } })).toBe(1);
  const process = await saveSteelWorkDefinitionAction({ kind: 'factory', label: 'Example task' });
  expect(process.ok).toBe(true); expect(process.definitionId).not.toBe(first.definitionId); expect(process.key).toMatch(/^fp-[a-f0-9]{24}$/);
});

it('edits an unselected definition without silently enabling it and requests fresh art only when relevant', async () => {
  const result = await create();
  const assignment = await prisma.steelSiteTask.findFirstOrThrow({ where: { definitionId: result.definitionId } });
  expect((await setSteelTaskSelectionAction({ siteId: assignment.baustelleId, definitionId: assignment.definitionId, enabled: false, revision: assignment.revision })).ok).toBe(true);
  await prisma.steelWorkDefinition.update({ where: { id: result.definitionId }, data: { visualStatus: 'generated', visualUpdatedAt: new Date() } });
  const edited = await saveSteelWorkDefinitionAction({ id: result.definitionId, kind: 'site', label: 'Updated example', description: 'Updated illustration', siteId: assignment.baustelleId, revision: result.revision });
  expect(edited).toMatchObject({ ok: true, artNeeded: true });
  expect(await prisma.steelSiteTask.findUnique({ where: { id: assignment.id } })).toMatchObject({ enabled: false });
  await prisma.steelWorkDefinition.update({ where: { id: result.definitionId }, data: { visualStatus: 'photo' } });
  expect(await saveSteelWorkDefinitionAction({ id: result.definitionId, kind: 'site', label: 'Photo example', revision: edited.revision })).toMatchObject({ ok: true, artNeeded: false });
});

it('refreshes generated art when its linked work context changes, while keeping uploaded photos', async () => {
  const task = await create('Fixture flashing');
  const process = await saveSteelWorkDefinitionAction({ kind: 'factory', label: 'Fixture fastening' });
  expect(process.ok).toBe(true);
  await prisma.steelWorkDefinition.update({ where: { id: task.definitionId }, data: { visualStatus: 'generated', visualUpdatedAt: new Date() } });
  const linked = await saveSteelWorkDefinitionAction({ id: task.definitionId, kind: 'site', label: 'Fixture flashing', revision: task.revision, linkedProcessKey: process.key, linkedList: 'assembly' });
  expect(linked).toMatchObject({ ok: true, artNeeded: true });
  const unchanged = await saveSteelWorkDefinitionAction({ id: task.definitionId, kind: 'site', label: 'Fixture flashing', revision: linked.revision, linkedProcessKey: process.key, linkedList: 'assembly' });
  expect(unchanged).toMatchObject({ ok: true, artNeeded: false });
  const filtered = await saveSteelWorkDefinitionAction({ id: task.definitionId, kind: 'site', label: 'Fixture flashing', revision: unchanged.revision, linkedProcessKey: process.key, linkedList: 'assembly', linkedKind: 'COLUMN' });
  expect(filtered).toMatchObject({ ok: true, artNeeded: true });
  const parts = await saveSteelWorkDefinitionAction({ id: task.definitionId, kind: 'site', label: 'Fixture flashing', revision: filtered.revision, linkedProcessKey: process.key, linkedList: 'part', linkedKind: 'COLUMN' });
  expect(parts).toMatchObject({ ok: true, artNeeded: true });
  await prisma.steelWorkDefinition.update({ where: { id: task.definitionId }, data: { visualStatus: 'photo' } });
  expect(await saveSteelWorkDefinitionAction({ id: task.definitionId, kind: 'site', label: 'Fixture flashing', revision: parts.revision })).toMatchObject({ ok: true, artNeeded: false });
});

it('cancels an invalidated pending badge on any edit while retaining the previous image', async () => {
  const task = await create('Fixture pending illustration');
  const at = new Date('2026-11-05T12:00:00Z');
  await prisma.steelWorkDefinition.update({ where: { id: task.definitionId }, data: { visualStatus: 'pending', visualUpdatedAt: at } });
  const unchanged = await saveSteelWorkDefinitionAction({ id: task.definitionId, kind: 'site', label: 'Fixture pending illustration', revision: task.revision });
  expect(unchanged).toMatchObject({ ok: true, artNeeded: false });
  expect(await prisma.steelWorkDefinition.findUnique({ where: { id: task.definitionId } })).toMatchObject({ visualStatus: 'generated', visualUpdatedAt: at });
  await prisma.steelWorkDefinition.update({ where: { id: task.definitionId }, data: { visualStatus: 'pending', visualUpdatedAt: null } });
  const edited = await saveSteelWorkDefinitionAction({ id: task.definitionId, kind: 'site', label: 'Fixture changed pending illustration', revision: unchanged.revision });
  expect(edited).toMatchObject({ ok: true, artNeeded: true });
  expect(await prisma.steelWorkDefinition.findUnique({ where: { id: task.definitionId } })).toMatchObject({ visualStatus: 'fallback', visualUpdatedAt: null });
});

it('disable/archive/re-enable preserve original history and reject stale revisions', async () => {
  const result = await create(), assignment = await prisma.steelSiteTask.findFirstOrThrow({ where: { definitionId: result.definitionId } });
  expect((await updateSteelPhaseAction({ phaseItemId: assignment.treeItemId, command: 'done' })).ok).toBe(true);
  expect((await removeSteelTaskAction({ phaseItemId: assignment.treeItemId })).ok).toBe(true);
  expect(await prisma.treeItem.findUnique({ where: { id: assignment.treeItemId } })).toMatchObject({ status: 'done' });
  expect((await updateSteelPhaseAction({ phaseItemId: assignment.treeItemId, command: 'reopen' })).ok).toBe(false);
  expect((await setSteelTaskSelectionAction({ siteId: assignment.baustelleId, definitionId: assignment.definitionId, enabled: true, revision: assignment.revision })).ok).toBe(false);
  const disabled = await prisma.steelSiteTask.findUniqueOrThrow({ where: { id: assignment.id } });
  expect((await setSteelTaskSelectionAction({ siteId: assignment.baustelleId, definitionId: assignment.definitionId, enabled: true, revision: disabled.revision })).ok).toBe(true);
  expect((await archiveSteelWorkDefinitionAction({ definitionId: result.definitionId, revision: result.revision, archived: true })).ok).toBe(true);
  expect((await updateSteelPhaseAction({ phaseItemId: assignment.treeItemId, command: 'reopen' })).ok).toBe(false);
  expect(await prisma.treeItem.findUnique({ where: { id: assignment.treeItemId } })).toMatchObject({ status: 'done' });
});

it('rejects manual completion/reopening of automatic linked tasks while preserving reporting', async () => {
  const result = await create('Example linked task', { linkedProcessKey: 'mounted', linkedList: 'assembly', linkedKind: 'BEAM' });
  const assignment = await prisma.steelSiteTask.findFirstOrThrow({ where: { definitionId: result.definitionId } });
  expect((await updateSteelPhaseAction({ phaseItemId: assignment.treeItemId, command: 'done' })).ok).toBe(false);
  expect((await updateSteelPhaseAction({ phaseItemId: assignment.treeItemId, command: 'reopen' })).ok).toBe(false);
  expect((await updateSteelPhaseAction({ phaseItemId: assignment.treeItemId, command: 'note', text: 'Example note' })).ok).toBe(true);
  expect((await saveSteelWorkDefinitionAction({ kind: 'site', label: 'Invalid part link', linkedProcessKey: 'mounted', linkedList: 'part' })).ok).toBe(false);
  const process = await prisma.steelWorkDefinition.findFirstOrThrow({ where: { companyProfileId: tenants[0].company.id, key: 'mounted' } });
  expect((await archiveSteelWorkDefinitionAction({ definitionId: process.id, revision: process.revision, archived: true })).ok).toBe(true);
  expect((await saveSteelWorkDefinitionAction({ id: result.definitionId, revision: result.revision, kind: 'site', label: 'Updated linked label', linkedProcessKey: 'mounted', linkedList: 'assembly', linkedKind: 'BEAM' })).ok).toBe(true);
  const current = await prisma.steelWorkDefinition.findUniqueOrThrow({ where: { id: result.definitionId } });
  expect((await saveSteelWorkDefinitionAction({ id: result.definitionId, revision: current.revision, kind: 'site', label: 'Changed filter', linkedProcessKey: 'mounted', linkedList: 'assembly', linkedKind: 'COLUMN' })).ok).toBe(false);
});

it('denies foreign IDs, inactive/basic workers and mixed identities; management roles remain explicit', async () => {
  const result = await create();
  await login(1);
  expect((await saveSteelWorkDefinitionAction({ id: result.definitionId, revision: result.revision, kind: 'site', label: 'Foreign edit' })).ok).toBe(false);
  expect((await setSteelTaskSelectionAction({ siteId: tenants[1].site.id, definitionId: result.definitionId, enabled: true })).ok).toBe(false);
  expect((await getSteelWorkCatalogAction({ siteId: tenants[0].site.id })).ok).toBe(false);
  await login(0, true);
  expect((await saveSteelWorkDefinitionAction({ kind: 'factory', label: 'Denied example' })).ok).toBe(false);
  for (const crewRole of ['OFFICE', 'FIELD_ENGINEER', 'FACTORY_ENGINEER']) {
    await prisma.worker.update({ where: { id: tenants[0].worker.id }, data: { crewRole } });
    expect((await saveSteelWorkDefinitionAction({ kind: 'factory', label: `Example ${crewRole}` })).ok).toBe(true);
  }
  request.values.set('bk_admin_id', await createTestSession('admin', tenants[0].admin.id));
  expect((await saveSteelWorkDefinitionAction({ kind: 'factory', label: 'Mixed identity' })).ok).toBe(false);
});

it('serializes duplicate creation and rejects cross-tenant owned foreign keys', async () => {
  const results = await Promise.all([create('Concurrent example'), create('Concurrent example')]);
  expect(results[0].definitionId).toBe(results[1].definitionId);
  const definitionId = results[0].definitionId!;
  await expect(withTenantContext(tenants[1].company.id, tx => tx.steelSiteTask.create({ data: { companyProfileId: tenants[1].company.id, baustelleId: tenants[1].site.id, definitionId, treeItemId: tenants[1].tree.id } }))).rejects.toThrow();
});

it('numbers site phases in the order they are chosen; choosing one again moves it to the end', async () => {
  const siteId = tenants[0].site.id;
  const catalog = await getSteelWorkCatalogAction({ siteId });
  const painting = catalog.definitions!.find(item => item.key === 'steel-painting')!;
  const columns = catalog.definitions!.find(item => item.key === 'steel-columns')!;
  expect((await setSteelTaskSelectionAction({ siteId, definitionId: painting.id, enabled: true })).ok).toBe(true);
  const custom = await create('Example bolts');
  expect((await setSteelTaskSelectionAction({ siteId, definitionId: columns.id, enabled: true })).ok).toBe(true);
  const order = async () => Object.fromEntries((await getSteelWorkCatalogAction({ siteId })).definitions!.filter(item => item.enabled).map(item => [item.key, item.selectionPosition]));
  expect(await order()).toEqual({ 'steel-painting': 1, [custom.key!]: 2, 'steel-columns': 3 });
  const current = (await getSteelWorkCatalogAction({ siteId })).definitions!.find(item => item.id === painting.id)!;
  expect((await setSteelTaskSelectionAction({ siteId, definitionId: painting.id, enabled: false, revision: current.selectionRevision })).ok).toBe(true);
  const off = (await getSteelWorkCatalogAction({ siteId })).definitions!.find(item => item.id === painting.id)!;
  expect((await setSteelTaskSelectionAction({ siteId, definitionId: painting.id, enabled: true, revision: off.selectionRevision })).ok).toBe(true);
  expect((await order())['steel-painting']).toBe(4);
});

it('names who put each phase on the site', async () => {
  const tenant = tenants[0];
  const created = await create('Example added task');
  const catalog = await getSteelWorkCatalogAction({ siteId: tenant.site.id });
  const builtin = catalog.definitions!.find(definition => definition.kind === 'site' && !definition.label)!;
  await login(0, true);
  await prisma.worker.update({ where: { id: tenant.worker.id }, data: { crewRole: 'FIELD_ENGINEER' } });
  const selected = await setSteelTaskSelectionAction({ siteId: tenant.site.id, definitionId: builtin.id, enabled: true });
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: tenant.admin.id } });
  const worker = await prisma.worker.findUniqueOrThrow({ where: { id: tenant.worker.id } });
  const names = await steelPhaseAddedBy(tenant.company.id, tenant.site.id, [created.definitionId!, builtin.id]);
  expect(names[created.definitionId!]).toBe((admin.name ?? '').trim() || admin.email);
  expect(selected.ok).toBe(true);
  expect(names[builtin.id]).toBe(`${worker.firstName} ${worker.lastName}`.trim());
  expect(await steelPhaseAddedBy(tenants[1].company.id, tenant.site.id, [created.definitionId!])).toEqual({});
});
