import { expect, it } from 'vitest';
import { createLegacyWeightQualifier } from './weight-qualifier';

const metric = (kg: number, legacyPieces = 0) => ({ kg, legacyPieces, pieces: 1 });
const metrics = (kg: number, legacyPieces = 0) => ({ cutParts: metric(0), cutAssemblies: metric(kg, legacyPieces), assembled: metric(67.89, legacyPieces) });
const day = (key: string, kg: number, legacyPieces = 0) => ({ key, metrics: metrics(kg, legacyPieces) });
const summary = (result: unknown, input = {}) => ({ toolName: 'adminGetSteelProductionSummary', status: 'ok' as const, input, result });
const evidence = (result: unknown, input = {}) => ({ toolName: 'adminGetSteelProductionEvidence', status: 'ok' as const, input, result });
const guard = (singleDate: string | null = null, currentMonthRequested = false) => createLegacyWeightQualifier({ singleDate, currentMonthRequested });
const confirmation = (kg: number | null, legacy = true, project = 'example-project', stage = 'cutting', list = 'assembly') => ({ kg, legacy, project: { id: project }, stage, list });

it('qualifies selected-day legacy facts without importing historical/monthly/current-progress values', () => {
  const qualifier = guard('2026-02-04');
  qualifier.observe(summary({ ok: true, selectedDate: '2026-02-04', dailyProduction: [day('2026-02-03', 987.65, 1), day('2026-02-04', 123.45, 1)], monthlyProduction: metrics(987.65, 1), currentProgress: metrics(777.77, 1), projects: [{ monthlyProduction: metrics(555.55, 1) }] }, { date: '2026-02-04' }));
  expect(qualifier.transformAnswer('Prerje 123,45 kg; asambluar 67.89 kg; 0 kg; stok 777,77 kg; të tjera 987,65 kg dhe 555,55 kg.')).toBe('Prerje ≈123,45 kg; asambluar ≈67.89 kg; 0 kg; stok 777,77 kg; të tjera 987,65 kg dhe 555,55 kg.');
  expect(qualifier.snapshot()).toEqual({ legacyValuesSeen: 2, qualifiersAdded: 2 });
});

it('defaults to the selected day and keeps snapshot-only values exact despite legacy monthly history', () => {
  const qualifier = guard();
  qualifier.observe(summary({ ok: true, selectedDate: '2026-02-05', dailyProduction: [day('2026-02-04', 123.45, 1), day('2026-02-05', 123.45)], monthlyProduction: metrics(123.45, 1) }));
  expect(qualifier.transformAnswer('123.45 kg dhe 67.89 kg')).toBe('123.45 kg dhe 67.89 kg');
});

it.each([{ month: '2026-02' }, {}])('collects month totals and month project details only in month scope (%j)', input => {
  const qualifier = guard(null, true);
  qualifier.observe(summary({ ok: true, monthlyProduction: metrics(321.12, 1), projects: [{ monthlyProduction: metrics(234.56, 1) }], dailyProduction: [day('2026-02-05', 876.54, 1)], selectedDate: '2026-02-05' }, input));
  expect(qualifier.transformAnswer('321.12 kg; 234,56 kg; 876.54 kg')).toBe('≈321.12 kg; ≈234,56 kg; 876.54 kg');
});

it('uses explicit tool dates in mixed month/day comparisons instead of monthly legacy facts', () => {
  const qualifier = guard(null, true);
  qualifier.observe(summary({ ok: true, selectedDate: '2026-02-05', dailyProduction: [day('2026-02-05', 123.45)], monthlyProduction: metrics(123.45, 1) }, { date: '2026-02-05', month: '2026-02' }));
  expect(qualifier.transformAnswer('123.45 kg')).toBe('123.45 kg');
});

it('collects evidence aggregates, individual legacy confirmations and complete per-project process totals separately', () => {
  const qualifier = guard();
  const confirmations = [confirmation(40.12), confirmation(50.34, false), confirmation(11.11, true, 'example-project', 'assembly'), confirmation(22.22, false, 'example-project', 'cutting', 'part')];
  qualifier.observe(evidence({ ok: true, aggregates: [{ metric: metric(222.22, 1) }], confirmations, pageComplete: true, totalMatchingConfirmations: 4 }));
  expect(qualifier.transformAnswer('222.22 kg; 40.12 kg; 90.46 kg; 11.11 kg; 50.34 kg; 22.22 kg; 101.57 kg; 112.68 kg')).toBe('≈222.22 kg; ≈40.12 kg; ≈90.46 kg; ≈11.11 kg; 50.34 kg; 22.22 kg; 101.57 kg; 112.68 kg');
});

