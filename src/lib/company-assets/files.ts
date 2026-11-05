import { createHash } from 'node:crypto';
import { z } from 'zod';
import { withTenantContext } from '@/lib/db/tenant-context';
import { compactPhoto, MAX_PHOTO_BYTES } from '@/lib/asset-photos/image';
import { safeFileName, sniffSiteFileMime } from '@/lib/site-files/validate';
import { scanFileContent } from '@/lib/storage/content-scan';
import { assetActor, assetActorKey, assetFail } from './access';
import { assertAssetVisible, lockOwnedAsset, readOwnedAsset } from './service';
import { assetRefSchema } from './validation';

export const MAX_ASSET_DOCUMENT_BYTES = 5_000_000;
export const MAX_REPAIR_FILES = 20;
export const MAX_REPAIR_FILE_BYTES = 25_000_000;
const fileKind = z.enum(['photo', 'invoice', 'document', 'cover']);
const id = z.string().trim().min(1).max(128);
const url = (fileId: string) => `/api/company-assets/files/${fileId}`;

/** Inspect real bytes; images become bounded WebP without embedded GPS/EXIF. */
export async function prepareAssetFile(file: File, kind: z.infer<typeof fileKind>) {
  if (!(file instanceof File) || !file.size || file.size > MAX_PHOTO_BYTES) return assetFail('FILE_INVALID');
  const bytes = new Uint8Array(await file.arrayBuffer());
  // The current scanner seam can refuse uploads; its default is explicitly no-op.
  // Never send an owner's private filename to scanner diagnostics.
  const scan = await scanFileContent(new File([bytes], 'asset-upload', { type: file.type }));
  if (!scan.ok) return assetFail('FILE_REFUSED');
  const mime = sniffSiteFileMime(bytes, file.name);
  const name = safeFileName(file.name);
  if (mime === 'application/pdf' && (kind === 'invoice' || kind === 'document')) {
    if (bytes.length > MAX_ASSET_DOCUMENT_BYTES) return assetFail('FILE_INVALID');
    return { bytes, mime, name: name.replace(/\.[^.]+$/, '') + '.pdf' };
  }
  if (!mime?.startsWith('image/')) return assetFail('FILE_INVALID');
  try {
    const photo = await compactPhoto(bytes);
    return { bytes: new Uint8Array(photo.data), mime: 'image/webp', name: name.replace(/\.[^.]+$/, '') + '.webp' };
  } catch { return assetFail('FILE_INVALID'); }
}

export async function saveCompanyAssetFile(form: FormData) {
  const actor = await assetActor();
  const ref = assetRefSchema.parse({ kind: form.get('assetKind'), id: form.get('assetId') });
  const kind = fileKind.parse(form.get('kind'));
  const requestId = z.uuid().parse(form.get('requestId'));
  const repairId = form.get('repairId') ? id.parse(form.get('repairId')) : null;
  if ((kind === 'invoice' && !actor.canRepair) || (kind === 'cover' && !actor.canManage)) return assetFail('DENIED');
  const file = form.get('file');
  if (!(file instanceof File) || !file.size || file.size > MAX_PHOTO_BYTES) return assetFail('FILE_INVALID');
  // Verify asset visibility before buffering/decoding user-supplied input.
  await withTenantContext(actor.companyId, async tx => {
    const asset = await readOwnedAsset(tx, actor, ref);
    await assertAssetVisible(tx, actor, asset);
  });
  return withTenantContext(actor.companyId, async tx => {
    // Bound native image processing across replicas, sharing the photo subsystem lock.
    const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(71402004) AS locked`;
    if (!lock.locked) return assetFail('BUSY');
    const asset = await lockOwnedAsset(tx, actor, ref);
    await assertAssetVisible(tx, actor, asset);
    if (repairId && !await tx.companyAssetRepair.findFirst({ where: { id: repairId, companyProfileId: actor.companyId, assetId: asset.id }, select: { id: true } })) return assetFail('NOT_FOUND');
    const prepared = await prepareAssetFile(file, kind);
    const sha256 = createHash('sha256').update(prepared.bytes).digest('hex');
    const existing = await tx.companyAssetFile.findFirst({ where: { id: requestId, companyProfileId: actor.companyId } });
    if (existing) {
      if (existing.assetId !== asset.id || existing.repairId !== repairId || existing.kind !== kind || existing.sha256 !== sha256 || existing.name !== prepared.name || existing.uploadedByUserId !== actor.userId || existing.uploadedByWorkerId !== actor.workerId) return assetFail('CONFLICT');
      return { id: existing.id, url: url(existing.id) };
    }
    const totals = await tx.companyAssetFile.aggregate({ where: { companyProfileId: actor.companyId, assetId: asset.id, repairId }, _count: true, _sum: { size: true } });
    if (totals._count >= MAX_REPAIR_FILES || (totals._sum.size ?? 0) + prepared.bytes.length > MAX_REPAIR_FILE_BYTES) return assetFail('FILE_LIMIT');
    const uploadedAt = new Date();
    await tx.companyAssetFile.create({ data: {
      id: requestId, companyProfileId: actor.companyId, assetId: asset.id, repairId, kind,
      mime: prepared.mime, name: prepared.name, size: prepared.bytes.length, dataBytes: prepared.bytes, sha256,
      uploadedByUserId: actor.userId, uploadedByWorkerId: actor.workerId, uploadedByName: actor.name,
      createdAt: uploadedAt,
    } });
    if (kind === 'cover' && asset.machineId) {
      // Fleet, map and the existing vehicle card share this current-photo path.
      // The immutable file above keeps its history; retries never replace a newer photo.
      await tx.assetPhoto.upsert({
        where: { companyProfileId_machineId: { companyProfileId: actor.companyId, machineId: asset.machineId } },
        create: { companyProfileId: actor.companyId, machineId: asset.machineId, data: prepared.bytes },
        update: { data: prepared.bytes },
      });
      await tx.machine.update({ where: { id: asset.machineId, companyProfileId: actor.companyId }, data: { coverPhotoAt: uploadedAt } });
    }
    await tx.companyOperationalAsset.update({ where: { id: asset.id, companyProfileId: actor.companyId }, data: { revision: { increment: 1 } } });
    await tx.companyAssetEvent.create({ data: {
      companyProfileId: actor.companyId, assetId: asset.id, repairId, type: kind === 'invoice' ? 'invoice-added' : kind === 'cover' ? 'cover-added' : 'file-added',
      actorKey: assetActorKey(actor), actorName: actor.name, note: kind === 'invoice' ? '' : prepared.name,
    } });
    return { id: requestId, url: url(requestId) };
  }, { timeout: 20000 });
}

export async function readCompanyAssetFile(fileId: string) {
  const actor = await assetActor();
  id.parse(fileId);
  return withTenantContext(actor.companyId, async tx => {
    const file = await tx.companyAssetFile.findFirst({ where: { id: fileId, companyProfileId: actor.companyId }, include: { asset: { select: { machineId: true, inventoryItemId: true } } } });
    if (!file || (file.kind === 'invoice' && !actor.canRepair)) return assetFail('NOT_FOUND');
    const ref = file.asset.machineId ? { kind: 'machine' as const, id: file.asset.machineId } : { kind: 'inventory' as const, id: file.asset.inventoryItemId! };
    const asset = await readOwnedAsset(tx, actor, ref);
    await assertAssetVisible(tx, actor, asset);
    return { bytes: file.dataBytes, mime: file.mime, name: file.name };
  });
}
