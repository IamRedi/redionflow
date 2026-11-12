import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { Prisma } from '@/generated/prisma/client';
import { withTenantContext } from '@/lib/db/tenant-context';
import { fleetActor } from '@/lib/fleet/access';
import { compactPhoto, MAX_PHOTO_BYTES } from '@/lib/asset-photos/image';
import { getRequesterContext } from '@/lib/assistant/requester';
import { categorizeAssistantFailure } from '@/lib/assistant/diagnostics';
import { logger } from '@/lib/observability/logger';
import { canManageSteelCatalog } from './types';
import { steelWorkPhoto } from './photo-style';
import { buildSteelIllustrationPrompt, STEEL_ILLUSTRATION_STYLE_VERSION } from './illustration-style';
import { generateSteelImage, SteelImageGenerationError, STEEL_IMAGE_MODEL } from './image-generation';
import { reserveSteelImageQuota } from './image-quota';

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
  const jobAt = new Date(), staleBefore = new Date(jobAt.getTime() - 300_000);
  const definition = await withTenantContext(actor.companyId, async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`steel-catalog:${actor.companyId}`}))`;
    await tx.$queryRaw`SELECT "id" FROM "SteelWorkDefinition" WHERE "id"=${definitionId} AND "companyProfileId"=${actor.companyId} FOR UPDATE`;
    const row = await tx.steelWorkDefinition.findFirst({ where: { ...ownedWhere(actor.companyId, definitionId), revision, archivedAt: null }, select: { label: true, description: true, key: true, kind: true, linkedProcessKey: true, linkedList: true, linkedKind: true, visualStatus: true, visualUpdatedAt: true, updatedAt: true } });
    if (!row) throw new Error('VISUAL_CONFLICT');
    if (row.visualStatus === 'photo') return { ...row, linked: null, skip: true };
    if (row.visualStatus === 'pending' && row.updatedAt > staleBefore) throw new Error('PHOTO_BUSY');
    const linked = row.linkedProcessKey ? await tx.steelWorkDefinition.findFirst({ where: { companyProfileId: actor.companyId, key: row.linkedProcessKey, kind: { in: ['factory', 'field'] } }, select: { id: true, revision: true, key: true, label: true, description: true } }) : null;
    await tx.steelWorkDefinition.updateMany({ where: ownedWhere(actor.companyId, definitionId), data: { visualStatus: 'pending', updatedAt: jobAt } });
    return { ...row, linked, skip: false };
  });
  if (definition.skip) return { url: definition.visualUpdatedAt ? steelVisualUrl(definitionId, definition.visualUpdatedAt) : undefined, status: 'photo' };
  const jobWhere = { ...ownedWhere(actor.companyId, definitionId), revision, archivedAt: null, visualStatus: 'pending', updatedAt: jobAt };
  const controller = new AbortController();
  let phase: 'reference' | 'quota' | 'image' | 'validation' | 'storage' = 'reference';
  let providerCalls = 0, outputBytes = 0;
  try {
    // Literal path keeps Next's file trace scoped to this public style asset.
    const reference = new Uint8Array(await readFile(join(process.cwd(), 'public', 'steel-studio-v1', 'processes.webp')));
    const prompt = buildSteelIllustrationPrompt({ key: definition.key, label: definition.label, description: definition.description, kind: definition.kind as 'site' | 'factory' | 'field',
      linkedProcess: definition.linked ? { key: definition.linked.key, label: definition.linked.label, description: definition.linked.description, list: definition.linkedList as 'assembly' | 'part' | null, elementKind: definition.linkedKind } : undefined });
    phase = 'quota';
    const quota = await reserveSteelImageQuota(requester);
    if (!quota.ok) throw new Error(quota.reason === 'unavailable' ? 'VISUAL_UNAVAILABLE' : 'VISUAL_QUOTA');
    phase = 'image';
    providerCalls = 1;
    const result = await generateSteelImage(prompt, reference, controller.signal);
    logger.info({ event: 'steel.visual_image_usage', model: STEEL_IMAGE_MODEL, style: STEEL_ILLUSTRATION_STYLE_VERSION, ...result.usage }, 'Work illustration usage');
    phase = 'validation';
    outputBytes = result.bytes.length;
    const image = await compactPhoto(result.bytes);
    phase = 'storage';
    const at = new Date();
    const saved = await withTenantContext(actor.companyId, async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`steel-catalog:${actor.companyId}`}))`;
      if (definition.linked && !await tx.steelWorkDefinition.findFirst({ where: { ...ownedWhere(actor.companyId, definition.linked.id), revision: definition.linked.revision }, select: { id: true } })) {
        const retainedStatus = definition.visualStatus === 'pending' ? definition.visualUpdatedAt ? 'generated' : 'fallback' : definition.visualStatus;
        await tx.steelWorkDefinition.updateMany({ where: jobWhere, data: { visualStatus: retainedStatus } });
        return false;
      }
      const current = await tx.steelWorkDefinition.updateMany({ where: jobWhere, data: { visualStatus: 'generated', visualUpdatedAt: at } });
      if (current.count !== 1) return false; // A newer photo/edit always wins.
      await tx.steelWorkVisual.upsert({
        where: { companyProfileId_definitionId: { companyProfileId: actor.companyId, definitionId } },
        create: { companyProfileId: actor.companyId, definitionId, data: new Uint8Array(image.data), scene: { style: STEEL_ILLUSTRATION_STYLE_VERSION }, mime: 'image/webp' },
        update: { data: new Uint8Array(image.data), scene: { style: STEEL_ILLUSTRATION_STYLE_VERSION }, mime: 'image/webp' },
      });
      await tx.auditLog.create({ data: { companyProfileId: actor.companyId, actorType: actor.workerId ? 'WORKER' : 'ADMIN', actorId: (actor.workerId ?? actor.userId)!, action: 'steel.visual_generated', payload: { definitionId, revision, style: STEEL_ILLUSTRATION_STYLE_VERSION, bytes: image.data.length } } });
      return true;
    });
    return { status: saved ? 'generated' : 'superseded', url: saved ? steelVisualUrl(definitionId, at) : undefined };
  } catch (error) {
    try { await withTenantContext(actor.companyId, tx => tx.steelWorkDefinition.updateMany({ where: jobWhere, data: { visualStatus: 'error' } })); }
    catch { logger.warn({ event: 'steel.visual_status_update_failed' }, 'Work visual status could not be updated'); }
    const knownCode = error instanceof Error && error.message === 'VISUAL_QUOTA' ? error.message : error instanceof SteelImageGenerationError ? error.code : undefined;
    const failure = error instanceof SteelImageGenerationError ? error.failure : categorizeAssistantFailure(error, { source: phase === 'storage' ? 'database' : 'provider' });
    logger.warn({ event: 'steel.visual_generation_failed', phase, outputBytes, providerCalls, failureCode: knownCode ?? failure?.code, failure }, 'Work visual retained after generation failure');
    throw new Error(knownCode ?? 'VISUAL_UNAVAILABLE');
  } finally { controller.abort(); }
}

