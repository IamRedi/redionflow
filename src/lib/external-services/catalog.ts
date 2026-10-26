import type { SupportedLanguage } from "@/lib/i18n/language";

export type ExternalServicePreset = {
  title: string;
  amountEur: string;
  group: "subunternehmer" | "entsorgung" | "technik" | "behoerde";
};

export const EXTERNAL_SERVICE_PRESETS: ExternalServicePreset[] = [
  { title: "Subunternehmer Tagessatz", amountEur: "450", group: "subunternehmer" },
  { title: "Subunternehmer Fachkraft", amountEur: "650", group: "subunternehmer" },
  { title: "Container Gruenschnitt", amountEur: "280", group: "entsorgung" },
  { title: "Container Bauschutt", amountEur: "390", group: "entsorgung" },
  { title: "Kran / Autokran Einsatz", amountEur: "850", group: "technik" },
  { title: "Verkehrssicherung", amountEur: "320", group: "technik" },
  { title: "Hubarbeitsbuehne Miete extern", amountEur: "420", group: "technik" },
  { title: "Genehmigung / Antrag", amountEur: "95", group: "behoerde" },
  { title: "Baumgutachten / Fachberatung", amountEur: "380", group: "behoerde" },
];

const EXTERNAL_SERVICE_TITLES: Partial<Record<SupportedLanguage, Record<string, string>>> = {
  en: {
    "Subunternehmer Tagessatz": "Subcontractor daily rate",
    "Subunternehmer Fachkraft": "Subcontractor specialist",
    "Container Gruenschnitt": "Green waste container",
    "Container Bauschutt": "Construction waste container",
    "Kran / Autokran Einsatz": "Crane / mobile crane use",
    Verkehrssicherung: "Traffic safety",
    "Hubarbeitsbuehne Miete extern": "External aerial platform rental",
    "Genehmigung / Antrag": "Permit / application",
    "Baumgutachten / Fachberatung": "Tree assessment / specialist advice",
  },
  it: {
    "Subunternehmer Tagessatz": "Subappaltatore tariffa giornaliera",
    "Subunternehmer Fachkraft": "Subappaltatore specialista",
    "Container Gruenschnitt": "Container verde",
    "Container Bauschutt": "Container macerie",
    "Kran / Autokran Einsatz": "Uso gru / autogru",
    Verkehrssicherung: "Sicurezza traffico",
    "Hubarbeitsbuehne Miete extern": "Noleggio piattaforma aerea esterna",
    "Genehmigung / Antrag": "Permesso / richiesta",
    "Baumgutachten / Fachberatung": "Perizia albero / consulenza",
  },
  pl: {
    "Subunternehmer Tagessatz": "Podwykonawca stawka dzienna",
    "Subunternehmer Fachkraft": "Podwykonawca specjalista",
    "Container Gruenschnitt": "Kontener na odpady zielone",
    "Container Bauschutt": "Kontener na gruz",
    "Kran / Autokran Einsatz": "Uzycie dzwigu / autodzwigu",
    Verkehrssicherung: "Zabezpieczenie ruchu",
    "Hubarbeitsbuehne Miete extern": "Wynajem podnosnika zewnetrzny",
    "Genehmigung / Antrag": "Pozwolenie / wniosek",
    "Baumgutachten / Fachberatung": "Ekspertyza drzewa / doradztwo",
  },
  ro: {
    "Subunternehmer Tagessatz": "Subcontractor tarif zilnic",
    "Subunternehmer Fachkraft": "Subcontractor specialist",
    "Container Gruenschnitt": "Container deseuri verzi",
    "Container Bauschutt": "Container moloz",
    "Kran / Autokran Einsatz": "Utilizare macara / automacara",
    Verkehrssicherung: "Siguranta trafic",
    "Hubarbeitsbuehne Miete extern": "Inchiriere externa platforma aeriana",
    "Genehmigung / Antrag": "Autorizatie / cerere",
    "Baumgutachten / Fachberatung": "Expertiza arbore / consultanta",
  },
  sq: {
    "Subunternehmer Tagessatz": "Nenkontraktor tarife ditore",
    "Subunternehmer Fachkraft": "Nenkontraktor specialist",
    "Container Gruenschnitt": "Kontejner mbetje gjelberimi",
    "Container Bauschutt": "Kontejner mbetje ndertimi",
    "Kran / Autokran Einsatz": "Perdorim vinci / autovinci",
    Verkehrssicherung: "Sigurim trafiku",
    "Hubarbeitsbuehne Miete extern": "Qira e jashtme platforme pune",
    "Genehmigung / Antrag": "Leje / kerkese",
    "Baumgutachten / Fachberatung": "Ekspertize peme / keshillim",
  },
};

export function externalServiceTitle(title: string, lang?: string) {
  return EXTERNAL_SERVICE_TITLES[lang as SupportedLanguage]?.[title] ?? title;
}

export function externalServiceGroupLabel(group: ExternalServicePreset["group"], lang?: string) {
  const labels: Partial<Record<SupportedLanguage, Record<ExternalServicePreset["group"], string>>> = {
    en: { subunternehmer: "Subcontractors", entsorgung: "Disposal", technik: "Equipment / rental", behoerde: "Authority / proof" },
    it: { subunternehmer: "Subappaltatori", entsorgung: "Smaltimento", technik: "Tecnica / noleggio", behoerde: "Autorita / prova" },
    pl: { subunternehmer: "Podwykonawcy", entsorgung: "Utylizacja", technik: "Technika / wynajem", behoerde: "Urzad / dowod" },
    ro: { subunternehmer: "Subcontractori", entsorgung: "Eliminare", technik: "Tehnica / inchiriere", behoerde: "Autoritate / dovada" },
    sq: { subunternehmer: "Nenkontraktore", entsorgung: "Largim mbetjesh", technik: "Teknike / qira", behoerde: "Autoritet / prove" },
  };
  const localized = labels[lang as SupportedLanguage]?.[group];
  if (localized) return localized;
  if (group === "subunternehmer") return "Subunternehmer";
  if (group === "entsorgung") return "Entsorgung";
  if (group === "technik") return "Technik / Miete";
  return "Behoerde / Nachweis";
}
