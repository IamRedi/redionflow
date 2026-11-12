import { currentOfficeAccess } from './access';
import { withTenantContext } from '@/lib/db/tenant-context';
import { OfficeError } from './work-access';
import { beginWorkerSession } from '@/lib/workzone/session-start';

/** Resolve the signed-in person's immutable worker link. Never accept a target ID from the browser. */
async function ownOfficeWorker() {
  const access = await currentOfficeAccess();
  if (!access || process.env.VIRTUAL_OFFICE_WORK_ENABLED !== 'true') throw new OfficeError('DENIED');
  let workerId: string | undefined;
  if (access.kind === 'worker') workerId = access.id;
  else if (access.seat !== 'staff') {
    const config = JSON.parse(process.env.VIRTUAL_OFFICE_ACCESS_JSON!);
    workerId = config[access.seat]?.workerId;
  } else {
    workerId = (await withTenantContext(access.companyId, tx => tx.officeMember.findFirst({
      where: { companyProfileId: access.companyId, userId: access.id, enabled: true }, select: { workerId: true },
    })))?.workerId ?? undefined;
  }
  if (!workerId) throw new OfficeError('NOT_FOUND');
  const worker = await withTenantContext(access.companyId, tx => tx.worker.findFirst({
    where: { id: workerId, companyProfileId: access.companyId, status: 'active' }, select: { id: true, availability: true },
  }));
  if (!worker) throw new OfficeError('NOT_FOUND');
  return { ...access, worker };
}

export async function ownOfficePresence() {
  const actor = await ownOfficeWorker();
  const session = await withTenantContext(actor.companyId, tx => tx.workSession.findFirst({
    where: { workerId: actor.worker.id, isLive: true, endTime: null }, orderBy: { startTime: 'desc' }, select: { workplace: true },
  }));
  return { active: session?.workplace === 'OFFICE', profile: actor.kind === 'admin' ? `/workzone/admin-workers/${actor.worker.id}` : '/workzone/profile' };
}

export async function startOwnOfficeWork() {
  const actor = await ownOfficeWorker();
  if (actor.worker.availability !== 'AVAILABLE') throw new OfficeError('CONFLICT');
  await beginWorkerSession({ companyId: actor.companyId, workerId: actor.worker.id, start: new Date(), siteId: null, workplace: 'OFFICE', moveExisting: true });
}
