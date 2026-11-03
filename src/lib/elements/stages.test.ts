import { describe, expect, it } from "vitest";

import { availableQty, canCheck, doneQty, elementDone, elementStatus, onFieldList, sideOfStage, stageProgress, stagesFor } from "./stages";

const perms = (over: Partial<{ siteSteps: boolean; factorySteps: boolean; office: boolean; reportMissing: boolean }>) => ({
  siteSteps: false,
  factorySteps: false,
  office: false,
  reportMissing: true,
  ...over,
});

describe("element stages", () => {
  it("assemblies pass the whole factory line, parts only cutting", () => {
    expect(stagesFor("factory", "assembly")).toEqual(["cutting", "assembly", "welding", "cleaning", "coating", "loading"]);
    expect(stagesFor("factory", "part")).toEqual(["cutting"]);
    expect(stagesFor("field", "assembly")).toEqual(["received", "mounted", "bolted", "touchup"]);
    expect(stagesFor("field", "part")).toEqual([]);
  });

  it("knows the side of a stage and rejects unknown ones", () => {
    expect(sideOfStage("welding")).toBe("factory");
    expect(sideOfStage("mounted")).toBe("field");
    expect(sideOfStage("laser")).toBeNull();
  });

  it("factory engineer checks factory, field engineer checks mounting", () => {
    expect(canCheck(perms({ factorySteps: true }), "factory")).toBe(true);
    expect(canCheck(perms({ factorySteps: true }), "field")).toBe(false);
    expect(canCheck(perms({ siteSteps: true }), "field")).toBe(true);
    expect(canCheck(perms({}), "factory")).toBe(false);
  });

  it("counts progress per stage and finished elements", () => {
    const elements = [
      { list: "assembly" as const, work: [{ stage: "cutting" }, { stage: "mounted" }] },
      { list: "assembly" as const, work: [] },
      { list: "part" as const, work: [{ stage: "cutting" }] },
    ];
    const factory = stageProgress(elements, "factory");
    expect(factory.cutting).toMatchObject({ done: 2, total: 3 });
    expect(factory.welding).toMatchObject({ done: 0, total: 2 });
    expect(stageProgress(elements, "field").mounted).toMatchObject({ done: 1, total: 2 });
    expect(elementDone(elements[0], "field")).toBe(false);
    expect(elementDone(elements[0], "factory")).toBe(false);
    expect(elementDone(elements[2], "factory")).toBe(true);
    expect(elementDone(elements[2], "field")).toBe(false);
  });

  it("finished pieces go to the field list, the rest stay in the factory", () => {
    const open = { list: "assembly" as const, quantity: 4, work: [{ stage: "cutting" }] };
    expect(elementStatus(open, "factory")).toBe("working");
    expect(elementStatus({ list: "assembly", quantity: 4, work: [] }, "factory")).toBe("waiting");
    expect(onFieldList(open)).toBe(false);
    const half = { ...open, factoryDoneQty: 2 };
    expect(doneQty(half, "factory")).toBe(2);
    expect(elementStatus(half, "factory")).toBe("working");
    expect(onFieldList(half)).toBe(true);
    expect(availableQty(half, "field")).toBe(2);
    expect(elementStatus({ ...half, fieldDoneQty: 2 }, "field")).toBe("working");
    const all = { ...open, factoryDoneQty: 4, fieldDoneQty: 9 };
    expect(elementStatus(all, "factory")).toBe("done");
    expect(doneQty(all, "field")).toBe(4);
    expect(elementStatus(all, "field")).toBe("done");
    // A cut part is finished by checking cutting; parts never go to the field list.
    expect(elementDone({ list: "part", quantity: 12, work: [{ stage: "cutting" }] }, "factory")).toBe(true);
    expect(onFieldList({ list: "part", work: [{ stage: "cutting" }] })).toBe(false);
  });
});
