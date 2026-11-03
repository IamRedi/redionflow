import { describe, expect, it } from "vitest";

import { capFor, canCheck, doneQty, elementDone, elementStatus, onFieldList, routeStages, stagePieces, stageRemaining, sideOfStage, stageProgress, stagesFor } from "./stages";

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
    // Mounting counts only pieces that came from the factory.
    expect(stageProgress(elements, "field").mounted).toMatchObject({ done: 0, total: 2 });
    expect(elementDone(elements[0], "field")).toBe(false);
    expect(elementDone(elements[0], "factory")).toBe(false);
    expect(elementDone(elements[2], "factory")).toBe(true);
    expect(elementDone(elements[2], "field")).toBe(false);
  });

  it("pieces are counted per step; finished pieces passed the whole route", () => {
    const base = { list: "assembly" as const, quantity: 4 };
    const started = { ...base, work: [{ stage: "cutting", pieces: 2 }] };
    expect(stagePieces(started, "cutting")).toBe(2);
    expect(stageRemaining(started, "cutting")).toBe(2);
    expect(elementStatus(started, "factory")).toBe("working");
    expect(elementStatus({ ...base, work: [] }, "factory")).toBe("waiting");
    // Not finished: nothing leaves the factory yet.
    expect(doneQty(started, "factory")).toBe(0);
    expect(onFieldList(started)).toBe(false);
    // Finished with cutting 4 and assembly 2: 2 pieces out, 2 stay.
    const closed = { ...base, factoryDoneAt: "2026-11-03T10:00:00Z", work: [{ stage: "cutting", pieces: 2 }, { stage: "cutting", pieces: 2 }, { stage: "assembly", pieces: 2 }] };
    expect(routeStages(closed, "factory")).toEqual(["cutting", "assembly"]);
    expect(doneQty(closed, "factory")).toBe(2);
    expect(elementStatus(closed, "factory")).toBe("working");
    expect(onFieldList(closed)).toBe(true);
    expect(capFor(closed, "field")).toBe(2);
    expect(stageRemaining(closed, "mounted")).toBe(2);
    // Entries without a count (older checks) mean every piece.
    const legacy = { ...base, factoryDoneAt: new Date(), work: [{ stage: "welding" }] };
    expect(elementDone(legacy, "factory")).toBe(true);
    // Every step worked on all pieces closes the route by itself.
    const full = { ...base, work: ["cutting", "assembly", "welding", "cleaning", "coating", "loading"].map((stage) => ({ stage, pieces: 4 })) };
    expect(elementDone(full, "factory")).toBe(true);
    // Field: capped by what came, done when all came and passed the site route.
    const site = { ...closed, fieldDoneAt: new Date(), work: [...closed.work, { stage: "mounted", pieces: 5 }] };
    expect(doneQty(site, "field")).toBe(2);
    expect(elementStatus(site, "field")).toBe("working");
    // A cut part is finished by its cutting pieces; parts never go to the field list.
    expect(elementDone({ list: "part", quantity: 12, work: [{ stage: "cutting", pieces: 12 }] }, "factory")).toBe(true);
    expect(doneQty({ list: "part", quantity: 12, work: [{ stage: "cutting", pieces: 5 }] }, "factory")).toBe(5);
    expect(onFieldList({ list: "part", work: [{ stage: "cutting" }] })).toBe(false);
  });
});
