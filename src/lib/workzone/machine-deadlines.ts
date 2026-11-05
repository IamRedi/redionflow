/**
 * Which paper deadlines a machine card shows, by the company's country.
 * Germany: HU, SP, UVV. Albania: Kolaudimi (stored in tuvDate), insurance,
 * road tax, transport permit, tachograph; the last two only when the vehicle has them.
 */
export type DeadlineKey =
  | 'hu'
  | 'sp'
  | 'uvv'
  | 'kolaudim'
  | 'insurance'
  | 'tax'
  | 'permit'
  | 'tachograph';

export type MachineDates = {
  tuvDate?: Date | string | null;
  spDate?: Date | string | null;
  uvvDate?: Date | string | null;
  insuranceDate?: Date | string | null;
  taxDate?: Date | string | null;
  transportPermitDate?: Date | string | null;
  tachographDate?: Date | string | null;
};

export type MachineDeadline = { key: DeadlineKey; date: Date | string | null };

export function machineDeadlines(
  machine: MachineDates,
  country: string | null | undefined,
): MachineDeadline[] {
  if (country === 'AL') {
    const list: MachineDeadline[] = [
      { key: 'kolaudim', date: machine.tuvDate ?? null },
      { key: 'insurance', date: machine.insuranceDate ?? null },
      { key: 'tax', date: machine.taxDate ?? null },
    ];
    if (machine.transportPermitDate)
      list.push({ key: 'permit', date: machine.transportPermitDate });
    if (machine.tachographDate)
      list.push({ key: 'tachograph', date: machine.tachographDate });
    return list;
  }
  return [
    { key: 'hu', date: machine.tuvDate ?? null },
    { key: 'sp', date: machine.spDate ?? null },
    { key: 'uvv', date: machine.uvvDate ?? null },
  ];
}

/** The deadline that runs out first (overdue ones included), or null when none is set. */
export function nextMachineDeadline(
  machine: MachineDates,
  country: string | null | undefined,
): MachineDeadline | null {
  let best: { deadline: MachineDeadline; time: number } | null = null;
  for (const deadline of machineDeadlines(machine, country)) {
    if (!deadline.date) continue;
    const time = new Date(deadline.date).getTime();
    if (Number.isNaN(time)) continue;
    if (!best || time < best.time) best = { deadline, time };
  }
  return best?.deadline ?? null;
}
