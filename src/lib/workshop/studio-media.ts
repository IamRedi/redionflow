/** Curated, versioned AI artwork. Served only by the opt-in Musterfirma route. */
export const studioMediaIds = [
  "card-workshop", "card-inventory", "card-worksite", "card-fleet", "card-parts", "card-documents", "card-team",
  "equipment-chipper", "equipment-truck", "equipment-platform", "equipment-harness", "equipment-helmet", "equipment-spade", "equipment-toolbox", "equipment-crane",
  "tree-norway-maple", "tree-large-lime", "tree-oak", "tree-maple", "tree-red-maple", "tree-plane", "tree-birch", "tree-beech", "tree-copper-beech", "tree-hornbeam", "tree-ash", "tree-lime", "tree-willow", "tree-fruit", "tree-chestnut", "tree-rowan", "tree-ginkgo", "tree-spruce", "tree-fir", "tree-pine", "tree-larch", "tree-yew", "tree-thuja", "tree-privet", "tree-box", "tree-photinia",
] as const;
export type StudioMediaId = typeof studioMediaIds[number];
export function equipmentCatalogueId(kind: string): StudioMediaId | undefined {
  const id = `equipment-${kind}`;
  return isStudioMediaId(id) ? id : undefined;
}
export function isStudioMediaId(id: string): id is StudioMediaId { return (studioMediaIds as readonly string[]).includes(id); }
export function studioMediaUrl(id: StudioMediaId) { return `/api/demo/baumdienst/art/${id}?v=1`; }
