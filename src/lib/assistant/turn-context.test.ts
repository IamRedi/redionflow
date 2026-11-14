import { describe, expect, it } from 'vitest';
import { assistantDayBounds, assistantToolDate, assistantTurnContext, isAssistantDateKey } from './turn-context';

const options = { timeZone: 'Europe/Tirane', now: new Date('2026-10-31T23:30:00Z') };
const turn = (...questions: string[]) => assistantTurnContext(questions.map(content => ({ role: 'user' as const, content })), options);

describe('company-calendar grounding', () => {
  it('resolves the company day and month across UTC midnight without using the host timezone', () => {
    expect(turn('Sa kg u prenë sot?')).toMatchObject({ today: '2026-11-01', yesterday: '2026-10-31', tomorrow: '2026-11-02', currentMonth: '2026-11', singleDate: '2026-11-01' });
  });
  it.each(['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-01', '2026-11-00', '2026-2-01', '2026-11-01T00:00Z', '2026-11-01-extra'])('rejects malformed or impossible date %s', key => {
    expect(isAssistantDateKey(key)).toBe(false);
    expect(assistantDayBounds(key, options.timeZone)).toBeNull();
  });
  it('accepts leap day and preserves DST day lengths', () => {
    expect(isAssistantDateKey('2024-02-29')).toBe(true);
    const spring = assistantDayBounds('2026-03-29', options.timeZone)!;
    const autumn = assistantDayBounds('2026-10-25', options.timeZone)!;
    expect((spring.end.getTime() - spring.start.getTime()) / 3600_000).toBe(23);
    expect((autumn.end.getTime() - autumn.start.getTime()) / 3600_000).toBe(25);
    expect(spring.start.toISOString()).toBe('2026-03-28T23:00:00.000Z');
  });
  it('uses an explicit historical date instead of today', () => {
    expect(assistantToolDate(turn('Sa kg më 2025-11-01?'), '2026-11-01')).toBe('2025-11-01');
    expect(turn('Sa kg më 5.11.2025?').singleDate).toBe('2025-11-05');
  });
  it('does not force a comparison onto one global day', () => {
    const comparison = turn('Krahaso sot me dje');
    expect(comparison).toMatchObject({ singleDate: null, multipleDates: true });
    expect(assistantToolDate(comparison, '2026-11-01')).toBe('2026-11-01');
    expect(assistantToolDate(comparison, '2026-10-31')).toBe('2026-10-31');
    expect(turn('Krahaso sot me 2025-11-01').multipleDates).toBe(true);
  });
  it('preserves independent day and month queries across a month rollover', () => {
    const comparison = turn('Krahaso këtë muaj me dje');
    expect(comparison).toMatchObject({ currentMonth: '2026-11', currentMonthRequested: true, singleDate: null, mixedPeriods: true });
    expect(assistantToolDate(comparison, '2026-10-31')).toBe('2026-10-31');
    expect(assistantToolDate(comparison, '2026-11-01')).toBe('2026-11-01');
    expect(assistantToolDate(comparison)).toBeUndefined();
    expect(turn('Krahaso këtë muaj me dje', 'edhe te Agroni?')).toMatchObject({ singleDate: null, mixedPeriods: true });
  });
  it.each(['muajin e kaluar krahasuar me sot', 'compare last week with today', 'dieses Jahr und gestern', '2025 compared with today'])('does not collapse a mixed period onto its only recognized day: %s', question => {
    expect(turn(question)).toMatchObject({ singleDate: null, mixedPeriods: true });
  });
  it('does not mistake the year/month inside a complete historical date for a mixed period', () => {
    expect(turn('Sa kg më 2025-11-01?')).toMatchObject({ singleDate: '2025-11-01', mixedPeriods: false });
    expect(turn('Sa kg më 5.11.2025?')).toMatchObject({ singleDate: '2025-11-05', mixedPeriods: false });
  });
  it('distinguishes a brief-answer instruction from the Albanian month February', () => {
    expect(turn('Sa materiale ka bërë fabrika dje? Përgjigju shkurt me një fjali.')).toMatchObject({ singleDate: '2026-10-31', mixedPeriods: false });
    expect(turn('Sa kg dje?', 'edhe te Demo, përgjigju shkurt')).toMatchObject({ singleDate: '2026-10-31', mixedPeriods: false });
    expect(turn('Krahaso shkurt 2026 me dje. Përgjigju shkurt.')).toMatchObject({ singleDate: null, mixedPeriods: true });
  });
  it('does not collapse an open-ended since/from range to its single starting day', () => {
    for (const question of ['Sa orë që prej 2026-01-01?', 'Sa orë nga 2026-01-01?', 'Hours since 2026-01-01', 'Hours from 2026-01-01', 'Stunden seit 2026-01-01']) {
      const range = turn(question);
      expect(range).toMatchObject({ singleDate: null, mixedPeriods: true, rangeRequested: true });
      expect(assistantToolDate(range, '2026-01-01')).toBe('2026-01-01');
      expect(assistantToolDate(range, '2026-11-01')).toBe('2026-11-01');
    }
    expect(turn('Hours from Oct 1 until today')).toMatchObject({ singleDate: null, mixedPeriods: true, rangeRequested: true });
  });
  it('recognizes new relative dates in follow-ups and retains them for a later qualifier', () => {
    expect(turn('Sa kg u prenë sot?', 'po dje?')).toMatchObject({ shortFollowUp: true, singleDate: '2026-10-31' });
    expect(turn('Sa kg u prenë sot?', 'po dje?', 'edhe te Agroni?').singleDate).toBe('2026-10-31');
    expect(turn('Sa kg më 2025-01-01?', 'sot?').singleDate).toBe('2026-11-01');
  });
  it('does not inherit an old date into a new standalone question', () => {
    expect(turn('Sa kg më 2025-01-01?', 'Cilët punëtorë janë aktivë?').singleDate).toBeNull();
  });
  it.each(['Me jep detaje', 'details', 'more details', 'dammi dettagli', 'arata detalii', 'pokaz szczegoly'])('keeps the requested day for a details-only follow-up: %s', question => {
    expect(turn('Me jep nje raport per dje', question)).toMatchObject({ shortFollowUp: true, singleDate: '2026-10-31' });
    expect(turn('Me jep nje raport per dje', `${question} te nje projekt i ri`).singleDate).toBeNull();
  });
  it('does not carry a previous historical day into a current-month follow-up', () => {
    expect(turn('Sa kg më 2025-01-01?', 'po këtë muaj?')).toMatchObject({ currentMonthRequested: true, currentMonth: '2026-11', singleDate: null });
    expect(turn('Sa kg më 2025-01-01?', 'po këtë muaj?', 'edhe te Agroni?')).toMatchObject({ currentMonthRequested: true, singleDate: null });
    expect(turn('Sa kg më 2025-01-01?', 'po nëntor 2026?').singleDate).toBeNull();
  });
  it('retains the actual business intent across several short follow-ups', () => {
    expect(turn('Sa kg u prenë sot?', 'po dje?', 'edhe te Agroni?').effectiveQuestion).toContain('Sa kg u prenë sot?');
  });
  it('does not silently normalize an invalid explicit calendar date', () => {
    expect(turn('Sa kg më 30.02.2026?')).toMatchObject({ singleDate: null, invalidDates: ['2026-02-30'] });
  });
  it.each(['sot', 'heute', 'today', 'oggi', 'astăzi', 'dziś'])('resolves today in supported language: %s', question => {
    expect(turn(question).singleDate).toBe('2026-11-01');
  });
  it.each(['nesër', 'morgen', 'tomorrow', 'domani', 'mâine', 'jutro'])('resolves tomorrow in supported language: %s', question => {
    expect(turn(question).singleDate).toBe('2026-11-02');
  });
});
