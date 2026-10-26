import type { SupportedLanguage } from "@/lib/i18n/language";

export type MaterialPreset = {
  title: string;
  unit: string;
  unitPriceEur: string;
  group: "gartenbau" | "baumdienst" | "bau" | "entsorgung";
};

export const MATERIAL_PRESETS: MaterialPreset[] = [
  { title: "Gruenschnitt Entsorgung", unit: "pauschal", unitPriceEur: "65", group: "entsorgung" },
  { title: "Holz / Stammholz Abfuhr", unit: "pauschal", unitPriceEur: "85", group: "baumdienst" },
  { title: "Mutterboden", unit: "m3", unitPriceEur: "38", group: "gartenbau" },
  { title: "Rindenmulch", unit: "m3", unitPriceEur: "52", group: "gartenbau" },
  { title: "Rollrasen", unit: "m2", unitPriceEur: "9.50", group: "gartenbau" },
  { title: "Pflanzen / Heckenware", unit: "pauschal", unitPriceEur: "250", group: "gartenbau" },
  { title: "Schotter 0/32", unit: "t", unitPriceEur: "32", group: "bau" },
  { title: "Splitt 2/5", unit: "t", unitPriceEur: "45", group: "bau" },
  { title: "Pflasterstein", unit: "m2", unitPriceEur: "28", group: "bau" },
  { title: "Beton / Fertigbeton", unit: "m3", unitPriceEur: "165", group: "bau" },
];

const MATERIAL_PRESET_TITLES: Partial<Record<SupportedLanguage, Record<string, string>>> = {
  en: {
    "Gruenschnitt Entsorgung": "Green waste disposal",
    "Holz / Stammholz Abfuhr": "Wood / trunk wood removal",
    Mutterboden: "Topsoil",
    Rindenmulch: "Bark mulch",
    Rollrasen: "Turf",
    "Pflanzen / Heckenware": "Plants / hedge plants",
    "Schotter 0/32": "Gravel 0/32",
    "Splitt 2/5": "Chippings 2/5",
    Pflasterstein: "Paving stone",
    "Beton / Fertigbeton": "Concrete / ready-mix concrete",
    "Stubben / Fraesgut Entsorgung": "Stump / milling waste disposal",
  },
  it: {
    "Gruenschnitt Entsorgung": "Smaltimento verde",
    "Holz / Stammholz Abfuhr": "Ritiro legno / tronchi",
    Mutterboden: "Terreno vegetale",
    Rindenmulch: "Pacciame di corteccia",
    Rollrasen: "Prato a rotoli",
    "Pflanzen / Heckenware": "Piante / siepi",
    "Schotter 0/32": "Ghiaia 0/32",
    "Splitt 2/5": "Graniglia 2/5",
    Pflasterstein: "Pietra da pavimentazione",
    "Beton / Fertigbeton": "Calcestruzzo / premiscelato",
    "Stubben / Fraesgut Entsorgung": "Smaltimento ceppo / fresato",
  },
  pl: {
    "Gruenschnitt Entsorgung": "Utylizacja zieleni",
    "Holz / Stammholz Abfuhr": "Wywoz drewna / pni",
    Mutterboden: "Ziemia urodzajna",
    Rindenmulch: "Kora ogrodowa",
    Rollrasen: "Trawnik z rolki",
    "Pflanzen / Heckenware": "Rosliny / material na zywoplot",
    "Schotter 0/32": "Kruszywo 0/32",
    "Splitt 2/5": "Grys 2/5",
    Pflasterstein: "Kostka brukowa",
    "Beton / Fertigbeton": "Beton / beton gotowy",
    "Stubben / Fraesgut Entsorgung": "Utylizacja pnia / frezu",
  },
  ro: {
    "Gruenschnitt Entsorgung": "Eliminare deseuri verzi",
    "Holz / Stammholz Abfuhr": "Transport lemn / trunchiuri",
    Mutterboden: "Pamant vegetal",
    Rindenmulch: "Mulci de scoarta",
    Rollrasen: "Gazon rulou",
    "Pflanzen / Heckenware": "Plante / gard viu",
    "Schotter 0/32": "Piatra sparta 0/32",
    "Splitt 2/5": "Criblura 2/5",
    Pflasterstein: "Pavaj",
    "Beton / Fertigbeton": "Beton / beton gata preparat",
    "Stubben / Fraesgut Entsorgung": "Eliminare cioata / material frezat",
  },
  sq: {
    "Gruenschnitt Entsorgung": "Largim mbetje gjelberimi",
    "Holz / Stammholz Abfuhr": "Transport dru / trungje",
    Mutterboden: "Dhe i siperm",
    Rindenmulch: "Mulch lekure druri",
    Rollrasen: "Bar i gatshem",
    "Pflanzen / Heckenware": "Bime / gardh i gjelber",
    "Schotter 0/32": "Zhavorr 0/32",
    "Splitt 2/5": "Granil 2/5",
    Pflasterstein: "Gur shtrimi",
    "Beton / Fertigbeton": "Beton / beton i gatshem",
    "Stubben / Fraesgut Entsorgung": "Largim cung / material frezimi",
  },
};

export function materialPresetTitle(title: string, lang?: string) {
  return MATERIAL_PRESET_TITLES[lang as SupportedLanguage]?.[title] ?? title;
}

export function materialGroupLabel(group: MaterialPreset["group"], lang?: string) {
  const labels: Partial<Record<SupportedLanguage, Record<MaterialPreset["group"], string>>> = {
    en: { gartenbau: "Landscaping", baumdienst: "Tree service", bau: "Construction / civil works", entsorgung: "Disposal" },
    it: { gartenbau: "Giardinaggio", baumdienst: "Tree service", bau: "Edilizia / scavi", entsorgung: "Smaltimento" },
    pl: { gartenbau: "Ogrodnictwo", baumdienst: "Arborystyka", bau: "Budowa / roboty ziemne", entsorgung: "Utylizacja" },
    ro: { gartenbau: "Amenajari verzi", baumdienst: "Servicii arboricole", bau: "Constructii / terasamente", entsorgung: "Eliminare" },
    sq: { gartenbau: "Kopshtari", baumdienst: "Sherbim peme", bau: "Ndertim / germim", entsorgung: "Largim mbetjesh" },
  };
  const localized = labels[lang as SupportedLanguage]?.[group];
  if (localized) return localized;
  if (group === "gartenbau") return "Gartenbau";
  if (group === "baumdienst") return "Baumdienst";
  if (group === "bau") return "Bau / Tiefbau";
  return "Entsorgung";
}
