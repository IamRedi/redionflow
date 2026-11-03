import { describe, expect, it } from "vitest";

import { canCheck, elementDone, elementStatus, onFieldList, sideOfStage, stageProgress, stagesFor } from "./stages";

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
    expect(factory.cutting).toEqual({ done: 2, total: 3 });
    expect(factory.welding).toEqual({ done: 0, total: 2 });
    expect(stageProgress(elements, "field").mounted).toEqual({ done: 1, total: 2 });
    expect(elementDone(elements[0], "field")).toBe(false);
    expect(elementDone(elements[0], "factory")).toBe(false);
    expect(elementDone(elements[2], "factory")).toBe(true);
    expect(elementDone(elements[2], "field")).toBe(false);
  });

  it("closing an element finishes it and puts it on the field list", () => {
    const open = { list: "assembly" as const, work: [{ stage: "cutting" }] };
    expect(elementStatus(open, "factory")).toBe("working");
    expect(elementStatus({ list: "assembly", work: [] }, "factory")).toBe("waiting");
    expect(onFieldList(open)).toBe(false);
    const closed = { ...open, factoryDoneAt: "2026-11-03T10:00:00Z" };
    expect(elementStatus(closed, "factory")).toBe("done");
    expect(onFieldList(closed)).toBe(true);
    expect(elementStatus(closed, "field")).toBe("waiting");
    expect(elementStatus({ ...closed, fieldDoneAt: new Date() }, "field")).toBe("done");
    expect(onFieldList({ list: "part", work: [{ stage: "cutting" }] })).toBe(false);
  });
});
