import { describe, expect, it } from "vitest";

import { equipmentQuantity, hasEquipmentOnSite, isRecord, readLatLng } from "./site-json";

describe("site-json", () => {
  it("isRecord accepts plain objects only", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
  });

  it("readLatLng supports both coordinate shapes", () => {
    expect(readLatLng({ lat: 51.9, lng: 7.6 })).toEqual({ lat: 51.9, lng: 7.6 });
    expect(readLatLng({ latitude: 48.1, longitude: 11.5 })).toEqual({ lat: 48.1, lng: 11.5 });
  });

  it.each([null, undefined, [], "51,7", { lat: "51", lng: 7 }, { lat: 51 }])("readLatLng rejects %j", (value) => {
    expect(readLatLng(value)).toBeNull();
  });

  it("equipmentQuantity clamps and ignores malformed rows", () => {
    const status = { SIGN: { quantity: 3 }, PLATE: { quantity: -2 }, FENCE: { quantity: "abc" } };
    expect(equipmentQuantity(status, "SIGN")).toBe(3);
    expect(equipmentQuantity(status, "PLATE")).toBe(0);
    expect(equipmentQuantity(status, "FENCE")).toBe(0);
    expect(equipmentQuantity(null, "SIGN")).toBe(0);
  });

  it("hasEquipmentOnSite detects any positive quantity", () => {
    expect(hasEquipmentOnSite({ SIGN: { quantity: 0 }, FENCE: { quantity: 1 } })).toBe(true);
    expect(hasEquipmentOnSite({ SIGN: { quantity: 0 } })).toBe(false);
    expect(hasEquipmentOnSite(null)).toBe(false);
  });
});
