// Fictitious demo data. Every name, address, phone number and plate below is
// invented. Coordinates lie in a real German city only so the maps look real.

import type { AssistantLanguage, BaustelleType, MachineCategory, WorkerLevel } from "../src/generated/prisma/client";

export const DEMO_COMPANY = {
  legalName: "Baumdienst Musterstadt GmbH",
  displayName: "Baumdienst Musterstadt GmbH",
  vatId: "DE000000000",
  phone: "+49 1234 567890",
  email: "info@baumdienst-musterstadt.example",
  street: "Musterstraße 12",
  zip: "12345",
  city: "Musterstadt",
} as const;

// Owns seeded plans, tasks and logs. Never active, has no password, so it
// cannot sign in.
export const SEED_SYSTEM_USER = {
  email: "seed@baumdienst-musterstadt.example",
  name: "Demo-Daten",
} as const;

export const LABOR_ROLES = [
  { name: "Helfer", grossHourlyCents: 1650, employerOverheadPct: "0.28", productivityPct: "0.80", sortOrder: 10 },
  { name: "Facharbeiter", grossHourlyCents: 2150, employerOverheadPct: "0.30", productivityPct: "0.85", sortOrder: 20 },
  { name: "Vorarbeiter", grossHourlyCents: 2550, employerOverheadPct: "0.32", productivityPct: "0.88", sortOrder: 30 },
  { name: "Kletterer", grossHourlyCents: 2850, employerOverheadPct: "0.34", productivityPct: "0.90", sortOrder: 40 },
  { name: "Maschinist", grossHourlyCents: 2450, employerOverheadPct: "0.30", productivityPct: "0.87", sortOrder: 50 },
] as const;

export type DemoMachine = {
  key: string;
  name: string;
  category: MachineCategory;
  hourlyRateCents: number;
  dayRateCents: number | null;
  model: string;
  targe: string | null;
  coneTotal: number;
};

export const MACHINES: DemoMachine[] = [
  { key: "chipper", name: "Häcksler", category: "CHIPPER", hourlyRateCents: 6500, dayRateCents: 42000, model: "Scheibenradhacker 200", targe: "MU-BD 201", coneTotal: 0 },
  { key: "truck", name: "LKW 7,5 t", category: "TRUCK", hourlyRateCents: 4500, dayRateCents: 32000, model: "Kipper 7,5 t", targe: "MU-BD 101", coneTotal: 12 },
  { key: "platform", name: "Hubarbeitsbühne 27 m", category: "AWP", hourlyRateCents: 9800, dayRateCents: 65000, model: "LKW-Bühne 27 m", targe: "MU-BD 301", coneTotal: 8 },
  { key: "crane", name: "Kran-LKW", category: "TRUCK", hourlyRateCents: 11500, dayRateCents: 78000, model: "Ladekran 25 mt", targe: "MU-BD 401", coneTotal: 10 },
  { key: "saw", name: "Motorsägen-Set", category: "CHAINSAW", hourlyRateCents: 1200, dayRateCents: null, model: "3 Sägen, 1 Stangensäge", targe: null, coneTotal: 0 },
];

export type DemoWorker = {
  key: string;
  firstName: string;
  lastName: string;
  position: string;
  level: WorkerLevel;
  language: AssistantLanguage;
  licenses: string;
  availability?: "AVAILABLE" | "SICK" | "VACATION";
  startedYear: number;
};

export const WORKERS: DemoWorker[] = [
  { key: "jonas", firstName: "Jonas", lastName: "Becker", position: "Vorarbeiter", level: "VORARBEITER", language: "DE", licenses: "C1E, SKT-B", startedYear: 2016 },
  { key: "arben", firstName: "Arben", lastName: "Berisha", position: "Baumkletterer", level: "SENIOR", language: "SQ", licenses: "B, SKT-B", startedYear: 2018 },
  { key: "lena", firstName: "Lena", lastName: "Hoffmann", position: "Baumpflegerin", level: "WORKER", language: "DE", licenses: "B, SKT-A", startedYear: 2021 },
  { key: "tomasz", firstName: "Tomasz", lastName: "Kowalski", position: "Maschinist", level: "SENIOR", language: "PL", licenses: "CE, Kran", startedYear: 2017 },
  { key: "marco", firstName: "Marco", lastName: "Ferri", position: "Baumkletterer", level: "WORKER", language: "IT", licenses: "B, SKT-B", startedYear: 2020 },
  { key: "ioana", firstName: "Ioana", lastName: "Dumitru", position: "Baumpflegerin", level: "WORKER", language: "RO", licenses: "B", startedYear: 2022, availability: "VACATION" },
  { key: "felix", firstName: "Felix", lastName: "Wagner", position: "Helfer", level: "JUNIOR", language: "DE", licenses: "B", startedYear: 2024, availability: "SICK" },
  { key: "dritan", firstName: "Dritan", lastName: "Hoxha", position: "Fahrer / Helfer", level: "WORKER", language: "SQ", licenses: "CE", startedYear: 2019 },
];

