/**
 * Which stages an element goes through, and who may check them.
 *
 * Factory list: assemblies pass the factory line (cutting ... loading); cut
 * parts only need "cutting", since they are welded into an assembly. Not every
 * element needs every step: the factory engineer checks the steps it went
 * through and then finishes it, saying how many pieces ("2 of 4"). Finished
 * pieces go to the field list, the rest stay in the factory.
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
  quantity?: number;
  work: Array<{ stage: string }>;
  factoryDoneQty?: number;
  fieldDoneQty?: number;
};

/** Pieces of the element (at least 1). */
export function pieces(element: ElementState) {
  return Math.max(1, element.quantity ?? 1);
}

/**
 * Pieces finished on that side. The engineer says how many when finishing
 * ("2 of 4"). A cut part needs only cutting: checking it finishes all pieces.
 */
export function doneQty(element: ElementState, side: ElementSide): number {
  if (side === "field") return Math.min(element.fieldDoneQty ?? 0, doneQty(element, "factory"));
  const qty = Math.min(element.factoryDoneQty ?? 0, pieces(element));
  if (qty === 0 && element.list === "part" && element.work.some((work) => work.stage === "cutting")) return pieces(element);
  return qty;
}

/** Pieces the side can still finish: in the factory all, on site only those that came. */
export function availableQty(element: ElementState, side: ElementSide) {
  return side === "factory" ? pieces(element) : doneQty(element, "factory");
}

/** Every piece finished on that list. */
export function elementDone(element: ElementState, side: ElementSide) {
  return doneQty(element, side) >= pieces(element);
}

/** On the field list: assemblies with at least one piece out of the factory. */
export function onFieldList(element: ElementState) {
  return element.list === "assembly" && doneQty(element, "factory") > 0;
}

/** waiting: nothing yet; working: some steps or pieces; done: every piece finished. */
export function elementStatus(element: ElementState, side: ElementSide): "waiting" | "working" | "done" {
  if (elementDone(element, side)) return "done";
  if (doneQty(element, side) > 0) return "working";
  const stages = stagesFor(side, element.list);
  return element.work.some((work) => stages.includes(work.stage)) ? "working" : "waiting";
}

export type ElementProgress = { done: number; total: number; pieces: number; totalPieces: number };

/** Per stage: how many elements (and their pieces) went through it, out of those on the list. */
export function stageProgress(elements: ElementState[], side: ElementSide): Record<string, ElementProgress> {
  const result: Record<string, ElementProgress> = {};
  for (const element of elements) {
    for (const stage of stagesFor(side, element.list)) {
      const entry = (result[stage] ??= { done: 0, total: 0, pieces: 0, totalPieces: 0 });
      entry.total += 1;
      entry.totalPieces += pieces(element);
      if (element.work.some((work) => work.stage === stage)) {
        entry.done += 1;
        entry.pieces += pieces(element);
      }
    }
  }
  return result;
}
