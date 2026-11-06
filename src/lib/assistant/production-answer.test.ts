import { expect, it } from 'vitest';
import type { AssistantLanguageCode } from './language';
import type { AssistantMessage } from './limits';
import { createCanonicalProductionAnswer, resolveCanonicalProductionIntent } from './production-answer';

const user = (content: string): AssistantMessage => ({ role: 'user', content });
const turn = { singleDate: '2026-02-04', currentMonthRequested: false, multipleDates: false, mixedPeriods: false, rangeRequested: false };
const metric = (kg = 0, pieces = 0, legacyPieces = 0, missingPieces = 0) => ({ kg, pieces, legacyPieces, missingPieces });
const metrics = () => ({ cutParts: metric(10, 2), cutAssemblies: metric(123.45, 5, 5), assembled: metric(67.89, 2, 2) });
const dailyResult = () => ({ ok: true, month: '2026-02', selectedDate: '2026-02-04', selectedProject: null, dailyProduction: [{ key: '2026-02-04', metrics: metrics() }], monthlyProduction: { cutParts: metric(999, 9, 9), cutAssemblies: metric(888, 8, 8), assembled: metric(777, 7, 7) } });
function formatter(details = false, language: AssistantLanguageCode = 'SQ', overrides = {}) {
  return createCanonicalProductionAnswer({ intent: { details }, turn: { ...turn, ...overrides }, language });
}
function observe(formatter: ReturnType<typeof createCanonicalProductionAnswer>, result: unknown, input: unknown = { date: '2026-02-04' }) {
  formatter.observe({ toolName: 'adminGetSteelProductionSummary', status: 'ok', result, input });
}

it.each([
  'Sa materiale ka bërë fabrika dje? Përgjigju shkurt me një fjali.',
  'How much did the factory produce yesterday? Answer in one sentence.',
  'Wie viel hat die Fabrik gestern produziert?',
  'Quanto materiale ha prodotto la fabbrica ieri?',
  'Cât material a produs fabrica ieri?',
  'Ile materiału wyprodukowała fabryka wczoraj?',
])('recognizes a standard factory production quantity question: %s', question => {
  expect(resolveCanonicalProductionIntent([user(question)])).toEqual({ details: false });
});

it.each([
  'Sa punëtorë ka fabrika?', 'How much fuel did the factory use?',
  'Sa materiale ka fabrika në inventar?', 'Sa kushton prodhimi i fabrikës?',
  'Wie viele Fahrzeuge hat die Fabrik?', 'Sa materiale saldoi fabrika dje?',
  'How much did the factory paint yesterday?', 'Sa pjesë preu fabrika dje?',
  'Sa materiale asambloi fabrika dje?', 'Why did the factory produce less?',
  'Who produced the factory materials?', 'Sa projekte janë aktive?',
  'What can the factory assistant do with production?',
  'Sa materiale ka fabrika?', 'How much material does the factory have?',
  'Sa materiale ka bërë fabrika për projektin Example?',
  'How much did the factory produce for project Example yesterday?',
  'Sa ka prodhuar fabrika për Shembullin dje?',
  'How much did the factory produce for Demo yesterday?',
  'How much did the factory produce for the Demo yesterday?',
  'Sa ka bërë oficina sot?', 'Sa vegla ka bërë punishtja?',
  'How many repairs has the workshop done today?',
  'Wie viele Reparaturen hat die Werkstatt heute gemacht?',
  'Cilat mjete janë në riparim?', 'Kujt i është dorëzuar trapan Bosch?',
])('does not replace other operational questions: %s', question => {
  expect(resolveCanonicalProductionIntent([user(question)])).toBeNull();
});

it('supports a global project breakdown without accepting a named project qualifier', () => {
  expect(resolveCanonicalProductionIntent([user('How much did the factory produce yesterday? Show details by project.')])).toEqual({ details: true });
  expect(resolveCanonicalProductionIntent([user('Sa materiale ka bërë fabrika dje? Më jep detajet sipas projektit.')])).toEqual({ details: true });
  expect(resolveCanonicalProductionIntent([user('How much did the factory produce? Show details by project Example.')])).toBeNull();
  expect(resolveCanonicalProductionIntent([user('How much did the factory produce for yesterday? Answer in one sentence.')])).toEqual({ details: false });
});

it('inherits details from the immediate factory topic without trusting assistant assertions', () => {
  const conversation: AssistantMessage[] = [user('Sa materiale ka bërë fabrika sot?'), { role: 'assistant', content: 'Invented combined total 999 kg.' }, user('Më jep detajet sipas projektit për dje')];
  expect(resolveCanonicalProductionIntent(conversation)).toEqual({ details: true });
  expect(resolveCanonicalProductionIntent([...conversation, user('Show me details by project for 2026-02-03')])).toEqual({ details: true });
  expect(resolveCanonicalProductionIntent([user('Sa materiale ka bërë fabrika?'), user('Sa makina kemi?'), user('Më jep detajet sipas projektit')])).toBeNull();
  expect(resolveCanonicalProductionIntent([user('Sa materiale ka bërë fabrika?'), user('Më jep detajet e motit')])).toBeNull();
  expect(resolveCanonicalProductionIntent([user('Më jep detajet sipas projektit')])).toBeNull();
});

