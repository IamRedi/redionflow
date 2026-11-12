/**
 * Factory process work includes assemblies and parts; released/field totals
 * still count assemblies only. Per
 * site and per process, in elements and pieces. Only to look at; the steps
 * and finished pieces are confirmed on the site's factory list.
 */
import { FACTORY_STEP_KEYS } from "@/lib/factory/production";

import { doneQty, pieces, routeClosed, routeStages, stagePieces, stagesFor, type ElementState } from "./stages";

export type OutputRow = {
  baustelleId: string;
  list?: string;
  quantity: number;
  weightKg: number | null;
  factoryDoneAt: Date | string | null;
  fieldDoneAt: Date | string | null;
  processRoutes?: unknown;
  work: Array<{ stage: string; pieces: number }>;
};

export type StageOutput = { marks: number; pieces: number; eligibleMarks: number; eligiblePieces: number };

export type SiteFactoryOutput = {
  siteId: string;
  siteName: string;
  marks: number;
  pieces: number;
  kg: number;
  /** Pieces out of the factory (on the field list). */
  donePieces: number;
  doneKg: number;
  /** Elements with every piece out of the factory. */
  doneMarks: number;
  /** Pieces the site finished. */
  mountedPieces: number;
  /** Confirmed process-piece work, never a count of distinct produced pieces or kg. */
  processWork?: { done: number; total: number };
  /** Parts that actually require cutting, kept apart from assembly delivery totals. */
  partCutting?: StageOutput;
  stages: Record<string, StageOutput>;
};

function emptyStages() {
  return Object.fromEntries(FACTORY_STEP_KEYS.map((key) => [key, emptyStage()])) as Record<string, StageOutput>;
}
const emptyStage = (): StageOutput => ({ marks: 0, pieces: 0, eligibleMarks: 0, eligiblePieces: 0 });

export function factoryOutput(rows: OutputRow[], sites: Array<{ id: string; name: string }>): SiteFactoryOutput[] {
  const bySite = new Map<string, SiteFactoryOutput>();
  for (const row of rows) {
    const site = sites.find((entry) => entry.id === row.baustelleId);
    if (!site) continue;
    const entry =
      bySite.get(site.id) ??
      ({ siteId: site.id, siteName: site.name, marks: 0, pieces: 0, kg: 0, donePieces: 0, doneKg: 0, doneMarks: 0, mountedPieces: 0, processWork: { done: 0, total: 0 }, partCutting: emptyStage(), stages: emptyStages() } satisfies SiteFactoryOutput);
    if (row.list !== undefined && row.list !== "assembly" && row.list !== "part") continue;
    const state: ElementState = { list: row.list === "part" ? "part" : "assembly", quantity: row.quantity, work: row.work, factoryDoneAt: row.factoryDoneAt, fieldDoneAt: row.fieldDoneAt, processRoutes: row.processRoutes };
    const count = pieces(state);
    const kgPiece = row.weightKg ?? 0;
    const out = doneQty(state, "factory");
    if (state.list === "assembly") {
      entry.marks += 1;
      entry.pieces += count;
      entry.kg += kgPiece * count;
      entry.donePieces += out;
      entry.doneKg += kgPiece * out;
      if (out >= count) entry.doneMarks += 1;
      entry.mountedPieces += doneQty(state, "field");
    }
    // A manually closed legacy route need not pass every default stage. Keep
    // its accepted completion, while unfinished routes count their pending work.
    const closedRoute = routeClosed(state, "factory") ? routeStages(state, "factory") : [];
    const progressRoute = closedRoute.length ? closedRoute : stagesFor("factory", state.list, row.processRoutes);
    for (const key of progressRoute) {
      entry.processWork!.total += count;
      entry.processWork!.done += stagePieces(state, key);
    }
    for (const key of stagesFor("factory", state.list, row.processRoutes)) {
      const stage = entry.stages[key] ??= emptyStage();
      stage.eligibleMarks += 1;
      stage.eligiblePieces += count;
      const through = stagePieces(state, key);
      if (through === 0) continue;
      stage.marks += through >= count ? 1 : 0;
      stage.pieces += through;
    }
    if (state.list === "part" && stagesFor("factory", "part", row.processRoutes).includes("cutting")) {
      const through = stagePieces(state, "cutting"), cutting = entry.partCutting!;
      cutting.eligibleMarks += 1; cutting.eligiblePieces += count;
      cutting.pieces += through; if (through >= count) cutting.marks += 1;
    }
    bySite.set(site.id, entry);
  }
  return [...bySite.values()].sort((a, b) => a.siteName.localeCompare(b.siteName));
}

/** All sites together. */
export function totalOutput(sites: SiteFactoryOutput[]): Omit<SiteFactoryOutput, "siteId" | "siteName"> {
  const total = { marks: 0, pieces: 0, kg: 0, donePieces: 0, doneKg: 0, doneMarks: 0, mountedPieces: 0, processWork: { done: 0, total: 0 }, partCutting: emptyStage(), stages: emptyStages() };
  for (const site of sites) {
    total.processWork.done += site.processWork?.done ?? site.donePieces;
    total.processWork.total += site.processWork?.total ?? site.pieces;
    for (const key of ["marks", "pieces", "eligibleMarks", "eligiblePieces"] as const) total.partCutting[key] += site.partCutting?.[key] ?? 0;
    for (const key of ["marks", "pieces", "kg", "donePieces", "doneKg", "doneMarks", "mountedPieces"] as const) total[key] += site[key];
    for (const [key, stage] of Object.entries(site.stages)) {
      const summed = total.stages[key] ??= emptyStage();
      summed.marks += stage.marks;
      summed.pieces += stage.pieces;
      summed.eligibleMarks += stage.eligibleMarks;
      summed.eligiblePieces += stage.eligiblePieces;
    }
  }
  return total;
}

/** Partial work advances progress without falsely releasing assemblies to site. */
export function factoryProcessPercent(output: Pick<SiteFactoryOutput, "processWork" | "donePieces" | "pieces">) {
  const done = output.processWork?.done ?? output.donePieces, total = output.processWork?.total ?? output.pieces;
  return total > 0 ? Math.min(100, Math.max(0, done / total * 100)) : 0;
}
