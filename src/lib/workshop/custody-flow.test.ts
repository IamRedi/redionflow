import { describe, expect, it } from "vitest";
import { createWorkshopDemo } from "./demo-data";
import { applyCustodyCommand, treeIdentity } from "./custody-flow";
import { demoOffice, type DemoActor } from "./custody-schema";
import { publicWorkshopCommand, type WorkshopDirectory } from "./shared-contract";
import { workshopSchema, type WorkshopState } from "./demo-model";
import { upgradeWorkshopInventory } from "./inventory-flow";
import type { z } from "zod";

const now = "2026-11-05T12:00:00.000Z";
const directory: WorkshopDirectory = { workers: ["A", "B", "C"].map(k => ({ key: `worker-${k}`, id: k, name: `Person ${k}`, available: true })), sites: [{ key: "site-one", id: "one", name: "Stadtpark", active: true }] };
const worker = (key: string): DemoActor => ({ key: `worker-${key}`, name: `Person ${key}`, role: "worker" });
function run(s: WorkshopState, input: z.input<typeof publicWorkshopCommand>, actor = demoOffice, id = "step", at = now) { return applyCustodyCommand(s, publicWorkshopCommand.parse(input), actor, directory, at, id, { status: "todo", species: "Eiche", diameter: 30, note: "" }); }
function issued(auto = false) { let s = createWorkshopDemo(); s.custody.autoConfirm = auto; s = run(s, { type: "handover", kind: "issue", assetId: "crane", workerKey: "worker-A", siteKey: "site-one" }, demoOffice, "first"); return auto ? s : run(s, { type: "confirm-handover", handoverId: "first" }, worker("A"), "accept"); }

