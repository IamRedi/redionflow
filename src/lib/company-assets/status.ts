import type { AssetAvailability, AssetOperationalStatus, AssetSummary } from './types';

export type OperationalStatusKey = AssetAvailability | 'unknown' | 'received' | 'repairing';
export function unknownAssetStatus(readAt = new Date().toISOString()): AssetOperationalStatus {
  return { availability: null, activeRepairPhase: null, activeRepairLocation: null, usable: null, known: false, readAt };
}
export function operationalStatusFromSummary(asset: AssetSummary, readAt = ''): AssetOperationalStatus {
  return { availability: asset.availability, activeRepairPhase: asset.activeRepairPhase, activeRepairLocation: asset.activeRepairLocation, usable: asset.availability === 'available' || asset.availability === 'issued', known: true, readAt };
}

/** Current open work only. A completed repair is history, never a current phase. */
export function operationalStatusLabels(status: AssetOperationalStatus | null | undefined): { primary: OperationalStatusKey; secondary: OperationalStatusKey | null; location: 'internal' | 'external' | null } {
  if (!status?.known || !status.availability || status.usable === null) return { primary: 'unknown', secondary: null, location: null };
  const phase = status.activeRepairPhase;
  const lifecycle = ['lost', 'retired', 'loss_pending', 'retirement_pending'].includes(status.availability);
  return {
    primary: lifecycle ? status.availability : phase ?? status.availability,
    secondary: lifecycle ? phase : null,
    location: phase === 'repairing' ? status.activeRepairLocation : null,
  };
}
