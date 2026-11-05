import { describe, expect, it } from "vitest";

import { capFor, canCheck, doneQty, elementDone, elementStatus, onFieldList, readProcessRoutes, routeClosed, routeStages, stagePieces, stageRemaining, sideOfStage, stageProgress, stagesFor } from "./stages";

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

  it("keeps null configurations exactly legacy and includes every configured required stage even before work", () => {
    const base = { list: "assembly" as const, quantity: 4, factoryDoneAt: new Date(), work: [{ stage: "cutting", pieces: 4 }] };
    expect(doneQty(base, "factory")).toBe(4);
    expect(doneQty({ ...base, processRoutes: { v: 1, factory: null, field: null } }, "factory")).toBe(4);
    const planned = { ...base, processRoutes: { v: 1, factory: ["cutting", "welding"], field: null } };
    expect(routeClosed(planned, "factory")).toBe(true);
    expect(routeStages(planned, "factory")).toEqual(["cutting", "welding"]);
    expect(doneQty(planned, "factory")).toBe(0);
    expect(onFieldList(planned)).toBe(false);
    expect(doneQty({ ...planned, work: [...planned.work, { stage: "welding", pieces: 2 }] }, "factory")).toBe(2);
  });

  it("an explicit empty route or a planned route with no work never auto-completes or claims work started", () => {
    const base = { list: "assembly" as const, quantity: 2, work: [], factoryDoneAt: new Date() };
    const empty = { ...base, processRoutes: { v: 1, factory: [], field: [] } };
    expect(routeClosed(empty, "factory")).toBe(false);
    expect(doneQty(empty, "factory")).toBe(0);
    expect(elementStatus(empty, "factory")).toBe("waiting");
    expect(stageProgress([empty], "factory")).toEqual({});
    const planned = { ...base, processRoutes: { v: 1, factory: ["cutting"], field: null } };
    expect(elementStatus(planned, "factory")).toBe("waiting");
    expect(doneQty(planned, "factory")).toBe(0);
  });

  it("selects only eligible denominators and supports stable company processes on either side", () => {
    const fp = `fp-${"a".repeat(24)}`, sp = `sp-${"b".repeat(24)}`;
    expect(sideOfStage(fp)).toBe("factory");
    expect(sideOfStage(sp)).toBe("field");
    expect(sideOfStage("fp-short")).toBeNull();
    const configured = { list: "assembly" as const, quantity: 4, processRoutes: { v: 1, factory: [fp], field: [sp] }, work: [{ stage: fp, pieces: 2 }, { stage: sp, pieces: 1 }, { stage: "welding", pieces: 4 }] };
    expect(stagesFor("factory", "assembly", configured.processRoutes)).toEqual([fp]);
    expect(doneQty(configured, "factory")).toBe(2);
    expect(doneQty(configured, "field")).toBe(1);
    expect(stageRemaining(configured, sp)).toBe(1);
    expect(stagePieces(configured, "welding")).toBe(4); // Historical evidence remains readable.
    const progress = stageProgress([configured, { list: "assembly", quantity: 8, processRoutes: { v: 1, factory: ["cutting"], field: null }, work: [] }], "factory");
    expect(progress[fp]).toEqual({ done: 0, total: 1, pieces: 2, totalPieces: 4 });
    expect(progress.cutting).toMatchObject({ total: 1, totalPieces: 8 });
    expect(progress.welding).toBeUndefined();
    expect(stagesFor("field", "part", configured.processRoutes)).toEqual([]);
    expect(stagesFor("factory", "part", configured.processRoutes)).toEqual([fp]);
  });

  it("reads only valid versioned side-specific route configurations", () => {
    expect(readProcessRoutes(null)).toBeNull();
    expect(readProcessRoutes({ v: 1, factory: ["mounted"], field: null })).toBeNull();
    expect(readProcessRoutes({ v: 2, factory: [], field: [] })).toBeNull();
    expect(readProcessRoutes({ v: 1, factory: ["cutting", "cutting"], field: null })).toEqual({ v: 1, factory: ["cutting"], field: null });
  });
});
