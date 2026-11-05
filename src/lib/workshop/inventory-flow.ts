import { activeJob, legacyWorkshopSchema, previousWorkshopSchema, workshopSchema, type WorkshopAsset, type WorkshopState } from "./demo-model";
import type { WorkshopDirectory } from "./shared-contract";

/** Add relationships without replacing an existing asset, order, event or file. */
export function upgradeWorkshopInventory(raw: unknown, directory: WorkshopDirectory): WorkshopState {
  const version = (raw as { version?: unknown })?.version;
  const state = version === 1 ? legacyWorkshopSchema.parse(raw) : version === 2 ? previousWorkshopSchema.parse(raw) : workshopSchema.parse(raw);
  return workshopSchema.parse({ ...state, version: 3, assets: state.assets.map(asset => {
    if (!asset.holder || asset.placement || activeJob(state as WorkshopState, asset.id)) return asset;
    const matches = directory.workers.filter(w => w.name === asset.holder);
    return matches.length === 1 ? { ...asset, placement: { workerKey: matches[0].key, workerName: matches[0].name } } : asset;
  }) });
}

/** A tag identifies a record; it never performs a stock/assignment mutation. */
export function resolveInventoryTag(raw: string, assets: WorkshopAsset[], origin: string) {
  let code = raw.trim();
  if (!code || code.length > 2048) return undefined;
  if (/^https?:\/\//i.test(code)) {
    try {
      const url = new URL(code);
      if (url.origin !== origin || url.pathname !== "/demo/workshop") return undefined;
      const id = url.searchParams.get("asset");
      return assets.find(a => a.id === id);
    } catch { return undefined; }
  }
  code = code.toUpperCase();
  const matches = assets.filter(a => a.code.trim().toUpperCase() === code);
  return matches.length === 1 ? matches[0] : undefined;
}

export function siteInventory(state: WorkshopState, siteKey: string) {
  return state.assets.filter(asset => asset.placement?.siteKey === siteKey || activeJob(state, asset.id)?.origin?.placement?.siteKey === siteKey);
}
export function workerInventory(state: WorkshopState, workerKey: string) {
  return state.assets.filter(asset => asset.placement?.workerKey === workerKey || activeJob(state, asset.id)?.origin?.placement?.workerKey === workerKey);
}
export function inventoryHistory(state: WorkshopState, scope: "site" | "worker", identity: string) {
  const key = scope === "site" ? "siteKey" : "workerKey";
  return state.assets.filter(asset => asset.placement?.[key] === identity || asset.events.some(e => e.placement?.[key] === identity) || state.jobs.some(j => j.assetId === asset.id && j.origin?.placement?.[key] === identity));
}

/** Shared upload permission for the labelled fictional role simulation. */
export function canUploadDemoFile(state: WorkshopState, actor: {key:string;role:string}, kind: string, target: string, jobId?: string) {
  return actor.role === "admin" || kind === "site" || state.assets.find(a=>a.id===target)?.placement?.workerKey === actor.key || Boolean(jobId && state.jobs.find(j=>j.id===jobId && j.assetId===target)?.origin?.placement?.workerKey === actor.key);
}
