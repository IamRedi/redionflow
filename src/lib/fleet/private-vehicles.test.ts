import { describe, expect, it } from "vitest";
import { maySeePrivateVehicles } from "./private-vehicles-rule";

describe("maySeePrivateVehicles", () => {
  it("without the list only office admins see private vehicles", () => {
    expect(maySeePrivateVehicles({ name: "Ana Test", isAdmin: true }, "")).toBe(true);
    expect(maySeePrivateVehicles({ name: "Ana Test", isAdmin: false }, "")).toBe(false);
    expect(maySeePrivateVehicles(null, "")).toBe(false);
  });
  it("with the list only matching full or first names, admin or worker", () => {
    const raw = "Ana, Beni Shembull";
    expect(maySeePrivateVehicles({ name: "Ana Test", isAdmin: false }, raw)).toBe(true);
    expect(maySeePrivateVehicles({ name: "ANA", isAdmin: true }, raw)).toBe(true);
    expect(maySeePrivateVehicles({ name: "Beni Shembull", isAdmin: false }, raw)).toBe(true);
    expect(maySeePrivateVehicles({ name: "Beni Tjeter", isAdmin: true }, raw)).toBe(false);
    expect(maySeePrivateVehicles({ name: "Anabela X", isAdmin: true }, raw)).toBe(false);
  });
});
