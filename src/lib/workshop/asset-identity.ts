/** Record identity is immutable; a vehicle plate and an optional printed tag are distinct. */
type Identity = { id?: string; kind: "fleet" | "tool"; code: string; plate?: string; barcode?: string };
export const normalizeIdentity = (value: string) => value.trim().toUpperCase().replace(/\s+/g, " ");
export const assetPlate = (asset: Identity) => asset.kind === "fleet" ? asset.plate || asset.code : undefined;
export const assetBarcode = (asset: Identity) => asset.kind === "fleet" ? asset.barcode || undefined : asset.code;
export const assetIdentity = (asset: Identity) => assetPlate(asset) || asset.code;
export const optionalAssetCode = (id: string) => `BF-${id.replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase()}`;
export const identityTokens = (asset: Identity) => [...new Set([asset.kind === "tool" ? asset.code : undefined, assetPlate(asset), assetBarcode(asset)].filter((v): v is string => Boolean(v)).map(normalizeIdentity))];
export function identityCollision(asset: Identity, others: Identity[]) {
  const tokens = identityTokens(asset);
  return others.some(other => other.id !== asset.id && identityTokens(other).some(value => tokens.includes(value)));
}
