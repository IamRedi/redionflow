import type { SupportedLanguage } from "@/lib/i18n/language";

export type RecipeCategory = "baumdienst" | "gartenbau" | "bau" | "regie";

export type RecipeId =
  | "baumfaellung_standard"
  | "baumpflege_kronenschnitt"
  | "stubbenfraesen"
  | "gartenpflege_tag"
  | "hecke_schneiden"
  | "pflaster_vorbereiten"
  | "erdarbeiten_minibagger"
  | "regie_2_mann_transporter";

export type RecipeTemplate = {
  id: RecipeId;
  category: RecipeCategory;
  title: string;
  description: string;
  amountLabel: string;
  defaultAmount: string;
  unit: string;
};

export const RECIPE_TEMPLATES: RecipeTemplate[] = [
  {
    id: "baumfaellung_standard",
    category: "baumdienst",
    title: "Baumfaellung Standard",
    description: "Fachkraft, Helfer, Transporter, Haechsler und optionale Entsorgung.",
    amountLabel: "Baeume",
    defaultAmount: "1",
    unit: "Baum",
  },
  {
    id: "baumpflege_kronenschnitt",
    category: "baumdienst",
    title: "Baumpflege / Kronenschnitt",
    description: "Schnittarbeiten mit Team, Hubsteiger/Transport und Gruenschnitt.",
    amountLabel: "Baeume",
    defaultAmount: "5",
    unit: "Baum",
  },
  {
    id: "stubbenfraesen",
    category: "baumdienst",
    title: "Stubbenfraesen",
    description: "Stubben fraesen, Fraesgut aufnehmen und Baustelle sauber uebergeben.",
    amountLabel: "Stubben",
    defaultAmount: "1",
    unit: "Stk.",
  },
  {
    id: "gartenpflege_tag",
    category: "gartenbau",
    title: "Gartenpflege Tag",
    description: "Tagesleistung fuer Pflege, Schnitt, Maehen und Abfuhr.",
    amountLabel: "Tage",
    defaultAmount: "1",
    unit: "Tag",
  },
  {
    id: "hecke_schneiden",
    category: "gartenbau",
    title: "Hecke schneiden",
    description: "Heckenschnitt nach Laenge inklusive optionaler Gruenschnittentsorgung.",
    amountLabel: "Meter",
    defaultAmount: "20",
    unit: "m",
  },
  {
    id: "pflaster_vorbereiten",
    category: "bau",
    title: "Pflasterflaeche vorbereiten",
    description: "Unterbau vorbereiten, Schotter/Splitt ansetzen und Flaeche kalkulieren.",
    amountLabel: "Flaeche",
    defaultAmount: "30",
    unit: "m2",
  },
  {
    id: "erdarbeiten_minibagger",
    category: "bau",
    title: "Erdarbeiten mit Minibagger",
    description: "Aushub, Planum und Transport-/Containeranteil fuer kleine Baustellen.",
    amountLabel: "Kubikmeter",
    defaultAmount: "8",
    unit: "m3",
  },
  {
    id: "regie_2_mann_transporter",
    category: "regie",
    title: "Regiearbeit 2 Mann + Transporter",
    description: "Einfacher Tagesansatz fuer zwei Mitarbeiter und Fahrzeug.",
    amountLabel: "Tage",
    defaultAmount: "1",
    unit: "Tag",
  },
];

