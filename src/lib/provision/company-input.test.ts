import { describe, expect, it } from "vitest";

import { parseProvisionInput } from "./company-input";

const base = {
  displayName: "Beispiel Stahlbau",
  legalName: "Beispiel Stahlbau GmbH",
  mode: "bau",
  country: "AL",
  owner: { name: "Erika Muster", email: "Erika@Example.org" },
  sites: [{ name: "Werkstatt", type: "STEEL_WORKSHOP" }],
};

describe("provision input", () => {
  it("does nothing without input", () => {
    expect(parseProvisionInput(undefined, undefined)).toBeNull();
    expect(parseProvisionInput("  ", "x")).toBeNull();
  });

  it("parses a company with defaults", () => {
    const parsed = parseProvisionInput(JSON.stringify(base), "a-long-password-1");
    expect(parsed?.company.plan).toBe("enterprise");
    expect(parsed?.company.owner.email).toBe("erika@example.org");
    expect(parsed?.company.sites[0]?.status).toBe("active");
  });

  it("requires a strong first password and valid data", () => {
    expect(() => parseProvisionInput(JSON.stringify(base), "short")).toThrow();
    expect(() => parseProvisionInput(JSON.stringify({ ...base, country: "FR" }), "a-long-password-1")).toThrow();
  });
});
