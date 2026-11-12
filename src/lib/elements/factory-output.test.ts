import { expect, it } from "vitest";
import { factoryOutput, factoryProcessPercent, totalOutput, type OutputRow } from "./factory-output";

const fp = `fp-${"a".repeat(24)}`;
const row = (over: Partial<OutputRow> = {}): OutputRow => ({ baustelleId: "demo-a", quantity: 4, weightKg: 10, factoryDoneAt: null, fieldDoneAt: null, work: [], ...over });
const sites = [{ id: "demo-a", name: "Demo A" }, { id: "demo-b", name: "Demo B" }];

it("uses only selected elements in each process denominator while keeping current factory release route-aware", () => {
  const [output] = factoryOutput([
    row({ processRoutes: { v: 1, factory: ["cutting", fp], field: null }, work: [{ stage: "cutting", pieces: 4 }, { stage: fp, pieces: 2 }, { stage: "welding", pieces: 4 }] }),
    row({ quantity: 8, processRoutes: { v: 1, factory: ["cutting"], field: null }, work: [{ stage: "cutting", pieces: 8 }] }),
  ], sites);
  expect(output).toMatchObject({ pieces: 12, donePieces: 10, doneKg: 100 });
  expect(output.stages.cutting).toEqual({ marks: 2, pieces: 12, eligibleMarks: 2, eligiblePieces: 12 });
  expect(output.stages[fp]).toEqual({ marks: 0, pieces: 2, eligibleMarks: 1, eligiblePieces: 4 });
  expect(output.stages.welding).toEqual({ marks: 0, pieces: 0, eligibleMarks: 0, eligiblePieces: 0 });
});

it("shows partial plate cutting even when the site has no assemblies, without inventing delivered pieces or kilograms", () => {
  const [output] = factoryOutput([row({ list: "part", quantity: 10, weightKg: 300, work: [{ stage: "cutting", pieces: 4 }] })], sites);
  expect(output).toMatchObject({ pieces: 0, donePieces: 0, doneKg: 0, kg: 0, mountedPieces: 0, processWork: { done: 4, total: 10 }, partCutting: { pieces: 4, eligiblePieces: 10 } });
  expect(factoryProcessPercent(output)).toBe(40);
  expect(output.stages.cutting).toMatchObject({ marks: 0, eligibleMarks: 1, pieces: 4, eligiblePieces: 10 });
});

it("combines confirmed process work but keeps parts out of assembly completion and field totals", () => {
  const [output] = factoryOutput([
    row({ quantity: 2, processRoutes: { v: 1, factory: ["cutting", "welding"], field: null }, work: [{ stage: "cutting", pieces: 1 }] }),
    row({ list: "part", quantity: 10, work: [{ stage: "cutting", pieces: 4 }, { stage: "mounted", pieces: 10 }] }),
  ], sites);
  expect(output).toMatchObject({ pieces: 2, kg: 20, donePieces: 0, mountedPieces: 0, processWork: { done: 5, total: 14 } });
  expect(factoryProcessPercent(output)).toBeCloseTo(5 / 14 * 100);
  expect(output.stages.welding.eligiblePieces).toBe(2);
});

it("preserves completed legacy routes and does not count skipped default processes against them", () => {
  const [output] = factoryOutput([row({ factoryDoneAt: new Date(), work: [{ stage: "welding", pieces: 4 }] }), row({ list: "part", quantity: 10, work: [{ stage: "cutting", pieces: 10 }] })], sites);
  expect(output.donePieces).toBe(4);
  expect(output.processWork).toEqual({ done: 14, total: 14 });
  expect(factoryProcessPercent(output)).toBe(100);
});

it("ignores stale work outside selected part routes and leaves empty routes unfinished", () => {
  const [output] = factoryOutput([row({ list: "part", quantity: 10, processRoutes: { v: 1, factory: [fp], field: [] }, work: [{ stage: "cutting", pieces: 10 }] })], sites);
  expect(output.partCutting?.eligiblePieces).toBe(0);
  expect(factoryProcessPercent(output)).toBe(0);
  const [empty] = factoryOutput([row({ processRoutes: { v: 1, factory: [], field: [] }, factoryDoneAt: new Date(), work: [{ stage: "cutting", pieces: 4 }] })], sites);
  expect(factoryProcessPercent(empty)).toBe(0);
});

it("weights aggregate progress by applicable work, clamps repeated checks and retains a fractional positive percent", () => {
  const outputs = factoryOutput([row({ list: "part", quantity: 1000, work: [{ stage: "cutting", pieces: 1 }] }), row({ baustelleId: "demo-b", list: "part", quantity: 2, work: [{ stage: "cutting", pieces: 2 }, { stage: "cutting", pieces: 2 }] })], sites);
  expect(factoryProcessPercent(outputs[0])).toBe(0.1);
  expect(totalOutput(outputs).processWork).toEqual({ done: 3, total: 1002 });
  expect(factoryProcessPercent(totalOutput(outputs))).toBeCloseTo(3 / 1002 * 100);
});

it("preserves legacy completed routes, does not release an explicitly empty route and aggregates custom denominators across sites", () => {
  const outputs = factoryOutput([
    row({ factoryDoneAt: new Date(), work: [{ stage: "welding", pieces: 3 }] }),
    row({ processRoutes: { v: 1, factory: [], field: [] }, factoryDoneAt: new Date(), work: [{ stage: "cutting", pieces: 4 }] }),
    row({ baustelleId: "demo-b", processRoutes: { v: 1, factory: [fp], field: [] }, work: [{ stage: fp, pieces: 4 }] }),
    row({ baustelleId: "foreign-site", quantity: 999 }),
  ], sites);
  expect(outputs).toHaveLength(2);
  expect(outputs[0]).toMatchObject({ marks: 2, pieces: 8, donePieces: 3 });
  expect(outputs[0].stages.cutting.eligibleMarks).toBe(1);
  expect(totalOutput(outputs)).toMatchObject({ pieces: 12, donePieces: 7, stages: { [fp]: { marks: 1, pieces: 4, eligibleMarks: 1, eligiblePieces: 4 }, welding: { pieces: 3, eligibleMarks: 1, eligiblePieces: 4 } } });
});