const RECIPE_TEXT: Partial<Record<SupportedLanguage, Record<RecipeId, Partial<Pick<RecipeTemplate, "title" | "description" | "amountLabel" | "unit">>>>> = {
  en: {
    baumfaellung_standard: { title: "Standard tree removal", description: "Specialist, helper, transporter, chipper and optional disposal.", amountLabel: "Trees", unit: "Tree" },
    baumpflege_kronenschnitt: { title: "Tree care / crown pruning", description: "Pruning work with team, aerial platform/transport and green waste.", amountLabel: "Trees", unit: "Tree" },
    stubbenfraesen: { title: "Stump grinding", description: "Grind stump, collect milling waste and hand over the site cleanly.", amountLabel: "Stumps", unit: "pcs." },
    gartenpflege_tag: { title: "Garden maintenance day", description: "Daily output for maintenance, pruning, mowing and removal.", amountLabel: "Days", unit: "Day" },
    hecke_schneiden: { title: "Hedge trimming", description: "Hedge trimming by length including optional green waste disposal.", amountLabel: "Meters", unit: "m" },
    pflaster_vorbereiten: { title: "Prepare paving area", description: "Prepare base, calculate gravel/chippings and surface.", amountLabel: "Area", unit: "m2" },
    erdarbeiten_minibagger: { title: "Earthworks with mini excavator", description: "Excavation, grade and transport/container share for small sites.", amountLabel: "Cubic meters", unit: "m3" },
    regie_2_mann_transporter: { title: "Daywork 2 workers + transporter", description: "Simple daily approach for two workers and one vehicle.", amountLabel: "Days", unit: "Day" },
  },
  it: {
    baumfaellung_standard: { title: "Abbattimento albero standard", description: "Specialista, aiutante, transporter, biotrituratore e smaltimento opzionale.", amountLabel: "Alberi", unit: "Albero" },
    baumpflege_kronenschnitt: { title: "Cura alberi / potatura chioma", description: "Potatura con team, piattaforma/trasporto e verde di risulta.", amountLabel: "Alberi", unit: "Albero" },
    stubbenfraesen: { title: "Fresatura ceppo", description: "Fresare il ceppo, raccogliere il materiale e consegnare il cantiere pulito.", amountLabel: "Ceppi", unit: "pz." },
    gartenpflege_tag: { title: "Giornata manutenzione giardino", description: "Prestazione giornaliera per cura, taglio, sfalcio e ritiro.", amountLabel: "Giorni", unit: "Giorno" },
    hecke_schneiden: { title: "Taglio siepe", description: "Taglio siepe per lunghezza con smaltimento verde opzionale.", amountLabel: "Metri", unit: "m" },
    pflaster_vorbereiten: { title: "Preparare area pavimentazione", description: "Preparare sottofondo, ghiaia/graniglia e calcolo superficie.", amountLabel: "Superficie", unit: "m2" },
    erdarbeiten_minibagger: { title: "Scavi con miniescavatore", description: "Scavo, livellamento e quota trasporto/container per piccoli cantieri.", amountLabel: "Metri cubi", unit: "m3" },
    regie_2_mann_transporter: { title: "Lavoro a giornata 2 persone + transporter", description: "Approccio giornaliero semplice per due operatori e veicolo.", amountLabel: "Giorni", unit: "Giorno" },
  },
  pl: {
    baumfaellung_standard: { title: "Standardowa wycinka drzewa", description: "Specjalista, pomocnik, transporter, rebak i opcjonalna utylizacja.", amountLabel: "Drzewa", unit: "Drzewo" },
    baumpflege_kronenschnitt: { title: "Pielegnacja drzew / ciecie korony", description: "Prace przy cieciu z zespolem, podnosnikiem/transportem i odpadami zielonymi.", amountLabel: "Drzewa", unit: "Drzewo" },
    stubbenfraesen: { title: "Frezowanie pnia", description: "Frezowanie pnia, zebranie frezu i czyste przekazanie miejsca pracy.", amountLabel: "Pnie", unit: "szt." },
    gartenpflege_tag: { title: "Dzien pielegnacji ogrodu", description: "Dzienna praca przy pielegnacji, cieciu, koszeniu i wywozie.", amountLabel: "Dni", unit: "Dzien" },
    hecke_schneiden: { title: "Ciecie zywoplotu", description: "Ciecie zywoplotu wedlug dlugosci z opcjonalna utylizacja zieleni.", amountLabel: "Metry", unit: "m" },
    pflaster_vorbereiten: { title: "Przygotowanie powierzchni pod kostke", description: "Przygotowanie podbudowy, kruszywa/grysu i kalkulacja powierzchni.", amountLabel: "Powierzchnia", unit: "m2" },
    erdarbeiten_minibagger: { title: "Roboty ziemne minikoparka", description: "Wykop, niwelacja i udzial transportu/kontenera dla malych miejsc pracy.", amountLabel: "Metry szescienne", unit: "m3" },
    regie_2_mann_transporter: { title: "Praca godzinowa 2 osoby + transporter", description: "Proste podejscie dzienne dla dwoch pracownikow i pojazdu.", amountLabel: "Dni", unit: "Dzien" },
  },
  ro: {
    baumfaellung_standard: { title: "Doborare arbore standard", description: "Specialist, ajutor, transporter, tocator si eliminare optionala.", amountLabel: "Arbori", unit: "Arbore" },
    baumpflege_kronenschnitt: { title: "Ingrijire arbori / taiere coroana", description: "Lucrari de taiere cu echipa, platforma/transport si deseuri verzi.", amountLabel: "Arbori", unit: "Arbore" },
    stubbenfraesen: { title: "Frezare cioata", description: "Frezare cioata, colectare material frezat si predare santier curat.", amountLabel: "Cioate", unit: "buc." },
    gartenpflege_tag: { title: "Zi de intretinere gradina", description: "Prestatie zilnica pentru intretinere, taiere, cosit si transport.", amountLabel: "Zile", unit: "Zi" },
    hecke_schneiden: { title: "Taiere gard viu", description: "Taiere gard viu dupa lungime cu eliminare optionala a deseurilor verzi.", amountLabel: "Metri", unit: "m" },
    pflaster_vorbereiten: { title: "Pregatire suprafata pavaj", description: "Pregatire strat suport, piatra/criblura si calcul suprafata.", amountLabel: "Suprafata", unit: "m2" },
    erdarbeiten_minibagger: { title: "Terasamente cu miniexcavator", description: "Sapatura, nivelare si cota transport/container pentru santiere mici.", amountLabel: "Metri cubi", unit: "m3" },
    regie_2_mann_transporter: { title: "Regie 2 oameni + transporter", description: "Abordare zilnica simpla pentru doi lucratori si vehicul.", amountLabel: "Zile", unit: "Zi" },
  },
  sq: {
    baumfaellung_standard: { title: "Prerje peme standard", description: "Specialist, ndihmes, transporter, grimcues dhe largim opsional.", amountLabel: "Peme", unit: "Peme" },
    baumpflege_kronenschnitt: { title: "Kujdes peme / prerje kurore", description: "Punime prerjeje me ekip, platforme/transport dhe mbetje gjelberimi.", amountLabel: "Peme", unit: "Peme" },
    stubbenfraesen: { title: "Frezim cungu", description: "Frezim cungu, mbledhje materiali dhe dorezim kantieri te paster.", amountLabel: "Cungje", unit: "cope" },
    gartenpflege_tag: { title: "Dite mirembajtje kopshti", description: "Pune ditore per mirembajtje, prerje, kositje dhe largim.", amountLabel: "Dite", unit: "Dite" },
    hecke_schneiden: { title: "Prerje gardhi", description: "Prerje gardhi sipas gjatesise me largim opsional te mbetjeve.", amountLabel: "Metra", unit: "m" },
    pflaster_vorbereiten: { title: "Pergatitje siperfaqe shtrimi", description: "Pergatitje baze, zhavorr/granil dhe kalkulim siperfaqeje.", amountLabel: "Siperfaqe", unit: "m2" },
    erdarbeiten_minibagger: { title: "Germime me minieskavator", description: "Germim, nivelim dhe pjese transporti/kontejneri per kantiere te vogla.", amountLabel: "Metra kub", unit: "m3" },
    regie_2_mann_transporter: { title: "Pune regjie 2 persona + transporter", description: "Qasje e thjeshte ditore per dy punetore dhe automjet.", amountLabel: "Dite", unit: "Dite" },
  },
};

