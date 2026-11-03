/**
 * Which stages an element goes through, and who may check them.
 *
 * Factory list: assemblies pass the whole factory line (cutting ... loading);
 * cut parts only need "cutting", since they are welded into an assembly.
 * Field list: assemblies get "mounted" on site. Parts are not on the field
 * list, nobody mounts a single plate.
 */
import { FACTORY_STEP_KEYS } from "@/lib/factory/production";
import type { CrewPermissions } from "@/lib/workzone/crew-roles";

export type ElementSide = "factory" | "field";
export type ElementList = "assembly" | "part";

export const FIELD_STAGES = ["mounted"] as const;
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

/** Factory engineer (or office admin) checks factory stages; field engineer the mounting. */
export function canCheck(can: CrewPermissions, side: ElementSide) {
  return side === "factory" ? can.factorySteps : can.siteSteps;
}

/** Crew roles whose workers are offered first on each list. */
export const CREW_FOR_SIDE: Record<ElementSide, readonly string[]> = {
  factory: ["FACTORY_WORKER", "FACTORY_ENGINEER"],
  field: ["FIELD_WORKER", "FIELD_ENGINEER"],
};

export type ElementProgress = { done: number; total: number };

/** Per stage: how many elements are checked, out of those that need the stage. */
export function stageProgress(
  elements: Array<{ list: ElementList; work: Array<{ stage: string }> }>,
  side: ElementSide,
): Record<string, ElementProgress> {
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

/** An element counts as finished on a list when every one of its stages is checked. */
export function elementDone(element: { list: ElementList; work: Array<{ stage: string }> }, side: ElementSide) {
  const stages = stagesFor(side, element.list);
  return stages.length > 0 && stages.every((stage) => element.work.some((work) => work.stage === stage));
}
