/** Planned shifts for steel workspaces, independent from recorded sessions and
 * access permissions. Unknown roles stay unspecified rather than guessing. */
export type PlannedSchedule = { start: string; end: string; weekdays: readonly number[] };
export function plannedSteelSchedule(role: string | null | undefined, enabled: boolean): PlannedSchedule | null {
  if (!enabled) return null;
  const times = role === 'OFFICE' ? ['08:00', '16:00']
    : role === 'FIELD_ENGINEER' || role === 'FIELD_WORKER' ? ['07:00', '17:00']
    : role === 'FACTORY_ENGINEER' || role === 'FACTORY_WORKER' ? ['07:00', '16:00'] : null;
  return times ? { start: times[0], end: times[1], weekdays: [1, 2, 3, 4, 5, 6] } : null;
}

/** Match the existing datetime-local form without changing session parsing. */
export function plannedStartToday(schedule: PlannedSchedule, now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${schedule.start}`;
}
const copy: Record<string, { planned: string; days: string }> = {
  sq: { planned: 'Orari i planifikuar', days: 'Hën–Sht' },
  de: { planned: 'Geplante Arbeitszeit', days: 'Mo–Sa' },
  en: { planned: 'Planned hours', days: 'Mon–Sat' },
  it: { planned: 'Orario previsto', days: 'Lun–Sab' },
  ro: { planned: 'Program planificat', days: 'Lun–Sâm' },
  pl: { planned: 'Planowane godziny', days: 'Pon–Sob' },
};
export function plannedScheduleLabel(schedule: PlannedSchedule, lang: string) {
  const c = copy[lang] ?? copy.en;
  return `${c.planned} · ${c.days} · ${schedule.start}–${schedule.end}`;
}
