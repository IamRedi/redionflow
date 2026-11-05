/**
 * What the factory produced, from the element lists (assemblies only): per
 * site and per process, in elements and pieces. Only to look at; the steps
 * and finished pieces are confirmed on the site's factory list.
 */
import { FACTORY_STEP_KEYS } from "@/lib/factory/production";

import { doneQty, pieces, stagePieces, stagesFor, type ElementState } from "./stages";

export type OutputRow = {
  baustelleId: string;
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
      ({ siteId: site.id, siteName: site.name, marks: 0, pieces: 0, kg: 0, donePieces: 0, doneKg: 0, doneMarks: 0, mountedPieces: 0, stages: emptyStages() } satisfies SiteFactoryOutput);
    const state: ElementState = { list: "assembly", quantity: row.quantity, work: row.work, factoryDoneAt: row.factoryDoneAt, fieldDoneAt: row.fieldDoneAt, processRoutes: row.processRoutes };
    const count = pieces(state);
    const kgPiece = row.weightKg ?? 0;
    const out = doneQty(state, "factory");
    entry.marks += 1;
    entry.pieces += count;
    entry.kg += kgPiece * count;
    entry.donePieces += out;
    entry.doneKg += kgPiece * out;
    if (out >= count) entry.doneMarks += 1;
    entry.mountedPieces += doneQty(state, "field");
    for (const key of stagesFor("factory", state.list, row.processRoutes)) {
      const stage = entry.stages[key] ??= emptyStage();
      stage.eligibleMarks += 1;
      stage.eligiblePieces += count;
      const through = stagePieces(state, key);
      if (through === 0) continue;
      stage.marks += through >= count ? 1 : 0;
      stage.pieces += through;
    }
    bySite.set(site.id, entry);
  }
  return [...bySite.values()].sort((a, b) => a.siteName.localeCompare(b.siteName));
}

/** All sites together. */
export function totalOutput(sites: SiteFactoryOutput[]): Omit<SiteFactoryOutput, "siteId" | "siteName"> {
  const total = { marks: 0, pieces: 0, kg: 0, donePieces: 0, doneKg: 0, doneMarks: 0, mountedPieces: 0, stages: emptyStages() };
  for (const site of sites) {
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
