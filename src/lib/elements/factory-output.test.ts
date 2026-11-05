import { expect, it } from "vitest";
import { factoryOutput, totalOutput, type OutputRow } from "./factory-output";

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
