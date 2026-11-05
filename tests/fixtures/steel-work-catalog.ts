import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { prisma } from '../../src/lib/db/prisma';
import { hashPassword } from '../../src/lib/auth/password';
import { ensureSteelWorkCatalog } from '../../src/lib/steel-work/catalog';
import { steelPhasesFor } from '../../src/lib/workzone/steel-phases';

/** Fictional data only; reusable by the owned disposable browser/preview server. */
export async function seedSteelWorkCatalog(companyId: string, options: { worker?: boolean } = {}) {
  assertE2ETestDatabase(process.env);
  const at = new Date('2026-01-05T08:00:00Z');
  await prisma.companyProfile.update({ where: { id: companyId }, data: { displayName: 'Aurora Steel · DEMO', mode: 'bau', country: 'AL' } });
  const aurora = await prisma.baustelle.create({ data: { companyProfileId: companyId, name: 'Aurora · Kantier demo', type: 'STEEL_ASSEMBLY' } });
  const vega = await prisma.baustelle.create({ data: { companyProfileId: companyId, name: 'Vega · Kantier demo', type: 'STEEL_ASSEMBLY' } });
  const workshop = await prisma.baustelle.create({ data: { companyProfileId: companyId, name: 'Punishtja · DEMO', type: 'STEEL_WORKSHOP' } });
  const fixedTasks = [];
  for (const [index, phase] of steelPhasesFor('STEEL_ASSEMBLY').entries()) {
    fixedTasks.push(await prisma.treeItem.create({ data: {
      baustelleId: aurora.id, treeId: phase.treeId, species: phase.key, diameter: 0,
      status: index === 0 ? 'done' : index === 2 ? 'blocked' : 'todo', completedAt: index === 0 ? at : null,
      notes: JSON.stringify({ doneBy: index === 0 ? 'Inxhinier demo' : '', material: index === 2 ? 'Material demonstrativ në pritje' : '' }),
    } }));
  }
  const customTasks = [];
  for (const [index, label] of ['Kontroll demo', 'Matje demo', 'Sigurim demo', 'Paketim demo', 'Dokumentim demo', 'Pastrim demo'].entries()) {
    const row = await prisma.treeItem.create({ data: {
      baustelleId: aurora.id, treeId: `steel-task-demo-${index}`, species: 'task', diameter: 0,
      status: index < 3 ? 'done' : 'todo', completedAt: index < 3 ? at : null,
      notes: JSON.stringify({ label, note: 'Shënim sintetik i ruajtur', doneBy: index < 3 ? 'Inxhinier demo' : '' }),
    } });
    customTasks.push({ ...row, label });
  }
  const column = await prisma.siteElement.create({ data: { companyProfileId: companyId, baustelleId: aurora.id, list: 'assembly', mark: 'C/10', kind: 'COLUMN', quantity: 10, weightKg: 25, factoryDoneAt: at } });
  const beam = await prisma.siteElement.create({ data: { companyProfileId: companyId, baustelleId: aurora.id, list: 'assembly', mark: 'B/20', kind: 'BEAM', quantity: 6, weightKg: 35, factoryDoneAt: at } });
  for (const element of [column, beam]) {
    await prisma.siteElementWork.createMany({ data: [
      ...['cutting', 'assembly'].map(stage => ({ companyProfileId: companyId, elementId: element.id, stage, pieces: element.id === column.id ? 4 : element.quantity, workerIds: [], workerNames: 'Ekip demo', checkedByName: 'Inxhinier demo', checkedAt: at })),
      { companyProfileId: companyId, elementId: element.id, stage: 'mounted', pieces: element.id === column.id ? 2 : 3, workerIds: [], workerNames: 'Ekip demo', checkedByName: 'Inxhinier demo', checkedAt: new Date('2026-01-06T09:00:00Z') },
    ] });
  }
  const fresh = await prisma.siteElement.create({ data: { companyProfileId: companyId, baustelleId: aurora.id, list: 'assembly', mark: 'F/30', kind: 'BRACE', quantity: 4, weightKg: 15, processRoutes: { v: 1, factory: [], field: [] }, processRevision: 0 } });
  const part = await prisma.siteElement.create({ data: { companyProfileId: companyId, baustelleId: aurora.id, list: 'part', mark: 'P/40', quantity: 12, weightKg: 3, processRoutes: { v: 1, factory: [], field: [] }, processRevision: 0 } });
  const worker = options.worker ? await prisma.worker.create({ data: { companyProfileId: companyId, firstName: 'Operator', lastName: 'Demo', crewRole: 'FIELD_ENGINEER', status: 'active', loginCodeHash: hashPassword('684921') } }) : null;
  await ensureSteelWorkCatalog(companyId);
  const definitions = await prisma.steelWorkDefinition.findMany({ where: { companyProfileId: companyId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  return { sites: { aurora, vega }, workshop, elements: { column, beam, fresh, part }, fixedTasks, customTasks, worker, definitions };
}