it.each([
  { pageComplete: false, totalMatchingConfirmations: 3 },
  { pageComplete: true, totalMatchingConfirmations: 3 },
  { pageComplete: true, totalMatchingConfirmations: 2, cursor: 'previous-example' },
])('does not derive a project total from an incomplete/cursor page (%j)', ({ cursor, ...paging }) => {
  const qualifier = guard();
  qualifier.observe(evidence({ ok: true, ...paging, confirmations: [confirmation(40.12), confirmation(50.34, false)] }, { cursor }));
  expect(qualifier.transformAnswer('40.12 kg; 90.46 kg')).toBe('≈40.12 kg; 90.46 kg');
});

it('does not construct a known project sum when any confirmation weight is unknown', () => {
  const qualifier = guard();
  qualifier.observe(evidence({ ok: true, pageComplete: true, totalMatchingConfirmations: 3, confirmations: [confirmation(40.12), confirmation(50.34, false), confirmation(null)] }));
  expect(qualifier.transformAnswer('40.12 kg; 90.46 kg; 0 kg')).toBe('≈40.12 kg; 90.46 kg; 0 kg');
});

it('does not turn zero known kg from missing weights into an approximate zero', () => {
  const unknown = guard();
  unknown.observe(evidence({ ok: true, aggregates: [{ metric: { kg: 0, pieces: 3, legacyPieces: 3, missingPieces: 3 } }] }));
  expect(unknown.transformAnswer('0 kg')).toBe('0 kg');
  expect(unknown.snapshot().legacyValuesSeen).toBe(0);
  const recordedZero = guard();
  recordedZero.observe(evidence({ ok: true, aggregates: [{ metric: { kg: 0, pieces: 3, legacyPieces: 3, missingPieces: 0 } }] }));
  expect(recordedZero.transformAnswer('0 kg')).toBe('≈0 kg');
});

it('ignores failed, oversized/rejected and unrelated tools even with lookalike legacy fields', () => {
  const qualifier = guard();
  for (const event of [
    { ...evidence({ ok: false, aggregates: [{ metric: metric(123.45, 1) }] }), status: 'error' as const },
    { ...evidence({ ok: true, aggregates: [{ metric: metric(123.45, 1) }] }), status: 'rejected' as const },
    { ...evidence({ ok: true, aggregates: [{ metric: metric(123.45, 1) }] }), toolName: 'adminGetSteelElement' },
  ]) qualifier.observe(event);
  expect(qualifier.transformAnswer('123.45 kg')).toBe('123.45 kg');
  expect(qualifier.snapshot()).toEqual({ legacyValuesSeen: 0, qualifiersAdded: 0 });
});

it('preserves locale digits, thousands, Markdown, units and existing approximation exactly', () => {
  const qualifier = guard();
  qualifier.observe(evidence({ ok: true, aggregates: [123.45, 1234.56, 1234567.89, 1234, 1.235].map(value => ({ metric: metric(value, 1) })) }));
  const text = '**123,45** kg; _123.45_ **kg**; 1.234,56 kg; 1,234.56 KG; 1 234,56 kg; 1\u202f234.56 kg; 1’234.56 kg; 1,234,567.89 kg; 1.234 kg; 1,24 kg; ≈ **123.45 kg**; ~123.45 kg; ∼ 123,45 kg; -123.45 kg; 123.45 kg/m; 123.45 pieces; 123.45 t';
  expect(qualifier.transformAnswer(text)).toBe('**≈123,45** kg; _≈123.45_ **kg**; ≈1.234,56 kg; ≈1,234.56 KG; ≈1 234,56 kg; ≈1\u202f234.56 kg; ≈1’234.56 kg; ≈1,234,567.89 kg; ≈1.234 kg; ≈1,24 kg; ≈ **123.45 kg**; ~123.45 kg; ∼ 123,45 kg; -123.45 kg; 123.45 kg/m; 123.45 pieces; 123.45 t');
  expect(qualifier.snapshot()).toEqual({ legacyValuesSeen: 5, qualifiersAdded: 10 });
});

it('is idempotent for already qualified output and does not change unsupported values', () => {
  const qualifier = guard();
  qualifier.observe(evidence({ ok: true, aggregates: [{ metric: metric(123.45, 1) }, { metric: metric(10, 0) }, { metric: metric(Number.NaN, 1) }] }));
  const first = qualifier.transformAnswer('123.45 kg; 10 kg; 123 kg');
  expect(qualifier.transformAnswer(first)).toBe(first);
  expect(qualifier.snapshot()).toEqual({ legacyValuesSeen: 1, qualifiersAdded: 1 });
});
