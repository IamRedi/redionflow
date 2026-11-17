import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (key: string) => request.values.has(key) ? { value: request.values.get(key) } : undefined, set: () => undefined }), headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { completeElementProductionAction, syncRemainderElementsAction, setElementProcessesAction, addElementWorkAction, createSiteFromProjectAction, importElementListsAction, deleteElementSourceAction } from '@/app/(workzone)/workzone/element-actions';
import { seedSecurityTenants, removeSecurityTenants, createTestSession } from '../../../tests/security/fixtures';
import { reconcileRemainders, RemainderConflict } from './remainders-db';
import { doneQty } from './stages';

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
beforeEach(async () => {
  vi.stubEnv('SESSION_SIGNING_SECRET', 'synthetic-shortcuts-signing-secret-only'); request.values.clear();
  tenants = await seedSecurityTenants();
  await prisma.baustelle.update({ where: { id: tenants[0].site.id }, data: { type: 'STEEL_ASSEMBLY' } });
  await login('admin', tenants[0].admin.id);
});
afterEach(async () => { await removeSecurityTenants(tenants.map(t => t.company.id)); vi.unstubAllEnvs(); });
async function login(kind: 'admin' | 'worker', id: string) { request.values.clear(); request.values.set(kind === 'admin' ? 'bk_admin_id' : 'bk_worker_id', await createTestSession(kind, id)); }
async function material() {
  const a = tenants[0];
  return prisma.siteElement.create({ data: { companyProfileId: a.company.id, baustelleId: a.site.id, list: 'assembly', mark: 'B/1', quantity: 4, weightKg: 20, processRevision: 2, processRoutes: { v: 1, factory: ['welding', 'coating'], field: ['mounted'] } } });
}
async function completionInput(id: string) {
  const e = await prisma.siteElement.findUniqueOrThrow({ where: { id }, include: { work: true } });
  return { elementId: id, expectedRevision: e.processRevision, expectedQuantity: e.quantity, expectedWorkIds: e.work.map(w => w.id), assignments: { welding: [tenants[0].worker.id], coating: [tenants[0].worker.id] } };
}
async function components() {
  const a = tenants[0];
  const part = await prisma.siteElement.create({ data: { companyProfileId: a.company.id, baustelleId: a.site.id, list: 'part', mark: 'p/1', quantity: 10, weightKg: 2, sourceFile: 'parts.xls' } });
  const assembly = await prisma.siteElement.create({ data: { companyProfileId: a.company.id, baustelleId: a.site.id, list: 'assembly', mark: 'B/1', quantity: 3, assemblyParts: { v: 1, parts: [{ mark: 'p/1', quantity: 2 }] } } });
  return { part, assembly };
}
async function reconcile() {
  const a = tenants[0]; return withTenantContext(a.company.id, async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`steel-catalog:${a.company.id}`}))`;
    return reconcileRemainders(tx, a.company.id, a.site.id);
  });
}

it('completes only remaining stage quantities and preserves earlier workers, timestamps and weights', async () => {
  const a = tenants[0], e = await material();
  expect((await addElementWorkAction({ elementId: e.id, stage: 'welding', pieces: 2, workerIds: [a.worker.id] })).ok).toBe(true);
  const old = await prisma.siteElementWork.findFirstOrThrow({ where: { elementId: e.id } });
  const result = await completeElementProductionAction(await completionInput(e.id)); expect(result.ok).toBe(true);
  expect(await prisma.siteElementWork.findUnique({ where: { id: old.id } })).toEqual(old);
  const actual = await prisma.siteElement.findUniqueOrThrow({ where: { id: e.id }, include: { work: true } });
  expect(actual.work.map(w => [w.stage, w.pieces]).sort()).toEqual([['coating', 4], ['welding', 2], ['welding', 2]]);
  expect(actual.work.every(w => w.workerIds[0] === a.worker.id && w.checkedByUserId === a.admin.id)).toBe(true);
  expect(actual.work.every(w => (w.productionSnapshot as { unitWeightKg: number }).unitWeightKg === 20)).toBe(true);
  expect(doneQty({ ...actual, list: 'assembly' }, 'factory')).toBe(4);
  expect(actual.factoryDoneBy).toBe(a.admin.name);
});
it('is idempotent under double click/concurrent confirmation and never doubles production', async () => {
  const e = await material(), input = await completionInput(e.id);
  const results = await Promise.all([completeElementProductionAction(input), completeElementProductionAction(input)]);
  expect(results.every(r => r.ok)).toBe(true);
  expect(await prisma.siteElementWork.count({ where: { elementId: e.id } })).toBe(2);
  expect((await completeElementProductionAction(input)).ok).toBe(true);
  expect(await prisma.siteElementWork.count({ where: { elementId: e.id } })).toBe(2);
});
it('requires authorized company/site actors and same-company active workers, atomically', async () => {
  const [a,b] = tenants, e = await material(), input = await completionInput(e.id);
  await login('admin', b.admin.id); expect((await completeElementProductionAction(input)).ok).toBe(false);
  await login('worker', a.worker.id); expect((await completeElementProductionAction(input)).ok).toBe(false);
  await login('admin', a.admin.id);
  expect((await completeElementProductionAction({ ...input, assignments: { ...input.assignments, coating: [b.worker.id] } })).ok).toBe(false);
  await prisma.worker.update({ where: { id: a.worker.id }, data: { status: 'inactive' } });
  expect((await completeElementProductionAction(input)).ok).toBe(false);
  expect(await prisma.siteElementWork.count({ where: { elementId: e.id } })).toBe(0);
});
it('rejects changed routes, quantities and intermediate work instead of applying a stale confirmation', async () => {
  const e = await material(), input = await completionInput(e.id);
  expect((await completeElementProductionAction({ ...input, expectedRevision: 1 })).ok).toBe(false);
  expect((await completeElementProductionAction({ ...input, expectedQuantity: 3 })).ok).toBe(false);
  await addElementWorkAction({ elementId: e.id, stage: 'welding', workerIds: [tenants[0].worker.id], pieces: 1 });
  const before = await prisma.siteElementWork.findMany({ where: { elementId: e.id } });
  expect((await completeElementProductionAction(input)).ok).toBe(false);
  expect(await prisma.siteElementWork.findMany({ where: { elementId: e.id } })).toEqual(before);
});
it('does not complete an empty manual route or accept extra/missing processes', async () => {
  const e = await material(), input = await completionInput(e.id);
  expect((await completeElementProductionAction({ ...input, assignments: { welding: input.assignments.welding } })).ok).toBe(false);
  await prisma.siteElement.update({ where: { id: e.id }, data: { isManual: true, processRoutes: { v: 1, factory: [], field: [] } } });
  expect((await completeElementProductionAction(input)).ok).toBe(false);
  expect(await prisma.siteElementWork.count({ where: { elementId: e.id } })).toBe(0);
});
it('permits the existing factory engineer role without giving a field engineer production rights', async () => {
  const a = tenants[0], e = await material(), input = await completionInput(e.id);
  await prisma.worker.update({ where: { id: a.worker.id }, data: { crewRole: 'FIELD_ENGINEER' } });
  await login('worker', a.worker.id); expect((await completeElementProductionAction(input)).ok).toBe(false);
  await prisma.worker.update({ where: { id: a.worker.id }, data: { crewRole: 'FACTORY_ENGINEER' } });
  expect((await completeElementProductionAction(input)).ok).toBe(true);
  const entries = await prisma.siteElementWork.findMany({ where: { elementId: e.id } });
  expect(entries.every(w => w.checkedByWorkerId === a.worker.id && w.checkedByUserId === null)).toBe(true);
});
it('keeps different workers per stage, including an explicitly chosen custom process', async () => {
  const a = tenants[0], e = await material(), stage = 'fp-123456789012345678901234';
  const worker = await prisma.worker.create({ data: { companyProfileId: a.company.id, firstName: 'Other DEMO', lastName: 'Crew' } });
  await prisma.steelWorkDefinition.create({ data: { companyProfileId: a.company.id, kind: 'factory', key: stage, label: 'Custom DEMO' } });
  await prisma.siteElement.update({ where: { id: e.id }, data: { processRoutes: { v: 1, factory: ['welding', stage], field: [] } } });
  const input = await completionInput(e.id);
  expect((await completeElementProductionAction({ ...input, assignments: { welding: [a.worker.id], [stage]: [worker.id] } })).ok).toBe(true);
  const work = await prisma.siteElementWork.findMany({ where: { elementId: e.id } });
  expect(work.find(w => w.stage === stage)?.workerIds).toEqual([worker.id]);
  expect(work.find(w => w.stage === 'welding')?.workerIds).toEqual([a.worker.id]);
});
it('creates one linked standalone row from the real remainder and retains source work', async () => {
  const a = tenants[0], {part} = await components();
  const check = await prisma.siteElementWork.create({ data: { companyProfileId: a.company.id, elementId: part.id, stage: 'cutting', pieces: 10, workerIds: [a.worker.id], workerNames: 'DEMO', checkedByName: 'DEMO' } });
  await reconcile(); await reconcile();
  const row = await prisma.siteElement.findUniqueOrThrow({ where: { remainderOfId: part.id } });
  expect(row).toMatchObject({ mark: 'p/1', quantity: 4, list: 'assembly', isManual: true, weightKg: 2, processRoutes: { v: 1, factory: [], field: [] }, factoryDoneAt: null });
  expect(await prisma.siteElement.count({ where: { remainderOfId: part.id } })).toBe(1);
  expect(await prisma.siteElementWork.findUnique({ where: { id: check.id } })).toEqual(check);
  expect(await prisma.siteElementWork.count({ where: { elementId: row.id } })).toBe(0);
  expect((await deleteElementSourceAction({ siteId: a.site.id, sourceFile: 'parts.xls' })).ok).toBe(false);
});
it('uses the existing catalog selector for remainder routes and preserves them on recalculation', async () => {
  const a = tenants[0], { part } = await components(); await reconcile();
  const row = await prisma.siteElement.findUniqueOrThrow({ where: { remainderOfId: part.id } });
  expect((await setElementProcessesAction({ siteId: a.site.id, elementIds: [row.id], side: 'factory', stages: ['coating'], expectedRevisions: { [row.id]: 1 } })).ok).toBe(true);
  const configured = await prisma.siteElement.findUniqueOrThrow({ where: { id: row.id } });
  await reconcile(); expect(await prisma.siteElement.findUniqueOrThrow({ where: { id: row.id } })).toEqual(configured);
});
it('refuses conflicting reallocation below confirmed work and rolls back every incoming change', async () => {
  const a = tenants[0], { part, assembly } = await components(); await reconcile();
  const row = await prisma.siteElement.findUniqueOrThrow({ where: { remainderOfId: part.id } });
  await setElementProcessesAction({ siteId: a.site.id, elementIds: [row.id], side: 'factory', stages: ['coating'] });
  await addElementWorkAction({ elementId: row.id, stage: 'coating', workerIds: [a.worker.id], pieces: 4 });
  await expect(withTenantContext(a.company.id, async tx => {
    await tx.siteElement.update({ where: { id: assembly.id }, data: { quantity: 5 } });
    return reconcileRemainders(tx, a.company.id, a.site.id);
  })).rejects.toThrow(RemainderConflict);
  expect((await prisma.siteElement.findUniqueOrThrow({ where: { id: assembly.id } })).quantity).toBe(3);
  expect((await prisma.siteElement.findUniqueOrThrow({ where: { id: row.id } })).quantity).toBe(4);
  const before = await prisma.siteElementWork.findMany({ where: { elementId: row.id } });
  const form = new FormData(); form.set('baustelleId', a.site.id);
  form.set('file', new File(['<table><tr><td>Assemb.</td><td>Parte</td><td>Q.tà</td></tr><tr><td>B/1</td><td></td><td>5</td></tr><tr><td></td><td>p/1</td><td>2</td></tr><tr><td>Totale</td></tr></table>'], 'changed-bom.xls'));
  expect((await importElementListsAction(form)).ok).toBe(false);
  expect((await prisma.siteElement.findUniqueOrThrow({ where: { id: assembly.id } })).quantity).toBe(3);
  expect(await prisma.siteElementWork.findMany({ where: { elementId: row.id } })).toEqual(before);
  expect(await prisma.siteFile.count({ where: { companyProfileId: a.company.id, fileName: 'changed-bom.xls' } })).toBe(0);
});
it('fails closed for missing compositions/parts and never steals a same-code manual row', async () => {
  const a = tenants[0], { part, assembly } = await components();
  await prisma.siteElement.update({ where: { id: assembly.id }, data: { assemblyParts: { v: 1, parts: [{ mark: 'missing', quantity: 1 }] } } });
  expect((await reconcile()).status).toBe('missingPart');
  expect(await prisma.siteElement.count({ where: { remainderOfId: part.id } })).toBe(0);
  await prisma.siteElement.update({ where: { id: assembly.id }, data: { assemblyParts: { v: 1, parts: [{ mark: part.mark, quantity: 2 }] } } });
  await prisma.siteElement.create({ data: { companyProfileId: a.company.id, baustelleId: a.site.id, list: 'assembly', mark: part.mark, isManual: true } });
  await expect(reconcile()).rejects.toThrow(RemainderConflict);
});
it('refreshes only for a same-company factory planner and automatically reconciles an uploaded BOM', async () => {
  const [a,b] = tenants, { part } = await components();
  await login('admin', b.admin.id); expect((await syncRemainderElementsAction({ siteId: a.site.id })).ok).toBe(false);
  await login('worker', a.worker.id); expect((await syncRemainderElementsAction({ siteId: a.site.id })).ok).toBe(false);
  await login('admin', a.admin.id);
  const form = new FormData(); form.set('baustelleId', a.site.id);
  form.set('file', new File(['<table><tr><td>Assemb.</td><td>Parte</td><td>Q.tà</td></tr><tr><td>B/1</td><td></td><td>3</td></tr><tr><td></td><td>p/1</td><td>2</td></tr><tr><td>Totale</td></tr></table>'], 'composition.xls'));
  expect((await importElementListsAction(form)).ok).toBe(true);
  expect((await prisma.siteElement.findUniqueOrThrow({ where: { remainderOfId: part.id } })).quantity).toBe(4);
});
it('also calculates standalone elements when both lists arrive through the new-project entry', async () => {
  const a = tenants[0], form = new FormData(); form.set('name', 'New synthetic project');
  form.append('file', new File(['<table><tr><td>Assemb.</td><td>Parte</td><td>Q.tà</td></tr><tr><td>B/1</td><td></td><td>2</td></tr><tr><td></td><td>p/1</td><td>3</td></tr><tr><td>Totale</td></tr></table>'], 'bom.xls'));
  form.append('file', new File(['<table><tr><td>Parte</td><td>Q.tà</td></tr><tr><td>p/1</td><td>8</td></tr><tr><td>Totale</td></tr></table>'], 'parts.xls'));
  const result = await createSiteFromProjectAction(form); expect(result.ok).toBe(true);
  const rows = await prisma.siteElement.findMany({ where: { companyProfileId: a.company.id, baustelleId: result.siteId } });
  expect(rows.find(row => row.remainderOfId)).toMatchObject({ mark: 'p/1', quantity: 2, processRoutes: { v: 1, factory: [], field: [] } });
});
