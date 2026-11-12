import { currentOfficeAccess } from './access';
import { withTenantContext } from '@/lib/db/tenant-context';
import { OfficeError, type OfficeActor } from './work-access';
import { beginWorkerSession } from '@/lib/workzone/session-start';
import { stopWorkerSessionAction } from '@/app/(workzone)/workzone/hr-actions';
import { defaultBreakForRange } from '@/lib/workzone/session-rules';
import { parseWorkDateTime, workDateTimeInput } from '@/lib/workzone/date-utils';

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
    where: { workerId: actor.worker.id, isLive: true, endTime: null }, orderBy: { startTime: 'desc' }, select: { id: true, workplace: true, pauseIntervals: { where: { endedAt: null }, select: { id: true }, take: 1 } },
  }));
  return { active: session?.workplace === 'OFFICE', sessionId: session?.workplace === 'OFFICE' ? session.id : null, paused: !!session?.pauseIntervals.length, profile: actor.kind === 'admin' ? `/workzone/admin-workers/${actor.worker.id}` : '/workzone/profile' };
}

export async function startOwnOfficeWork() {
  const actor = await ownOfficeWorker();
  if (actor.worker.availability !== 'AVAILABLE') throw new OfficeError('CONFLICT');
  await beginWorkerSession({ companyId: actor.companyId, workerId: actor.worker.id, start: new Date(), siteId: null, workplace: 'OFFICE', moveExisting: true });
  return actor.companyId;
}

/** Stop only the office session rendered for this person, using the existing pause/hour/undo rules. */
export async function stopOwnOfficeWork(sessionId: unknown) {
  if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 128) throw new OfficeError('INVALID');
  const actor = await ownOfficeWorker();
  const session = await withTenantContext(actor.companyId, tx => tx.workSession.findFirst({
    where: { id: sessionId, workerId: actor.worker.id, workplace: 'OFFICE', baustelleId: null, isLive: true, endTime: null }, select: { id: true, startTime: true },
  }));
  if (!session) throw new OfficeError('CONFLICT');
  const now = new Date(), end = parseWorkDateTime(workDateTimeInput(now))!;
  // A one-click stop needs the real instant: minute-only input can precede a just-started session.
  const result = await stopWorkerSessionAction({ sessionId: session.id, expectedWorkplace: 'OFFICE', endTime: now.toISOString(), breakMinutes: defaultBreakForRange(session.startTime, end) });
  if (!result.ok) throw new OfficeError('CONFLICT');
  return actor.companyId;
}

/** Share only present/paused status for the already-visible directory, never hours or private work. */
export async function directoryOfficePresence(actor: OfficeActor) {
  const config = JSON.parse(process.env.VIRTUAL_OFFICE_ACCESS_JSON!);
  return withTenantContext(actor.companyId, async tx => {
    const links = new Map<string, string>();
    for (const seat of ['megi', 'almet'] as const) {
      if (config[seat]?.workerId && actor.people.some(p => p.id === config[seat].adminId)) links.set(config[seat].adminId, config[seat].workerId);
    }
    const directors = new Set(links.values());
    const members = await tx.officeMember.findMany({ where: { companyProfileId: actor.companyId, id: { in: actor.people.filter(p => p.seat === 'staff').map(p => p.id) }, enabled: true, workerId: { not: null } }, select: { id: true, workerId: true } });
    for (const member of members) if (member.workerId && !directors.has(member.workerId)) links.set(member.id, member.workerId);
    const sessions = await tx.workSession.findMany({
      where: { workerId: { in: [...links.values()] }, worker: { companyProfileId: actor.companyId, status: 'active', availability: 'AVAILABLE' }, workplace: 'OFFICE', baustelleId: null, isLive: true, endTime: null },
      select: { workerId: true, pauseIntervals: { where: { endedAt: null }, select: { id: true }, take: 1 } },
    });
    const byWorker = new Map(sessions.map(s => [s.workerId, s.pauseIntervals.length ? 'paused' as const : 'active' as const]));
    return new Map([...links].flatMap(([personId, workerId]) => byWorker.has(workerId) ? [[personId, byWorker.get(workerId)!] as const] : []));
  });
}
