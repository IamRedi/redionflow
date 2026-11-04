import { localClock } from '@/lib/fleet/fuel/time';
import { doneQty, stagePieces, type ElementState } from '@/lib/elements/stages';
import { FACTORY_STEP_KEYS } from '@/lib/factory/production';
export const STEEL_TYPES = ['STEEL_WORKSHOP', 'STEEL_ASSEMBLY'] as const;
export const SERIES = ['cutParts', 'cutAssemblies', 'assembled'] as const;
export type Series = (typeof SERIES)[number];
export type Metric = {
    kg: number;
    pieces: number;
    legacyPieces: number;
    missingPieces: number;
    checks: number;
};
export type DayMetrics = {
    key: string;
    metrics: Record<Series, Metric>;
    checks: number;
};
export type SteelElement = {
    id: string;
    baustelleId: string;
    list: string;
    mark: string;
    quantity: number;
    weightKg: number | null;
    factoryDoneAt: Date | null;
    fieldDoneAt: Date | null;
    work: Array<{
        stage: string;
        pieces: number;
    }>;
};
export type WorkMeasure = {
    id: string;
    elementId: string;
    stage: string;
    pieces: number;
    checkedAt: Date;
    productionSnapshot: unknown;
};
export const emptyMetric = (): Metric => ({ kg: 0, pieces: 0, legacyPieces: 0, missingPieces: 0, checks: 0 });
export const emptyMetrics = () => Object.fromEntries(SERIES.map(s => [s, emptyMetric()])) as Record<Series, Metric>;
export const dayKey = (date: Date, zone: string) => localClock(date, zone).slice(0, 10);
export function monthKey(raw: unknown, today: string) {
    return typeof raw === 'string' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(raw) ? raw : today.slice(0, 7);
}
export function monthDays(month: string) {
    const [y, m] = month.split('-').map(Number);
    return Array.from({ length: new Date(Date.UTC(y, m, 0)).getUTCDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}
export function shiftMonth(month: string, by: number) {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}
export function midnight(key: string, zone: string) {
    const base = Date.parse(`${key}T00:00:00Z`);
    const date = [1, 2].map(offset => new Date(base - offset * 3600000)).find(d => localClock(d, zone) === `${key}T00:00`);
    if (!date)
        throw new Error('Invalid production date');
    return date;
}
export function nextDay(key: string) { return new Date(Date.parse(`${key}T12:00:00Z`) + 86400000).toISOString().slice(0, 10); }
const weight = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
/** New events retain their original basis. Legacy totals are visibly approximate. */
export function measure(work: WorkMeasure, element: SteelElement) {
    const raw = work.productionSnapshot;
    const snap = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    const captured = snap?.v === 1 && (snap.list === 'part' || snap.list === 'assembly') && typeof snap.mark === 'string' && typeof snap.quantity === 'number' && snap.quantity > 0;
    const list = captured ? snap.list as string : element.list;
    const unitWeightKg = weight(captured ? snap.unitWeightKg : element.weightKg);
    const quantity = captured ? Math.trunc(snap.quantity as number) : Math.max(1, element.quantity);
    const count = work.pieces > 0 ? work.pieces : quantity;
    return { list, mark: captured ? snap.mark as string : element.mark, unitWeightKg, pieces: count, kg: unitWeightKg === null ? null : Math.round(unitWeightKg * count * 1e6) / 1e6, legacy: !captured };
}
export function seriesFor(stage: string, list: string): Series | null {
    if (stage === 'cutting')
        return list === 'part' ? 'cutParts' : list === 'assembly' ? 'cutAssemblies' : null;
    return stage === 'assembly' && list === 'assembly' ? 'assembled' : null;
}
export function addMetric(total: Metric, item: ReturnType<typeof measure>) {
    total.pieces += item.pieces;
    total.checks += 1;
    if (item.kg === null)
        total.missingPieces += item.pieces;
    else
        total.kg = Math.round((total.kg + item.kg) * 1e6) / 1e6;
    if (item.legacy)
        total.legacyPieces += item.pieces;
}
export function calendarMetrics(month: string, zone: string, elements: SteelElement[], work: WorkMeasure[]) {
    const map = new Map(elements.map(e => [e.id, e]));
    const days = monthDays(month).map(key => ({ key, metrics: emptyMetrics(), checks: 0 }));
    const byDay = new Map(days.map(d => [d.key, d]));
    const byProject = new Map<string, Record<Series, Metric>>();
    const totals = emptyMetrics();
    for (const row of work) {
        const element = map.get(row.elementId), day = byDay.get(dayKey(row.checkedAt, zone));
        if (!element || !day)
            continue;
        day.checks += 1;
        const m = measure(row, element), series = seriesFor(row.stage, m.list);
        if (!series)
            continue;
        const project = byProject.get(element.baustelleId) ?? emptyMetrics();
        for (const total of [totals[series], day.metrics[series], project[series]])
            addMetric(total, m);
        byProject.set(element.baustelleId, project);
    }
    return { days, totals, byProject };
}
/** Current assembly progress; each process has its own denominator, never an additive tonnage. */
export function projectProgress(elements: SteelElement[]) {
    let kg = 0, totalPieces = 0, readyKg = 0, readyPieces = 0, mountedKg = 0, missingPieces = 0;
    const stages = Object.fromEntries([...FACTORY_STEP_KEYS, 'received', 'mounted', 'bolted', 'touchup'].map(s => [s, { kg: 0, pieces: 0 }])) as Record<string, {
        kg: number;
        pieces: number;
    }>;
    for (const e of elements.filter(e => e.list === 'assembly')) {
        const state = { ...e, list: 'assembly' } satisfies ElementState;
        const count = Math.max(1, e.quantity), unit = weight(e.weightKg), ready = doneQty(state, 'factory');
        totalPieces += count;
        kg += (unit ?? 0) * count;
        readyPieces += ready;
        readyKg += (unit ?? 0) * ready;
        mountedKg += (unit ?? 0) * stagePieces(state, 'mounted');
        if (unit === null)
            missingPieces += count;
        for (const key of Object.keys(stages)) {
            const n = stagePieces(state, key);
            stages[key].pieces += n;
            stages[key].kg += (unit ?? 0) * n;
        }
    }
    return { kg, totalPieces, readyKg, readyPieces, mountedKg, missingPieces, stages };
}
