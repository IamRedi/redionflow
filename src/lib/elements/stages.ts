/**
 * Which stages an element goes through, and who may check them.
 *
 * Factory list: assemblies pass the factory line (cutting ... loading); cut
 * parts only need "cutting", since they are welded into an assembly. Not every
 * element needs every step: the factory engineer checks the steps it went
 * through, each time with how many pieces ("Prerje: 2 of 4"), and finishes it
 * when the other steps are not needed. Pieces that passed all its steps go to
 * the field list, the rest stay in the factory.
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

export type WorkState = { stage: string; pieces?: number };

export type ElementState = {
  list: ElementList;
  quantity?: number;
  work: WorkState[];
  factoryDoneAt?: string | Date | null;
  fieldDoneAt?: string | Date | null;
};

/** Pieces of the element (at least 1). */
export function pieces(element: ElementState) {
  return Math.max(1, element.quantity ?? 1);
}

/** Pieces a step can take: in the factory all, on site only those that came. */
export function capFor(element: ElementState, side: ElementSide) {
  return side === "factory" ? pieces(element) : doneQty(element, "factory");
}

/** Pieces through this step: the sum of its entries (an entry without a count means all). */
export function stagePieces(element: ElementState, stage: string): number {
  const side = sideOfStage(stage) ?? "factory";
  const sum = element.work.filter((work) => work.stage === stage).reduce((total, work) => total + (work.pieces && work.pieces > 0 ? work.pieces : pieces(element)), 0);
  return Math.min(sum, side === "factory" ? pieces(element) : capFor(element, "field"));
}

/** Pieces still open in this step. */
export function stageRemaining(element: ElementState, stage: string) {
  const side = sideOfStage(stage) ?? "factory";
  return Math.max(0, capFor(element, side) - stagePieces(element, stage));
}

/** The steps the element went through on that side. */
export function routeStages(element: ElementState, side: ElementSide) {
  return stagesFor(side, element.list).filter((stage) => element.work.some((work) => work.stage === stage));
}

/**
 * The route is fixed when the engineer finished the element (the steps not
 * taken are not needed) or when every step has been worked.
 */
export function routeClosed(element: ElementState, side: ElementSide) {
  const all = stagesFor(side, element.list);
  if (all.length === 0) return false;
  if (side === "factory" ? element.factoryDoneAt : element.fieldDoneAt) return true;
  return routeStages(element, side).length === all.length;
}

/**
 * Pieces finished on that side: those that passed every step of the closed
 * route. In the factory they go to the field list, the rest stays.
 */
export function doneQty(element: ElementState, side: ElementSide): number {
  if (!routeClosed(element, side)) return 0;
  const route = routeStages(element, side);
  if (route.length === 0) return 0;
  return Math.min(...route.map((stage) => stagePieces(element, stage)));
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
  return routeStages(element, side).length > 0 ? "working" : "waiting";
}

export type ElementProgress = { done: number; total: number; pieces: number; totalPieces: number };

/** Per stage: elements with every piece through it, and pieces through it, out of those on the list. */
export function stageProgress(elements: ElementState[], side: ElementSide): Record<string, ElementProgress> {
  const result: Record<string, ElementProgress> = {};
  for (const element of elements) {
    for (const stage of stagesFor(side, element.list)) {
      const entry = (result[stage] ??= { done: 0, total: 0, pieces: 0, totalPieces: 0 });
      const through = stagePieces(element, stage);
      entry.total += 1;
      entry.totalPieces += pieces(element);
      entry.pieces += through;
      if (through >= pieces(element)) entry.done += 1;
    }
  }
  return result;
}
