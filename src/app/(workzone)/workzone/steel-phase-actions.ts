'use server';
import { effectiveTaskProcessLink } from '@/lib/steel-work/task-process-link';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentCompanyId } from '@/lib/db/tenant';
import { withTenantContext } from '@/lib/db/tenant-context';
import { getActionTranslator } from '@/lib/i18n/action-messages';
import { notifyRealtimeUpdate } from '@/lib/realtime/event-hub';
import type { ActionResult } from '@/lib/validation/action-result';
import { currentCompanyActor } from '@/lib/site-files/actor';
import { ensureSteelWorkCatalog, setSteelTaskSelection } from '@/lib/steel-work/catalog';
import { canManageSteelCatalog } from '@/lib/steel-work/types';
import { applySteelPhaseCommand, readSteelPhaseMeta, type SteelPhaseCommand } from '@/lib/workzone/steel-phases';
import { saveSteelWorkDefinitionAction } from './steel-catalog-actions';
import { dispatchCompletions, siteCompletionSnapshot, type CompletionSnapshot } from '@/lib/notifications/events';
import { appendPhaseNote, phaseNotesPage, type PhaseNotesPage } from '@/lib/steel-work/phase-notes';

const schema = z.object({ phaseItemId: z.string().min(1).max(64), command: z.enum(['done', 'reopen', 'note', 'missing', 'materialArrived']), text: z.string().max(500).optional().default(''), noteRequestId: z.uuid().optional() }).strict();
function refresh(siteId: string) {
  revalidatePath(`/workzone/baustellen/${siteId}`); revalidatePath('/workzone');
  notifyRealtimeUpdate('tree.updated', ['tree-list', 'baustelle-progress']);
}
/** Selection, archive and linkage checks share the catalog mutation lock. */
export async function updateSteelPhaseAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator(), parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr('invalidInput') };
  const companyId = await getCurrentCompanyId(), actor = companyId ? await currentCompanyActor(companyId) : null;
  if (!companyId || !actor) return { ok: false, message: tr('notSignedIn') };
  const allowedAt = (site: string) => { const can = actor.at(site); return parsed.data.command === 'missing' ? can.reportMissing : can.siteSteps; };
  let denied = false;
  let before: CompletionSnapshot | null = null, after: CompletionSnapshot | null = null, transitionKey = '';
  const siteId = await withTenantContext(companyId, async tx => {
    await ensureSteelWorkCatalog(companyId, tx);
    const assignment = await tx.steelSiteTask.findFirst({ where: { companyProfileId: companyId, treeItemId: parsed.data.phaseItemId }, include: { definition: true, treeItem: true } });
    if (!assignment || !assignment.enabled || assignment.definition.archivedAt || assignment.definition.kind !== 'site') return null;
    if (!allowedAt(assignment.baustelleId)) { denied = true; return null; }
    if (effectiveTaskProcessLink(assignment.definition).linkedProcessKey && ['done', 'reopen'].includes(parsed.data.command)) return null;
    if (parsed.data.command === 'done') before = await siteCompletionSnapshot(tx, companyId, assignment.baustelleId);
    const item = assignment.treeItem, text = parsed.data.text.trim(), now = new Date();
    if (parsed.data.command === 'note') {
      if (!text) return null;
      const saved = await appendPhaseNote(tx, assignment, actor, text, now, parsed.data.noteRequestId);
      if (saved === 'conflict') return null;
      if (saved === 'duplicate') return assignment.baustelleId;
    }
    let command: SteelPhaseCommand;
    switch (parsed.data.command) {
      case 'done': command = { kind: 'done', actor: actor.name }; break;
      case 'reopen': command = { kind: 'reopen' }; break;
      case 'note': command = { kind: 'note', actor: actor.name, text }; break;
      case 'missing': if (!text) return null; command = { kind: 'missing', actor: actor.name, text }; break;
      default: command = { kind: 'materialArrived' };
    }
    const next = applySteelPhaseCommand({ status: item.status, meta: readSteelPhaseMeta(item.notes) }, command, now);
    const finished = next.status === 'done';
    await tx.treeItem.update({ where: { id: item.id }, data: {
      status: next.status, notes: JSON.stringify(next.meta), lastEditedBy: actor.name, lastEditedAt: new Date(),
      ...(finished && item.status !== 'done' ? { completedAt: new Date(), completedBy: actor.userId, completedByWorkerId: actor.workerId } : {}),
      ...(!finished ? { completedAt: null, completedBy: null, completedByWorkerId: null } : {}),
    } });
    const audit = await tx.auditLog.create({ data: { companyProfileId: companyId, actorType: actor.workerId ? 'WORKER' : 'ADMIN', actorId: (actor.workerId ?? actor.userId)!, action: 'steel.task_updated', payload: { definitionId: assignment.definitionId, phaseItemId: item.id, command: parsed.data.command } } });
    if (before) { after = await siteCompletionSnapshot(tx, companyId, assignment.baustelleId); transitionKey = audit.id; }
    return assignment.baustelleId;
  });
  if (denied) return { ok: false, message: tr('accessDenied') };
  if (!siteId) return { ok: false, message: tr('invalidInput') };
  await dispatchCompletions(companyId, before, after, transitionKey);
  refresh(siteId); return { ok: true, message: 'OK' };
}
/** Read-only diary; the same site-view scope as the process page. */
export async function getSteelPhaseNotesAction(input: unknown): Promise<(ActionResult & { page?: PhaseNotesPage })> {
  const tr = await getActionTranslator();
  const parsed = z.object({ phaseItemId: z.string().min(1).max(64), day: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).optional(), author: z.string().max(400).optional(), cursor: z.string().max(64).optional() }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, message: tr('invalidInput') };
  const companyId = await getCurrentCompanyId(), actor = companyId ? await currentCompanyActor(companyId) : null;
  if (!companyId || !actor) return { ok: false, message: tr('notSignedIn') };
  try {
    const page = await withTenantContext(companyId, async tx => {
      const assignment = await tx.steelSiteTask.findFirst({ where: { companyProfileId: companyId, treeItemId: parsed.data.phaseItemId, enabled: true, definition: { archivedAt: null, kind: 'site' } }, include: { treeItem: true } });
      if (!assignment || !actor.allows('site.view', assignment.baustelleId)) return null;
      return phaseNotesPage(tx, assignment, parsed.data);
    });
    return page ? { ok: true, page } : { ok: false, message: tr('accessDenied') };
  } catch { return { ok: false, message: tr('invalidInput') }; }
}
/** Compatibility entry point: create/reuse a shared definition, selecting this site only. */
export async function addSteelTaskAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator(), parsed = z.object({ baustelleId: z.string().min(1).max(64), label: z.string().trim().min(1).max(80) }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, message: tr('invalidInput') };
  return saveSteelWorkDefinitionAction({ siteId: parsed.data.baustelleId, kind: 'site', label: parsed.data.label });
}
/** A site disable preserves its history and the shared catalog definition. */
export async function removeSteelTaskAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator(), parsed = z.object({ phaseItemId: z.string().min(1).max(64) }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, message: tr('invalidInput') };
  const companyId = await getCurrentCompanyId(), actor = companyId ? await currentCompanyActor(companyId) : null;
  if (!companyId || !actor || !canManageSteelCatalog(actor.can)) return { ok: false, message: tr('accessDenied') };
  const assignment = await withTenantContext(companyId, async tx => {
    await ensureSteelWorkCatalog(companyId, tx);
    return tx.steelSiteTask.findFirst({ where: { companyProfileId: companyId, treeItemId: parsed.data.phaseItemId }, select: { baustelleId: true, definitionId: true, revision: true } });
  });
  if (!assignment) return { ok: false, message: tr('invalidInput') };
  try { await setSteelTaskSelection(companyId, actor, { siteId: assignment.baustelleId, definitionId: assignment.definitionId, revision: assignment.revision, enabled: false }); }
  catch { return { ok: false, message: tr('invalidInput') }; }
  refresh(assignment.baustelleId); return { ok: true, message: 'OK' };
}
