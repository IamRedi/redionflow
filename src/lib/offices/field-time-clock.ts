import { dateKey, parseWorkDateTime } from '@/lib/workzone/date-utils';
import type { PlannedSchedule } from '@/lib/workzone/planned-schedule';

export type FieldClockChoice = { mode: 'now' | 'manual' | 'schedule'; at?: string };
/** Fixed hours are a choice at confirmation, never a timer or proof of attendance. */
export function fieldClockTime(choice: FieldClockChoice, command: 'start' | 'stop', schedule: PlannedSchedule | null, sessionStart: string | null, now = new Date()) {
  let at: Date | null;
  if (choice.mode === 'now') at = now;
  else if (choice.mode === 'manual') at = choice.at ? parseWorkDateTime(choice.at) : null;
  else {
    const key = dateKey(now);
    // An old live session needs an explicit date/time, never today's fixed finish.
    if (!schedule || command === 'stop' && (!sessionStart || dateKey(new Date(sessionStart)) !== key)) return null;
    const day = new Date(`${key}T12:00:00Z`).getUTCDay();
    if (!schedule.weekdays.includes(day)) return null;
    at = parseWorkDateTime(`${key}T${command === 'start' ? schedule.start : schedule.end}`);
  }
  if (!at || at.getTime() > now.getTime() + 60_000 || sessionStart && command === 'stop' && at < new Date(sessionStart)) return null;
  return at;
}
