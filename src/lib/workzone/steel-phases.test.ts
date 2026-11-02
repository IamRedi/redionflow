import { describe, expect, it } from "vitest";

import {
  applySteelPhaseCommand,
  isSteelSiteType,
  readSteelPhaseMeta,
  steelPhaseKeyFromTreeId,
  steelPhasesFor,
} from "./steel-phases";

const now = new Date("2026-11-03T08:00:00.000Z");

describe("steel phases", () => {
  it("lists the on-site and workshop phases in work order", () => {
    expect(steelPhasesFor("STEEL_ASSEMBLY").map((p) => p.key)).toEqual(["foundation", "columns", "trusses", "painting"]);
    expect(steelPhasesFor("STEEL_WORKSHOP").map((p) => p.treeId)).toEqual([
      "steel-cutting",
      "steel-drilling",
      "steel-welding",
      "steel-coating",
    ]);
    expect(steelPhasesFor("SIGNAGE")).toEqual([]);
    expect(isSteelSiteType("STEEL_ASSEMBLY")).toBe(true);
    expect(isSteelSiteType("CLIMBING")).toBe(false);
  });

  it("maps tree ids back to phase keys", () => {
    expect(steelPhaseKeyFromTreeId("steel-trusses")).toBe("trusses");
    expect(steelPhaseKeyFromTreeId("steel-unknown")).toBeNull();
    expect(steelPhaseKeyFromTreeId("B-12")).toBeNull();
  });

  it("reads broken or foreign notes as empty meta", () => {
    expect(readSteelPhaseMeta(null).note).toBe("");
    expect(readSteelPhaseMeta("not json").material).toBe("");
    expect(readSteelPhaseMeta(JSON.stringify({ note: "ok", material: 5 }))).toMatchObject({ note: "ok", material: "" });
  });

  it("blocks a phase while material is missing and unblocks when it arrives", () => {
    const start = { status: "todo" as const, meta: readSteelPhaseMeta(null) };
    const missing = applySteelPhaseCommand(start, { kind: "missing", actor: "Arben", text: "Bulona M20" }, now);
    expect(missing.status).toBe("blocked");
    expect(missing.meta).toMatchObject({ material: "Bulona M20", materialBy: "Arben", materialAt: now.toISOString() });

    const arrived = applySteelPhaseCommand(missing, { kind: "materialArrived" }, now);
    expect(arrived.status).toBe("todo");
    expect(arrived.meta.material).toBe("");
  });

  it("finishing clears the material request and reopening keeps the note", () => {
    const withNote = applySteelPhaseCommand({ status: "todo", meta: readSteelPhaseMeta(null) }, { kind: "note", actor: "Megi", text: "Kolona 3 e shtrembër" }, now);
    const blocked = applySteelPhaseCommand(withNote, { kind: "missing", actor: "Megi", text: "Pllaka bazë" }, now);
    const done = applySteelPhaseCommand(blocked, { kind: "done", actor: "Megi" }, now);
    expect(done.status).toBe("done");
    expect(done.meta).toMatchObject({ material: "", doneBy: "Megi", note: "Kolona 3 e shtrembër" });

    const reopened = applySteelPhaseCommand(done, { kind: "reopen" }, now);
    expect(reopened.status).toBe("todo");
    expect(reopened.meta.doneBy).toBe("");
    expect(reopened.meta.note).toBe("Kolona 3 e shtrembër");
  });

  it("an empty note clears the note author", () => {
    const cleared = applySteelPhaseCommand(
      { status: "done", meta: { ...readSteelPhaseMeta(null), note: "x", noteBy: "A", noteAt: "t" } },
      { kind: "note", actor: "B", text: "" },
      now,
    );
    expect(cleared.status).toBe("done");
    expect(cleared.meta).toMatchObject({ note: "", noteBy: "", noteAt: "" });
  });
});
