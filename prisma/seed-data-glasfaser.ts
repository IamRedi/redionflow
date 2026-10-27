// Fictitious fiber-optic civil works company (Glasfaser-Tiefbau) for the
// BauFlow demo. Every company, person, address and plate below is invented.
// Coordinates lie in a real German city only so the maps look real.
//
// How the work is modelled (as in practice in Germany): a network operator
// awards an expansion area to a general contractor (GU), who passes routes
// and house connections to Tiefbau subcontractors like this one. Each site
// is a work package from the GU; each work item is a route section, a
// drilling or a house connection, billed by measured quantity (Aufmaß).
// The category goes into `species`, the quantity (metres or pieces) into
// `diameter`.

import type { DemoDataset, DemoMachine, DemoSite, DemoWorker } from "./seed-data";

const MACHINES: DemoMachine[] = [
  { key: "bagger18", name: "Minibagger 1,8 t", category: "OTHER", hourlyRateCents: 4200, dayRateCents: 29000, model: "Kurzheckbagger 1,8 t, Tieflöffel 30 cm", targe: null, coneTotal: 0 },
  { key: "bagger35", name: "Minibagger 3,5 t", category: "OTHER", hourlyRateCents: 5600, dayRateCents: 39000, model: "Kurzheckbagger 3,5 t mit Schwenklöffel", targe: null, coneTotal: 0 },
  { key: "hdd", name: "Spülbohranlage 10 t", category: "OTHER", hourlyRateCents: 18500, dayRateCents: 135000, model: "Horizontalbohranlage 10 t mit Spülpumpe", targe: null, coneTotal: 0 },
  { key: "rakete", name: "Erdrakete 65 mm", category: "OTHER", hourlyRateCents: 1800, dayRateCents: 12000, model: "Bodenverdrängungshammer 65 mm", targe: null, coneTotal: 0 },
  { key: "einblas", name: "Einblasgerät + Kompressor", category: "OTHER", hourlyRateCents: 6500, dayRateCents: 45000, model: "Kabeleinblasgerät, Kompressor 10 m³/min", targe: "BT-GF 701", coneTotal: 0 },
  { key: "pritsche", name: "Pritsche 3,5 t + Anhänger", category: "TRUCK", hourlyRateCents: 2800, dayRateCents: 19000, model: "Doppelkabine mit Tieflader für Minibagger", targe: "BT-GF 101", coneTotal: 24 },
  { key: "kipper", name: "Kipper 7,5 t", category: "TRUCK", hourlyRateCents: 4500, dayRateCents: 32000, model: "Dreiseitenkipper", targe: "BT-GF 201", coneTotal: 12 },
  { key: "spleiss", name: "Spleißfahrzeug", category: "TRUCK", hourlyRateCents: 3500, dayRateCents: 24000, model: "Kastenwagen mit Spleißplatz, Spleißgerät, OTDR", targe: "BT-GF 301", coneTotal: 6 },
];

const WORKERS: DemoWorker[] = [
  { key: "markus", firstName: "Markus", lastName: "Brandt", position: "Polier Tiefbau", level: "VORARBEITER", language: "DE", licenses: "C1E, Bagger, Absicherung MVAS", startedYear: 2013 },
  { key: "fatmir", firstName: "Fatmir", lastName: "Krasniqi", position: "Baggerfahrer", level: "SENIOR", language: "SQ", licenses: "CE, Bagger bis 10 t", startedYear: 2017 },
  { key: "emre", firstName: "Emre", lastName: "Yıldız", position: "Tiefbauer", level: "WORKER", language: "DE", licenses: "B, Kabelortung", startedYear: 2019 },
  { key: "krzysztof", firstName: "Krzysztof", lastName: "Wójcik", position: "Bohrmeister (HDD)", level: "SENIOR", language: "PL", licenses: "CE, Spülbohrung", startedYear: 2016 },
  { key: "adrian", firstName: "Adrian", lastName: "Stoica", position: "Bohrhelfer", level: "WORKER", language: "RO", licenses: "B", startedYear: 2021 },
  { key: "gentian", firstName: "Gentian", lastName: "Bajrami", position: "Pflasterer", level: "SENIOR", language: "SQ", licenses: "B", startedYear: 2018 },
  { key: "sven", firstName: "Sven", lastName: "Hartmann", position: "Spleißtechniker", level: "SENIOR", language: "DE", licenses: "B, LWL-Messtechnik", startedYear: 2015 },
  { key: "andrea", firstName: "Andrea", lastName: "Conti", position: "Monteurin Hausanschluss", level: "WORKER", language: "IT", licenses: "B", startedYear: 2022 },
  { key: "bogdan", firstName: "Bogdan", lastName: "Ionescu", position: "Tiefbauhelfer", level: "JUNIOR", language: "RO", licenses: "B", startedYear: 2025, availability: "SICK" },
  { key: "jan", firstName: "Jan", lastName: "Kaminski", position: "Tiefbauer", level: "WORKER", language: "PL", licenses: "B, Rüttelplatte", startedYear: 2020, availability: "VACATION" },
];

