import { createHash, randomBytes } from 'node:crypto';
import { effectiveTaskProcessLink } from './task-process-link';
import type { Prisma } from '@/generated/prisma/client';
import { withTenantContext } from '@/lib/db/tenant-context';
import type { CompanyActor } from '@/lib/site-files/actor';
import { FACTORY_STEP_KEYS } from '@/lib/factory/production';
import { FIELD_STAGES } from '@/lib/elements/stages';
import { readSteelPhaseMeta, steelPhasesFor } from '@/lib/workzone/steel-phases';
import { canManageSteelCatalog, steelPhaseGroup, type SteelWorkDefinitionView, type SteelWorkKind } from './types';

type Tx = Prisma.TransactionClient;
const stableId = (value: string) => createHash('md5').update(value).digest('hex');
const siteKeys = [...new Set([...steelPhasesFor('STEEL_ASSEMBLY'), ...steelPhasesFor('STEEL_WORKSHOP')].map(item => item.treeId))];
const builtinKeys = new Set<string>([...siteKeys, ...FACTORY_STEP_KEYS, ...FIELD_STAGES]);
export class SteelCatalogError extends Error {}
const fail = (code: string): never => { throw new SteelCatalogError(code); };
const lock = (tx: Tx, companyId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`steel-catalog:${companyId}`}))`;
const audit = (tx: Tx, companyId: string, actor: CompanyActor, action: string, payload: Prisma.InputJsonObject) => tx.auditLog.create({ data: { companyProfileId: companyId, actorType: actor.workerId ? 'WORKER' : 'ADMIN', actorId: (actor.workerId ?? actor.userId)!, action, payload } });

/** Seed choices and bind legacy history only. Never enable an unseen site task. */
export async function ensureSteelWorkCatalog(companyId: string, transaction?: Tx): Promise<number> {
  const run = async (tx: Tx) => {
    await lock(tx, companyId);
    const choices = [
      ...siteKeys.map((key, sortOrder) => ({ key, kind: 'site', sortOrder })),
      ...FACTORY_STEP_KEYS.map((key, sortOrder) => ({ key, kind: 'factory', sortOrder })),
      ...FIELD_STAGES.map((key, sortOrder) => ({ key, kind: 'field', sortOrder })),
    ];
    await tx.steelWorkDefinition.createMany({ data: choices.map(choice => ({ ...choice, id: stableId(`steeldef:${companyId}:${choice.key}`), companyProfileId: companyId })), skipDuplicates: true });
    const legacy = await tx.treeItem.findMany({ where: { baustelle: { companyProfileId: companyId, type: { in: ['STEEL_ASSEMBLY', 'STEEL_WORKSHOP'] } }, steelTask: null, OR: [{ treeId: { in: siteKeys } }, { treeId: { startsWith: 'steel-task-' } }] }, select: { id: true, baustelleId: true, treeId: true, notes: true } });
    for (const item of legacy) {
      const definition = await tx.steelWorkDefinition.upsert({ where: { companyProfileId_key: { companyProfileId: companyId, key: item.treeId } }, update: {}, create: { id: stableId(`steeldef:${companyId}:${item.treeId}`), companyProfileId: companyId, kind: 'site', key: item.treeId, label: item.treeId.startsWith('steel-task-') ? readSteelPhaseMeta(item.notes).label || 'Task' : '', sortOrder: 100 } });
      await tx.steelSiteTask.createMany({ data: [{ id: stableId(`steeltask:${item.id}`), companyProfileId: companyId, baustelleId: item.baustelleId, definitionId: definition.id, treeItemId: item.id }], skipDuplicates: true });
    }
    return legacy.length;
  };
  return transaction ? run(transaction) : withTenantContext(companyId, run);
}

export async function readSteelWorkCatalog(companyId: string, siteId?: string): Promise<SteelWorkDefinitionView[]> {
  return withTenantContext(companyId, async tx => {
    await ensureSteelWorkCatalog(companyId, tx);
    if (siteId && !await tx.baustelle.findFirst({ where: { id: siteId, companyProfileId: companyId, type: { in: ['STEEL_ASSEMBLY', 'STEEL_WORKSHOP'] } }, select: { id: true } })) fail('NOT_FOUND');
    const rows = await tx.steelWorkDefinition.findMany({ where: { companyProfileId: companyId }, orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }], include: { siteTasks: { where: { companyProfileId: companyId, ...(siteId ? { baustelleId: siteId } : { baustelleId: '__none__' }) }, take: 1 } } });
    return rows.map(({ siteTasks, ...row }) => ({ ...row, ...(row.kind==='site'?effectiveTaskProcessLink(row):{}), kind: row.kind as SteelWorkKind, linkedList: (row.kind==='site'?effectiveTaskProcessLink(row).linkedList:row.linkedList) as 'assembly' | 'part' | null, archivedAt: row.archivedAt?.toISOString() ?? null, visualUpdatedAt: row.visualUpdatedAt?.toISOString() ?? null, ...(siteId ? { enabled: siteTasks[0]?.enabled ?? false, selectionPosition: siteTasks[0]?.enabled ? siteTasks[0].position : null, phaseItemId: siteTasks[0]?.treeItemId ?? null, ...(siteTasks[0] ? { selectionRevision: siteTasks[0].revision } : {}) } : {}) }));
  });
}

export type SaveSteelWorkInput = { id?: string; siteId?: string; kind: SteelWorkKind; label: string; description?: string; linkedProcessKey?: string | null; linkedList?: 'assembly' | 'part' | 'all' | null; linkedKind?: string | null; phaseGroup?: string | null; revision?: number };
export async function saveSteelWorkDefinition(companyId: string, actor: CompanyActor, input: SaveSteelWorkInput) {
  if (!canManageSteelCatalog(actor.can)) fail('DENIED');
  return withTenantContext(companyId, async tx => {
    await ensureSteelWorkCatalog(companyId, tx);
    const existing = input.id ? await tx.steelWorkDefinition.findFirst({ where: { id: input.id, companyProfileId: companyId } }) : await tx.steelWorkDefinition.findFirst({ where: { companyProfileId: companyId, kind: input.kind, label: { equals: input.label, mode: 'insensitive' } }, orderBy: { createdAt: 'asc' } });
    if (!input.label.trim() && (!input.id || !existing || !builtinKeys.has(existing.key))) fail('INVALID_INPUT');
    if (input.id && (!existing || existing.revision !== input.revision || existing.kind !== input.kind)) fail('CONFLICT');
    if (existing?.archivedAt) fail('ARCHIVED');
    const phaseGroup = input.kind === 'site' ? (input.phaseGroup === undefined ? existing?.phaseGroup ?? null : input.phaseGroup ? steelPhaseGroup(input.phaseGroup) : null) : null;
    const link=effectiveTaskProcessLink({...input,key:existing?.key,phaseGroup,linkedList:input.linkedList==='all'?null:input.linkedList??'assembly'});
    const linkedProcessKey = input.kind === 'site' ? link.linkedProcessKey : null;
    const linkedList = linkedProcessKey ? link.linkedList : null;
    const linkedKind = linkedProcessKey ? link.linkedKind : null;
    if (linkedProcessKey) {
      const process = await tx.steelWorkDefinition.findFirst({ where: { companyProfileId: companyId, key: linkedProcessKey, kind: { in: ['factory', 'field'] } }, select: { kind: true, archivedAt: true } });
      const unchangedLink = !!input.id && existing?.linkedProcessKey === linkedProcessKey && existing.linkedList === linkedList && existing.linkedKind === linkedKind;
      if (!process || process.archivedAt && !unchangedLink || linkedList === 'part' && process.kind === 'field') fail('INVALID_LINK');
    }
    const data = { label: input.label, description: input.description ?? '', linkedProcessKey, linkedList, linkedKind, phaseGroup };
    let definition;
    // Reusing the same kind/label is idempotent; never overwrite a shared definition through a create form.
    if (existing && !input.id) definition = existing;
    else if (existing) definition = await tx.steelWorkDefinition.update({ where: { id: existing.id }, data: { ...data,
      // Every edit invalidates the old job revision, even an unchanged Save.
      // Retain its existing bytes, but never leave an orphaned pending badge.
      ...(existing.visualStatus === 'pending' ? { visualStatus: existing.visualUpdatedAt ? 'generated' : 'fallback' } : {}),
      revision: { increment: 1 } } });
    else {
      if (!input.label.trim()) fail('INVALID_INPUT');
      const last = await tx.steelWorkDefinition.aggregate({ where: { companyProfileId: companyId, kind: input.kind }, _max: { sortOrder: true } });
      const prefix = input.kind === 'site' ? 'steel-task-' : input.kind === 'factory' ? 'fp-' : 'sp-';
      definition = await tx.steelWorkDefinition.create({ data: { ...data, companyProfileId: companyId, kind: input.kind, key: `${prefix}${randomBytes(12).toString('hex')}`, sortOrder: (last._max.sortOrder ?? 99) + 1 } });
    }
    if (input.siteId && input.kind === 'site' && !input.id) await selectTask(tx, companyId, input.siteId, definition.id, true);
    await audit(tx, companyId, actor, existing ? 'steel.catalog_updated' : 'steel.catalog_created', { definitionId: definition.id, revision: definition.revision, ...(input.siteId && input.kind === 'site' && !input.id ? { siteId: input.siteId } : {}) });
    const changedArt = !!input.id && !!existing && (existing.label !== definition.label || existing.description !== definition.description || existing.linkedProcessKey !== definition.linkedProcessKey || existing.linkedList !== definition.linkedList || existing.linkedKind !== definition.linkedKind);
    return { definitionId: definition.id, revision: definition.revision, key: definition.key, artNeeded: definition.visualStatus !== 'photo' && (changedArt || !definition.visualUpdatedAt) };
  });
}

/** Next place on the board. Phases chosen before positions existed get theirs first, in catalog order. */
async function nextPosition(tx: Tx, companyId: string, siteId: string) {
  const enabled = await tx.steelSiteTask.findMany({ where: { companyProfileId: companyId, baustelleId: siteId, enabled: true }, select: { id: true, position: true, definition: { select: { sortOrder: true } } } });
  let last = Math.max(0, ...enabled.map(task => task.position ?? 0));
  const unplaced = enabled.filter(task => task.position === null).sort((a, b) => a.definition.sortOrder - b.definition.sortOrder || a.id.localeCompare(b.id));
  for (const task of unplaced) await tx.steelSiteTask.update({ where: { id: task.id }, data: { position: ++last } });
  return last + 1;
}

async function selectTask(tx: Tx, companyId: string, siteId: string, definitionId: string, enabled: boolean, revision?: number, requireRevision = false) {
  const site = await tx.baustelle.findFirst({ where: { id: siteId, companyProfileId: companyId, type: { in: ['STEEL_ASSEMBLY', 'STEEL_WORKSHOP'] } }, select: { id: true } });
  const definition = await tx.steelWorkDefinition.findFirst({ where: { id: definitionId, companyProfileId: companyId, kind: 'site' } });
  if (!site || !definition || enabled && definition.archivedAt) fail('NOT_FOUND');
  const existing = await tx.steelSiteTask.findUnique({ where: { companyProfileId_baustelleId_definitionId: { companyProfileId: companyId, baustelleId: siteId, definitionId } } });
  if (existing) {
    if (requireRevision && revision === undefined) fail('CONFLICT');
    if (revision !== undefined && existing.revision !== revision) fail('CONFLICT');
    // A phase chosen (again) goes to the end: the board follows the order of choosing.
    if (existing.enabled !== enabled) await tx.steelSiteTask.update({ where: { id: existing.id }, data: { enabled, revision: { increment: 1 }, ...(enabled ? { position: await nextPosition(tx, companyId, siteId) } : {}) } });
    return;
  }
  if (revision !== undefined) fail('CONFLICT');
  if (!enabled) return;
  const tree = await tx.treeItem.create({ data: { baustelleId: siteId, treeId: definition!.key, species: definition!.key.startsWith('steel-task-') ? 'task' : definition!.key.slice(6), diameter: 0, status: 'todo', notes: JSON.stringify({ label: definition!.label }) } });
  await tx.steelSiteTask.create({ data: { companyProfileId: companyId, baustelleId: siteId, definitionId, treeItemId: tree.id, position: await nextPosition(tx, companyId, siteId) } });
}

export async function setSteelTaskSelection(companyId: string, actor: CompanyActor, input: { siteId: string; definitionId: string; enabled: boolean; revision?: number }) {
  if (!canManageSteelCatalog(actor.can)) fail('DENIED');
  return withTenantContext(companyId, async tx => {
    await ensureSteelWorkCatalog(companyId, tx);
    await selectTask(tx, companyId, input.siteId, input.definitionId, input.enabled, input.revision, true);
    await audit(tx, companyId, actor, 'steel.task_selected', { definitionId: input.definitionId, siteId: input.siteId, enabled: input.enabled });
  });
}
export async function archiveSteelWorkDefinition(companyId: string, actor: CompanyActor, input: { definitionId: string; revision: number; archived: boolean }) {
  if (!canManageSteelCatalog(actor.can)) fail('DENIED');
  return withTenantContext(companyId, async tx => {
    await lock(tx, companyId);
    const changed = await tx.steelWorkDefinition.updateMany({ where: { id: input.definitionId, companyProfileId: companyId, revision: input.revision }, data: { archivedAt: input.archived ? new Date() : null, revision: { increment: 1 } } });
    if (changed.count !== 1) fail('CONFLICT');
    await tx.steelWorkDefinition.updateMany({ where: { id: input.definitionId, companyProfileId: companyId, visualStatus: 'pending' }, data: { visualStatus: 'fallback' } });
    await audit(tx, companyId, actor, 'steel.catalog_archived', { definitionId: input.definitionId, archived: input.archived });
  });
}

/** Who put each phase on this site, from the audit trail: the last time it was chosen there, else whoever created it. */
export async function steelPhaseAddedBy(companyId: string, siteId: string, definitionIds: string[]): Promise<Record<string, string>> {
  if (!definitionIds.length) return {};
  return withTenantContext(companyId, async tx => {
    const rows = await tx.auditLog.findMany({
      where: { companyProfileId: companyId, OR: [
        { action: 'steel.task_selected', payload: { path: ['siteId'], equals: siteId } },
        { action: 'steel.catalog_created', OR: definitionIds.map(id => ({ payload: { path: ['definitionId'], equals: id } })) },
      ] },
      orderBy: { createdAt: 'desc' }, select: { action: true, actorType: true, actorId: true, payload: true },
    });
    const picked = new Map<string, { actorType: string; actorId: string }>();
    const read = (payload: unknown) => (payload && typeof payload === 'object' ? payload as Record<string, unknown> : {});
    // Choosing on this site wins over creating the definition (which may have happened elsewhere).
    for (const pass of ['steel.task_selected', 'steel.catalog_created']) for (const row of rows) {
      const payload = read(row.payload), id = String(payload.definitionId ?? '');
      if (row.action !== pass || !row.actorId || !definitionIds.includes(id) || picked.has(id)) continue;
      if (pass === 'steel.task_selected' && payload.enabled !== true) continue;
      if (pass === 'steel.catalog_created' && payload.siteId && payload.siteId !== siteId) continue;
      picked.set(id, { actorType: row.actorType, actorId: row.actorId });
    }
    const ids = [...picked.values()];
    const [workers, users] = await Promise.all([
      tx.worker.findMany({ where: { companyProfileId: companyId, id: { in: ids.filter(a => a.actorType === 'WORKER').map(a => a.actorId) } }, select: { id: true, firstName: true, lastName: true } }),
      tx.user.findMany({ where: { companyProfileId: companyId, id: { in: ids.filter(a => a.actorType !== 'WORKER').map(a => a.actorId) } }, select: { id: true, name: true, email: true } }),
    ]);
    const names = new Map<string, string>([...workers.map(w => [w.id, `${w.firstName} ${w.lastName}`.trim()] as const), ...users.map(u => [u.id, (u.name ?? '').trim() || u.email] as const)]);
    return Object.fromEntries([...picked].flatMap(([id, actor]) => names.get(actor.actorId) ? [[id, names.get(actor.actorId)!]] : []));
  });
}
