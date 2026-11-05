import { describe, expect, it } from 'vitest';
import { calendarMetrics, measure, midnight, monthDays, monthKey, projectProgress, type SteelElement, type WorkMeasure } from './steel-metrics';
import { productionDate, productionNumber } from './steel-format';
const element = (over: Partial<SteelElement> = {}): SteelElement => ({ id: 'assembly1', baustelleId: 'project1', list: 'assembly', mark: 'B/01', quantity: 4, weightKg: 125, factoryDoneAt: null, fieldDoneAt: null, work: [], ...over });
const work = (over: Partial<WorkMeasure> = {}): WorkMeasure => ({ id: 'work1', elementId: 'assembly1', stage: 'assembly', pieces: 2, checkedAt: new Date('2026-11-03T23:30:00Z'), productionSnapshot: { v: 1, list: 'assembly', mark: 'B/01', quantity: 4, unitWeightKg: 125 }, ...over });
describe('steel production evidence', () => {
    it('renders Albanian dates and numeric weights deterministically rather than falling back to English', () => {
        expect(productionDate('2026-10-14', 'sq')).toBe('14 tetor 2026');
        expect(productionDate('2026-10-14', 'sq', { weekday: 'short' })).toBe('Mër');
        expect(productionNumber(1234.5, 'sq')).toBe('1.234,5');
        expect(productionNumber(1234.5, 'en')).toBe('1,234.5');
        for (const lang of ['sq', 'en', 'de', 'it', 'pl', 'ro'])
            expect(productionDate('2026-10-14', lang)).toContain('2026');
    });
    it('preserves the confirmed weight/mark/list after reimport and preserves an explicitly missing weight', () => {
        expect(measure(work(), element({ weightKg: 999, quantity: 9, mark: 'CHANGED' }))).toMatchObject({ kg: 250, pieces: 2, mark: 'B/01', legacy: false });
        expect(measure(work({ productionSnapshot: { v: 1, list: 'assembly', mark: 'B/01', quantity: 4, unitWeightKg: null } }), element())).toMatchObject({ kg: null, unitWeightKg: null, legacy: false });
    });
    it('marks legacy all-piece checks and invalid snapshots as approximate, without inventing missing kg', () => {
        expect(measure(work({ pieces: 0, productionSnapshot: null }), element())).toMatchObject({ pieces: 4, kg: 500, legacy: true });
        expect(measure(work({ productionSnapshot: [] }), element({ weightKg: null }))).toMatchObject({ kg: null, legacy: true });
    });
    it('keeps parts cutting, assembly cutting and assembly separate and groups local dates/projects exactly', () => {
        const es = [element(), element({ id: 'part1', list: 'part', weightKg: 10, baustelleId: 'project2' })];
        const rows = [work(), work({ id: 'work2', stage: 'cutting' }), work({ id: 'work3', elementId: 'part1', stage: 'cutting', productionSnapshot: null }), work({ id: 'other', elementId: 'foreign' })];
        const out = calendarMetrics('2026-11', 'Europe/Tirane', es, rows);
        expect(out.totals.cutParts.kg).toBe(20);
        expect(out.totals.cutAssemblies.kg).toBe(250);
        expect(out.totals.assembled.kg).toBe(250);
        expect(out.days[3].checks).toBe(3);
        expect(out.days[2].checks).toBe(0);
        expect(out.byProject.get('project2')?.assembled.pieces).toBe(0);
        for (const key of ['cutParts', 'cutAssemblies', 'assembled'] as const)
            expect(out.days.reduce((n, d) => n + d.metrics[key].kg, 0)).toBe(out.totals[key].kg);
    });
    it('flags unknown-weight pieces without turning their weight into a confirmed zero', () => {
        const out = calendarMetrics('2026-11', 'Europe/Tirane', [element({ weightKg: null })], [work({ productionSnapshot: null })]);
        expect(out.totals.assembled).toMatchObject({ kg: 0, pieces: 2, missingPieces: 2, legacyPieces: 2 });
    });
    it('follows the engineer route for factory readiness and does not add parts to the assembly denominator', () => {
        const progress = projectProgress([element({ factoryDoneAt: new Date(), work: [{ stage: 'assembly', pieces: 3 }, { stage: 'welding', pieces: 2 }, { stage: 'mounted', pieces: 1 }] }), element({ id: 'part', list: 'part', quantity: 1000 })]);
        expect(progress).toMatchObject({ totalPieces: 4, kg: 500, readyPieces: 2, readyKg: 250, mountedKg: 125 });
        expect(progress.stages.cutting.pieces).toBe(0);
    });
    it('measures current selected processes independently while retaining immutable historical throughput', () => {
        const fp = `fp-${'a'.repeat(24)}`, sp = `sp-${'b'.repeat(24)}`;
        const configured = element({ processRoutes: { v: 1, factory: ['cutting', fp], field: [sp] }, work: [{ stage: 'cutting', pieces: 4 }, { stage: fp, pieces: 2 }, { stage: sp, pieces: 1 }, { stage: 'assembly', pieces: 4 }] });
        const other = element({ id: 'other', quantity: 6, processRoutes: { v: 1, factory: ['cutting'], field: [] } });
        const progress = projectProgress([configured, other]);
        expect(progress).toMatchObject({ totalPieces: 10, readyPieces: 2, readyKg: 250 });
        expect(progress.stages[fp]).toMatchObject({ pieces: 2, kg: 250, eligibleMarks: 1, eligiblePieces: 4, eligibleKg: 500 });
        expect(progress.stages[sp]).toMatchObject({ pieces: 1, kg: 125, eligiblePieces: 4 });
        expect(progress.stages.cutting.eligiblePieces).toBe(10);
        expect(progress.stages.assembly).toMatchObject({ pieces: 0, kg: 0, eligiblePieces: 0 });
        const historical = calendarMetrics('2026-11', 'Europe/Tirane', [configured], [work({ stage: 'assembly' }), work({ id: 'custom-work', stage: fp, pieces: 4 })]);
        expect(historical.totals.assembled).toMatchObject({ pieces: 2, kg: 250, legacyPieces: 0 });
        expect(historical.totals.cutAssemblies.kg).toBe(0);
    });
    it('handles leap months and DST boundaries without server-local date arithmetic', () => {
        expect(monthDays('2028-02')).toHaveLength(29);
        expect(monthKey('2026-99', '2026-11-04')).toBe('2026-11');
        expect((midnight('2026-04-01', 'Europe/Tirane').getTime() - midnight('2026-03-01', 'Europe/Tirane').getTime()) / 3600000).toBe(743);
        expect((midnight('2026-11-01', 'Europe/Berlin').getTime() - midnight('2026-10-01', 'Europe/Berlin').getTime()) / 3600000).toBe(745);
    });
});
