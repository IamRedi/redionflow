import type { TrackPoint } from '../wanway/adapter';

export const FUEL_GPS_TOLERANCE_SECONDS = 15 * 60;

/** Preserve the actual point time and offset; never interpolate or backdate it. */
export function closestFuelEvidence(
  points: Array<TrackPoint & { source?: string }>,
  fueledAt: Date,
  now = new Date(),
) {
  const valid = points.filter(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      Math.abs(p.lat) <= 90 &&
      Math.abs(p.lng) <= 180 &&
      Number.isFinite(Date.parse(p.recordedAt)) &&
      Date.parse(p.recordedAt) <= now.getTime() + 60_000,
  );
  valid.sort(
    (a, b) =>
      Math.abs(Date.parse(a.recordedAt) - fueledAt.getTime()) -
        Math.abs(Date.parse(b.recordedAt) - fueledAt.getTime()) ||
      Date.parse(a.recordedAt) - Date.parse(b.recordedAt),
  );
  const point = valid[0];
  if (!point) return null;
  const deltaSeconds = Math.round(
    (Date.parse(point.recordedAt) - fueledAt.getTime()) / 1000,
  );
  const before = valid.find(
    (p) => Date.parse(p.recordedAt) <= fueledAt.getTime(),
  );
  const after = valid.find(
    (p) => Date.parse(p.recordedAt) >= fueledAt.getTime(),
  );
  const evidence = [point, before, after].filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );
  const unique = evidence.filter(
    (p, i) =>
      evidence.findIndex(
        (other) =>
          other.recordedAt === p.recordedAt &&
          other.lat === p.lat &&
          other.lng === p.lng,
      ) === i,
  );
  return {
    ...point,
    deltaSeconds,
    status:
      Math.abs(deltaSeconds) <= FUEL_GPS_TOLERANCE_SECONDS
        ? 'matched'
        : 'too_far',
    evidence: unique.sort(
      (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt),
    ),
  };
}
