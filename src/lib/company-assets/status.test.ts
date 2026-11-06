import { describe, expect, it } from 'vitest';
import { operationalStatusFromSummary, operationalStatusLabels, unknownAssetStatus } from './status';
import { assetCopy } from '@/components/company-assets/copy';
import type { AssetOperationalStatus, AssetSummary } from './types';

const status = (change: Partial<AssetOperationalStatus> = {}): AssetOperationalStatus => ({ availability: 'available', activeRepairPhase: null, activeRepairLocation: null, usable: true, known: true, readAt: '2026-01-02T12:00:00.000Z', ...change });
describe('current operational status labels', () => {
  it('never guesses availability from absent or failed data', () => {
    for (const value of [null, undefined, unknownAssetStatus(), status({ known: false }), status({ usable: null })]) expect(operationalStatusLabels(value)).toEqual({ primary: 'unknown', secondary: null, location: null });
  });
  it.each(['reported', 'received', 'repairing'] as const)('shows the exact %s phase, not a broad workshop label', phase => {
    expect(operationalStatusLabels(status({ availability: phase === 'reported' ? 'reported' : 'workshop', activeRepairPhase: phase, activeRepairLocation: 'external', usable: false }))).toEqual({ primary: phase, secondary: null, location: phase === 'repairing' ? 'external' : null });
  });
  it.each(['loss_pending', 'retirement_pending', 'lost', 'retired'] as const)('keeps %s primary while retaining current repair evidence', availability => {
    expect(operationalStatusLabels(status({ availability, activeRepairPhase: 'repairing', activeRepairLocation: 'internal', usable: false }))).toEqual({ primary: availability, secondary: 'repairing', location: 'internal' });
  });
  it('uses only summary current state, with no inference from completed history', () => {
    const input = { availability: 'inactive', activeRepairPhase: null, activeRepairLocation: null } as AssetSummary;
    expect(operationalStatusFromSummary(input)).toMatchObject({ availability: 'inactive', usable: false, known: true });
    expect(operationalStatusLabels(operationalStatusFromSummary(input)).primary).toBe('inactive');
  });
  it('has readable machine-specific status and refresh copy in all supported languages', () => {
    for (const language of ['sq', 'en', 'de', 'it', 'pl', 'ro']) {
      const c = assetCopy(language);
      for (const key of ['statusAvailable', 'statusAvailableShort', 'statusUnknown', 'statusReported', 'statusReceivedShort', 'statusWorkshop', 'statusHandover', 'refresh'] as const) expect(c[key].trim().length).toBeGreaterThan(2);
    }
    expect(assetCopy('sq').statusAvailable).not.toBe(assetCopy('sq').available);
    expect(assetCopy('sq').statusHandover).not.toBe(assetCopy('sq').handover);
  });
});
