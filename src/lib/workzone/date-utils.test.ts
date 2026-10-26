import { describe, expect, it } from "vitest";

import { dateKey, dayRange, monthKey } from "./date-utils";

describe("workzone report date helpers", () => {
  it("uses the Berlin calendar day instead of the UTC day", () => {
    expect(dateKey(new Date("2026-04-22T22:30:00.000Z"))).toBe("2026-04-23");
    expect(dateKey(new Date("2026-04-23T22:30:00.000Z"))).toBe("2026-04-24");
    expect(monthKey(new Date("2026-04-30T22:30:00.000Z"))).toBe("2026-05");
  });

  it("builds Berlin day ranges as UTC instants for database filters", () => {
    const { start, end } = dayRange("2026-04-23");

    expect(start.toISOString()).toBe("2026-04-22T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-04-23T22:00:00.000Z");
  });
});
