export const treeIdentity = (siteKey: string, code: string) => `${siteKey}:${code}`;
export const ILLUSTRATION_STYLE = "baumdienst-forest-v1";
const normalized = (name: string) => name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function assetArtKind(id: string, name = "", category = "tool") {
  if (["truck", "crane", "platform", "chipper", "saw", "pole-saw", "blower", "harness"].includes(id)) return id;
  const n = normalized(name);
  if (/stangen|pole.?saw|hoch.?entast/.test(n)) return "pole-saw";
  if (/sage|chainsaw|motoseg|sharr/.test(n)) return "saw";
  if (/hacks|chipper/.test(n)) return "chipper";
  if (/kran|crane/.test(n)) return "crane";
  if (/buhne|platform|lift/.test(n)) return "platform";
  if (/blaser|blower|soffiat/.test(n)) return "blower";
  if (/gurt|harness|imbrac/.test(n)) return "harness";
  if (/helm|helmet|casco/.test(n) || category === "ppe") return "helmet";
  if (/spaten|schaufel|shovel|lopat/.test(n)) return "spade";
  if (/trimmer|freischneider|brushcutter/.test(n)) return "trimmer";
  return category === "vehicle" ? "truck" : "toolbox";
}
export function treeArtKind(species: string) {
  const n = normalized(species);
  if (/eiche|quercus|oak/.test(n)) return "oak";
  if (/ahorn|acer|platane|platanus|maple/.test(n)) return "maple";
  if (/birke|betula|birch/.test(n)) return "birch";
  if (/buche|fagus|carpinus|beech/.test(n)) return "beech";
  if (/esche|fraxinus|ash/.test(n)) return "ash";
  if (/linde|tilia|lime/.test(n)) return "lime";
  if (/fichte|picea|tanne|abies|kiefer|pinus|pine/.test(n)) return "conifer";
  if (/weide|salix|willow/.test(n)) return "willow";
  if (/malus|prunus|apfel|kirsche|apple|cherry/.test(n)) return "fruit";
  return "broadleaf";
}