const SITES: DemoSite[] = [
  {
    key: "trasse",
    name: "Cluster 3 – Trasse Lindenweg / Schulstraße",
    type: "FIBER_TRENCH",
    address: "Lindenweg 1–60 und Schulstraße 2–40, 34567 Beispieltal",
    description:
      "Offene Bauweise im Gehweg, Grabentiefe 60 cm, Rohrverband 12x10/6 mit Trassenwarnband. Auftrag des GU Netzbau Muster AG, abgerechnet nach Aufmaß je Meter. Gehweg halbseitig gesperrt, Fußgänger auf der Gegenseite.",
    documents: [
      "verkehrsrechtliche-anordnung-cluster3.pdf",
      "zustimmung-wegebaulasttraeger-127-tkg.pdf",
      "spartenauskunft-strom-gas-wasser.pdf",
      "trassenplan-cluster3.pdf",
      "beweissicherung-fotos.pdf",
    ],
    path: [
      { lat: 51.53402, lng: 9.92811 },
      { lat: 51.53288, lng: 9.93202 },
      { lat: 51.53151, lng: 9.93488 },
      { lat: 51.53022, lng: 9.93311 },
    ],
    treeCount: 40,
    treePrefix: "TR",
    species: [
      "Gehweg Betonpflaster öffnen + Graben",
      "Gehweg Asphalt schneiden + Graben",
      "Rohrverband 12x10/6 einlegen",
      "Verfüllen + Trassenwarnband",
      "Pflaster wiederherstellen",
      "Grünstreifen Graben",
    ],
    doneShare: 0.55,
    crew: ["markus", "fatmir", "emre", "gentian"],
    machines: ["bagger35", "pritsche", "kipper"],
    tasks: [
      "Spartenauskunft Telekom für Schulstraße 30–40 fehlt – dort noch nicht graben",
      "Aufmaß Abschnitte TR-001 bis TR-020 an GU senden",
      "Verkehrsrechtliche Anordnung läuft Freitag ab – Verlängerung beantragt",
    ],
    safety: { SIGN: 6, PLATE: 4, FENCE: 36 },
  },
  {
    key: "hausanschluss",
    name: "Hausanschlüsse Ahornstraße 1–48",
    type: "FIBER_HOUSE_CONNECTION",
    address: "Ahornstraße 1–48, 34567 Beispieltal",
    description:
      "Hausanschlüsse nach Hausbegehung: Kopfloch am Gehweg, Erdrakete bis zur Hauswand, Kernbohrung, gas- und wasserdichte Hauseinführung, HÜP im Keller. Termine mit den Eigentümern über das Büro.",
    documents: ["hausbegehungsprotokolle-ahornstrasse.pdf", "grundstueckseigentuemererklaerungen.pdf", "lageplan-hausanschluesse.pdf"],
    path: [
      { lat: 51.52611, lng: 9.94102 },
      { lat: 51.52702, lng: 9.94588 },
      { lat: 51.52789, lng: 9.95021 },
    ],
    treeCount: 48,
    treePrefix: "HA",
    species: [
      "Kopfloch + Erdrakete",
      "Offener Graben über Grundstück",
      "Kernbohrung + Hauseinführung",
      "HÜP setzen",
      "Oberfläche Grundstück wiederherstellen",
    ],
    doneShare: 0.4,
    crew: ["andrea", "emre"],
    machines: ["bagger18", "rakete"],
    tasks: ["Ahornstraße 17: Eigentümer erst ab 16 Uhr zu Hause", "Kernbohrgerät 52 mm nach Einsatz zurück ins Lager"],
    safety: { SIGN: 2, PLATE: 2, FENCE: 12 },
  },
  {
    key: "bohrung",
    name: "Spülbohrung Querung B 27 und Bachlauf",
    type: "FIBER_DRILLING",
    address: "B 27 / Am Mühlbach, 34567 Beispieltal",
    description:
      "Grabenlose Querung der Bundesstraße und des Mühlbachs mit Spülbohrung, Einzug von 2x Schutzrohr DA 50. Start- und Zielgruben in der Böschung. Arbeiten nur mit Freigabe der Straßenmeisterei.",
    documents: ["genehmigung-strassenmeisterei.pdf", "wasserrechtliche-erlaubnis.pdf", "bohrprotokoll-vorlage.pdf"],
    path: [
      { lat: 51.53811, lng: 9.95402 },
      { lat: 51.53902, lng: 9.95688 },
    ],
    treeCount: 10,
    treePrefix: "SB",
    species: ["Start-/Zielgrube", "Pilotbohrung", "Aufweiten + Rohreinzug 2x DA 50", "Bohrprotokoll + Einmessung"],
    doneShare: 0.3,
    crew: ["krzysztof", "adrian"],
    machines: ["hdd"],
    tasks: ["Bentonit nachbestellen (2 Paletten)", "Bohrspülung zur Entsorgung abholen lassen"],
    safety: { SIGN: 4, FENCE: 10 },
  },
  {
    key: "spleiss",
    name: "Einblasen und Spleißen – NVt 3.2",
    type: "OTHER",
    address: "Netzverteiler 3.2, Schulstraße / Ecke Lindenweg, 34567 Beispieltal",
    description:
      "Glasfaserkabel in die Mikrorohre einblasen, im Netzverteiler NVt 3.2 spleißen und jede Faser mit OTDR messen. Messprotokolle gehen mit der Dokumentation an den GU.",
    documents: ["spleissplan-nvt-3-2.pdf", "faserzuordnung-cluster3.xlsx"],
    path: [
      { lat: 51.53151, lng: 9.93488 },
      { lat: 51.53182, lng: 9.93531 },
    ],
    treeCount: 16,
    treePrefix: "NV",
    species: ["Kabel einblasen", "Spleißen im NVt", "Muffe setzen", "OTDR-Messung + Protokoll"],
    doneShare: 0.5,
    crew: ["sven"],
    machines: ["einblas", "spleiss"],
    tasks: ["OTDR-Protokolle Fasern 1–24 hochladen"],
  },
];

