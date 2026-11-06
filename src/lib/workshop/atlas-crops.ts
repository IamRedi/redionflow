import type { StudioMediaId } from "./studio-media";

/** Measured dividers in the original 1536×1024 plates; CSS zoom never stretches plant shapes. */
const dividers: Partial<Record<StudioMediaId, readonly [number, number, number]>> = {
  "tree-oak": [
    995,
    322,
    649
  ],
  "tree-maple": [
    987,
    341,
    650
  ],
  "tree-beech": [
    995,
    326,
    662
  ],
  "tree-birch": [
    995,
    322,
    649
  ],
  "tree-hornbeam": [
    995,
    322,
    649
  ],
  "tree-red-maple": [
    995,
    322,
    649
  ],
  "tree-plane": [
    995,
    322,
    649
  ],
  "tree-ash": [
    995,
    322,
    649
  ],
  "tree-lime": [
    994,
    322,
    648
  ],
  "tree-willow": [
    994,
    322,
    650
  ],
  "tree-copper-beech": [
    994,
    322,
    648
  ],
  "tree-fruit": [
    995,
    321,
    649
  ],
  "tree-chestnut": [
    995,
    322,
    650
  ],
  "tree-spruce": [
    995,
    322,
    649
  ],
  "tree-fir": [
    995,
    322,
    648
  ],
  "tree-pine": [
    995,
    322,
    649
  ],
  "tree-larch": [
    995,
    321,
    648
  ],
  "tree-rowan": [
    995,
    322,
    648
  ],
  "tree-ginkgo": [
    995,
    322,
    649
  ],
  "tree-thuja": [
    994,
    322,
    649
  ],
  "tree-privet": [
    995,
    322,
    649
  ],
  "tree-box": [
    995,
    322,
    649
  ],
  "tree-photinia": [
    995,
    322,
    649
  ],
  "tree-norway-maple": [
    994,
    322,
    649
  ],
  "tree-large-lime": [
    995,
    322,
    649
  ],
  "tree-yew": [
    994,
    322,
    649
  ]
};
export function atlasCrop(id: StudioMediaId, area: "overview" | "habit" | "leaf" | "bark" | "reproduction") {
  const [x, first, second] = dividers[id] || [995,322,649];
  if (area === "overview") return { x: 0, y: 0, w: 1536, h: 1024 };
  if (area === "habit") return { x: 4, y: 4, w: x-8, h: 1016 };
  const y = area === "leaf" ? 4 : area === "bark" ? first+4 : second+4;
  const bottom = area === "leaf" ? first-4 : area === "bark" ? second-4 : 1020;
  return { x: x+4, y, w: 1532-x-4, h: bottom-y };
}