export async function readSteelWorkVisual(id: string) {
  if (!validId.test(id)) return null;
  const actor = await fleetActor();
  const visual = await withTenantContext(actor.companyId, tx => tx.steelWorkVisual.findFirst({ where: { companyProfileId: actor.companyId, definitionId: id }, select: { data: true, scene: true, mime: true, definition: { select: { key: true, label: true, linkedProcessKey: true, kind: true, visualStatus: true } } } }));
  if (!visual) return null;
  const currentStyle = visual.scene && typeof visual.scene === 'object' && !Array.isArray(visual.scene) && visual.scene.style === STEEL_ILLUSTRATION_STYLE_VERSION;
  if (visual.mime === 'image/webp' && visual.data && (visual.definition.visualStatus === 'photo' || currentStyle)) return { data: new Uint8Array(visual.data), mime: 'image/webp' };
  // Legacy AI/SVG bytes remain untouched. Reads never regenerate, reserve quota
  // or rewrite customer data; show the same photographic default as empty cards.
  const photo = steelWorkPhoto(visual.definition);
  const bytes = await readFile(join(process.cwd(), 'public', 'steel-studio-v1', photo.src.split('/').at(-1)!));
  if (photo.panel === undefined) return { data: new Uint8Array(bytes), mime: 'image/webp' };
  const image = sharp(bytes), metadata = await image.metadata();
  const width = Math.floor(metadata.width! / 3), height = Math.floor(metadata.height! / 2);
  return { data: new Uint8Array(await image.extract({ left: (photo.panel % 3) * width, top: Math.floor(photo.panel / 3) * height, width, height }).webp({ quality: 80 }).toBuffer()), mime: 'image/webp' };
}