export const GLASFASER_DEMO: DemoDataset = {
  mode: "bau",
  company: {
    legalName: "Glasfaserbau Beispieltal GmbH",
    displayName: "Glasfaserbau Beispieltal GmbH",
    vatId: "DE000000002",
    phone: "+49 4567 890123",
    email: "info@glasfaserbau-beispieltal.example",
    street: "Kabelweg 7",
    zip: "34567",
    city: "Beispieltal",
  },
  systemUser: { email: "seed@glasfaserbau-beispieltal.example", name: "Demo-Daten" },
  laborRoles: [
    { name: "Tiefbauhelfer", grossHourlyCents: 1600, employerOverheadPct: "0.28", productivityPct: "0.80", sortOrder: 10 },
    { name: "Tiefbauer", grossHourlyCents: 2100, employerOverheadPct: "0.30", productivityPct: "0.85", sortOrder: 20 },
    { name: "Pflasterer", grossHourlyCents: 2250, employerOverheadPct: "0.30", productivityPct: "0.85", sortOrder: 30 },
    { name: "Maschinist", grossHourlyCents: 2400, employerOverheadPct: "0.30", productivityPct: "0.87", sortOrder: 40 },
    { name: "Bohrmeister", grossHourlyCents: 2800, employerOverheadPct: "0.32", productivityPct: "0.88", sortOrder: 50 },
    { name: "Spleißtechniker", grossHourlyCents: 2700, employerOverheadPct: "0.32", productivityPct: "0.88", sortOrder: 60 },
    { name: "Polier", grossHourlyCents: 2900, employerOverheadPct: "0.32", productivityPct: "0.88", sortOrder: 70 },
  ],
  machines: MACHINES,
  workers: WORKERS,
  vacationWorker: "jan",
  plannedVacationWorker: "gentian",
  plannedVacationNote: "Heimaturlaub",
  sites: SITES,
  blockedNotes: [
    "Fremdleitung (Gas) nicht im Plan – Netzbetreiber informiert, Handschachtung.",
    "Eigentümer nicht erreichbar – Hausbegehung neu terminieren.",
    "Wurzeln im Graben – Baumschutz, Abstimmung mit Grünflächenamt.",
    "Spartenauskunft fehlt – Abschnitt gesperrt bis Freigabe.",
  ],
  announcement:
    "Willkommen in der Glasfaser-Demo! Alle Firmen, Personen, Baustellen und Netzbetreiber sind frei erfunden.",
  itemLabel: "work items",
  offer: {
    template: {
      name: "Standard: Glasfaser-Hausanschluss (offene Bauweise)",
      description: "Typische Positionen für einen Hausanschluss als Nachunternehmer. Mengen sind editierbar.",
      positions: [
        { title: "Kopfloch herstellen und wiederherstellen", description: "Gehweg öffnen, Kopfloch ca. 1,0 x 0,6 m, verfüllen, Pflaster wiederherstellen", unit: "Stk" },
        { title: "Erdrakete bis Hauswand", description: "Bodenverdrängung bis 15 m, Hausanschlussrohr 10/6 einziehen", unit: "m" },
        { title: "Kernbohrung und Hauseinführung", description: "Kernbohrung bis 52 mm, gas- und wasserdichte Hauseinführung setzen", unit: "Stk" },
        { title: "HÜP montieren", description: "Hausübergabepunkt im Keller setzen und Rohr einführen", unit: "Stk" },
      ],
    },
    project: {
      title: "Angebot: Nachverdichtung Hausanschluss – Familie Beispiel",
      customerName: "Sabine Beispielfrau",
      customerStreet: "Ahornstraße 52",
      customerZip: "34567",
      customerCity: "Beispieltal",
      internalNotes: "Nachverdichtung nach Abschluss des Clusters. Demo-Angebot, Preise als Startpunkt.",
      position: {
        title: "Glasfaser-Hausanschluss Einfamilienhaus (12 m)",
        description: "Kopfloch, Erdrakete 12 m, Kernbohrung, Hauseinführung, HÜP, Oberfläche wiederherstellen",
        unit: "pauschal",
        labor: [
          { roleName: "Tiefbauer", hours: "5.0" },
          { roleName: "Tiefbauhelfer", hours: "5.0" },
        ],
        machineKey: "rakete",
        machineHours: "2.0",
        material: { title: "Hausanschlussrohr 10/6, Hauseinführung, HÜP, Sand, Pflasterbettung", unitPriceCents: 9800 },
        externalService: { title: "Entsorgung Aushub", amountCents: 6000, notes: "Je nach Menge und Deponie." },
      },
    },
  },
  inventory: {
    catalogs: [
      { name: "Verkehrszeichen (VZ 283 Halteverbot, VZ 123 Arbeitsstelle)", category: "SIGN", totalQuantity: 40 },
      { name: "Stahlplatten Grabenabdeckung 1 x 2 m", category: "PLATE", totalQuantity: 24 },
      { name: "Absperrschranken mit Fußplatten", category: "FENCE", totalQuantity: 120 },
      { name: "Leitbaken und Warnleuchten", category: "OTHER", totalQuantity: 60 },
    ],
    items: [
      { code: "WZ-001", name: "Spaten", category: "WORK_TOOL" },
      { code: "WZ-002", name: "Schaufel", category: "WORK_TOOL" },
      { code: "WZ-003", name: "Kreuzhacke", category: "WORK_TOOL" },
      { code: "WZ-004", name: "Spitzhacke", category: "WORK_TOOL" },
      { code: "WZ-005", name: "Brechstange", category: "WORK_TOOL" },
      { code: "WZ-006", name: "Pflasterhammer", category: "WORK_TOOL" },
      { code: "WZ-007", name: "Fugeisen und Fugenkratzer", category: "WORK_TOOL" },
      { code: "WZ-008", name: "Schubkarre", category: "WORK_TOOL" },
      { code: "WZ-009", name: "Handstampfer", category: "WORK_TOOL" },
      { code: "WZ-010", name: "Richtschnur und Wasserwaage", category: "WORK_TOOL" },
      { code: "WZ-011", name: "Kabelortungsgerät mit Generator", category: "WORK_TOOL", note: "Vor jedem Graben Leitungen orten." },
      { code: "WZ-012", name: "Rüttelplatte 90 kg", category: "WORK_TOOL" },
      { code: "WZ-013", name: "Trennschleifer / Steinsäge", category: "WORK_TOOL" },
      { code: "WZ-014", name: "Asphaltschneider", category: "WORK_TOOL" },
      { code: "WZ-015", name: "Kernbohrgerät mit Bohrkronen 32–52 mm", category: "WORK_TOOL" },
      { code: "WZ-016", name: "Mikrorohrschneider", category: "WORK_TOOL" },
      { code: "WZ-017", name: "Druckprüfset für Mikrorohre", category: "WORK_TOOL" },
      { code: "WZ-018", name: "Spleißgerät", category: "WORK_TOOL" },
      { code: "WZ-019", name: "OTDR-Messgerät", category: "WORK_TOOL" },
      { code: "WZ-020", name: "GNSS-Rover für Einmessung", category: "WORK_TOOL" },
      { code: "KL-001", name: "Warnschutzjacke Klasse 3", category: "CLOTHING", sizeLabel: "L" },
      { code: "KL-002", name: "Warnschutzhose", category: "CLOTHING", sizeLabel: "52" },
      { code: "KL-003", name: "Sicherheitsschuhe S3", category: "CLOTHING", sizeLabel: "43" },
      { code: "KL-004", name: "Schutzhelm", category: "CLOTHING" },
      { code: "KL-005", name: "Gehörschutz", category: "CLOTHING" },
      { code: "KL-006", name: "Schutzbrille", category: "CLOTHING" },
      { code: "BE-001", name: "Bauzaun-Element 3,5 m", category: "SITE_EQUIPMENT" },
      { code: "BE-002", name: "Fußgängerbrücke für Gräben", category: "SITE_EQUIPMENT" },
      { code: "BE-003", name: "Baustellenampel (Paar)", category: "SITE_EQUIPMENT" },
    ],
    handovers: {
      markus: ["WZ-011", "WZ-020", "KL-001", "KL-004"],
      fatmir: ["WZ-001", "WZ-003", "KL-003"],
      emre: ["WZ-002", "WZ-004", "WZ-009", "KL-002"],
      gentian: ["WZ-006", "WZ-007", "WZ-010", "WZ-013"],
      andrea: ["WZ-015", "WZ-016", "WZ-017"],
      sven: ["WZ-018", "WZ-019"],
      krzysztof: ["WZ-014", "KL-005", "KL-006"],
    },
  },
  knowledge: [
    {
      key: "ablauf-auftrag",
      title: "So kommt ein Auftrag zu uns",
      tags: ["auftrag", "gu", "aufmass"],
      content:
        "Der Netzbetreiber vergibt ein Ausbaugebiet an einen Generalunternehmer (GU). Wir arbeiten als Nachunternehmer: Der GU gibt uns Arbeitspakete (Trassen, Hausanschlüsse, Bohrungen) mit Leistungsverzeichnis und Einheitspreisen. Abgerechnet wird nach Aufmaß: Meter Graben je Oberfläche, Stück Hausanschluss, Meter Bohrung. Das Aufmaß geht wöchentlich mit Fotos und Einmessung an den GU.",
    },
    {
      key: "vor-baubeginn",
      title: "Vor Baubeginn",
      tags: ["genehmigung", "sparten", "vrao"],
      content:
        "1. Zustimmung des Wegebaulastträgers nach § 127 TKG (holt der GU). 2. Verkehrsrechtliche Anordnung für die Absicherung. 3. Spartenauskunft für Strom, Gas, Wasser, Telekom und Fernwärme, Pläne auf der Baustelle. 4. Beweissicherung: Fotos von Gehweg, Bordsteinen und Einfahrten. 5. Hausbegehung und Grundstückseigentümererklärung vor jedem Hausanschluss.",
    },
    {
      key: "materialliste",
      title: "Materialliste Trasse und Hausanschluss",
      tags: ["material"],
      content:
        "Trasse: Mikrorohrverband 12x10/6 (Verteilnetz), 4x20/15 (Zubringer), Trassenwarnband Glasfaser, Sand zum Einsanden, Schotter, Pflasterbettung, Fugensand, Kaltasphalt für Provisorien. Hausanschluss: Hausanschlussrohr 10/6, Verbinder und Endkappen, Hauseinführung gas- und wasserdicht, HÜP. Netz: Netzverteiler (NVt), Muffen, Glasfaserkabel 12–24 Fasern zum Einblasen.",
    },
    {
      key: "regeln-graben",
      title: "Regeln im Graben",
      tags: ["sicherheit", "graben"],
      content:
        "Vor jedem Aufbruch Leitungen orten und mit der Spartenauskunft vergleichen. Im Gehweg Grabentiefe 60 cm, Rohrverband einsanden, Trassenwarnband ca. 30 cm darüber. Fremdleitungen von Hand freilegen. Gräben abends abdecken oder schließen, Fußgängerbrücken an Einfahrten. Route offen einmessen (GNSS, Punkte max. alle 20 m).",
    },
  ],
};
