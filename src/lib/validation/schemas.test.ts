import { describe, expect, it } from "vitest";

import { createBaustelleSchema, updateBaustelleMetaSchema } from "./schemas";

describe("Baustelle validation schemas", () => {
  it("accept BauFlow Baustelle types", () => {
    expect(
      createBaustelleSchema.safeParse({
        companyId: "company-1",
        name: "Kantier BauFlow",
        type: "SIGNAGE",
        status: "active",
      }).success,
    ).toBe(true);

    expect(
      updateBaustelleMetaSchema.safeParse({
        baustelleId: "baustelle-1",
        name: "Kantier BauFlow",
        type: "OTHER",
        status: "active",
      }).success,
    ).toBe(true);
  });
});
