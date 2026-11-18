import { describe, expect, it } from 'vitest';
import { legacyPhaseNote, phaseNoteDayRange } from './phase-notes';
describe('process diary legacy evidence and company days', () => {
 it('preserves a real old note without inventing its missing author or time', () => {
  expect(legacyPhaseNote(JSON.stringify({ note: 'Existing note' }))).toMatchObject({ text: 'Existing note', authorName: '', writtenAt: null, legacy: true });
  expect(legacyPhaseNote('Old plain text')).toMatchObject({ text: 'Old plain text', writtenAt: null });
  expect(legacyPhaseNote(JSON.stringify({ material: 'Bolts', label: 'Process' }))).toBeNull();
  expect(legacyPhaseNote(JSON.stringify({ note: 'Existing', noteBy: 'Original author', noteAt: 'not a date' }))).toMatchObject({ authorName: 'Original author', writtenAt: null });
 });
 it('keeps the original recorded date and handles timezone day boundaries and DST', () => {
  expect(legacyPhaseNote(JSON.stringify({ note: 'Old', noteBy: 'A', noteAt: '2026-11-17T23:30:00Z' }))?.writtenAt).toBe('2026-11-17T23:30:00.000Z');
  const normal = phaseNoteDayRange('2026-11-18', 'Europe/Tirane');
  expect(normal.gte.toISOString()).toBe('2026-11-17T23:00:00.000Z');
  expect(normal.lt.toISOString()).toBe('2026-11-18T23:00:00.000Z');
  const short = phaseNoteDayRange('2026-03-29', 'Europe/Tirane'), long = phaseNoteDayRange('2026-10-25', 'Europe/Tirane');
  expect((short.lt.getTime() - short.gte.getTime()) / 3600000).toBe(23);
  expect((long.lt.getTime() - long.gte.getTime()) / 3600000).toBe(25);
  for (const day of ['2026-02-30', '2026-99-10', '2026-1-1', 'bad']) expect(() => phaseNoteDayRange(day, 'Europe/Tirane')).toThrow();
 });
});
