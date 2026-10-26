// Fictitious BauFlow demo data. Every name, address, phone number and plate
// below is invented. Coordinates lie in a real German city only so the maps
// look real. In BauFlow a site's items are work items ("Arbeiten"): the
// category goes into `species`, the quantity into `diameter`.

import type { DemoDataset, DemoMachine, DemoSite, DemoWorker } from "./seed-data";

const MACHINES: DemoMachine[] = [
  { key: "excavator", name: "Minibagger 3 t", category: "OTHER", hourlyRateCents: 5500, dayRateCents: 38000, model: "Kettenbagger 3 t", targe: null, coneTotal: 0 },
  { key: "truck", name: "Kipper 7,5 t", category: "TRUCK", hourlyRateCents: 4500, dayRateCents: 32000, model: "Dreiseitenkipper", targe: "BS-BF 101", coneTotal: 20 },
  { key: "van", name: "Pritsche Beschilderung", category: "TRUCK", hourlyRateCents: 3200, dayRateCents: 22000, model: "Pritsche mit Schildergestell", targe: "BS-BF 201", coneTotal: 30 },
  { key: "compactor", name: "Rüttelplatte", category: "OTHER", hourlyRateCents: 1500, dayRateCents: 9000, model: "Vibrationsplatte 90 kg", targe: null, coneTotal: 0 },
  { key: "mixer", name: "Betonmischer", category: "OTHER", hourlyRateCents: 1200, dayRateCents: null, model: "Freifallmischer 160 l", targe: null, coneTotal: 0 },
];

const WORKERS: DemoWorker[] = [
  { key: "stefan", firstName: "Stefan", lastName: "Krüger", position: "Polier", level: "VORARBEITER", language: "DE", licenses: "C1E, Bagger", startedYear: 2014 },
  { key: "besnik", firstName: "Besnik", lastName: "Gashi", position: "Pflasterer", level: "SENIOR", language: "SQ", licenses: "B", startedYear: 2017 },
  { key: "anna", firstName: "Anna", lastName: "Schulz", position: "Straßenbauerin", level: "WORKER", language: "DE", licenses: "B", startedYear: 2021 },
  { key: "piotr", firstName: "Piotr", lastName: "Nowak", position: "Baggerfahrer", level: "SENIOR", language: "PL", licenses: "CE, Bagger", startedYear: 2016 },
  { key: "luca", firstName: "Luca", lastName: "Rossi", position: "Maurer", level: "WORKER", language: "IT", licenses: "B", startedYear: 2019 },
  { key: "mihai", firstName: "Mihai", lastName: "Popescu", position: "Bauhelfer", level: "WORKER", language: "RO", licenses: "B", startedYear: 2022, availability: "VACATION" },
  { key: "tim", firstName: "Tim", lastName: "Neumann", position: "Auszubildender", level: "JUNIOR", language: "DE", licenses: "B", startedYear: 2025, availability: "SICK" },
  { key: "erion", firstName: "Erion", lastName: "Shehu", position: "Fahrer / Beschilderung", level: "WORKER", language: "SQ", licenses: "CE", startedYear: 2018 },
];

const SITES: DemoSite[] = [
  {
    key: "markt",
    name: "Marktplatz – Pflasterarbeiten",
    type: "PAVING",
    address: "Marktplatz 1–20, 54321 Beispielstadt",
    description: "Neupflasterung der Fußgängerzone in Abschnitten. Lieferverkehr nur bis 10:00 Uhr.",
    documents: ["leistungsverzeichnis-marktplatz.pdf", "verlegeplan-pflaster.pdf"],
    path: [
      { lat: 52.26402, lng: 10.52011 },
      { lat: 52.26318, lng: 10.52287 },
      { lat: 52.26205, lng: 10.52402 },
    ],
    treeCount: 36,
    treePrefix: "MP",
    species: ["Pflaster verlegen", "Bordstein setzen", "Unterbau verdichten", "Fugen schließen"],
    doneShare: 0.5,
    crew: ["stefan", "besnik", "anna"],
    machines: ["compactor", "truck"],
    tasks: ["Lieferung Granitpflaster 14:00 Uhr annehmen", "Absperrung Eingang Rathaus prüfen"],
  },
  {
    key: "ring",
    name: "Ringstraße – Beschilderung Umleitung",
    type: "SIGNAGE",
    address: "Ringstraße / Am Bahnhof, 54321 Beispielstadt",
    description: "Umleitungsbeschilderung für die Brückensanierung aufstellen und täglich kontrollieren.",
    documents: ["verkehrsrechtliche-anordnung.pdf", "beschilderungsplan.pdf"],
    path: [
      { lat: 52.25611, lng: 10.51203 },
      { lat: 52.25788, lng: 10.51602 },
      { lat: 52.25902, lng: 10.52098 },
      { lat: 52.25803, lng: 10.52511 },
    ],
    treeCount: 42,
    treePrefix: "RS",
    species: ["Schild aufstellen", "Leitbake setzen", "Absperrschranke", "Schild kontrollieren"],
    doneShare: 0.65,
    crew: ["erion", "luca"],
    machines: ["van"],
    tasks: ["Baustellenampel Kreuzung Nord nachts prüfen"],
  },
  {
    key: "schule",
    name: "Grundschule Süd – Entwässerung Schulhof",
    type: "DRAINAGE",
    address: "Schulweg 5, 54321 Beispielstadt",
    description: "Neue Rinnen und Sickerschächte im Schulhof. Arbeiten in den Pausen ruhen lassen.",
    documents: ["entwaesserungsplan.pdf", "bodengutachten.pdf"],
    path: [
      { lat: 52.24811, lng: 10.52902 },
      { lat: 52.24902, lng: 10.53188 },
      { lat: 52.24788, lng: 10.53401 },
    ],
    treeCount: 28,
    treePrefix: "GS",
    species: ["Graben ausheben", "Rinne setzen", "Sickerschacht", "Oberfläche schließen"],
    doneShare: 0.25,
    crew: ["piotr"],
    machines: ["excavator", "mixer"],
    tasks: ["Große Pause 09:30 Uhr – Bagger abstellen"],
  },
];

