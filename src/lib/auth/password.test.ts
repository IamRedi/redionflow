import { describe, expect, it } from "vitest";

import { hashPassword, isHashedPassword, isLegacyPlaintextHash, verifyPassword } from "./password";

describe("password (BDF-P1-001)", () => {
  it("hashPassword returns a scrypt$-prefixed value", () => {
    const stored = hashPassword("hunter22-strong");
    expect(stored.startsWith("scrypt$1$")).toBe(true);
    expect(isHashedPassword(stored)).toBe(true);
  });

  it("verifyPassword accepts the correct password", () => {
    const stored = hashPassword("hunter22-strong");
    expect(verifyPassword("hunter22-strong", stored)).toBe(true);
  });

  it("verifyPassword rejects a wrong password", () => {
    const stored = hashPassword("hunter22-strong");
    expect(verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("verifyPassword rejects legacy plaintext PIN 654321 stored as-is", () => {
    // Simulates a legacy row: `passwordHash = "654321"`. verifyPassword
    // must return false regardless of what the client submits.
    expect(verifyPassword("654321", "654321")).toBe(false);
  });

  it("verifyPassword rejects legacy plaintext PIN 202020 stored as-is", () => {
    expect(verifyPassword("202020", "202020")).toBe(false);
  });

  it("verifyPassword rejects an arbitrary plaintext value stored as-is", () => {
    expect(verifyPassword("hunter2", "hunter2")).toBe(false);
    expect(verifyPassword("password123", "password123")).toBe(false);
  });

  it("verifyPassword rejects a malformed scrypt hash (wrong version)", () => {
    expect(verifyPassword("hunter2", "scrypt$9$deadbeef$deadbeef")).toBe(false);
  });

  it("verifyPassword rejects a malformed scrypt hash (missing segments)", () => {
    expect(verifyPassword("hunter2", "scrypt$1$onlyonesalt")).toBe(false);
  });

  it("verifyPassword rejects an empty stored value", () => {
    expect(verifyPassword("hunter2", "")).toBe(false);
  });

  it("isHashedPassword correctly classifies scrypt vs plaintext", () => {
    const stored = hashPassword("hunter22-strong");
    expect(isHashedPassword(stored)).toBe(true);
    expect(isHashedPassword("654321")).toBe(false);
    expect(isHashedPassword("202020")).toBe(false);
    expect(isHashedPassword("")).toBe(false);
    expect(isHashedPassword(null)).toBe(false);
    expect(isHashedPassword(undefined)).toBe(false);
  });

  it("isLegacyPlaintextHash flags exactly the values scrypt does not", () => {
    const stored = hashPassword("hunter22-strong");
    expect(isLegacyPlaintextHash(stored)).toBe(false);
    expect(isLegacyPlaintextHash("654321")).toBe(true);
    expect(isLegacyPlaintextHash("202020")).toBe(true);
    expect(isLegacyPlaintextHash("plain")).toBe(true);
    expect(isLegacyPlaintextHash("")).toBe(false); // no hash to reject
    expect(isLegacyPlaintextHash(null)).toBe(false);
  });
});
