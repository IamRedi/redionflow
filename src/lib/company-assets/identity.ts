import type { AssetSummary } from './types';

/** Imported references remain searchable/stored; clothing labels need no XLS IDs. */
export function visibleAssetCode(asset: Pick<AssetSummary, 'code'> & Partial<Pick<AssetSummary, 'category'>>) {
  return asset.category === 'clothing' && /^XLS-/i.test(asset.code ?? '') ? null : asset.code;
}
