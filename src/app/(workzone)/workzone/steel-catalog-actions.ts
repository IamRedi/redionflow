'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentCompanyId } from '@/lib/db/tenant';
import { currentCompanyActor } from '@/lib/site-files/actor';
import { isSteelCompany } from '@/lib/dashboard/steel-access';
import { getActionTranslator } from '@/lib/i18n/action-messages';
import { notifyRealtimeUpdate } from '@/lib/realtime/event-hub';
import { canManageSteelCatalog, type SteelWorkDefinitionView } from '@/lib/steel-work/types';
import { readSteelWorkCatalog, saveSteelWorkDefinition, setSteelTaskSelection, archiveSteelWorkDefinition } from '@/lib/steel-work/catalog';

const id = z.string().min(1).max(64), revision = z.number().int().min(1);
const save = z.object({ id: id.optional(), siteId: id.optional(), kind: z.enum(['site', 'factory', 'field']), label: z.string().trim().max(80), description: z.string().trim().max(500).optional(), linkedProcessKey: z.string().max(32).nullable().optional(), linkedList: z.enum(['assembly', 'part']).nullable().optional(), linkedKind: z.string().trim().max(80).nullable().optional(), phaseGroup: z.enum(['concrete', 'production', 'assembly']).nullable().optional(), revision: revision.optional() }).strict();
async function actor(manage: boolean) {
  const companyId = await getCurrentCompanyId();
  const person = companyId ? await currentCompanyActor(companyId) : null;
  if (!companyId || !person || manage && !canManageSteelCatalog(person.can) || !await isSteelCompany(companyId)) return null;
  return { companyId, person };
}
function refresh(siteId?: string) {
  revalidatePath('/workzone'); revalidatePath('/app/dashboard');
  if (siteId) revalidatePath(`/workzone/baustellen/${siteId}`);
  notifyRealtimeUpdate('tree.updated', ['tree-list', 'baustelle-progress', 'workzone-cards']);
}

export async function getSteelWorkCatalogAction(input: { siteId?: string } = {}): Promise<{ ok: boolean; message: string; definitions?: SteelWorkDefinitionView[] }> {
  const tr = await getActionTranslator(), parsed = z.object({ siteId: id.optional() }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, message: tr('invalidInput') };
  const auth = await actor(false);
  if (!auth) return { ok: false, message: tr('accessDenied') };
  try { return { ok: true, message: 'OK', definitions: await readSteelWorkCatalog(auth.companyId, parsed.data.siteId) }; }
  catch { return { ok: false, message: tr('invalidInput') }; }
}
export async function saveSteelWorkDefinitionAction(input: unknown): Promise<{ ok: boolean; message: string; definitionId?: string; revision?: number; key?: string; artNeeded?: boolean }> {
  const tr = await getActionTranslator(), parsed = save.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr('invalidInput') };
  const auth = await actor(true);
  if (!auth) return { ok: false, message: tr('accessDenied') };
  try {
    const result = await saveSteelWorkDefinition(auth.companyId, auth.person, parsed.data);
    refresh(parsed.data.siteId); return { ok: true, message: 'OK', ...result };
  } catch { return { ok: false, message: tr('invalidInput') }; }
}
export async function setSteelTaskSelectionAction(input: unknown): Promise<{ ok: boolean; message: string }> {
  const tr = await getActionTranslator(), parsed = z.object({ siteId: id, definitionId: id, enabled: z.boolean(), revision: revision.optional() }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, message: tr('invalidInput') };
  const auth = await actor(true);
  if (!auth) return { ok: false, message: tr('accessDenied') };
  try { await setSteelTaskSelection(auth.companyId, auth.person, parsed.data); refresh(parsed.data.siteId); return { ok: true, message: 'OK' }; }
  catch { return { ok: false, message: tr('invalidInput') }; }
}
export async function archiveSteelWorkDefinitionAction(input: unknown): Promise<{ ok: boolean; message: string }> {
  const tr = await getActionTranslator(), parsed = z.object({ definitionId: id, revision, archived: z.boolean() }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, message: tr('invalidInput') };
  const auth = await actor(true);
  if (!auth) return { ok: false, message: tr('accessDenied') };
  try { await archiveSteelWorkDefinition(auth.companyId, auth.person, parsed.data); refresh(); return { ok: true, message: 'OK' }; }
  catch { return { ok: false, message: tr('invalidInput') }; }
}
