import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { withTenantContext } from '@/lib/db/tenant-context';
import { compactPhoto, MAX_PHOTO_BYTES } from '@/lib/asset-photos/image';
import { scanFileContent } from '@/lib/storage/content-scan';
import { officeActor, OfficeError, type OfficeActor } from './work-access';

export type OfficeArtworkState = { memberId: string; version: number; custom: boolean; editable: boolean };

async function visibleRoom(tx: Prisma.TransactionClient, actor: OfficeActor, id: string) {
  if (actor.people.some(p => p.id === id)) return;
  // Managers can preview a prepared, disabled room, as in the directory.
  if (actor.manager && process.env.VIRTUAL_OFFICE_TEAM_ENABLED === 'true' &&
    await tx.officeMember.findFirst({ where: { id, companyProfileId: actor.companyId, enabled: false, worker: { status: 'active' } }, select: { id: true } })) return;
  throw new OfficeError('NOT_FOUND');
}

export async function officeArtworkState(memberId?: string): Promise<OfficeArtworkState> {
  const actor = await officeActor(), id = memberId ?? actor.principalId;
  return withTenantContext(actor.companyId, async tx => {
    await visibleRoom(tx, actor, id);
    const row = await tx.officeArtwork.findFirst({ where: { memberId: id, companyProfileId: actor.companyId }, select: { version: true, data: false } });
    // Do not transfer image bytes into the server-component payload.
    const custom = row ? await tx.officeArtwork.count({ where: { memberId: id, companyProfileId: actor.companyId, data: { not: null } } }) > 0 : false;
    return { memberId: id, version: row?.version ?? 0, custom, editable: id === actor.principalId };
  });
}

export async function readOfficeArtwork(memberId: string) {
  z.string().min(1).max(128).parse(memberId);
  const actor = await officeActor();
  return withTenantContext(actor.companyId, async tx => {
    await visibleRoom(tx, actor, memberId);
    return (await tx.officeArtwork.findFirst({ where: { memberId, companyProfileId: actor.companyId }, select: { data: true } }))?.data ?? null;
  });
}

/** Target is derived from the signed-in person; there is no target input. */
export async function saveOfficeArtwork(form: FormData) {
  const version = z.coerce.number().int().min(0).parse(form.get('version'));
  const reset = form.get('reset') === 'true', actor = await officeActor();
  const file = form.get('photo');
  if (!reset && (!(file instanceof File) || !file.size || file.size > MAX_PHOTO_BYTES)) throw new OfficeError('INVALID');
  const input = !reset && file instanceof File ? new Uint8Array(await file.arrayBuffer()) : null;
  return withTenantContext(actor.companyId, async tx => {
    await tx.$executeRaw`SELECT set_config('app.current_office_member_id',${actor.principalId},true)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`office-artwork:${actor.companyId}:${actor.principalId}`}))`;
    // Recheck live identity after acquiring the write lock.
    if (actor.manager) {
      if (!await tx.user.findFirst({ where: { id: actor.principalId, companyProfileId: actor.companyId, isActive: true, role: 'ADMIN' }, select: { id: true } })) throw new OfficeError('DENIED');
      await tx.officeMember.upsert({ where: { id: actor.principalId }, update: {}, create: { id: actor.principalId, companyProfileId: actor.companyId, userId: actor.principalId, title: actor.people.find(p => p.id === actor.principalId)!.title, enabled: false } });
    } else if (!await tx.officeMember.findFirst({ where: { id: actor.principalId, companyProfileId: actor.companyId, enabled: true, OR: [{ worker: { status: 'active' } }, { user: { isActive: true } }] }, select: { id: true } })) throw new OfficeError('DENIED');
    const old = await tx.officeArtwork.findFirst({ where: { memberId: actor.principalId, companyProfileId: actor.companyId }, select: { version: true } });
    if ((old?.version ?? 0) !== version) throw new OfficeError('CONFLICT');
    let data: Uint8Array<ArrayBuffer> | null = null;
    if (input) {
      const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(71402004) AS locked`;
      if (!lock.locked) throw new OfficeError('LIMIT');
      if (!(await scanFileContent(new File([input], 'office-photo', { type: (file as File).type }))).ok) throw new OfficeError('INVALID');
      // Same bounded decoder as other app photos: auto-orient, no EXIF/GPS.
      const photo = await compactPhoto(input).catch(() => { throw new OfficeError('INVALID'); });
      data = new Uint8Array(photo.data);
    }
    const row = old
      ? await tx.officeArtwork.update({ where: { memberId: actor.principalId }, data: { data, version: { increment: 1 } }, select: { version: true } })
      : await tx.officeArtwork.create({ data: { memberId: actor.principalId, companyProfileId: actor.companyId, data }, select: { version: true } });
    await tx.auditLog.create({ data: { companyProfileId: actor.companyId, actorType: actor.kind === 'worker' ? 'WORKER' : 'ADMIN', actorId: actor.id, action: reset ? 'office.artwork_reset' : 'office.artwork_updated', payload: { memberId: actor.principalId, version: row.version, bytes: data?.length ?? 0 } } });
    return { memberId: actor.principalId, version: row.version, custom: !reset, editable: true };
  }, { timeout: 20000 });
}
