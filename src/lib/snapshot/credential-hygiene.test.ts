import { describe, expect, it } from "vitest";

import {
  isCredentialSnapshotField,
  sanitizeSnapshotValue,
} from "./credential-hygiene";

describe("snapshot credential hygiene (BDF-P4-004)", () => {
  it("removes credential material while preserving business data", () => {
    const snapshot = {
      models: {
        user: [{ email: "admin@example.test", passwordHash: "legacy-secret", loginPinHash: "private-owner-pin-hash", profile: { name: "Admin" } }],
        worker: [{ name: "Worker", loginCode: "123456", loginCodeHash: "scrypt$1$hash", availability: "AVAILABLE" }],
        token: [{ apiKey: "key", resetCode: "reset", publicLabel: "Mobile app" }],
      },
    };

    expect(sanitizeSnapshotValue(snapshot)).toEqual({
      models: {
        user: [{ email: "admin@example.test", profile: { name: "Admin" } }],
        worker: [{ name: "Worker", availability: "AVAILABLE" }],
        token: [{ publicLabel: "Mobile app" }],
      },
    });
  });

  it("is idempotent", () => {
    const snapshot = { worker: [{ loginCode: "123456", name: "Worker" }] };
    const once = sanitizeSnapshotValue(snapshot);
    expect(sanitizeSnapshotValue(once)).toEqual(once);
  });

  it.each(["passwordHash", "loginCode", "loginCodeHash", "loginPinHash", "login_pin_hash", "token", "accessToken", "apiKey", "secret", "resetCode", "sessionToken", "fcmToken"])(
    "recognises %s as credential material",
    (field) => expect(isCredentialSnapshotField(field)).toBe(true),
  );
});