describe("Musterfirma custody", () => {
  it("reserves one device without changing its holder until both parties confirm", () => {
    const initial = createWorkshopDemo();
    const pending = run(initial, { type: "handover", kind: "take", assetId: "crane", method: "scan" }, worker("A"), "request");
    expect(pending.assets.find(a => a.id === "crane")?.holder).toBe("");
    expect(pending.custody.handovers[0].confirmations).toEqual([{ actorKey: "worker-A", by: "worker-A", at: now, mode: "explicit" }]);
    expect(pending.custody.notifications).toContainEqual(expect.objectContaining({ recipient: "admin", kind: "requested" }));
    expect(() => run(pending, { type: "handover", kind: "take", assetId: "crane" }, worker("B"))).toThrow("pending");
    expect(() => run(pending, { type: "confirm-handover", handoverId: "request" }, worker("B"))).toThrow("permission");
    const complete = run(pending, { type: "confirm-handover", handoverId: "request" }, demoOffice, "confirm");
    expect(complete.assets.find(a => a.id === "crane")?.placement?.workerKey).toBe("worker-A");
    expect(complete.custody.handovers[0].status).toBe("completed");
    expect(initial.custody.handovers).toHaveLength(0);
  });
  it("records explicit and policy confirmations but never auto-confirms a colleague transfer", () => {
    const s = issued(true);
    expect(s.custody.handovers[0].confirmations.map(c => c.mode)).toEqual(["explicit", "policy"]);
    const transfer = run(s, { type: "handover", kind: "transfer", assetId: "crane", workerKey: "worker-B", siteKey: "site-one", method: "scan" }, worker("A"), "transfer");
    expect(transfer.custody.handovers[0]).toMatchObject({ automatic: false, status: "pending", required: ["worker-A", "worker-B"] });
    expect(() => run(transfer, { type: "confirm-handover", handoverId: "transfer" }, demoOffice)).toThrow("permission");
    const complete = run(transfer, { type: "confirm-handover", handoverId: "transfer" }, worker("B"), "accept-transfer");
    expect(complete.assets.find(a => a.id === "crane")?.placement?.workerKey).toBe("worker-B");
    expect(complete.assets.find(a => a.id === "crane")?.events[0]).toMatchObject({ kind: "transferred", actorKey: "worker-B", method: "scan" });
  });
  it("lets the manager propose a colleague transfer but requires both colleagues", () => {
    const s = run(issued(true), { type: "handover", kind: "issue", assetId: "crane", workerKey: "worker-B" }, demoOffice, "proposal");
    expect(s.custody.handovers[0].confirmations).toEqual([]);
    const one = run(s, { type: "confirm-handover", handoverId: "proposal" }, worker("B"), "one");
    expect(one.custody.handovers[0].status).toBe("pending");
    expect(run(one, { type: "confirm-handover", handoverId: "proposal" }, worker("A"), "two").custody.handovers[0].status).toBe("completed");
  });
  it("supports rejection/cancellation without moving the device", () => {
    const pending = run(createWorkshopDemo(), { type: "handover", kind: "issue", assetId: "crane", workerKey: "worker-A" }, demoOffice, "request");
    const declined = run(pending, { type: "decline-handover", handoverId: "request", reason: "Wrong device" }, worker("A"));
    expect(declined.assets.find(a => a.id === "crane")?.holder).toBe("");
    expect(declined.custody.handovers[0]).toMatchObject({ status: "declined", reason: "Wrong device" });
    expect(run(pending, { type: "cancel-handover", handoverId: "request" }).custody.handovers[0].status).toBe("cancelled");
    expect(() => run(declined, { type: "confirm-handover", handoverId: "request" }, worker("A"))).toThrow("transition");
  });
  it("allows an overdue device back into storage, without making it usable", () => {
    const s = run(issued(true), { type: "handover", kind: "return", assetId: "crane" }, worker("A"), "return", "2028-01-01T12:00:00.000Z");
    expect(s.assets.find(a => a.id === "crane")).toMatchObject({ location: "Lager", holder: "" });
    expect(() => run(s, { type: "handover", kind: "take", assetId: "crane" }, worker("B"), "take", "2028-01-01T12:00:00.000Z")).toThrow("unavailable");
  });
  it("cancels pending custody at defect intake, retaining the actual origin", () => {
    const s = run(issued(true), { type: "handover", kind: "transfer", assetId: "crane", workerKey: "worker-B" }, worker("A"), "transfer");
    const received = run(s, { type: "receive", assetId: "crane", problem: "DEMO warning", priority: "normal", assignee: "Workshop" }, worker("A"), "job");
    expect(received.custody.handovers[0].status).toBe("cancelled");
    expect(received.jobs[0].origin?.placement?.workerKey).toBe("worker-A");
    expect(() => run(received, { type: "confirm-handover", handoverId: "transfer" }, worker("B"))).toThrow("transition");
  });
  it("restricts creation/settings, canonicalises codes and resolves directory identities", () => {
    const details = { category: "tool" as const, manufacturer: "Demo", model: "M1", serial: "S1", note: "Fictional" };
    expect(() => run(createWorkshopDemo(), { type: "policy", autoConfirm: true }, worker("A"))).toThrow("permission");
    expect(() => run(createWorkshopDemo(), { type: "register", assetId: "9c156500-3de3-403a-9416-923eddd559be", name: "Saw", code: "WG-101", inspection: "2027-01-01", details })).toThrow("duplicate");
    const created = run(createWorkshopDemo(), { type: "register", assetId: "9c156500-3de3-403a-9416-923eddd559be", name: "Demo saw", code: " test-42 ", inspection: "2027-01-01", details }, demoOffice, "new-tool");
    expect(created.assets[0]).toMatchObject({ id: "9c156500-3de3-403a-9416-923eddd559be", code: "TEST-42", details });
    expect(() => run(created, { type: "handover", kind: "issue", assetId: "9c156500-3de3-403a-9416-923eddd559be", workerKey: "foreign" })).toThrow("unavailable");
  });
  it("isolates read receipts to their recipient", () => {
    const s = run(createWorkshopDemo(), { type: "handover", kind: "take", assetId: "crane" }, worker("A"), "r");
    const id = s.custody.notifications[0].id;
    expect(run(s, { type: "read-notifications", ids: [id] }, worker("B")).custody.notifications[0].readAt).toBeUndefined();
    expect(run(s, { type: "read-notifications", ids: [id] }).custody.notifications[0].readAt).toBe(now);
  });
  it("persists tree progress/reports and prevents worker edits or completing blocked trees", () => {
    const c = { type: "tree" as const, siteKey: "site-one", treeCode: "SP-1" };
    const done = run(createWorkshopDemo(), { ...c, action: "done" }, worker("A"));
    expect(done.custody.trees[treeIdentity(c.siteKey, c.treeCode)].status).toBe("done");
    const reported = run(done, { ...c, action: "report", note: "DEMO broken branch" }, worker("A"));
    expect(() => run(reported, { ...c, action: "done" }, worker("B"))).toThrow("blocked");
    expect(() => run(reported, { ...c, action: "edit", species: "Birke" }, worker("A"))).toThrow("permission");
    const reopened = run(reported, { ...c, action: "reopen" });
    expect(reopened.custody.treeEvents).toHaveLength(3);
    expect(reopened.custody.trees[treeIdentity(c.siteKey, c.treeCode)]).toMatchObject({ status: "todo", note: "DEMO broken branch" });
  });
  it("audits policy changes and refuses to overwrite an unresolved legacy holder", () => {
    const s = run(createWorkshopDemo(), {type:"policy", autoConfirm:true});
    expect(s.custody.policyEvents).toEqual([{id:"step",at:now,actor:demoOffice,autoConfirm:true}]);
    expect(() => run(s,{type:"handover",kind:"issue",assetId:"pole-saw",workerKey:"worker-B"})).toThrow("transition");
    const returned = run(s,{type:"handover",kind:"return",assetId:"pole-saw"});
    expect(returned.assets.find(a=>a.id==="pole-saw")?.holder).toBe("");
  });
  it("upgrades v2 without replacing old assets, jobs, files, events or part movements", () => {
    const old = { ...createWorkshopDemo(), version: 2 }; delete (old as Partial<typeof old>).custody;
    const upgraded = upgradeWorkshopInventory(old, directory);
    expect(upgraded.version).toBe(3); expect(upgraded.jobs).toEqual(old.jobs); expect(upgraded.documents).toEqual(old.documents); expect(upgraded.movements).toEqual(old.movements);
    expect(workshopSchema.safeParse(old).success).toBe(false);
  });
});
