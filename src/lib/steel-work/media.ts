import { randomUUID } from 'node:crypto';
import { streamText } from 'ai';
import { Prisma } from '@/generated/prisma/client';
import { withTenantContext } from '@/lib/db/tenant-context';
import { fleetActor } from '@/lib/fleet/access';
import { compactPhoto, MAX_PHOTO_BYTES } from '@/lib/asset-photos/image';
import { getRequesterContext } from '@/lib/assistant/requester';
import { reserveAssistantQuota } from '@/lib/assistant/quota';
import { assistantGeneration } from '@/lib/assistant/generation';
import { logger } from '@/lib/observability/logger';
import { canManageSteelCatalog } from './types';
import { parseSteelScene, renderSteelScene, steelScenePrompt, STEEL_SCENE_MAX_BYTES } from './visual';

const validId = /^[a-z0-9-]{10,64}$/i;
export const steelVisualUrl = (id: string, at: Date) => `/api/steel-work-visuals/${id}?v=${at.getTime()}`;
const ownedWhere = (companyId: string, id: string) => ({ id, companyProfileId: companyId });

export async function uploadSteelWorkVisual(definitionId: string, revision: number, file: File) {
  const actor = await fleetActor();
  if (!canManageSteelCatalog(actor.can)) throw new Error('VISUAL_DENIED');
  if (!validId.test(definitionId) || !Number.isSafeInteger(revision) || !(file instanceof File) || !file.size || file.size > MAX_PHOTO_BYTES) throw new Error('PHOTO_FILE');
  const bytes = new Uint8Array(await file.arrayBuffer());
  return withTenantContext(actor.companyId, async tx => {
    await tx.$queryRaw`SELECT "id" FROM "SteelWorkDefinition" WHERE "id"=${definitionId} AND "companyProfileId"=${actor.companyId} FOR UPDATE`;
    const definition = await tx.steelWorkDefinition.findFirst({ where: { ...ownedWhere(actor.companyId, definitionId), revision, archivedAt: null }, select: { id: true } });
    if (!definition) throw new Error('VISUAL_CONFLICT');
    const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(71402004) AS locked`;
    if (!lock.locked) throw new Error('PHOTO_BUSY');
    const image = await compactPhoto(bytes), at = new Date();
    await tx.steelWorkVisual.upsert({
      where: { companyProfileId_definitionId: { companyProfileId: actor.companyId, definitionId } },
      create: { companyProfileId: actor.companyId, definitionId, data: new Uint8Array(image.data), mime: 'image/webp' },
      update: { data: new Uint8Array(image.data), scene: Prisma.DbNull, mime: 'image/webp' },
    });
    await tx.steelWorkDefinition.updateMany({ where: ownedWhere(actor.companyId, definitionId), data: { visualStatus: 'photo', visualUpdatedAt: at } });
    await tx.auditLog.create({ data: { companyProfileId: actor.companyId, actorType: actor.workerId ? 'WORKER' : 'ADMIN', actorId: (actor.workerId ?? actor.userId)!, action: 'steel.visual_uploaded', payload: { definitionId, bytes: image.data.length } } });
    return { url: steelVisualUrl(definitionId, at), status: 'photo' };
  }, { timeout: 20_000 });
}

/** Explicit creation/edit request only: one guarded call, no render-time jobs. */
export async function generateSteelWorkVisual(definitionId: string, revision: number) {
  const actor = await fleetActor();
  if (!canManageSteelCatalog(actor.can)) throw new Error('VISUAL_DENIED');
  if (!validId.test(definitionId) || !Number.isSafeInteger(revision)) throw new Error('VISUAL_NOT_FOUND');
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('VISUAL_UNAVAILABLE');
  const requester = await getRequesterContext();
  if (requester.kind === 'anonymous' || requester.companyId !== actor.companyId) throw new Error('VISUAL_DENIED');
  const jobAt = new Date(), staleBefore = new Date(jobAt.getTime() - 120_000);
  const definition = await withTenantContext(actor.companyId, async tx => {
    await tx.$queryRaw`SELECT "id" FROM "SteelWorkDefinition" WHERE "id"=${definitionId} AND "companyProfileId"=${actor.companyId} FOR UPDATE`;
    const row = await tx.steelWorkDefinition.findFirst({ where: { ...ownedWhere(actor.companyId, definitionId), revision, archivedAt: null }, select: { label: true, description: true, key: true, kind: true, visualStatus: true, visualUpdatedAt: true, updatedAt: true } });
    if (!row) throw new Error('VISUAL_CONFLICT');
    if (row.visualStatus === 'photo') return { ...row, skip: true };
    if (row.visualStatus === 'pending' && row.updatedAt > staleBefore) throw new Error('PHOTO_BUSY');
    await tx.steelWorkDefinition.updateMany({ where: ownedWhere(actor.companyId, definitionId), data: { visualStatus: 'pending', updatedAt: jobAt } });
    return { ...row, skip: false };
  });
  if (definition.skip) return { url: definition.visualUpdatedAt ? steelVisualUrl(definitionId, definition.visualUpdatedAt) : undefined, status: 'photo' };
  const jobWhere = { ...ownedWhere(actor.companyId, definitionId), revision, archivedAt: null, visualStatus: 'pending', updatedAt: jobAt };
  const controller = new AbortController();
  try {
    const quota = await reserveAssistantQuota(requester);
    if (!quota.ok) throw new Error('VISUAL_QUOTA');
    // Worker generation means ONE call even for an admin; the shared quota
    // reservation remains conservative and is settled to actual usage.
    const generation = assistantGeneration(new Request(`https://steel-work.invalid/${randomUUID()}`, { signal: controller.signal }), 'worker', quota.settle);
    const result = streamText({ ...generation, temperature: 0, system: steelScenePrompt, prompt: JSON.stringify({ label: definition.label || definition.key, kind: definition.kind, description: definition.description }) });
    let output = '', finished = false;
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        output += part.text;
        if (Buffer.byteLength(output, 'utf8') > STEEL_SCENE_MAX_BYTES) throw new Error('VISUAL_INVALID');
      } else if (part.type === 'error' || part.type === 'abort') throw new Error('VISUAL_UNAVAILABLE');
      else if (part.type === 'finish') finished = part.finishReason === 'stop';
    }
    const scene = finished ? parseSteelScene(output) : null;
    if (!scene) throw new Error('VISUAL_INVALID');
    const at = new Date();
    const saved = await withTenantContext(actor.companyId, async tx => {
      const current = await tx.steelWorkDefinition.updateMany({ where: jobWhere, data: { visualStatus: 'generated', visualUpdatedAt: at } });
      if (current.count !== 1) return false; // A newer photo/edit always wins.
      await tx.steelWorkVisual.upsert({
        where: { companyProfileId_definitionId: { companyProfileId: actor.companyId, definitionId } },
        create: { companyProfileId: actor.companyId, definitionId, scene, mime: 'image/svg+xml' },
        update: { data: null, scene, mime: 'image/svg+xml' },
      });
      await tx.auditLog.create({ data: { companyProfileId: actor.companyId, actorType: actor.workerId ? 'WORKER' : 'ADMIN', actorId: (actor.workerId ?? actor.userId)!, action: 'steel.visual_generated', payload: { definitionId, revision } } });
      return true;
    });
    return { status: saved ? 'generated' : 'superseded', url: saved ? steelVisualUrl(definitionId, at) : undefined };
  } catch {
    await withTenantContext(actor.companyId, tx => tx.steelWorkDefinition.updateMany({ where: jobWhere, data: { visualStatus: 'error' } }));
    logger.warn({ event: 'steel.visual_generation_failed' }, 'Work visual retained after generation failure');
    throw new Error('VISUAL_UNAVAILABLE');
  } finally { controller.abort(); }
}

export async function readSteelWorkVisual(id: string) {
  if (!validId.test(id)) return null;
  const actor = await fleetActor();
  const visual = await withTenantContext(actor.companyId, tx => tx.steelWorkVisual.findFirst({ where: { companyProfileId: actor.companyId, definitionId: id }, select: { data: true, scene: true, mime: true } }));
  if (!visual) return null;
  if (visual.mime === 'image/webp' && visual.data) return { data: new Uint8Array(visual.data), mime: 'image/webp' };
  const svg = renderSteelScene(visual.scene);
  return svg ? { data: new TextEncoder().encode(svg), mime: 'image/svg+xml' } : null;
}
