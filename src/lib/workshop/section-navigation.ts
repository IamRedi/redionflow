import type { WorkshopAsset, WorkshopState, WorkshopTab } from "./demo-model";

export type WorkshopSection = "orders" | "fleet" | "tools";
export const resourceTabs = ["documents", "history", "parts"] as const;
export function workshopSection(tab: WorkshopTab, requested?: string | null): WorkshopSection {
  if (tab === "orders" || tab === "fleet" || tab === "tools") return tab;
  return requested === "fleet" || requested === "tools" ? requested : "orders";
}
/** Views of the same records; never another inventory, file or stock store.
 * Unscoped historical URLs keep their complete original view. */
export function sectionAssets(state: WorkshopState, section: WorkshopSection, scoped: boolean): WorkshopAsset[] {
  if (!scoped || section === "tools") return state.assets;
  if (section === "fleet") return state.assets.filter(a => a.kind === "fleet");
  const repaired = new Set(state.jobs.map(j => j.assetId));
  return state.assets.filter(a => repaired.has(a.id));
}
