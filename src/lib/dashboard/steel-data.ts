import { withTenantContext } from '@/lib/db/tenant-context';
import { fuelTimeZone } from '@/lib/fleet/fuel/time';
import { addMetric, calendarMetrics, dayKey, emptyMetric, emptyMetrics, measure, midnight, monthDays, monthKey, nextDay, projectProgress, seriesFor, shiftMonth, STEEL_TYPES, type Metric } from './steel-metrics';
export type SteelParams = {
    month?: string;
    day?: string;
    project?: string;
    cursor?: string;
    week?: string;
};
export async function steelDashboardData(company: {
    id: string;
    country: string;
    displayName: string;
}, params: SteelParams, readOnly: boolean, now = new Date(), options: { piecesOnly?: boolean } = {}) {
    const zone = fuelTimeZone(company.country), today = dayKey(now, zone), month = monthKey(params.month, today);
    const day = monthDays(month).includes(params.day ?? '') ? params.day! : today.startsWith(month) ? today : `${month}-01`;
    const projects = await withTenantContext(company.id, tx => tx.baustelle.findMany({
        where: { companyProfileId: company.id, type: { in: [...STEEL_TYPES] }, NOT: { type: 'STEEL_WORKSHOP' } },
        select: { id: true, name: true, status: true }, orderBy: { name: 'asc' },
    }));
    const selectedProject = projects.some(p => p.id === params.project) ? params.project! : '';
    // Unknown/foreign project filters resolve to no records, never silently to all company records.
    if (params.project && !selectedProject)
        throw new Error('PRODUCTION_PROJECT_NOT_FOUND');
    const scope = { companyProfileId: company.id, baustelleId: { in: selectedProject ? [selectedProject] : projects.map(p => p.id) } };
    const result = await withTenantContext(company.id, async (tx) => {
        const processDefinitions = await tx.steelWorkDefinition.findMany({
            where: { companyProfileId: company.id, kind: { in: ['factory', 'field'] } },
            select: { key: true, kind: true, label: true }, orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
        });
        const elements = await tx.siteElement.findMany({ where: scope,
            select: { id: true, baustelleId: true, list: true, mark: true, quantity: true, weightKg: true, factoryDoneAt: true, fieldDoneAt: true, processRoutes: true,
                work: { where: { companyProfileId: company.id }, select: { stage: true, pieces: true } } },
        });
        const where = { companyProfileId: company.id, element: scope, checkedAt: { gte: midnight(`${month}-01`, zone), lt: midnight(`${shiftMonth(month, 1)}-01`, zone) } };
        const work = await tx.siteElementWork.findMany({ where,
            select: { id: true, elementId: true, stage: true, pieces: true, checkedAt: true, productionSnapshot: true }, orderBy: [{ checkedAt: 'asc' }, { id: 'asc' }],
        });
        const dayScope = { ...where, checkedAt: { gte: midnight(day, zone), lt: midnight(nextDay(day), zone) } };
        const cursor = !readOnly && params.cursor ? await tx.siteElementWork.findFirst({ where: { ...dayScope, id: params.cursor }, select: { id: true, checkedAt: true } }) : null;
        if (!readOnly && params.cursor && !cursor)
            throw new Error('PRODUCTION_PROJECT_NOT_FOUND');
        // Personal evidence never reaches a monitor's HTML/RSC payload. Aggregate checks are enough there.
        const evidence = readOnly ? [] : await tx.siteElementWork.findMany({
            where: { ...dayScope, ...(cursor ? { OR: [{ checkedAt: { lt: cursor.checkedAt } }, { checkedAt: cursor.checkedAt, id: { lt: cursor.id } }] } : {}) },
            select: { id: true, elementId: true, stage: true, pieces: true, checkedAt: true, productionSnapshot: true, workerNames: true, checkedByName: true },
            orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }], take: 51,
        });
        if (options.piecesOnly) {
            // Someone who may not see weights: every piece counts 1, so no kg reaches the page.
            const oneKg = <T extends { productionSnapshot: unknown }>(row: T): T => {
                const snap = row.productionSnapshot;
                return snap && typeof snap === 'object' && !Array.isArray(snap) ? { ...row, productionSnapshot: { ...(snap as Record<string, unknown>), unitWeightKg: 1 } } : row;
            };
            return { elements: elements.map(e => ({ ...e, weightKg: 1 })), work: work.map(oneKg), evidence: evidence.map(oneKg), processDefinitions };
        }
        return { elements, work, evidence, processDefinitions };
    }, { timeout: 20000 });
    const rollup = calendarMetrics(month, zone, result.elements, result.work);
    const byElement = new Map(result.elements.map(e => [e.id, e]));
    const projectRows = projects.filter(p => !selectedProject || p.id === selectedProject).map(p => ({
        ...p, progress: projectProgress(result.elements.filter(e => e.baustelleId === p.id)),
        month: rollup.byProject.get(p.id) ?? null,
    }));
    const totalProgress = projectProgress(result.elements);
    const selectedWork = result.work.filter(w => dayKey(w.checkedAt, zone) === day);
    const selectedByProject = calendarMetrics(month, zone, result.elements, selectedWork).byProject;
    const otherOperations = new Map<string, Map<string, Metric>>();
    for (const row of selectedWork) {
        const e = byElement.get(row.elementId);
        if (!e) continue;
        const m = measure(row, e);
        if (seriesFor(row.stage, m.list)) continue;
        const operations = otherOperations.get(e.baustelleId) ?? new Map<string, Metric>();
        const metric = operations.get(row.stage) ?? emptyMetric();
        addMetric(metric, m); operations.set(row.stage, metric); otherOperations.set(e.baustelleId, operations);
    }
    return {
        piecesOnly: Boolean(options.piecesOnly), companyName: company.displayName, zone, today, month, day, selectedProject, readOnly, generatedAt: now.toISOString(),
        projects, projectRows, totalProgress, processDefinitions: result.processDefinitions, days: rollup.days, totals: rollup.totals,
        dayProjects: projectRows.map(p => ({ id: p.id, name: p.name, metrics: selectedByProject.get(p.id) ?? emptyMetrics(), checks: selectedWork.filter(w => byElement.get(w.elementId)?.baustelleId === p.id).length,
            operations: [...(otherOperations.get(p.id) ?? [])].map(([stage, metric]) => ({ stage, metric })),
        })),
        dayChecks: selectedWork.length,
        evidence: result.evidence.slice(0, 50).flatMap(w => {
            const e = byElement.get(w.elementId);
            if (!e)
                return [];
            const m = measure(w, e);
            return [{ id: w.id, projectId: e.baustelleId, stage: w.stage, checkedAt: w.checkedAt.toISOString(), workerNames: w.workerNames, checkedByName: w.checkedByName, ...m }];
        }),
        nextCursor: result.evidence.length > 50 ? result.evidence[49].id : null,
    };
}
export type SteelDashboardData = Awaited<ReturnType<typeof steelDashboardData>>;
