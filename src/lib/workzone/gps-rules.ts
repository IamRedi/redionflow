export const DEFAULT_BAUSTELLE_GEOFENCE_METERS = 120;

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type WorkerPhoneGpsState = {
  workerPhoneGpsEnabled: boolean;
  isLiveSession: boolean;
  appIsActive: boolean;
  isPaused: boolean;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(from: GeoPoint, to: GeoPoint) {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isInsideGeofence(point: GeoPoint, center: GeoPoint, radiusMeters = DEFAULT_BAUSTELLE_GEOFENCE_METERS) {
  return distanceMeters(point, center) <= radiusMeters;
}

export function canUseWorkerPhoneGps(state: WorkerPhoneGpsState) {
  return state.workerPhoneGpsEnabled && state.isLiveSession && state.appIsActive && !state.isPaused;
}

export function presenceDurationMinutes(enteredAt: Date, leftAt: Date) {
  return Math.max(0, Math.round((leftAt.getTime() - enteredAt.getTime()) / 60_000));
}
