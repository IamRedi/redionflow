import { describe, expect, it } from "vitest";
import { fleetInspectionFor, fleetInspectionState } from "./fleet-inspections";

describe("Muster fleet inspection indicators", () => {
  const now = "2026-11-13T12:00:00Z";
  it("keeps missing/invalid dates unknown and uses inclusive 30-day warning boundaries", () => {
    expect(fleetInspectionState(null, now)).toBe("unknown");
    expect(fleetInspectionState("invalid", now)).toBe("unknown");
    expect(fleetInspectionState("2026-02-30", now)).toBe("unknown");
    expect(fleetInspectionState("2026-11-12", now)).toBe("expired");
    expect(fleetInspectionState("2026-11-13", now)).toBe("due");
    expect(fleetInspectionState("2026-12-13", now)).toBe("due");
    expect(fleetInspectionState("2026-12-14", now)).toBe("ok");
  });
  it("uses Berlin midnight and calendar days across DST", () => {
    expect(fleetInspectionState("2026-11-13", "2026-11-13T23:30:00Z")).toBe("expired");
    expect(fleetInspectionState("2026-04-27", "2026-03-28T12:00:00Z")).toBe("due");
    expect(fleetInspectionState("2026-04-28", "2026-03-28T12:00:00Z")).toBe("ok");
  });
  it("matches one existing plate and refuses missing or ambiguous identity", () => {
    const row = { plate: "MU-BD 201", hu: "2027-01-31", sp: null, uvv: null };
    expect(fleetInspectionFor([row], " mu-bd   201 ")).toBe(row);
    expect(fleetInspectionFor([row], "MU-BD 401")).toBeUndefined();
    expect(fleetInspectionFor([row, row], row.plate)).toBeUndefined();
  });
});
