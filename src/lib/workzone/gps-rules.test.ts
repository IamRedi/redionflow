import { describe, expect, it } from "vitest";

import { canUseWorkerPhoneGps, distanceMeters, isInsideGeofence, presenceDurationMinutes } from "./gps-rules";

describe("gps-rules", () => {
  it("matches nearby points inside a Baustelle geofence", () => {
    const center = { lat: 51.4556, lng: 7.0116 };
    const nearby = { lat: 51.456, lng: 7.012 };

    expect(distanceMeters(center, nearby)).toBeLessThan(60);
    expect(isInsideGeofence(nearby, center, 120)).toBe(true);
  });

  it("gates worker phone GPS to active, app-open, non-paused sessions", () => {
    expect(canUseWorkerPhoneGps({ workerPhoneGpsEnabled: true, isLiveSession: true, appIsActive: true, isPaused: false })).toBe(true);
    expect(canUseWorkerPhoneGps({ workerPhoneGpsEnabled: true, isLiveSession: true, appIsActive: true, isPaused: true })).toBe(false);
    expect(canUseWorkerPhoneGps({ workerPhoneGpsEnabled: false, isLiveSession: true, appIsActive: true, isPaused: false })).toBe(false);
  });

  it("calculates machine presence minutes", () => {
    const start = new Date("2026-04-30T10:00:00Z");
    const end = new Date("2026-04-30T10:37:00Z");

    expect(presenceDurationMinutes(start, end)).toBe(37);
  });
});