export function recipeTemplateText(recipe: RecipeTemplate, lang?: string): RecipeTemplate {
  return {
    ...recipe,
    ...RECIPE_TEXT[lang as SupportedLanguage]?.[recipe.id],
  };
}

export function recipeCategoryLabel(category: RecipeCategory, lang?: string) {
  const labels: Partial<Record<SupportedLanguage, Record<RecipeCategory, string>>> = {
    en: { baumdienst: "Tree service", gartenbau: "Landscaping", bau: "Construction / civil works", regie: "Daywork / general" },
    it: { baumdienst: "Tree service", gartenbau: "Giardinaggio", bau: "Edilizia / scavi", regie: "Regia / generale" },
    pl: { baumdienst: "Arborystyka", gartenbau: "Ogrodnictwo", bau: "Budowa / roboty ziemne", regie: "Praca godzinowa / ogolne" },
    ro: { baumdienst: "Servicii arboricole", gartenbau: "Amenajari verzi", bau: "Constructii / terasamente", regie: "Regie / general" },
    sq: { baumdienst: "Sherbim peme", gartenbau: "Kopshtari", bau: "Ndertim / germim", regie: "Regji / te pergjithshme" },
  };
  const localized = labels[lang as SupportedLanguage]?.[category];
  if (localized) return localized;
  if (category === "baumdienst") return "Baumdienst";
  if (category === "gartenbau") return "Gartenbau";
  if (category === "bau") return "Bau / Tiefbau";
  return "Regie / Allgemein";
}
