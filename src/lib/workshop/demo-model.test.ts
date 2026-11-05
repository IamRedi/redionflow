import { describe, expect, it } from "vitest";
import { createWorkshopDemo } from "./demo-data";
import { activeJob, applyWorkshopCommand as apply, availability, workshopSchema, type WorkshopCommand } from "./demo-model";

const now = "2026-11-05T10:00:00.000Z";
describe("browser-local workshop rehearsal", () => {
  it("validates its fixture and survives a JSON round trip", () => {
    const state = createWorkshopDemo(); expect(workshopSchema.parse(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
  it("receives an issued fleet asset and keeps its return and intake evidence", () => {
    const input = createWorkshopDemo(); const result = apply(input, { type: "receive", assetId: "truck", problem: "Brake warning", priority: "urgent", assignee: "Demo" }, now, "new");
    expect(input.assets.find(a => a.id === "truck")!.holder).toBe("Jonas Becker");
    expect(result.assets.find(a => a.id === "truck")!.holder).toBe("");
    expect(result.assets.find(a => a.id === "truck")!.events.map(e => e.kind)).toEqual(["received", "returned"]);
    expect(activeJob(result, "truck")!.id).toBe("new");
  });
  it("prevents a duplicate intake and skipped repair stages", () => {
    const input = createWorkshopDemo();
    expect(() => apply(input, { type: "receive", assetId: "saw", problem: "Other", priority: "normal", assignee: "Demo" }, now, "new")).toThrow("duplicate");
    expect(() => apply(input, { type: "repair", jobId: "WS-102", note: "Fixed", tested: true }, now, "new")).toThrow("transition");
    expect(() => apply(input, { type: "release", jobId: "WS-102" }, now, "new")).toThrow("transition");
  });
  it("requires an assignee, repair evidence and function check", () => {
    const state = createWorkshopDemo();
    expect(() => apply(state, { type: "start", jobId: "WS-102", assignee: " " }, now, "e")).toThrow("required");
    expect(() => apply(state, { type: "repair", jobId: "WS-101", note: "Replaced hose", tested: false }, now, "e")).toThrow("testRequired");
    expect(() => apply(state, { type: "repair", jobId: "WS-101", note: " ", tested: true }, now, "e")).toThrow("testRequired");
  });
  it("blocks use until deliberate release; a completed repair alone is insufficient", () => {
    let state = createWorkshopDemo();
    state = apply(state, { type: "start", jobId: "WS-102", assignee: "Demo" }, now, "start");
    state = apply(state, { type: "repair", jobId: "WS-102", note: "Brake replaced and checked", tested: true }, now, "repair");
    const saw = state.assets.find(a => a.id === "saw")!;
    expect(availability(state, saw, now)).toBe("workshop");
    expect(() => apply(state, { type: "issue", assetId: saw.id, holder: "Demo" }, now, "issue")).toThrow("unavailable");
    state = apply(state, { type: "release", jobId: "WS-102" }, now, "release");
    expect(availability(state, state.assets.find(a => a.id === "saw")!, now)).toBe("available");
    expect(state.assets.find(a => a.id === "saw")!.events.map(e => e.kind)).toEqual(["released", "repaired", "started", "received"]);
  });
  it("deducts spare parts once per operation, rejects overdraw and retains cost at time of use", () => {
    const state = apply(createWorkshopDemo(), { type: "part", jobId: "WS-101", partId: "hydraulic", qty: 2 }, now, "p");
    expect(state.parts.find(p => p.id === "hydraulic")!.stock).toBe(1);
    expect(state.jobs.find(j => j.id === "WS-101")!.parts[0]).toMatchObject({ qty: 2, unitCents: 4800 });
    expect(() => apply(state, { type: "part", jobId: "WS-101", partId: "hydraulic", qty: 2 }, now, "p2")).toThrow("stock");
  });
  it.each([0, -1, 0.5, NaN, Infinity, 10001])("rejects invalid stock quantity %s", qty => {
    expect(() => apply(createWorkshopDemo(), { type: "restock", partId: "chain", qty }, now, "p")).toThrow("quantity");
  });
  it("blocks overdue inspections, records the check, and allows issue/return", () => {
    let state = createWorkshopDemo();
    expect(() => apply(state, { type: "issue", assetId: "harness", holder: "Demo" }, now, "i")).toThrow("unavailable");
    state = apply(state, { type: "inspection", assetId: "harness", date: "2027-05-01", note: "Synthetic check only" }, now, "check");
    state = apply(state, { type: "issue", assetId: "harness", holder: "Demo" }, now, "issue");
    expect(state.assets.find(a => a.id === "harness")!.holder).toBe("Demo");
    state = apply(state, { type: "return", assetId: "harness" }, now, "return");
    expect(state.assets.find(a => a.id === "harness")!.location).toBe("Lager");
  });
  it("preserves more than five repair cycles and their full history", () => {
    let state = createWorkshopDemo();
    for (let i = 0; i < 7; i++) {
      const commands: WorkshopCommand[] = [{ type: "receive", assetId: "blower", problem: `Defect ${i}`, priority: "normal", assignee: "Demo" }, { type: "start", jobId: `job${i}`, assignee: "Demo" }, { type: "repair", jobId: `job${i}`, note: "Checked", tested: true }, { type: "release", jobId: `job${i}` }];
      commands.forEach((command, n) => { state = apply(state, command, now, n ? `event${i}-${n}` : `job${i}`); });
    }
    expect(state.jobs.filter(j => j.assetId === "blower")).toHaveLength(7);
    expect(state.assets.find(a => a.id === "blower")!.events).toHaveLength(28);
  });
  it("links documents to the correct asset/order and rejects foreign references", () => {
    const state = createWorkshopDemo(); const doc = { ...state.documents[0], id: "doc2" };
    expect(apply(state, { type: "document", document: doc }, now, "event").documents).toHaveLength(2);
    expect(() => apply(state, { type: "document", document: { ...doc, assetId: "saw" } }, now, "e")).toThrow("missing");
    expect(() => apply(state, { type: "document", document: { ...doc, bytes: 256001 } }, now, "e")).toThrow();
  });
});
