import { expect, it } from 'vitest';
import { plannedSteelSchedule, plannedStartToday } from './planned-schedule';
it('keeps six-day sector plans separate from permission levels and actual hours', () => {
  for (const role of ['FIELD_ENGINEER', 'FIELD_WORKER']) expect(plannedSteelSchedule(role, true)).toMatchObject({ start: '07:00', end: '17:00', weekdays: [1, 2, 3, 4, 5, 6] });
  for (const role of ['FACTORY_ENGINEER', 'FACTORY_WORKER']) expect(plannedSteelSchedule(role, true)).toMatchObject({ start: '07:00', end: '16:00' });
  const office = plannedSteelSchedule('OFFICE', true)!;
  expect(office).toMatchObject({ start: '08:00', end: '16:00' });
  expect(plannedStartToday(office, new Date(2026, 10, 9, 23, 30))).toBe('2026-11-09T08:00');
  expect(plannedStartToday(office, new Date(2026, 6, 10, 0, 30))).toBe('2026-07-10T08:00');
  expect(plannedSteelSchedule('OFFICE', false)).toBeNull();
  for (const role of [null, 'MECHANIC', 'MEISTER', 'unknown']) expect(plannedSteelSchedule(role, true)).toBeNull();
});
