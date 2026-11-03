/**
 * Which stages an element goes through, and who may check them.
 *
 * Factory list: assemblies pass the factory line (cutting ... loading); cut
 * parts only need "cutting", since they are welded into an assembly. Not every
 * element needs every step: the factory engineer checks the steps it went
 * through and then closes it ("finished"). An element with every step checked
 * counts as finished too.
 *
 * Field list: only assemblies the factory finished. On site they are received,
 * mounted, bolted or welded in place and touched up, closed the same way.
 * Parts are not on the field list, nobody mounts a single plate.
 */
import { FACTORY_STEP_KEYS } from "@/lib/factory/production";
import type { CrewPermissions } from "@/lib/workzone/crew-roles";

export type ElementSide = "factory" | "field";
export type ElementList = "assembly" | "part";

export const FIELD_STAGES = ["received", "mounted", "bolted", "touchup"] as const;
export const ALL_STAGES: readonly string[] = [...FACTORY_STEP_KEYS, ...FIELD_STAGES];

export function stagesFor(side: ElementSide, list: ElementList): readonly string[] {
  if (side === "field") return list === "assembly" ? FIELD_STAGES : [];
  return list === "assembly" ? FACTORY_STEP_KEYS : ["cutting"];
}

export function sideOfStage(stage: string): ElementSide | null {
  if ((FIELD_STAGES as readonly string[]).includes(stage)) return "field";
  if ((FACTORY_STEP_KEYS as readonly string[]).includes(stage)) return "factory";
  return null;
}

/** Factory engineer (or office admin) checks factory stages; field engineer the site ones. */
export function canCheck(can: CrewPermissions, side: ElementSide) {
  return side === "factory" ? can.factorySteps : can.siteSteps;
}

/** Crew roles whose workers are offered on each list. */
export const CREW_FOR_SIDE: Record<ElementSide, readonly string[]> = {
  factory: ["FACTORY_WORKER", "FACTORY_ENGINEER"],
  field: ["FIELD_WORKER", "FIELD_ENGINEER"],
};

export type ElementState = {
  list: ElementList;
  work: Array<{ stage: string }>;
  factoryDoneAt?: string | Date | null;
  fieldDoneAt?: string | Date | null;
};

/** Finished on that list: closed by the engineer, or every stage checked. */
export function elementDone(element: ElementState, side: ElementSide) {
  if (side === "factory" ? element.factoryDoneAt : element.fieldDoneAt) return true;
  const stages = stagesFor(side, element.list);
  return stages.length > 0 && stages.every((stage) => element.work.some((work) => work.stage === stage));
}

/** On the field list: assemblies the factory finished. */
export function onFieldList(element: ElementState) {
  return element.list === "assembly" && elementDone(element, "factory");
}

/** waiting: nothing checked yet; working: some steps; done: finished. */
export function elementStatus(element: ElementState, side: ElementSide): "waiting" | "working" | "done" {
  if (elementDone(element, side)) return "done";
  const stages = stagesFor(side, element.list);
  return element.work.some((work) => stages.includes(work.stage)) ? "working" : "waiting";
}

export type ElementProgress = { done: number; total: number };

/** Per stage: how many elements are checked, out of those on the list. */
export function stageProgress(elements: ElementState[], side: ElementSide): Record<string, ElementProgress> {
  const result: Record<string, ElementProgress> = {};
  for (const element of elements) {
    for (const stage of stagesFor(side, element.list)) {
      const entry = (result[stage] ??= { done: 0, total: 0 });
      entry.total += 1;
      if (element.work.some((work) => work.stage === stage)) entry.done += 1;
    }
  }
  return result;
}
