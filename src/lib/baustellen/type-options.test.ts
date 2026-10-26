import { describe, expect, it } from "vitest";

import { baustelleTypeOptionsForMode, defaultBaustelleTypeForMode } from "./type-options";

describe("Baustelle type options", () => {
  it("uses construction task types for BauFlow", () => {
    const values = baustelleTypeOptionsForMode("bau").map((option) => option.value);

    expect(defaultBaustelleTypeForMode("bau")).toBe("SIGNAGE");
    expect(values).toEqual(["SIGNAGE", "DRAINAGE", "WALL", "PAVING", "PAINTING", "RENOVATION", "OTHER"]);
    expect(values).not.toContain("CLIMBING");
  });

  it("keeps Baumdienst tree-work types separate", () => {
    const values = baustelleTypeOptionsForMode("baumdienst").map((option) => option.value);

    expect(defaultBaustelleTypeForMode("baumdienst")).toBe("TRUCK_PLATFORM");
    expect(values).toEqual(["TRUCK_PLATFORM", "TRUCK_CRANE", "CLIMBING", "WATERING", "EXCAVATOR"]);
    expect(values).not.toContain("SIGNAGE");
  });
});
