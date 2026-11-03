import { describe, expect, it } from "vitest";

import { geocodeAddress } from "./geocode";

const reply = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

describe("geocodeAddress", () => {
  it("returns the first point and limits the search to the company country", async () => {
    let url = "";
    const fetcher = (async (input: string) => {
      url = input;
      return { ok: true, json: async () => [{ lat: "41.33", lon: "19.82" }] };
    }) as unknown as typeof fetch;
    expect(await geocodeAddress("Rruga e Durrësit, Tiranë", "AL", fetcher)).toEqual({ lat: 41.33, lng: 19.82 });
    expect(url).toContain("countrycodes=al");
  });

  it("gives null for no match, errors and too short input", async () => {
    expect(await geocodeAddress("Nowhere 1", "AL", reply([]))).toBeNull();
    expect(await geocodeAddress("Nowhere 1", "AL", reply([], false))).toBeNull();
    expect(await geocodeAddress("x", "AL", reply([{ lat: "1", lon: "2" }]))).toBeNull();
  });
});
