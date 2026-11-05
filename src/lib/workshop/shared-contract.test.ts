import { describe, expect, it } from "vitest";
import { mutationEnvelope, uploadEnvelope, publicWorkshopCommand } from "./shared-contract";

describe("shared demo request boundary", () => {
  it("accepts commands, never client snapshots or company/actor/time overrides", () => {
    const command = { type: "part", jobId: "WS-101", partId: "hydraulic", qty: 1 };
    expect(publicWorkshopCommand.safeParse(command).success).toBe(true);
    for (const extra of [{ companyId: "another-company" }, { actor: "Admin" }, { at: "2020-01-01" }, { state: {} }]) expect(publicWorkshopCommand.safeParse({ ...command, ...extra }).success).toBe(false);
    for (const type of ["document", "photo", "reset", "replace"]) expect(publicWorkshopCommand.safeParse({ type }).success).toBe(false);
  });
  it("requires an explicit valid revision and receipt on uploads and commands", () => {
    const requestId = "bc3cd4f2-b74a-433b-8bd5-65fd593e342a";
    for (const revision of [null, undefined, "", "-1", "NaN", "1.2"]) expect(uploadEnvelope.safeParse({ requestId, revision, kind: "asset", target: "crane" }).success).toBe(false);
    expect(uploadEnvelope.parse({ requestId, revision: "3", kind: "asset", target: "crane" }).revision).toBe(3);
    expect(mutationEnvelope.safeParse({ requestId, revision: -1, command: { type: "release", jobId: "WS-100" } }).success).toBe(false);
    expect(mutationEnvelope.safeParse({ requestId: "arbitrary", revision: 0, command: { type: "release", jobId: "WS-100" } }).success).toBe(false);
  });
  it("rejects fractional, negative and unbounded stock or invalid inspection values", () => {
    for (const qty of [-1, 0, 1.5, 10001, Infinity]) expect(publicWorkshopCommand.safeParse({ type: "restock", partId: "hydraulic", qty }).success).toBe(false);
    expect(publicWorkshopCommand.safeParse({ type: "inspection", assetId: "crane", date: "2026-02-31", note: "Demo" }).success).toBe(false);
  });
});
