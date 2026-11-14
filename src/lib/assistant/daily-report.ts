import { prisma } from '@/lib/db/prisma';
import { addMetric, dayKey, emptyMetric, measure, STEEL_TYPES, type Metric } from '@/lib/dashboard/steel-metrics';
import { fuelTimeZone } from '@/lib/fleet/fuel/time';
import { steelPhasesFor, STEEL_TASK_PREFIX } from '@/lib/workzone/steel-phases';
import { assistantDayBounds } from './turn-context';
import { assistantHoursSnapshot } from './hours-data';
import type { RequesterContext } from './requester';

/** Steel work is not tree work. One fresh tenant snapshot, with complete totals
 * kept separate from bounded worker/project/process detail lists. */
export async function adminGetSteelDailyReport(requester: RequesterContext, input: { date: string; workerId?: string }) {
  if (requester.kind !== 'admin') return { ok: false as const, code: 'ADMIN_REQUIRED' };
  const now = new Date();
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${requester.companyId}, true)`;
    const company = await tx.companyProfile.findFirst({ where: { id: requester.companyId, mode: 'bau', users: { some: { id: requester.adminId, role: 'ADMIN', isActive: true } } }, select: { id: true, country: true } });
    if (!company || !await tx.baustelle.findFirst({ where: { companyProfileId: company.id, type: { in: [...STEEL_TYPES] } }, select: { id: true } })) return { ok: false as const, code: 'ACCESS_DENIED' };
    const zone = fuelTimeZone(company.country), bounds = assistantDayBounds(input.date, zone);
    if (!bounds || input.date > dayKey(now, zone)) return { ok: false as const, code: 'INVALID_REPORT_DATE' };
    const from = bounds.start, to = new Date(Math.min(+bounds.end, +now));
    const worker = input.workerId ? await tx.worker.findFirst({ where: { id: input.workerId, companyProfileId: company.id }, select: { id: true, firstName: true, lastName: true } }) : null;
    if (input.workerId && !worker) return { ok: false as const, code: 'WORKER_NOT_FOUND' };
    const sessionScope = { worker: { companyProfileId: company.id }, startTime: { gte: from, lt: to }, ...(worker ? { workerId: worker.id } : {}) };
    const [hours, openRows, closedRows, work, phases, note, sessions] = await Promise.all([
      assistantHoursSnapshot(tx, requester, { from, to, now }),
      tx.workSession.count({ where: { ...sessionScope, endTime: null } }),
      tx.workSession.count({ where: { ...sessionScope, endTime: { not: null } } }),
      tx.siteElementWork.findMany({ where: { companyProfileId: company.id, checkedAt: { gte: from, lt: to }, element: { companyProfileId: company.id, list: { in: ['assembly', 'part'] }, baustelle: { companyProfileId: company.id, type: 'STEEL_ASSEMBLY' } }, ...(worker ? { workerIds: { has: worker.id } } : {}) },
        select: { id: true, checkedAt: true, stage: true, pieces: true, productionSnapshot: true, element: { select: { id: true, list: true, mark: true, quantity: true, weightKg: true, baustelleId: true, baustelle: { select: { name: true } } } } }, take: 10001 }),
      // The checker is NOT the operator. Never turn this into worker output.
      worker ? Promise.resolve(null) : tx.treeItem.count({ where: { status: 'done', completedAt: { gte: from, lt: to }, OR: [{ treeId: { in: [...steelPhasesFor('STEEL_ASSEMBLY'), ...steelPhasesFor('STEEL_WORKSHOP')].map(p => p.treeId) } }, { treeId: { startsWith: STEEL_TASK_PREFIX } }], baustelle: { companyProfileId: company.id, type: 'STEEL_ASSEMBLY' }, steelTask: { companyProfileId: company.id, enabled: true, definition: { archivedAt: null } } } }),
      worker ? tx.workReportNote.findFirst({ where: { workerId: worker.id, worker: { companyProfileId: company.id }, type: 'DAILY', periodKey: input.date }, select: { note: true, updatedAt: true } }) : Promise.resolve(null),
      worker ? tx.workSession.findMany({ where: sessionScope, select: { startTime: true, endTime: true, breakMinutes: true, workplace: true, baustelle: { select: { name: true } } }, orderBy: { startTime: 'asc' }, take: 20 }) : Promise.resolve([]),
    ]);
    if (!hours || work.length > 10000) return { ok: false as const, code: 'REPORT_UNAVAILABLE', message: 'Narrow this report or use the paginated production evidence; no complete report is available.' };
    const recorded = hours.workers.filter(w => !worker || w.workerId === worker.id);
    const historicalOpen = input.date < dayKey(now, zone) && openRows > 0;
    const processes = new Map<string, { list: string; stage: string; metric: Metric }>();
    const projects = new Map<string, { id: string; name: string; checks: number }>();
    for (const row of work) {
      const value = measure({ ...row, elementId: row.element.id }, { ...row.element, work: [], factoryDoneAt: null, fieldDoneAt: null });
      const key = `${value.list}:${row.stage}`, group = processes.get(key) ?? { list: value.list, stage: row.stage, metric: emptyMetric() };
      addMetric(group.metric, value); processes.set(key, group);
      const project = projects.get(row.element.baustelleId) ?? { id: row.element.baustelleId, name: row.element.baustelle.name, checks: 0 };
      project.checks++; projects.set(project.id, project);
    }
    const processRows = [...processes.values()].sort((a, b) => `${a.list}:${a.stage}`.localeCompare(`${b.list}:${b.stage}`));
    const projectRows = [...projects.values()].sort((a, b) => a.name.localeCompare(b.name));
    const definitions = processRows.length ? await tx.steelWorkDefinition.findMany({ where: { companyProfileId: company.id, key: { in: processRows.map(p => p.stage) }, kind: { in: ['factory', 'field'] } }, select: { key: true, label: true } }) : [];
    const totalHours = worker ? recorded.reduce((n, w) => n + w.hours, 0) : hours.totalHours;
    return { ok: true as const, date: input.date, worker: worker ? { id: worker.id, name: `${worker.firstName} ${worker.lastName}`.trim() } : null,
      source: { retrievedAt: now.toISOString(), timeZone: zone, periodFrom: from.toISOString(), periodToExclusive: to.toISOString(), readOnly: true, snapshot: 'repeatable-read' },
      attendance: { recordedWorkers: recorded.length, sessionRows: openRows + closedRows, closedRows, openRows, complete: !historicalOpen, totalHours: historicalOpen ? null : Math.round(totalHours * 100) / 100,
        workers: recorded.slice(0, 20).map(w => ({ ...w, hours: historicalOpen ? null : w.hours })), workersComplete: recorded.length <= 20 },
      production: { checks: work.length, projectCount: projectRows.length, projects: projectRows.slice(0, 20), projectsComplete: projectRows.length <= 20,
        processCount: processRows.length, processes: processRows.slice(0, 30).map(p => ({ ...p, label: definitions.find(d => d.key === p.stage)?.label || p.stage })), processesComplete: processRows.length <= 30 },
      selectedPhasesConfirmed: phases,
      ...(worker ? { workbook: { note: note ? { text: note.note.slice(0, 4000), truncated: note.note.length > 4000, updatedAt: note.updatedAt.toISOString() } : null, sessions, sessionsComplete: openRows + closedRows <= 20 } } : {}),
      interpretation: 'Hours are recorded sessions started on this company day, not productivity or proof of attendance. An old unclosed session makes historical hours unknown. Production is confirmation-time throughput, grouped separately by list and stage; never sum stage kg/pieces into unique steel output. Worker-filtered production uses credited team IDs only, not the checker; shared team output is not individual productivity. Selected phases are still-marked-done enabled phase checks, not trees, element pieces, or the checker\'s personal output. Detail lists are bounded; exact counts are separate.',
    };
  }, { isolationLevel: 'RepeatableRead', timeout: 20000 });
}

export type SteelDailyReport = Awaited<ReturnType<typeof adminGetSteelDailyReport>>;