export const BAU_DEMO: DemoDataset = {
  mode: "bau",
  company: {
    legalName: "Bau Beispielstadt GmbH",
    displayName: "Bau Beispielstadt GmbH",
    vatId: "DE000000001",
    phone: "+49 9876 543210",
    email: "info@bau-beispielstadt.example",
    street: "Beispielring 4",
    zip: "54321",
    city: "Beispielstadt",
  },
  systemUser: { email: "seed@bau-beispielstadt.example", name: "Demo-Daten" },
  laborRoles: [
    { name: "Bauhelfer", grossHourlyCents: 1600, employerOverheadPct: "0.28", productivityPct: "0.80", sortOrder: 10 },
    { name: "Facharbeiter", grossHourlyCents: 2200, employerOverheadPct: "0.30", productivityPct: "0.85", sortOrder: 20 },
    { name: "Polier", grossHourlyCents: 2700, employerOverheadPct: "0.32", productivityPct: "0.88", sortOrder: 30 },
    { name: "Maschinist", grossHourlyCents: 2450, employerOverheadPct: "0.30", productivityPct: "0.87", sortOrder: 40 },
  ],
  machines: MACHINES,
  workers: WORKERS,
  vacationWorker: "mihai",
  plannedVacationWorker: "luca",
  plannedVacationNote: "Familienbesuch",
  sites: SITES,
  blockedNotes: [
    "Leitung beim Aushub gefunden – Netzbetreiber informiert.",
    "Material nicht geliefert – Lieferung morgen früh.",
    "Fläche zugeparkt – Ordnungsamt verständigt.",
  ],
  announcement: "Willkommen in der BauFlow-Demo! Alle Firmen, Personen und Baustellen sind frei erfunden.",
  itemLabel: "work items",
  offer: {
    template: {
      name: "Standard: Pflasterfläche",
      description: "Typische Positionen als Startpunkt. Inhalte und Mengen sind bewusst editierbar.",
      positions: [
        { title: "Unterbau herstellen", description: "Auskoffern, Schotter einbauen, verdichten", unit: "m²" },
        { title: "Pflaster verlegen", description: "Betonpflaster im Verband verlegen, abrütteln, verfugen", unit: "m²" },
      ],
    },
    project: {
      title: "Angebot: Hofpflaster – Familie Beispiel",
      customerName: "Max Beispielmann",
      customerStreet: "Musterweg 3",
      customerZip: "54321",
      customerCity: "Beispielstadt",
      internalNotes: "Demo-Angebot. Positionen dienen als realistischer Startpunkt.",
      position: {
        title: "Hoffläche pflastern (60 m²)",
        description: "Unterbau, Betonpflaster 8 cm, Randeinfassung",
        unit: "pauschal",
        labor: [
          { roleName: "Facharbeiter", hours: "16.0" },
          { roleName: "Bauhelfer", hours: "16.0" },
        ],
        machineKey: "compactor",
        machineHours: "6.0",
        material: { title: "Betonpflaster und Splitt", unitPriceCents: 145000 },
        externalService: { title: "Entsorgung Aushub", amountCents: 32000, notes: "Je nach Menge und Deponie." },
      },
    },
  },
};
