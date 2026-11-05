import { describe, expect, it } from 'vitest';

import { machineDeadlines, nextMachineDeadline } from './machine-deadlines';

describe('machineDeadlines', () => {
  it('keeps HU/SP/UVV for German companies', () => {
    expect(
      machineDeadlines({ tuvDate: '2027-01-01' }, 'DE').map((d) => d.key),
    ).toEqual(['hu', 'sp', 'uvv']);
  });

  it('shows Albanian papers, permit and tachograph only when set', () => {
    expect(
      machineDeadlines({ tuvDate: '2027-01-01' }, 'AL').map((d) => d.key),
    ).toEqual(['kolaudim', 'insurance', 'tax']);
    const full = machineDeadlines(
      {
        tuvDate: '2027-01-01',
        transportPermitDate: '2027-03-29',
        tachographDate: '2026-11-14',
      },
      'AL',
    );
    expect(full.map((d) => d.key)).toEqual([
      'kolaudim',
      'insurance',
      'tax',
      'permit',
      'tachograph',
    ]);
    expect(full[0]?.date).toBe('2027-01-01');
  });

  it('finds the paper that runs out first', () => {
    const next = nextMachineDeadline(
      {
        tuvDate: '2027-04-27',
        insuranceDate: '2027-02-04',
        taxDate: '2027-02-25',
        transportPermitDate: '2025-09-18',
      },
      'AL',
    );
    expect(next?.key).toBe('permit');
    expect(nextMachineDeadline({}, 'AL')).toBeNull();
  });
});
