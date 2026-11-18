import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (key: string) => request.values.has(key) ? { value: request.values.get(key) } : undefined }), headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
import { projectSteelTasks } from './progress';
import { addElementWorkAction } from '@/app/(workzone)/workzone/element-actions';
import { steelDashboardData } from '@/lib/dashboard/steel-data';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { assertAssistantTestDatabase } from '../../../tests/fixtures/assistant-database';
import { createTestSession, seedSecurityTenants, removeSecurityTenants } from '../../../tests/security/fixtures';
import { getSteelWorkCatalogAction, saveSteelWorkDefinitionAction, setSteelTaskSelectionAction, archiveSteelWorkDefinitionAction } from '@/app/(workzone)/workzone/steel-catalog-actions';
import { removeSteelTaskAction, updateSteelPhaseAction } from '@/app/(workzone)/workzone/steel-phase-actions';
import { ensureSteelWorkCatalog, steelPhaseAddedBy } from './catalog';
import { processPlacement } from './process-order';

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
  const allLists = await saveSteelWorkDefinitionAction({ id: task.definitionId, kind: 'site', label: 'Fixture flashing', revision: parts.revision, linkedProcessKey: process.key, linkedList: 'all', linkedKind: 'COLUMN' });
  expect(allLists).toMatchObject({ ok: true });
  expect(await prisma.steelWorkDefinition.findUnique({ where: { id: task.definitionId }, select: { linkedProcessKey: true, linkedList: true } })).toEqual({ linkedProcessKey: process.key, linkedList: null });
  await prisma.steelWorkDefinition.update({ where: { id: task.definitionId }, data: { visualStatus: 'photo' } });
  expect(await saveSteelWorkDefinitionAction({ id: task.definitionId, kind: 'site', label: 'Fixture flashing', revision: allLists.revision })).toMatchObject({ ok: true, artNeeded: false });
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

it('standard production phases follow list confirmations and reject duplicate manual checks, while retaining legacy records',async()=>{
 const t=tenants[0];
 const result=await create('Saldim',{phaseGroup:'production',linkedProcessKey:'assembly',linkedList:'part'});
 const saved=await prisma.steelWorkDefinition.findUniqueOrThrow({where:{id:result.definitionId!}});
 expect(saved).toMatchObject({linkedProcessKey:'welding',linkedList:null});
 // Simulate old incorrect configuration without changing its stored audit/history.
 await prisma.steelWorkDefinition.update({where:{id:saved.id},data:{linkedProcessKey:'assembly',linkedList:'part'}});
 const selection=await prisma.steelSiteTask.findFirstOrThrow({where:{definitionId:saved.id}});
 expect((await getSteelWorkCatalogAction({siteId:t.site.id})).definitions?.find(d=>d.id===saved.id)).toMatchObject({linkedProcessKey:'welding',linkedList:null});
 expect((await updateSteelPhaseAction({phaseItemId:selection.treeItemId,command:'done'})).ok).toBe(false);
 const element=await prisma.siteElement.create({data:{companyProfileId:t.company.id,baustelleId:t.site.id,list:'assembly',mark:'SYN-WELD',quantity:4,weightKg:10,processRoutes:{v:1,factory:['welding'],field:[]}}});
 const project=async()=>projectSteelTasks(await prisma.treeItem.findMany({where:{id:selection.treeItemId},include:{steelTask:{include:{definition:true}}}}),(await prisma.siteElement.findMany({where:{id:element.id},include:{work:true}})).map(e=>({...e,list:'assembly' as const})))[0];
 expect((await addElementWorkAction({elementId:element.id,stage:'welding',workerIds:[t.worker.id],pieces:3})).ok).toBe(true);
 expect(await project()).toMatchObject({automatic:true,status:'todo',percent:75});
 expect((await addElementWorkAction({elementId:element.id,stage:'welding',workerIds:[t.worker.id],pieces:1})).ok).toBe(true);
 expect(await project()).toMatchObject({automatic:true,status:'done',percent:100});
 expect((await steelDashboardData({...t.company,country:'AL',displayName:'Synthetic'}, {},false)).totalProgress.stages.welding).toMatchObject({pieces:4,kg:40});
 expect(await prisma.steelWorkDefinition.findUniqueOrThrow({where:{id:saved.id}})).toMatchObject({linkedProcessKey:'assembly',linkedList:'part'});
 expect(await prisma.treeItem.findUniqueOrThrow({where:{id:selection.treeItemId}})).toMatchObject({status:'todo'});
});

