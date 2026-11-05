export type BotanicalKind = "oak" | "maple" | "plane" | "birch" | "beech" | "hornbeam" | "ash" | "lime" | "willow" | "fruit" | "spruce" | "fir" | "pine" | "yew" | "thuja" | "privet" | "box" | "photinia" | "chestnut" | "rowan" | "ginkgo" | "broadleaf";
export type BotanicalSeason = "summer" | "autumn";
const normalize = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** Name-based reference families, never an AI identification of a living specimen. */
export function botanicalIdentity(name: string) {
  const n = normalize(name);
  let kind: BotanicalKind = "broadleaf";
  if (/hainbuche|weissbuche|carpinus|hornbeam/.test(n)) kind = "hornbeam";
  else if (/eberesche|vogelbeere|sorbus|rowan/.test(n)) kind = "rowan";
  else if (/rosskastanie|aesculus|horse.?chestnut/.test(n)) kind = "chestnut";
  else if (/kirschlorbeer|laurocerasus/.test(n)) kind = "broadleaf";
  else if (/photinia|glanzmispel|red robin/.test(n)) kind = "photinia";
  else if (/liguster|ligustrum|privet/.test(n)) kind = "privet";
  else if (/buchs|buxus|boxwood/.test(n)) kind = "box";
  else if (/thuja|lebensbaum/.test(n)) kind = "thuja";
  else if (/eibe|taxus|yew/.test(n)) kind = "yew";
  else if (/fichte|picea|spruce/.test(n)) kind = "spruce";
  else if (/tanne|abies|\bfir\b/.test(n)) kind = "fir";
  else if (/kiefer|pinus|\bpine\b/.test(n)) kind = "pine";
  else if (/ginkgo/.test(n)) kind = "ginkgo";
  else if (/eiche|quercus|\boak\b/.test(n)) kind = "oak";
  else if (/platane|platanus|plane tree/.test(n)) kind = "plane";
  else if (/ahorn|acer|maple/.test(n)) kind = "maple";
  else if (/birke|betula|birch/.test(n)) kind = "birch";
  else if (/buche|fagus|beech/.test(n)) kind = "beech";
  else if (/esche|fraxinus|\bash\b/.test(n)) kind = "ash";
  else if (/linde|tilia|lime|linden/.test(n)) kind = "lime";
  else if (/weide|salix|willow/.test(n)) kind = "willow";
  else if (/malus|prunus|apfel|kirsche|apple|cherry/.test(n)) kind = "fruit";
  const hedge = /hecke|hedge|gardh|siepe|zywoplot|gard viu/.test(n) || ["privet", "box", "photinia"].includes(kind);
  const evergreen = ["spruce", "fir", "pine", "yew", "thuja", "box", "photinia"].includes(kind);
  const copper = /blutbuche|purpurea|atropurpurea|purple.?beech|copper.?beech/.test(n);
  const redMaple = kind === "maple" && /rubrum|roter ahorn|rotahorn|japan|palmatum|red.?maple/.test(n);
  const known = kind !== "broadleaf";
  return { kind, hedge, evergreen, copper, redMaple, known };
}
export function botanicalPalette(name: string, season: BotanicalSeason = "summer") {
  const { kind, evergreen, copper, redMaple } = botanicalIdentity(name);
  if (copper) return { deep: "#542c39", mid: "#934452", light: "#c47760", leaf: "#843d4b", vein: "#d49a73" };
  if (kind === "photinia") return { deep: "#1f4d38", mid: "#497c47", light: "#b9473e", leaf: "#b0443c", vein: "#e2a57f" };
  if (season === "autumn" && !evergreen && kind !== "privet") {
    if (redMaple || kind === "rowan") return { deep: "#8c342d", mid: "#cf5538", light: "#efab4b", leaf: "#d16138", vein: "#ffe0a0" };
    if (kind === "beech" || kind === "oak" || kind === "plane" || kind === "chestnut") return { deep: "#795234", mid: "#b47a36", light: "#e5b75f", leaf: "#bc813b", vein: "#f3d498" };
    return { deep: "#8c782d", mid: "#c4a536", light: "#edcf68", leaf: "#d5b53f", vein: "#fff0aa" };
  }
  if (["spruce", "fir", "pine", "yew", "thuja"].includes(kind)) return { deep: "#163d32", mid: "#326a50", light: "#71966a", leaf: "#39785a", vein: "#b8c987" };
  if (["birch", "lime", "hornbeam", "willow", "ginkgo"].includes(kind)) return { deep: "#355b32", mid: "#689447", light: "#b0ca74", leaf: "#83a94f", vein: "#dfedb0" };
  return { deep: "#214c32", mid: "#487944", light: "#91b463", leaf: "#5c914a", vein: "#c7df9a" };
}
export const botanicalReferences = [
  { name: "Stieleiche", latin: "Quercus robur" }, { name: "Bergahorn", latin: "Acer pseudoplatanus" }, { name: "Rotahorn", latin: "Acer rubrum" }, { name: "Platane", latin: "Platanus" }, { name: "Birke", latin: "Betula" }, { name: "Rotbuche", latin: "Fagus sylvatica" }, { name: "Blutbuche", latin: "Fagus sylvatica · Atropurpurea" }, { name: "Esche", latin: "Fraxinus" }, { name: "Linde", latin: "Tilia" }, { name: "Weide", latin: "Salix" }, { name: "Apfelbaum", latin: "Malus" }, { name: "Rosskastanie", latin: "Aesculus hippocastanum" }, { name: "Eberesche", latin: "Sorbus aucuparia" }, { name: "Ginkgo", latin: "Ginkgo biloba" }, { name: "Fichte", latin: "Picea" }, { name: "Tanne", latin: "Abies" }, { name: "Kiefer", latin: "Pinus" }, { name: "Hainbuchenhecke", latin: "Carpinus betulus" }, { name: "Buchenhecke", latin: "Fagus sylvatica" }, { name: "Eibenhecke", latin: "Taxus baccata" }, { name: "Thujahecke", latin: "Thuja" }, { name: "Ligusterhecke", latin: "Ligustrum" }, { name: "Buchshecke", latin: "Buxus" }, { name: "Glanzmispelhecke", latin: "Photinia × fraseri" },
] as const;