it('replaces an invented combined factory kg total with separate canonical series and provenance', () => {
  const answer = formatter();
  observe(answer, dailyResult());
  const output = answer.transformAnswer('Fabrika prodhoi 191,34 kg dje.');
  expect(output).toBe('Konfirmime prerjeje/asamblimi · 2026-02-04: Prerje pjesësh: 2 copë, 10 kg; Prerje asamblesh: 5 copë, ≈123,45 kg; Asambluar: 2 copë, ≈67,89 kg.');
  expect(output).not.toMatch(/191[,.]34|201[,.]34|999|888|777/);
  expect(answer.snapshot()).toEqual({ applied: true, unavailable: false });
});

it('keeps snapshot-only source weights exact and distinguishes zero confirmations from no factory work', () => {
  const exact = formatter();
  observe(exact, { ...dailyResult(), dailyProduction: [{ key: turn.singleDate, metrics: { cutParts: metric(12.5, 1), cutAssemblies: metric(), assembled: metric() } }] });
  expect(exact.transformAnswer('Wrong')).toContain('1 copë, 12,5 kg');
  expect(exact.transformAnswer('Wrong')).not.toContain('≈');
  const empty = formatter();
  observe(empty, { ...dailyResult(), dailyProduction: [{ key: turn.singleDate, metrics: { cutParts: metric(), cutAssemblies: metric(), assembled: metric() } }] });
  expect(empty.transformAnswer('No factory work happened.')).toBe('2026-02-04: Nuk ka konfirmime prerjeje/asamblimi.');
});

it('never turns unknown weight into zero kg and qualifies known partial weight', () => {
  const answer = formatter();
  observe(answer, { ...dailyResult(), dailyProduction: [{ key: turn.singleDate, metrics: { cutParts: metric(0, 3, 3, 3), cutAssemblies: metric(20, 5, 2, 2), assembled: { kg: null, pieces: 1, legacyPieces: 1, missingPieces: 1 } } }] });
  const output = answer.transformAnswer('0 kg');
  expect(output).toContain('Prerje pjesësh: 3 copë, peshë e panjohur për 3 copë');
  expect(output).toContain('Prerje asamblesh: 5 copë, ≈20 kg të njohura, peshë e panjohur për 2 copë');
  expect(output).toContain('Asambluar: 1 copë, peshë e panjohur për 1 copë');
  expect(output).not.toMatch(/(?<!\d)(?:≈)?0 kg/);
});

it('uses selected-day project metrics rather than monthly project totals, with quoted names', () => {
  const answer = formatter(true);
  observe(answer, { ...dailyResult(), selectedProject: { id: 'example', name: 'Example "Project"' }, selectedDayProjects: [{ id: 'example', name: 'Example "Project"', metrics: metrics(), checks: 2 }], selectedDayProjectsPageComplete: true, projectCount: 1, projects: [{ id: 'example', name: 'Example', monthlyProduction: { cutParts: metric(999, 9, 9), cutAssemblies: metric(888, 8, 8), assembled: metric(777, 7, 7) } }] });
  const output = answer.transformAnswer('Fabricated details.');
  expect(output).toContain(`2026-02-04 · ${JSON.stringify('Example "Project"')}`);
  expect(output).toContain(`\n${JSON.stringify('Example "Project"')}:`);
  expect(output).not.toMatch(/999|888|777/);
});

it('uses month totals and monthly project details only for an explicitly requested month', () => {
  const answer = formatter(true, 'EN', { singleDate: null });
  observe(answer, { ...dailyResult(), projectPageComplete: true, projectCount: 1, projects: [{ id: 'example', name: 'Example', monthlyProduction: { cutParts: metric(999, 9), cutAssemblies: metric(888, 8), assembled: metric(777, 7) } }] }, { month: '2026-02' });
  const output = answer.transformAnswer('Wrong');
  expect(output).toContain('Cutting/assembly confirmations · 2026-02:');
  expect(output).toContain('\n"Example": Parts cut: 9 pieces, 999 kg; Assemblies cut: 8 pieces, 888 kg; Assembled: 7 pieces, 777 kg.');
  expect(output).not.toContain('123.45');
});

it('treats an explicit canonical null month project as no confirmations, but absent metrics as unknown', () => {
  const answer = formatter(true, 'EN', { singleDate: null });
  const result = { ...dailyResult(), projectPageComplete: true, projectCount: 1, projects: [{ id: 'example', name: 'Example', monthlyProduction: null }] };
  observe(answer, result, { month: '2026-02' });
  expect(answer.transformAnswer('Wrong')).toContain('"Example": Parts cut: 0 pieces, 0 kg');
  const missing = formatter(true, 'EN', { singleDate: null });
  observe(missing, { ...result, projects: [{ id: 'example', name: 'Example' }] }, { month: '2026-02' });
  expect(missing.transformAnswer('Wrong')).toContain('I do not have complete confirmations');
});