async function processes(kind: 'factory' | 'field' = 'factory') {
  const result = await getSteelWorkCatalogAction(); expect(result.ok).toBe(true);
  return result.definitions!.filter(row => row.kind === kind);
}

it('places an existing drilling process second without rewriting routes, confirmations, images or another company', async () => {
  const tenant = tenants[0];
  const created = await saveSteelWorkDefinitionAction({ kind: 'factory', label: 'Shpimi DEMO' });
  const element = await prisma.siteElement.create({ data: { companyProfileId: tenant.company.id, baustelleId: tenant.site.id, list: 'assembly', mark: 'SYN-ORDER', quantity: 4, weightKg: 10, processRevision: 3, processRoutes: { v: 1, factory: ['cutting', 'assembly', created.key!], field: [] } } });
  await prisma.siteElementWork.create({ data: { companyProfileId: tenant.company.id, elementId: element.id, stage: 'cutting', pieces: 2, workerIds: [tenant.worker.id], workerNames: 'Original synthetic crew', checkedByName: 'Original checker', checkedAt: new Date('2026-01-05T08:00:00Z') } });
  const beforeElement = await prisma.siteElement.findUniqueOrThrow({ where: { id: element.id }, include: { work: true } });
  await ensureSteelWorkCatalog(tenants[1].company.id);
  const foreign = await prisma.steelWorkDefinition.findMany({ where: { companyProfileId: tenants[1].company.id }, orderBy: { id: 'asc' } });
  const rows = await processes(), target = rows.find(row => row.id === created.definitionId)!;
  const result = await saveSteelWorkDefinitionAction({ id: target.id, kind: 'factory', label: target.label, description: target.description, revision: target.revision, placement: { ...processPlacement(target.id, rows), beforeId: rows.find(row => row.key === 'assembly')!.id } });
  expect(result).toMatchObject({ ok: true, artNeeded: false });
  expect((await processes()).filter(row => !row.archivedAt).slice(0, 3).map(row => row.key)).toEqual(['cutting', target.key, 'assembly']);
  expect(await prisma.siteElement.findUniqueOrThrow({ where: { id: element.id }, include: { work: true } })).toEqual(beforeElement);
  expect(await prisma.steelWorkDefinition.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({ key: target.key, visualStatus: target.visualStatus, visualUpdatedAt: null });
  expect(await prisma.steelWorkDefinition.findMany({ where: { companyProfileId: tenants[1].company.id }, orderBy: { id: 'asc' } })).toEqual(foreign);
});

it('inserts a new process at its chosen slot, keeps duplicate submits idempotent and keeps old clients appending', async () => {
  const rows = await processes(), placement = { ...processPlacement(undefined, rows), beforeId: rows[1].id };
  const first = await saveSteelWorkDefinitionAction({ kind: 'factory', label: 'New drill DEMO', placement });
  const replay = await saveSteelWorkDefinitionAction({ kind: 'factory', label: 'New drill DEMO', placement });
  expect(first.ok).toBe(true); expect(replay).toMatchObject({ ok: true, definitionId: first.definitionId });
  expect((await processes()).slice(0, 3).map(row => row.id)).toEqual([rows[0].id, first.definitionId, rows[1].id]);
  expect(await prisma.steelWorkDefinition.count({ where: { companyProfileId: tenants[0].company.id, label: 'New drill DEMO' } })).toBe(1);
  const legacy = await saveSteelWorkDefinitionAction({ kind: 'factory', label: 'Legacy caller DEMO' });
  expect((await processes()).at(-1)?.id).toBe(legacy.definitionId);
});

it('keeps an in-flight illustration revision and status intact when only the position changes', async () => {
  const created = await saveSteelWorkDefinitionAction({ kind: 'factory', label: 'Pending drill DEMO' });
  await prisma.steelWorkDefinition.update({ where: { id: created.definitionId! }, data: { visualStatus: 'pending' } });
  const rows = await processes(), target = rows.find(row => row.id === created.definitionId)!;
  expect(await saveSteelWorkDefinitionAction({ id: target.id, kind: 'factory', label: target.label, description: target.description, revision: target.revision, placement: { ...processPlacement(target.id, rows), beforeId: rows[1].id } })).toMatchObject({ ok: true, artNeeded: false, revision: target.revision });
  expect(await prisma.steelWorkDefinition.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({ revision: target.revision, visualStatus: 'pending', visualUpdatedAt: null });
});

it('serializes competing insertions, returns an order conflict and never partially creates the loser', async () => {
  const rows = await processes(), placement = { ...processPlacement(undefined, rows), beforeId: rows[1].id };
  const results = await Promise.all(['Concurrent A DEMO', 'Concurrent B DEMO'].map(label => saveSteelWorkDefinitionAction({ kind: 'factory', label, placement })));
  expect(results.filter(row => row.ok)).toHaveLength(1);
  expect(results.filter(row => row.code === 'ORDER_CONFLICT')).toHaveLength(1);
  expect(await prisma.steelWorkDefinition.count({ where: { companyProfileId: tenants[0].company.id, label: { startsWith: 'Concurrent ' } } })).toBe(1);
});

it('rejects foreign, archived, self and cross-kind anchors without changing the saved definition', async () => {
  await ensureSteelWorkCatalog(tenants[1].company.id);
  const rows = await processes(), target = rows[0];
  const archived = rows.at(-1)!;
  expect((await archiveSteelWorkDefinitionAction({ definitionId: archived.id, revision: archived.revision, archived: true })).ok).toBe(true);
  const current = await processes(), placement = processPlacement(target.id, current);
  const foreign = await prisma.steelWorkDefinition.findFirstOrThrow({ where: { companyProfileId: tenants[1].company.id, kind: 'factory' } });
  const field = (await processes('field'))[0];
  const before = await prisma.steelWorkDefinition.findMany({ where: { companyProfileId: tenants[0].company.id }, orderBy: { id: 'asc' } });
  for (const anchor of [foreign.id, archived.id, target.id, field.id]) {
    expect(await saveSteelWorkDefinitionAction({ id: target.id, kind: 'factory', label: 'Must not be written', revision: target.revision, placement: { ...placement, beforeId: anchor } })).toMatchObject({ ok: false, code: 'ORDER_CONFLICT' });
  }
  expect(await prisma.steelWorkDefinition.findMany({ where: { companyProfileId: tenants[0].company.id }, orderBy: { id: 'asc' } })).toEqual(before);
});

it('scopes field ordering to its own catalog and never changes per-site task positions', async () => {
  const factory = await processes(), field = await processes('field');
  const task = await create('Keep site order DEMO');
  const siteTask = await prisma.steelSiteTask.findFirstOrThrow({ where: { definitionId: task.definitionId } });
  const result = await saveSteelWorkDefinitionAction({ kind: 'field', label: 'Field check DEMO', placement: { ...processPlacement(undefined, field), beforeId: field[1].id } });
  expect(result.ok).toBe(true);
  expect((await processes('field'))[1].id).toBe(result.definitionId);
  expect((await processes()).map(row => [row.id, row.sortOrder])).toEqual(factory.map(row => [row.id, row.sortOrder]));
  expect((await saveSteelWorkDefinitionAction({ kind: 'site', label: 'Wrong scope DEMO', placement: processPlacement(undefined, factory) })).ok).toBe(false);
  expect(await prisma.steelSiteTask.findUniqueOrThrow({ where: { id: siteTask.id } })).toEqual(siteTask);
});