type LatLng = { lat: number; lng: number };

export type DemoSite = {
  key: string;
  name: string;
  type: BaustelleType;
  address: string;
  description: string;
  documents: string[];
  // Trees are spread along this polyline (an avenue, a park path).
  path: LatLng[];
  treeCount: number;
  treePrefix: string;
  species: readonly string[];
  doneShare: number;
  crew: string[];
  machines: string[];
  tasks: string[];
};

export const SITES: DemoSite[] = [
  {
    key: "allee",
    name: "Lindenallee – Verkehrssicherung",
    type: "TRUCK_PLATFORM",
    address: "Lindenallee 1–80, 12345 Musterstadt",
    description: "Totholzentfernung und Lichtraumprofil über der Fahrbahn. Halbseitige Sperrung mit Ampel.",
    documents: ["verkehrsrechtliche-anordnung.pdf", "baumkataster-lindenallee.pdf"],
    path: [
      { lat: 51.31762, lng: 9.47402 },
      { lat: 51.31571, lng: 9.47911 },
      { lat: 51.31392, lng: 9.48403 },
    ],
    treeCount: 56,
    treePrefix: "LA",
    species: ["Winterlinde", "Sommerlinde", "Spitzahorn"],
    doneShare: 0.55,
    crew: ["jonas", "lena", "dritan"],
    machines: ["platform", "truck", "chipper"],
    tasks: ["Ampelanlage am Abend zurückbauen", "Anwohner Hausnr. 42 wegen Einfahrt informieren"],
  },
  {
    key: "park",
    name: "Stadtpark – Pflegeschnitt",
    type: "CLIMBING",
    address: "Am Stadtpark, 12345 Musterstadt",
    description: "Kronenpflege und Kronensicherung an Altbäumen entlang der Hauptwege. Wege abschnittweise gesperrt.",
    documents: ["leistungsverzeichnis-stadtpark.pdf", "sicherheitsplan.pdf"],
    path: [
      { lat: 51.30961, lng: 9.49012 },
      { lat: 51.31102, lng: 9.49388 },
      { lat: 51.30894, lng: 9.49702 },
      { lat: 51.30702, lng: 9.49421 },
    ],
    treeCount: 52,
    treePrefix: "SP",
    species: ["Stieleiche", "Rotbuche", "Bergahorn", "Platane", "Esche"],
    doneShare: 0.3,
    crew: ["arben", "marco"],
    machines: ["saw"],
    tasks: ["Absperrbaken an Weg C nachstellen"],
  },
  {
    key: "friedhof",
    name: "Friedhof Nord – Fällungen",
    type: "TRUCK_CRANE",
    address: "Nordfriedhof, Friedhofsweg 3, 12345 Musterstadt",
    description: "Fällung abgestorbener Fichten mit Kran-LKW. Arbeiten nur außerhalb von Beisetzungen.",
    documents: ["faellgenehmigung.pdf", "lageplan-friedhof.pdf"],
    path: [
      { lat: 51.32511, lng: 9.46602 },
      { lat: 51.32622, lng: 9.46903 },
      { lat: 51.32498, lng: 9.47188 },
    ],
    treeCount: 44,
    treePrefix: "FN",
    species: ["Fichte", "Fichte", "Kiefer", "Birke", "Lärche"],
    doneShare: 0.2,
    crew: ["tomasz"],
    machines: ["crane"],
    tasks: ["Beisetzung 11:00 Uhr – Arbeiten in Feld 4 pausieren"],
  },
];

export const BLOCKED_NOTES = [
  "Vogelnest entdeckt – Freigabe durch Naturschutz abwarten.",
  "Leitung im Kronenbereich – Netzbetreiber informiert.",
  "Zufahrt zugeparkt – morgen erneut anfahren.",
] as const;

export const ANNOUNCEMENT =
  "Willkommen in der Demo! Alle Firmen, Personen und Baustellen sind frei erfunden.";
