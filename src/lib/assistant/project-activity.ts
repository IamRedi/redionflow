import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { FIELD_STAGES } from '@/lib/elements/stages';
import { FACTORY_STEP_KEYS } from '@/lib/factory/production';
import { fuelTimeZone } from '@/lib/fleet/fuel/time';
import type { RequesterContext } from './requester';

type Scope = 'any' | 'factory' | 'site';
type Input = { scope?: Scope; includeInactive?: boolean; limit?: number; cursor?: string };
const error = (code: string, message: string) => ({ ok: false as const, code, message });

/** A stored confirmation/clock-in is evidence of recorded activity, never a physical-start guess. */
export async function adminGetStartedSteelProjects(requester: RequesterContext, input: Input = {}) {
  if (requester.kind !== 'admin' || !requester.companyId || !requester.adminId) return error('ADMIN_REQUIRED', 'A current company administrator is required.');
  const scope = input.scope ?? 'any', limit = input.limit ?? 8;
  if (!['any', 'factory', 'site'].includes(scope) || !Number.isInteger(limit) || limit < 1 || limit > 30 ||
      (input.includeInactive !== undefined && typeof input.includeInactive !== 'boolean') ||
      (input.cursor !== undefined && !/^[a-z0-9_-]{1,120}$/i.test(input.cursor))) return error('INVALID_INPUT', 'Use any/factory/site scope and a valid bounded page.');
  const now = new Date(), companyId = requester.companyId;
  try {
    return await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
      const company = await tx.companyProfile.findFirst({ where: { id: companyId, mode: 'bau', users: { some: { id: requester.adminId, role: 'ADMIN', isActive: true } } }, select: { country: true } });
      if (!company) return error('ACCESS_DENIED', 'No authorized steel company exists for this administrator.');
      const factory = scope !== 'site', field = scope !== 'factory';
      const workWhere: Prisma.SiteElementWorkWhereInput = {
        companyProfileId: companyId, checkedAt: { lte: now },
        OR: [
          ...(factory ? [
            { stage: { in: [...FACTORY_STEP_KEYS] }, element: { companyProfileId: companyId, list: 'assembly' } },
            { stage: 'cutting', element: { companyProfileId: companyId, list: 'part' } },
          ] : []),
          ...(field ? [{ stage: { in: [...FIELD_STAGES] }, element: { companyProfileId: companyId, list: 'assembly' } }] : []),
        ],
      };
      // A planned future session, empty/non-live placeholder or future close is not work evidence.
      const sessionWhere: Prisma.WorkSessionWhereInput = {
        worker: { companyProfileId: companyId }, startTime: { lte: now },
        OR: [{ endTime: null, isLive: true }, { endTime: { lte: now, gt: tx.workSession.fields.startTime } }],
      };
      // Creation/import/note/block-only audit records do not prove production work.
      const eventWhere: Prisma.ProductionEventWhereInput = { companyProfileId: companyId, createdAt: { lte: now },
        stepKey: { in: [...FACTORY_STEP_KEYS] },
        OR: [{ action: 'start', toStatus: 'active' }, { action: 'done', toStatus: 'done' }],
        batch: { companyProfileId: companyId },
      };
      const activity: Prisma.BaustelleWhereInput[] = [
        { siteElements: { some: { companyProfileId: companyId, work: { some: workWhere } } } },
        ...(field ? [{ workSessions: { some: sessionWhere } }] : []),
        ...(factory ? [{ productionBatches: { some: { companyProfileId: companyId, events: { some: eventWhere } } } }] : []),
      ];
      const where: Prisma.BaustelleWhereInput = { companyProfileId: companyId, type: 'STEEL_ASSEMBLY',
        ...(input.includeInactive ? {} : { status: 'active' }), OR: activity };
      if (input.cursor && !await tx.baustelle.findFirst({ where: { AND: [where, { id: input.cursor }] }, select: { id: true } })) return error('INVALID_CURSOR', 'The cursor is not in this activity query.');
      const totalMatches = await tx.baustelle.count({ where });
      const rows = await tx.baustelle.findMany({ where: { AND: [where, ...(input.cursor ? [{ id: { gt: input.cursor } }] : [])] },
        orderBy: { id: 'asc' }, take: limit + 1, select: { id: true, name: true, status: true } });
      const page = rows.slice(0, limit), hasMore = rows.length > limit;
      const projects = await Promise.all(page.map(async project => {
        const confirmations = await tx.siteElementWork.aggregate({ where: { AND: [workWhere, { element: { baustelleId: project.id, companyProfileId: companyId } }] }, _min: { checkedAt: true }, _max: { checkedAt: true } });
        const sessions = field ? await tx.workSession.aggregate({ where: { AND: [sessionWhere, { baustelleId: project.id }] }, _min: { startTime: true }, _max: { startTime: true } }) : null;
        const events = factory ? await tx.productionEvent.aggregate({ where: { AND: [eventWhere, { batch: { companyProfileId: companyId, baustelleId: project.id } }] }, _min: { createdAt: true }, _max: { createdAt: true } }) : null;
        const starts = [confirmations._min.checkedAt, sessions?._min.startTime, events?._min.createdAt].filter((d): d is Date => !!d);
        const ends = [confirmations._max.checkedAt, sessions?._max.startTime, events?._max.createdAt].filter((d): d is Date => !!d);
        return { id: project.id, name: project.name, status: project.status,
          firstRecordedAt: starts.length ? new Date(Math.min(...starts.map(d => d.getTime()))).toISOString() : null,
          lastRecordedAt: ends.length ? new Date(Math.max(...ends.map(d => d.getTime()))).toISOString() : null,
          basis: [ ...(confirmations._min.checkedAt ? ['production_confirmation'] : []), ...(sessions?._min.startTime ? ['site_clock_in'] : []), ...(events?._min.createdAt ? ['legacy_factory_start_or_done'] : []) ],
        };
      }));
      return { ok: true as const, source: 'Stored project activity', retrievedAt: now.toISOString(), timeZone: fuelTimeZone(company.country),
        scope, includeInactive: input.includeInactive ?? false, totalMatches, returned: projects.length,
        complete: !input.cursor && !hasMore, pageComplete: !hasMore, nextCursor: hasMore ? projects.at(-1)!.id : null, projects,
        definition: 'Projects with current stored work evidence; active/imported/created alone does not mean started. This is not independently observed physical work or proof work is ongoing.',
        scopeDefinition: scope === 'factory' ? 'Factory stage confirmations and dated legacy factory start/done events.' : scope === 'site' ? 'Field-stage confirmations or actual project clock-ins.' : 'Any factory/field confirmation, actual project clock-in or dated legacy factory start/done event.',
        evidenceTimes: 'Confirmation time, clock-in start time or legacy event time; not an exact physical work-start/end time.',
      };
    }, { isolationLevel: 'RepeatableRead' });
  } catch {
    return error('READ_UNAVAILABLE', 'Project activity could not be read. Do not treat this as zero started projects.');
  }
}
