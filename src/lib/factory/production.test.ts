import { describe, expect, it } from "vitest";

import {
  applyStepCommand,
  batchState,
  currentStepIndex,
  initialFactorySteps,
  migrateLegacySteps,
  readFactorySteps,
  readySummary,
  StepCommandError,
} from "./production";

const now = new Date("2026-11-03T07:30:00.000Z");

describe("factory production line", () => {
  it("starts with every step waiting", () => {
    const steps = initialFactorySteps();
    expect(steps.map((s) => s.key)).toEqual(["cutting", "assembly", "welding", "cleaning", "coating", "loading"]);
    expect(batchState(steps)).toBe("waiting");
    expect(currentStepIndex(steps)).toBe(0);
  });

  it("runs in order and becomes ready only when every step is done", () => {
    let steps = initialFactorySteps();
    expect(() => applyStepCommand(steps, 1, { kind: "done" }, "Ardit", now)).toThrow(StepCommandError);

    steps = applyStepCommand(steps, 0, { kind: "start" }, "Ardit", now).steps;
    expect(batchState(steps)).toBe("inProgress");
    for (const index of [0, 1, 2, 3, 4]) steps = applyStepCommand(steps, index, { kind: "done" }, "Ardit", now).steps;
    expect(batchState(steps)).toBe("inProgress");
    expect(currentStepIndex(steps)).toBe(5);

    const last = applyStepCommand(steps, 5, { kind: "done" }, "Megi", now);
    expect(batchState(last.steps)).toBe("ready");
    expect(last.event).toMatchObject({ stepKey: "loading", action: "done", fromStatus: "todo", toStatus: "done" });
    expect(last.steps[5]).toMatchObject({ by: "Megi", at: now.toISOString() });
  });

  it("blocks with a reason and unblocks back to in progress", () => {
    const steps = initialFactorySteps();
    expect(() => applyStepCommand(steps, 0, { kind: "block", text: "  " }, "A", now)).toThrow(StepCommandError);
    const blocked = applyStepCommand(steps, 0, { kind: "block", text: "Mungon disku i prerjes" }, "A", now);
    expect(batchState(blocked.steps)).toBe("blocked");
    expect(blocked.steps[0]?.note).toBe("Mungon disku i prerjes");
    const unblocked = applyStepCommand(blocked.steps, 0, { kind: "unblock" }, "A", now);
    expect(unblocked.steps[0]).toMatchObject({ status: "active", note: "" });
  });

  it("only reopens the last finished step", () => {
    let steps = initialFactorySteps();
    steps = applyStepCommand(steps, 0, { kind: "done" }, "A", now).steps;
    steps = applyStepCommand(steps, 1, { kind: "start" }, "A", now).steps;
    expect(() => applyStepCommand(steps, 0, { kind: "reopen" }, "A", now)).toThrow(StepCommandError);
    steps = applyStepCommand(steps, 1, { kind: "done" }, "A", now).steps;
    const reopened = applyStepCommand(steps, 1, { kind: "reopen" }, "A", now);
    expect(reopened.steps[1]?.status).toBe("active");
  });

  it("reads stored JSON defensively", () => {
    expect(readFactorySteps(null)).toEqual([]);
    expect(readFactorySteps([{ key: "cutting", status: "weird" }, { nope: 1 }, "x"])).toEqual([
      { key: "cutting", status: "todo", note: "", by: "", at: "" },
    ]);
  });

  it("counts ready groups per site without hiding a missing one", () => {
    const done = initialFactorySteps().map((s) => ({ ...s, status: "done" as const }));
    expect(readySummary([{ steps: done }, { steps: initialFactorySteps() }])).toEqual({ ready: 1, total: 2 });
  });

  it("moves a group from the first example line without losing progress", () => {
    const legacy = initialFactorySteps(["cutting", "laser", "assembly", "final"]);
    const done = (key: string) => ({ key, status: "done" as const, note: "", by: "A", at: now.toISOString() });
    const migrated = migrateLegacySteps([done("cutting"), done("laser"), { ...legacy[2]!, status: "active" }, legacy[3]!]);
    expect(migrated.map((s) => [s.key, s.status])).toEqual([
      ["cutting", "done"],
      ["assembly", "active"],
      ["welding", "todo"],
      ["cleaning", "todo"],
      ["coating", "todo"],
      ["loading", "todo"],
    ]);
    const half = migrateLegacySteps([done("cutting"), legacy[1]!, legacy[2]!, legacy[3]!]);
    expect(half[0]?.status).toBe("active");
    const current = initialFactorySteps();
    expect(migrateLegacySteps(current)).toBe(current);
  });
});
