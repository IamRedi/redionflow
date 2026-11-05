import { getCurrentCompanyId } from '@/lib/db/tenant';
import { withTenantContext } from '@/lib/db/tenant-context';
import { getRequesterContext, type RequesterContext } from '@/lib/assistant/requester';

const BURST_MS = 600_000, DAY_MS = 86_400_000;
type Denied = { ok: false; status: 403 | 429 | 503; reason: 'rate' | 'budget' | 'unavailable'; retryAfterSeconds: number };
export type SteelImageQuota = { ok: true } | Denied;
class ImageQuotaDenied extends Error {
  constructor(readonly result: Denied) { super('Steel image quota denied'); }
}
const actorKey = (actor: RequesterContext) => actor.kind === 'anonymous' ? null : `${actor.kind}:${actor.kind === 'admin' ? actor.adminId : actor.workerId}`;

/** Separate image-request ceilings. Failed provider calls keep their reservation. */
export async function reserveSteelImageQuota(requester: RequesterContext, now = new Date()): Promise<SteelImageQuota> {
  try {
    const [companyId, current] = await Promise.all([getCurrentCompanyId(), getRequesterContext()]);
    const actor = actorKey(requester);
    if (!actor || !companyId || companyId !== requester.companyId || current.companyId !== companyId || actorKey(current) !== actor) return { ok: false, status: 403, reason: 'unavailable', retryAfterSeconds: 60 };
    if (!Number.isFinite(now.getTime())) throw new Error('Invalid quota time');
    const burstStart = new Date(Math.floor(now.getTime() / BURST_MS) * BURST_MS), dayStart = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);
    const buckets = [
      { actorKey: 'company', window: 'image-burst', windowStart: burstStart, limit: 2, duration: BURST_MS },
      { actorKey: actor, window: 'image-burst', windowStart: burstStart, limit: 1, duration: BURST_MS },
      { actorKey: 'company', window: 'image-day', windowStart: dayStart, limit: 10, duration: DAY_MS },
      { actorKey: actor, window: 'image-day', windowStart: dayStart, limit: 5, duration: DAY_MS },
    ];
    return await withTenantContext(companyId, async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`assistant-image:${companyId}`}))`;
      for (const bucket of buckets) {
        const row = await tx.assistantQuotaBucket.findUnique({ where: { companyProfileId_actorKey_window_windowStart: { companyProfileId: companyId, actorKey: bucket.actorKey, window: bucket.window, windowStart: bucket.windowStart } }, select: { requests: true } });
        if ((row?.requests ?? 0) >= bucket.limit) throw new ImageQuotaDenied({ ok: false, status: 429, reason: bucket.window === 'image-day' ? 'budget' : 'rate', retryAfterSeconds: Math.max(1, Math.ceil((bucket.windowStart.getTime() + bucket.duration - now.getTime()) / 1_000)) });
      }
      for (const bucket of buckets) await tx.assistantQuotaBucket.upsert({
        where: { companyProfileId_actorKey_window_windowStart: { companyProfileId: companyId, actorKey: bucket.actorKey, window: bucket.window, windowStart: bucket.windowStart } },
        create: { companyProfileId: companyId, actorKey: bucket.actorKey, window: bucket.window, windowStart: bucket.windowStart, requests: 1, tokens: 0 },
        update: { requests: { increment: 1 }, tokens: 0 },
      });
      await tx.assistantQuotaBucket.deleteMany({ where: { companyProfileId: companyId, window: { in: ['image-burst', 'image-day'] }, windowStart: { lt: new Date(dayStart.getTime() - 32 * DAY_MS) } } });
      return { ok: true };
    });
  } catch (error) {
    if (error instanceof ImageQuotaDenied) return error.result;
    return { ok: false, status: 503, reason: 'unavailable', retryAfterSeconds: 60 };
  }
}
