import { describe, expect, it } from "vitest";

import { parseEnumInput } from "./enum-input";

const Level = { JUNIOR: "JUNIOR", SENIOR: "SENIOR" } as const;

describe("parseEnumInput", () => {
  it("accepts a known value", () => {
    expect(parseEnumInput("SENIOR", Level, "JUNIOR")).toBe("SENIOR");
    expect(parseEnumInput(" SENIOR ", Level, "JUNIOR")).toBe("SENIOR");
  });

  it.each([null, undefined, "", "senior", "ADMIN"])("falls back for %j", (value) => {
    expect(parseEnumInput(value, Level, "JUNIOR")).toBe("JUNIOR");
  });

  it("falls back for file uploads", () => {
    expect(parseEnumInput(new File([], "x.txt"), Level, "JUNIOR")).toBe("JUNIOR");
  });
});
