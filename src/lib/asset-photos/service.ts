import { withTenantContext } from '@/lib/db/tenant-context';
import { fleetActor } from '@/lib/fleet/access';
import { compactPhoto, MAX_PHOTO_BYTES } from './image';
import { assetPhotoUrl, type PhotoKind } from './shared';
import { mayUploadSiteDocuments } from '@/lib/site-phase-documents/site-access';
import { scanFileContent } from '@/lib/storage/content-scan';
const validId = /^[a-z0-9]{10,40}$/i;
const validPhotoId = (kind: PhotoKind, id: string) => kind === 'worker'
  ? /^[a-z0-9_-]{1,128}$/i.test(id)
  : validId.test(id);
export async function saveAssetPhoto(kind: PhotoKind, id: string, file: File) {
  const a = await fleetActor();
  if (!validPhotoId(kind, id) || !['machine', 'site', 'worker'].includes(kind))
    throw new Error('PHOTO_NOT_FOUND');
  const owned = await withTenantContext(a.companyId, async (tx) =>
    kind === 'machine'
      ? tx.machine.findFirst({
          where: { id, companyProfileId: a.companyId },
          select: { id: true },
        })
      : kind === 'worker'
      ? tx.worker.findFirst({ where: { id, companyProfileId: a.companyId }, select: { id: true } })
      : tx.baustelle.findFirst({
          where: { id, companyProfileId: a.companyId },
          select: { id: true, type: true },
        }),
  );
  if (!owned) throw new Error('PHOTO_NOT_FOUND');
  let allowed = kind === 'worker'
    ? a.isAdmin || a.workerId === id
    : a.can.office ||
    (kind === 'site' &&
      ('type' in owned && owned.type === 'STEEL_WORKSHOP'
        ? a.can.factorySteps
        : a.can.siteSteps));
  if(kind==='site'&&'type' in owned&&owned.type==='STEEL_ASSEMBLY')allowed=await withTenantContext(a.companyId,tx=>mayUploadSiteDocuments(tx,a,id));
  if (!allowed) throw new Error('PHOTO_DENIED');
  if (!(file instanceof File) || !file.size || file.size > MAX_PHOTO_BYTES)
    throw new Error('PHOTO_FILE');
  const input = new Uint8Array(await file.arrayBuffer());
  return withTenantContext(
    a.companyId,
    async (tx) => {
      // One bounded native conversion across replicas; preserve the old photo
      // on failures, and commit the compressed image + audit atomically.
      const [lock] = await tx.$queryRaw<
        Array<{ locked: boolean }>
      >`SELECT pg_try_advisory_xact_lock(71402004) AS locked`;
      if (!lock.locked) throw new Error('PHOTO_BUSY');
      if (kind === 'worker') {
        const scan = await scanFileContent(new File([input], 'profile-photo', { type: file.type }));
        if (!scan.ok) throw new Error('PHOTO_FILE');
      }
      if(kind==='site'&&'type' in owned&&owned.type==='STEEL_ASSEMBLY'&&!await mayUploadSiteDocuments(tx,a,id))throw new Error('PHOTO_DENIED');
      const photo = await compactPhoto(input),
        at = new Date();
      const data = { coverPhotoAt: at };
      const result =
        kind === 'machine'
          ? await tx.machine.updateMany({
              where: { id, companyProfileId: a.companyId },
              data,
            })
          : kind === 'worker'
          ? await tx.worker.updateMany({ where: { id, companyProfileId: a.companyId }, data: { profileImageUrl: assetPhotoUrl('worker', id, at) } })
          : await tx.baustelle.updateMany({
              where: { id, companyProfileId: a.companyId },
              data,
            });
      if (result.count !== 1) throw new Error('PHOTO_NOT_FOUND');
      const target =
        kind === 'machine' ? { machineId: id } : kind === 'worker' ? { workerId: id } : { baustelleId: id };
      await tx.assetPhoto.upsert({
        where:
          kind === 'machine'
            ? {
                companyProfileId_machineId: {
                  companyProfileId: a.companyId,
                  machineId: id,
                },
              }
            : kind === 'worker'
            ? { companyProfileId_workerId: { companyProfileId: a.companyId, workerId: id } }
            : {
                companyProfileId_baustelleId: {
                  companyProfileId: a.companyId,
                  baustelleId: id,
                },
              },
        create: {
          companyProfileId: a.companyId,
          ...target,
          data: new Uint8Array(photo.data),
        },
        update: { data: new Uint8Array(photo.data) },
      });
      await tx.auditLog.create({
        data: {
          companyProfileId: a.companyId,
          actorType: a.workerId ? 'WORKER' : 'ADMIN',
          actorId: (a.workerId ?? a.userId)!,
          action: 'asset.photo_updated',
          payload: {
            kind,
            id,
            bytes: photo.data.length,
            width: photo.width,
            height: photo.height,
          },
        },
      });
      return { url: assetPhotoUrl(kind, id, at)!, bytes: photo.data.length };
    },
    { timeout: 20000 },
  );
}
export async function readAssetPhoto(kind: PhotoKind, id: string) {
  const a = await fleetActor();
  if (!validPhotoId(kind, id) || !['machine', 'site', 'worker'].includes(kind)) return null;
  const row = await withTenantContext(a.companyId, (tx) =>
    tx.assetPhoto.findFirst({
      where: {
        companyProfileId: a.companyId,
        ...(kind === 'machine' ? { machineId: id } : kind === 'worker' ? { workerId: id } : { baustelleId: id }),
      },
      select: { data: true },
    }),
  );
  return row?.data ?? null;
}