it.each([{ complete: false, input: {} }, { complete: true, input: { projectCursor: 'example-cursor' } }])('declares a partial project page even on a final cursor page (%j)', ({ complete, input }) => {
  const answer = formatter(true);
  observe(answer, { ...dailyResult(), selectedDayProjects: [{ id: 'example', name: 'Example', metrics: metrics() }], selectedDayProjectsPageComplete: complete, projectCount: 3 }, input);
  expect(answer.transformAnswer('All projects shown')).toContain('1/3 projekte të shfaqura');
});

it.each(['DE', 'EN', 'SQ', 'IT', 'RO', 'PL'] as const)('localizes source framing, processes and missing-source fallback in %s', language => {
  const answer = formatter(false, language);
  const fallback = answer.transformAnswer('Invented 191.34 kg');
  expect(fallback).not.toContain('191.34');
  expect(answer.snapshot()).toEqual({ applied: true, unavailable: true });
  observe(answer, dailyResult());
  const output = answer.transformAnswer('Invented 191.34 kg');
  expect(output).toContain('2026-02-04');
  expect(output.match(/ kg/g)).toHaveLength(3);
  expect(output.match(/≈/g)).toHaveLength(2);
  expect(answer.snapshot()).toEqual({ applied: true, unavailable: false });
});

it.each(['multipleDates', 'mixedPeriods', 'rangeRequested'])('fails closed for unsupported %s instead of passing model numbers', field => {
  const answer = formatter(false, 'EN', { [field]: true });
  observe(answer, dailyResult());
  expect(answer.transformAnswer('Invented 191.34 kg')).toBe('I do not have complete confirmations for this answer. Choose one date or month.');
});

it('fails closed for month-versus-month comparison even when calendar day flags are false', () => {
  const intent = resolveCanonicalProductionIntent([user('How much did the factory produce this month versus last month?')]);
  expect(intent).toEqual({ details: false, unsupportedScope: true });
  const answer = createCanonicalProductionAnswer({ intent, turn: { ...turn, singleDate: null, currentMonthRequested: true }, language: 'EN' });
  observe(answer, dailyResult(), { month: '2026-02' });
  expect(answer.transformAnswer('Invented comparison 191.34 kg')).toBe('I do not have complete confirmations for this answer. Choose one date or month.');
  expect(answer.snapshot()).toEqual({ applied: true, unavailable: true });
});

it.each(['How much did the factory produce last week?', 'Sa materiale ka bërë fabrika javën e kaluar?', 'How much did the factory produce last year?', 'How much did the factory produce in 2025?'])('never substitutes daily/monthly data for a week/year: %s', question => {
  const intent = resolveCanonicalProductionIntent([user(question)]);
  expect(intent).toEqual({ details: false, unsupportedScope: true });
  const answer = createCanonicalProductionAnswer({ intent, turn: { ...turn, singleDate: null }, language: 'EN' });
  observe(answer, dailyResult());
  expect(answer.transformAnswer('Wrong daily substitution')).toContain('Choose one date or month');
});

it('fails closed for errors, wrong dates, incomplete metrics, or absent project detail evidence', () => {
  for (const result of [{ ok: false }, { ...dailyResult(), selectedDate: '2026-02-03' }, { ...dailyResult(), dailyProduction: [] }, { ...dailyResult(), dailyProduction: [{ key: turn.singleDate, metrics: { cutParts: metric() } }] }]) {
    const answer = formatter();
    observe(answer, result);
    expect(answer.transformAnswer('Invented 191.34 kg')).not.toContain('191.34');
    expect(answer.snapshot().unavailable).toBe(true);
  }
  const answer = formatter(true);
  observe(answer, dailyResult());
  expect(answer.transformAnswer('Fabricated project details')).toContain('Nuk kam konfirmime të plota');
});

it('ignores wrong tools/rejected reports and preserves original text only for unsupported intents', () => {
  const answer = formatter();
  answer.observe({ toolName: 'adminGetSteelElement', status: 'ok', result: dailyResult(), input: {} });
  answer.observe({ toolName: 'adminGetSteelProductionSummary', status: 'rejected', result: dailyResult(), input: {} });
  expect(answer.transformAnswer('Invented 191.34 kg')).toContain('Nuk kam konfirmime të plota');
  const generic = createCanonicalProductionAnswer({ intent: null, turn, language: 'EN' });
  observe(generic, dailyResult());
  expect(generic.transformAnswer('Other supported answer')).toBe('Other supported answer');
  expect(generic.snapshot()).toEqual({ applied: false, unavailable: false });
});
