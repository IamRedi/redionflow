import { prisma } from "@/lib/db/prisma";
import { createStoredZip } from "@/lib/export/zip";

type ExportLang = "de" | "en" | "it" | "pl" | "ro" | "sq";

const EXPORT_TEXT = {
  de: {
    reportTitle: "Baustellenbericht",
    readmeIntro: "Diese Exportdatei enthaelt nur die zwei gewuenschten Bereiche:",
    readmeFiles: "Dateien im Ordner report:",
    generatedAt: "Stand",
    overviewIntro: (name: string) => `Zusammenfassung der Baustelle ${name} fuer Verwaltung und Ablage.`,
    masterData: "Stammdaten",
    name: "Name",
    status: "Status",
    type: "Typ",
    address: "Adresse",
    description: "Beschreibung",
    treesTotal: "Baeume gesamt",
    done: "Erledigt",
    blocked: "Blockiert",
    open: "Offen",
    treeList: "Baumliste",
    treeListIntro: "Lesbare Baumliste mit Status, Massnahme und Notizen.",
    tree: "Baum",
    species: "Art",
    diameter: "Durchmesser",
    completedBy: "Ausgefuehrt von",
    branches: "Aeste",
    extraWork: "Extra Arbeit",
    action: "Massnahme",
    note: "Notiz",
    notes: "Notizen",
    notesIntro: "Erfasste Baustellen-Notizen und deren Erledigungsstand.",
    created: "Erstellt",
    from: "Von",
    worker: "Mitarbeiter",
    doneBy: "Erledigt von",
    dailyLog: "Tagesprotokoll",
    dailyLogIntro: "Erfasste Tagesprotokolle der Baustelle.",
    date: "Datum",
    start: "Beginn",
    end: "Ende",
    break: "Pause",
    movements: "Bewegungen",
    movementsIntro: "Material- und Konenbewegungen dieser Baustelle.",
    siteMaterial: "Baustellenmaterial",
    time: "Zeit",
    category: "Kategorie",
    quantity: "Menge",
    actor: "Akteur",
    coneMovements: "Konenbewegungen",
    fromMachine: "Von Maschine",
    toMachine: "Zu Maschine",
    noParking: "Halteverbot",
    yes: "Ja",
    no: "Nein",
  },
  en: {
    reportTitle: "Site report",
    readmeIntro: "This export file contains only the two requested areas:",
    readmeFiles: "Files in the report folder:",
    generatedAt: "Generated",
    overviewIntro: (name: string) => `Summary of site ${name} for management and archiving.`,
    masterData: "Master data",
    name: "Name",
    status: "Status",
    type: "Type",
    address: "Address",
    description: "Description",
    treesTotal: "Total trees",
    done: "Done",
    blocked: "Blocked",
    open: "Open",
    treeList: "Tree list",
    treeListIntro: "Readable tree list with status, action and notes.",
    tree: "Tree",
    species: "Species",
    diameter: "Diameter",
    completedBy: "Completed by",
    branches: "Branches",
    extraWork: "Extra work",
    action: "Action",
    note: "Note",
    notes: "Notes",
    notesIntro: "Recorded site notes and their completion status.",
    created: "Created",
    from: "From",
    worker: "Worker",
    doneBy: "Done by",
    dailyLog: "Daily log",
    dailyLogIntro: "Recorded daily logs for this site.",
    date: "Date",
    start: "Start",
    end: "End",
    break: "Break",
    movements: "Movements",
    movementsIntro: "Material and cone movements for this site.",
    siteMaterial: "Site material",
    time: "Time",
    category: "Category",
    quantity: "Quantity",
    actor: "Actor",
    coneMovements: "Cone movements",
    fromMachine: "From machine",
    toMachine: "To machine",
    noParking: "No-parking",
    yes: "Yes",
    no: "No",
  },
  it: {
    reportTitle: "Report cantiere",
    readmeIntro: "Questo export contiene solo le due aree richieste:",
    readmeFiles: "File nella cartella report:",
    generatedAt: "Generato",
    overviewIntro: (name: string) => `Riepilogo del cantiere ${name} per gestione e archivio.`,
    masterData: "Dati principali",
    name: "Nome",
    status: "Stato",
    type: "Tipo",
    address: "Indirizzo",
    description: "Descrizione",
    treesTotal: "Alberi totali",
    done: "Completati",
    blocked: "Bloccati",
    open: "Aperti",
    treeList: "Lista alberi",
    treeListIntro: "Lista alberi leggibile con stato, intervento e note.",
    tree: "Albero",
    species: "Specie",
    diameter: "Diametro",
    completedBy: "Eseguito da",
    branches: "Rami",
    extraWork: "Lavoro extra",
    action: "Intervento",
    note: "Nota",
    notes: "Note",
    notesIntro: "Note registrate del cantiere e relativo stato.",
    created: "Creato",
    from: "Da",
    worker: "Lavoratore",
    doneBy: "Completato da",
    dailyLog: "Protocollo giornaliero",
    dailyLogIntro: "Protocolli giornalieri registrati per il cantiere.",
    date: "Data",
    start: "Inizio",
    end: "Fine",
    break: "Pausa",
    movements: "Movimenti",
    movementsIntro: "Movimenti di materiale e coni per questo cantiere.",
    siteMaterial: "Materiale cantiere",
    time: "Ora",
    category: "Categoria",
    quantity: "Quantita",
    actor: "Attore",
    coneMovements: "Movimenti coni",
    fromMachine: "Da macchina",
    toMachine: "A macchina",
    noParking: "Divieto di sosta",
    yes: "Si",
    no: "No",
  },
  pl: {
    reportTitle: "Raport miejsca pracy",
    readmeIntro: "Ten eksport zawiera tylko dwa wymagane obszary:",
    readmeFiles: "Pliki w folderze report:",
    generatedAt: "Wygenerowano",
    overviewIntro: (name: string) => `Podsumowanie miejsca pracy ${name} dla zarzadzania i archiwum.`,
    masterData: "Dane podstawowe",
    name: "Nazwa",
    status: "Status",
    type: "Typ",
    address: "Adres",
    description: "Opis",
    treesTotal: "Drzewa lacznie",
    done: "Zrobione",
    blocked: "Zablokowane",
    open: "Otwarte",
    treeList: "Lista drzew",
    treeListIntro: "Czytelna lista drzew ze statusem, czynnoscia i notatkami.",
    tree: "Drzewo",
    species: "Gatunek",
    diameter: "Srednica",
    completedBy: "Wykonane przez",
    branches: "Galezie",
    extraWork: "Praca dodatkowa",
    action: "Czynnosc",
    note: "Notatka",
    notes: "Notatki",
    notesIntro: "Zapisane notatki miejsca pracy i ich status wykonania.",
    created: "Utworzono",
    from: "Od",
    worker: "Pracownik",
    doneBy: "Zrobione przez",
    dailyLog: "Protokol dzienny",
    dailyLogIntro: "Zapisane protokoly dzienne dla tego miejsca pracy.",
    date: "Data",
    start: "Start",
    end: "Koniec",
    break: "Przerwa",
    movements: "Ruchy",
    movementsIntro: "Ruchy materialow i slupkow dla tego miejsca pracy.",
    siteMaterial: "Material miejsca pracy",
    time: "Czas",
    category: "Kategoria",
    quantity: "Ilosc",
    actor: "Osoba",
    coneMovements: "Ruchy slupkow",
    fromMachine: "Z maszyny",
    toMachine: "Do maszyny",
    noParking: "Zakaz parkowania",
    yes: "Tak",
    no: "Nie",
  },
  ro: {
    reportTitle: "Raport santier",
    readmeIntro: "Acest export contine doar cele doua zone solicitate:",
    readmeFiles: "Fisiere in folderul report:",
    generatedAt: "Generat",
    overviewIntro: (name: string) => `Rezumatul santierului ${name} pentru administrare si arhiva.`,
    masterData: "Date principale",
    name: "Nume",
    status: "Status",
    type: "Tip",
    address: "Adresa",
    description: "Descriere",
    treesTotal: "Arbori total",
    done: "Finalizat",
    blocked: "Blocat",
    open: "Deschis",
    treeList: "Lista arbori",
    treeListIntro: "Lista lizibila de arbori cu status, actiune si notite.",
    tree: "Arbore",
    species: "Specie",
    diameter: "Diametru",
    completedBy: "Executat de",
    branches: "Ramuri",
    extraWork: "Munca extra",
    action: "Actiune",
    note: "Notita",
    notes: "Notite",
    notesIntro: "Notitele inregistrate ale santierului si statusul lor.",
    created: "Creat",
    from: "De la",
    worker: "Worker",
    doneBy: "Finalizat de",
    dailyLog: "Protocol zilnic",
    dailyLogIntro: "Protocoalele zilnice inregistrate pentru acest santier.",
    date: "Data",
    start: "Start",
    end: "Sfarsit",
    break: "Pauza",
    movements: "Miscari",
    movementsIntro: "Miscari de materiale si conuri pentru acest santier.",
    siteMaterial: "Material santier",
    time: "Ora",
    category: "Categorie",
    quantity: "Cantitate",
    actor: "Actor",
    coneMovements: "Miscari conuri",
    fromMachine: "De la masina",
    toMachine: "La masina",
    noParking: "Interzis parcatul",
    yes: "Da",
    no: "Nu",
  },
  sq: {
    reportTitle: "Raport kantieri",
    readmeIntro: "Ky export permban vetem dy zonat e kerkuara:",
    readmeFiles: "File ne dosjen report:",
    generatedAt: "Gjeneruar",
    overviewIntro: (name: string) => `Permbledhje e kantierit ${name} per menaxhim dhe arkivim.`,
    masterData: "Te dhenat baze",
    name: "Emri",
    status: "Statusi",
    type: "Lloji",
    address: "Adresa",
    description: "Pershkrimi",
    treesTotal: "Drunj gjithsej",
    done: "Te perfunduara",
    blocked: "Te bllokuara",
    open: "Te hapura",
    treeList: "Lista e drunjve",
    treeListIntro: "Liste e lexueshme me status, mase dhe shenime.",
    tree: "Dru",
    species: "Lloji",
    diameter: "Diametri",
    completedBy: "Kryer nga",
    branches: "Dege",
    extraWork: "Pune shtese",
    action: "Masa",
    note: "Shenim",
    notes: "Shenime",
    notesIntro: "Shenimet e regjistruara te kantierit dhe statusi i kryerjes.",
    created: "Krijuar",
    from: "Nga",
    worker: "Punonjes",
    doneBy: "Kryer nga",
    dailyLog: "Protokoll ditor",
    dailyLogIntro: "Protokollet ditore te regjistruara per kantierin.",
    date: "Data",
    start: "Fillimi",
    end: "Fundi",
    break: "Pushim",
    movements: "Levizje",
    movementsIntro: "Levizjet e materialit dhe koneve per kete kantier.",
    siteMaterial: "Material kantieri",
    time: "Ora",
    category: "Kategoria",
    quantity: "Sasia",
    actor: "Aktori",
    coneMovements: "Levizje konash",
    fromMachine: "Nga makineria",
    toMachine: "Te makineria",
    noParking: "Ndalim parkimi",
    yes: "Po",
    no: "Jo",
  },
} as const;

function normalizeExportLang(lang?: string): ExportLang {
  return lang === "en" || lang === "it" || lang === "pl" || lang === "ro" || lang === "sq" ? lang : "de";
}

function localeForExport(lang: ExportLang) {
  const locales: Record<ExportLang, string> = {
    de: "de-DE",
    en: "en",
    it: "it",
    pl: "pl",
    ro: "ro",
    sq: "sq",
  };
  return locales[lang];
}

function sanitizeSegment(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "baustelle"
  );
}

function asText(data: string) {
  return Buffer.from(data, "utf8");
}

function formatDateTime(value: Date | null | undefined, lang: ExportLang) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(localeForExport(lang), {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatDate(value: Date | null | undefined, lang: ExportLang) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(localeForExport(lang), {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function coordsFromJson(value: unknown) {
  const row = value as Record<string, unknown> | null;
  if (!row || typeof row !== "object") return { lat: null, lng: null };
  const lat =
    typeof row.lat === "number" ? row.lat : typeof row.latitude === "number" ? row.latitude : null;
  const lng =
    typeof row.lng === "number" ? row.lng : typeof row.longitude === "number" ? row.longitude : null;
  return { lat, lng };
}

function displayWorkerName(worker: { firstName: string; lastName: string } | null | undefined) {
  if (!worker) return "-";
  return `${worker.firstName} ${worker.lastName}`.trim();
}

function displayAdminName(admin: { name: string | null; email: string } | null | undefined) {
  if (!admin) return "-";
  return admin.name?.trim() || admin.email;
}

function actorLabel(
  actorRole: string | null | undefined,
  actorName: string | null | undefined,
  worker: { firstName: string; lastName: string } | null | undefined,
  admin: { name: string | null; email: string } | null | undefined,
) {
  if (actorName?.trim()) return actorName.trim();
  if (actorRole === "ADMIN") return displayAdminName(admin);
  if (worker) return displayWorkerName(worker);
  return actorRole ?? "-";
}

function treeStatusLabel(status: string, text: (typeof EXPORT_TEXT)[ExportLang]) {
  if (status === "done") return text.done;
  if (status === "blocked") return text.blocked;
  return text.open;
}

function parseTreeMeta(notes: string | null) {
  if (!notes) {
    return {
      note: "",
      haltverbot: false,
      action: "",
      branchCutsOver10: "",
      branchCutsOver20: "",
      branchCutsOver30: "",
      extraWork: "",
    };
  }

  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    return {
      note: typeof parsed.note === "string" ? parsed.note : "",
      haltverbot: Boolean(parsed.haltverbot),
      action:
        typeof parsed.action === "string"
          ? parsed.action
          : typeof parsed.massnahme === "string"
            ? parsed.massnahme
          : typeof parsed.task === "string"
              ? parsed.task
              : "",
      branchCutsOver10:
        typeof parsed.branchCutsOver10 === "number" || typeof parsed.branchCutsOver10 === "string"
          ? String(parsed.branchCutsOver10)
          : typeof parsed.asteOver10 === "number" || typeof parsed.asteOver10 === "string"
            ? String(parsed.asteOver10)
            : "",
      branchCutsOver20:
        typeof parsed.branchCutsOver20 === "number" || typeof parsed.branchCutsOver20 === "string"
          ? String(parsed.branchCutsOver20)
          : typeof parsed.asteOver20 === "number" || typeof parsed.asteOver20 === "string"
            ? String(parsed.asteOver20)
            : "",
      branchCutsOver30:
        typeof parsed.branchCutsOver30 === "number" || typeof parsed.branchCutsOver30 === "string"
          ? String(parsed.branchCutsOver30)
          : typeof parsed.asteOver30 === "number" || typeof parsed.asteOver30 === "string"
            ? String(parsed.asteOver30)
            : "",
      extraWork:
        parsed.extraWork === "25% +" ||
        parsed.extraWork === "50% +" ||
        parsed.extraWork === "75% +" ||
        parsed.extraWork === "100% +"
          ? parsed.extraWork
          : parsed.extraWork === "25%" ||
              parsed.extraWork === "50%" ||
              parsed.extraWork === "75%" ||
              parsed.extraWork === "100%"
            ? `${parsed.extraWork} +`
            : "",
    };
  } catch {
    return {
      note: notes,
      haltverbot: false,
      action: "",
      branchCutsOver10: "",
      branchCutsOver20: "",
      branchCutsOver30: "",
      extraWork: "",
    };
  }
}

function htmlDocument(lang: ExportLang, title: string, intro: string, body: string) {
  return `<!doctype html>
<html lang="${htmlEscape(lang)}">
  <head>
    <meta charset="utf-8" />
    <title>${htmlEscape(title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", Arial, sans-serif;
      }
      body {
        margin: 28px;
        color: #1f2937;
        background: #ffffff;
      }
      h1, h2 {
        margin: 0 0 12px;
        color: #111827;
      }
      h1 {
        font-size: 24px;
      }
      h2 {
        margin-top: 28px;
        font-size: 18px;
      }
      p, li {
        font-size: 14px;
        line-height: 1.6;
      }
      .meta {
        margin-bottom: 20px;
        padding: 14px 16px;
        border: 1px solid #d1d5db;
        border-radius: 14px;
        background: #f9fafb;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 12px;
        font-size: 13px;
      }
      th, td {
        border: 1px solid #d1d5db;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #f3f4f6;
        font-weight: 700;
      }
      .status {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
      }
      .status-offen { background: #fef3c7; color: #92400e; }
      .status-erledigt { background: #dcfce7; color: #166534; }
      .status-blockiert { background: #fee2e2; color: #991b1b; }
      .col-tight {
        width: 56px;
        text-align: center;
      }
      .col-worker {
        width: 150px;
      }
      .col-extra {
        width: 90px;
        text-align: center;
      }
      @media print {
        body {
          margin: 12mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="meta">
      <h1>${htmlEscape(title)}</h1>
      <p>${htmlEscape(intro)}</p>
    </div>
    ${body}
  </body>
</html>`;
}

function buildTreeKml(
  baustelle: {
    name: string;
    address: string | null;
    coordinates: unknown;
    treeItems: Array<{
      treeId: string;
      status: string;
      species: string | null;
      diameter: number | null;
      coordinates: unknown;
      notes: string | null;
    }>;
  },
  text: (typeof EXPORT_TEXT)[ExportLang],
) {
  const siteCoords = coordsFromJson(baustelle.coordinates);
  const placemarks = baustelle.treeItems
    .map((tree) => {
      const coords = coordsFromJson(tree.coordinates);
      if (coords.lat == null || coords.lng == null) return "";
      const meta = parseTreeMeta(tree.notes);
      const description = [
        `${text.tree}: ${tree.treeId}`,
        `${text.status}: ${treeStatusLabel(tree.status, text)}`,
        `${text.species}: ${tree.species ?? "-"}`,
        `${text.diameter}: ${tree.diameter ?? "-"}`,
        `${text.action}: ${meta.action || "-"}`,
        `${text.note}: ${meta.note || "-"}`,
        `${text.noParking}: ${meta.haltverbot ? text.yes : text.no}`,
      ].join("\n");

      return `
    <Placemark>
      <name>${xmlEscape(tree.treeId)}</name>
      <styleUrl>#${xmlEscape(tree.status)}</styleUrl>
      <description>${xmlEscape(description)}</description>
      <Point>
        <coordinates>${coords.lng},${coords.lat},0</coordinates>
      </Point>
    </Placemark>`;
    })
    .join("");

  const sitePlacemark =
    siteCoords.lat != null && siteCoords.lng != null
      ? `
    <Placemark>
      <name>${xmlEscape(baustelle.name)}</name>
      <styleUrl>#baustelle</styleUrl>
      <description>${xmlEscape(baustelle.address ?? "")}</description>
      <Point>
        <coordinates>${siteCoords.lng},${siteCoords.lat},0</coordinates>
      </Point>
    </Placemark>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xmlEscape(baustelle.name)}</name>
    <Style id="todo"><IconStyle><color>ff08b3ea</color><scale>1.1</scale></IconStyle></Style>
    <Style id="done"><IconStyle><color>ff55c522</color><scale>1.1</scale></IconStyle></Style>
    <Style id="blocked"><IconStyle><color>ff4444ef</color><scale>1.1</scale></IconStyle></Style>
    <Style id="baustelle"><IconStyle><color>ffc084fc</color><scale>1.25</scale></IconStyle></Style>
    ${sitePlacemark}
    ${placemarks}
  </Document>
</kml>`;
}

export async function buildBaustelleExportZip(baustelleId: string, companyProfileId: string, lang?: string) {
  const exportLang = normalizeExportLang(lang);
  const text = EXPORT_TEXT[exportLang];
  const baustelle = await prisma.baustelle.findFirst({
    where: { id: baustelleId, companyProfileId },
    include: {
      treeItems: {
        orderBy: [{ status: "asc" }, { treeId: "asc" }],
        include: {
          completedByWorker: { select: { firstName: true, lastName: true } },
        },
      },
      manualTasks: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          worker: { select: { id: true, firstName: true, lastName: true } },
          resolvedByUser: { select: { id: true, name: true, email: true } },
          resolvedByWorker: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      workLogs: {
        orderBy: { date: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      inventoryMovements: {
        orderBy: { timestamp: "asc" },
        include: {
          worker: { select: { id: true, firstName: true, lastName: true } },
          actorAdmin: { select: { id: true, name: true, email: true } },
          treeItem: { select: { id: true, treeId: true } },
        },
      },
      coneMovements: {
        orderBy: { createdAt: "asc" },
        include: {
          fromMachine: { select: { id: true, name: true, nickname: true } },
          toMachine: { select: { id: true, name: true, nickname: true } },
          treeItem: { select: { id: true, treeId: true } },
          actorWorker: { select: { id: true, firstName: true, lastName: true } },
          actorAdmin: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!baustelle) return null;

  const archiveRoot = `${sanitizeSegment(baustelle.name)}-${sanitizeSegment(baustelle.id)}`;
  const normalizedTrees = baustelle.treeItems.map((tree) => {
    const meta = parseTreeMeta(tree.notes);
    return {
      treeId: tree.treeId,
      status: tree.status,
      statusLabel: treeStatusLabel(tree.status, text),
      species: tree.species ?? "-",
      diameter: tree.diameter ?? "-",
      action: meta.action || "-",
      note: meta.note || "-",
      branchCutsOver10: meta.branchCutsOver10,
      branchCutsOver20: meta.branchCutsOver20,
      branchCutsOver30: meta.branchCutsOver30,
      extraWork: meta.extraWork,
      completedByWorker: tree.completedByWorker ? displayWorkerName(tree.completedByWorker) : "",
    };
  });

  const reportReadme = [
    text.reportTitle,
    ``,
    text.readmeIntro,
    `- map/tree-markers.kml`,
    `- report/*`,
    ``,
    text.readmeFiles,
    `- README.txt`,
    `- uebersicht.html`,
    `- baumliste.html`,
    `- notizen.html`,
    `- tagesprotokoll.html`,
    `- bewegungen.html`,
    ``,
    `${text.generatedAt}: ${formatDateTime(new Date(), exportLang)}`,
  ].join("\n");

  const overviewHtml = htmlDocument(
    exportLang,
    `${text.reportTitle} - ${baustelle.name}`,
    text.overviewIntro(baustelle.name),
    `
      <h2>${htmlEscape(text.masterData)}</h2>
      <table>
        <tbody>
          <tr><th>${htmlEscape(text.name)}</th><td>${htmlEscape(baustelle.name)}</td></tr>
          <tr><th>ID</th><td>${htmlEscape(baustelle.id)}</td></tr>
          <tr><th>${htmlEscape(text.status)}</th><td>${htmlEscape(baustelle.status)}</td></tr>
          <tr><th>${htmlEscape(text.type)}</th><td>${htmlEscape(baustelle.type)}</td></tr>
          <tr><th>${htmlEscape(text.address)}</th><td>${htmlEscape(baustelle.address ?? "-")}</td></tr>
          <tr><th>${htmlEscape(text.description)}</th><td>${htmlEscape(baustelle.description ?? "-")}</td></tr>
          <tr><th>${htmlEscape(text.treesTotal)}</th><td>${baustelle.treeItems.length}</td></tr>
          <tr><th>${htmlEscape(text.done)}</th><td>${baustelle.treeItems.filter((tree) => tree.status === "done").length}</td></tr>
          <tr><th>${htmlEscape(text.blocked)}</th><td>${baustelle.treeItems.filter((tree) => tree.status === "blocked").length}</td></tr>
          <tr><th>${htmlEscape(text.open)}</th><td>${baustelle.treeItems.filter((tree) => tree.status === "todo").length}</td></tr>
        </tbody>
      </table>
    `,
  );

  const treeListHtml = htmlDocument(
    exportLang,
    `${text.treeList} - ${baustelle.name}`,
    text.treeListIntro,
    `
      <table>
        <thead>
          <tr>
            <th rowspan="2">${htmlEscape(text.tree)}</th>
            <th rowspan="2">${htmlEscape(text.status)}</th>
            <th rowspan="2">${htmlEscape(text.species)}</th>
            <th rowspan="2">${htmlEscape(text.diameter)}</th>
            <th rowspan="2" class="col-worker">${htmlEscape(text.completedBy)}</th>
            <th colspan="3">${htmlEscape(text.branches)} ⌀</th>
            <th rowspan="2" class="col-extra">${htmlEscape(text.extraWork)}</th>
            <th rowspan="2">${htmlEscape(text.action)}</th>
            <th rowspan="2">${htmlEscape(text.note)}</th>
          </tr>
          <tr>
            <th class="col-tight">&gt;10cm</th>
            <th class="col-tight">&gt;20cm</th>
            <th class="col-tight">&gt;30cm</th>
          </tr>
        </thead>
        <tbody>
          ${normalizedTrees
            .map((tree) => {
              const statusClass =
                tree.status === "done"
                  ? "status-erledigt"
                  : tree.status === "blocked"
                    ? "status-blockiert"
                    : "status-offen";
              return `
                <tr>
                  <td>${htmlEscape(tree.treeId)}</td>
                  <td><span class="status ${statusClass}">${htmlEscape(tree.statusLabel)}</span></td>
                  <td>${htmlEscape(tree.species)}</td>
                  <td>${htmlEscape(tree.diameter)}</td>
                  <td>${htmlEscape(tree.completedByWorker || "-")}</td>
                  <td class="col-tight">${htmlEscape(tree.branchCutsOver10 || "")}</td>
                  <td class="col-tight">${htmlEscape(tree.branchCutsOver20 || "")}</td>
                  <td class="col-tight">${htmlEscape(tree.branchCutsOver30 || "")}</td>
                  <td class="col-extra">${htmlEscape(tree.extraWork || "")}</td>
                  <td>${htmlEscape(tree.action)}</td>
                  <td>${htmlEscape(tree.note)}</td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    `,
  );

  const notesHtml = htmlDocument(
    exportLang,
    `${text.notes} - ${baustelle.name}`,
    text.notesIntro,
    `
      <table>
        <thead>
          <tr>
            <th>${htmlEscape(text.created)}</th>
            <th>${htmlEscape(text.description)}</th>
            <th>${htmlEscape(text.from)}</th>
            <th>${htmlEscape(text.worker)}</th>
            <th>${htmlEscape(text.done)}</th>
            <th>${htmlEscape(text.doneBy)}</th>
          </tr>
        </thead>
        <tbody>
          ${baustelle.manualTasks
            .map(
              (task) => `
                <tr>
                  <td>${htmlEscape(formatDateTime(task.createdAt, exportLang))}</td>
                  <td>${htmlEscape(task.description)}</td>
                  <td>${htmlEscape(displayAdminName(task.user))}</td>
                  <td>${htmlEscape(displayWorkerName(task.worker))}</td>
                  <td>${htmlEscape(formatDateTime(task.resolvedAt, exportLang))}</td>
                  <td>${htmlEscape(
                    displayAdminName(task.resolvedByUser) !== "-"
                      ? displayAdminName(task.resolvedByUser)
                      : displayWorkerName(task.resolvedByWorker),
                  )}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    `,
  );

  const logsHtml = htmlDocument(
    exportLang,
    `${text.dailyLog} - ${baustelle.name}`,
    text.dailyLogIntro,
    `
      <table>
        <thead>
          <tr>
            <th>${htmlEscape(text.date)}</th>
            <th>${htmlEscape(text.start)}</th>
            <th>${htmlEscape(text.end)}</th>
            <th>${htmlEscape(text.break)}</th>
            <th>Admin</th>
            <th>${htmlEscape(text.note)}</th>
          </tr>
        </thead>
        <tbody>
          ${baustelle.workLogs
            .map(
              (log) => `
                <tr>
                  <td>${htmlEscape(formatDate(log.date, exportLang))}</td>
                  <td>${htmlEscape(formatDateTime(log.startTime, exportLang))}</td>
                  <td>${htmlEscape(formatDateTime(log.endTime, exportLang))}</td>
                  <td>${log.breakMinutes} min</td>
                  <td>${htmlEscape(displayAdminName(log.user))}</td>
                  <td>${htmlEscape(log.notes ?? "-")}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    `,
  );

  const movementsHtml = htmlDocument(
    exportLang,
    `${text.movements} - ${baustelle.name}`,
    text.movementsIntro,
    `
      <h2>${htmlEscape(text.siteMaterial)}</h2>
      <table>
        <thead>
          <tr>
            <th>${htmlEscape(text.time)}</th>
            <th>${htmlEscape(text.type)}</th>
            <th>${htmlEscape(text.category)}</th>
            <th>${htmlEscape(text.quantity)}</th>
            <th>${htmlEscape(text.tree)}</th>
            <th>${htmlEscape(text.actor)}</th>
            <th>${htmlEscape(text.note)}</th>
          </tr>
        </thead>
        <tbody>
          ${baustelle.inventoryMovements
            .map(
              (row) => `
                <tr>
                  <td>${htmlEscape(formatDateTime(row.timestamp, exportLang))}</td>
                  <td>${htmlEscape(row.type)}</td>
                  <td>${htmlEscape(row.category)}</td>
                  <td>${row.quantity}</td>
                  <td>${htmlEscape(row.treeItem?.treeId ?? "-")}</td>
                  <td>${htmlEscape(actorLabel(row.actorRole, row.actorName, row.worker, row.actorAdmin))}</td>
                  <td>${htmlEscape(row.note ?? "-")}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <h2>${htmlEscape(text.coneMovements)}</h2>
      <table>
        <thead>
          <tr>
            <th>${htmlEscape(text.time)}</th>
            <th>${htmlEscape(text.type)}</th>
            <th>${htmlEscape(text.quantity)}</th>
            <th>${htmlEscape(text.fromMachine)}</th>
            <th>${htmlEscape(text.toMachine)}</th>
            <th>${htmlEscape(text.tree)}</th>
            <th>${htmlEscape(text.actor)}</th>
            <th>${htmlEscape(text.note)}</th>
          </tr>
        </thead>
        <tbody>
          ${baustelle.coneMovements
            .map(
              (row) => `
                <tr>
                  <td>${htmlEscape(formatDateTime(row.createdAt, exportLang))}</td>
                  <td>${htmlEscape(row.type)}</td>
                  <td>${row.quantity}</td>
                  <td>${htmlEscape(row.fromMachine?.nickname || row.fromMachine?.name || "-")}</td>
                  <td>${htmlEscape(row.toMachine?.nickname || row.toMachine?.name || "-")}</td>
                  <td>${htmlEscape(row.treeItem?.treeId ?? "-")}</td>
                  <td>${htmlEscape(actorLabel(row.actorRole, row.actorName, row.actorWorker, row.actorAdmin))}</td>
                  <td>${htmlEscape(row.note ?? "-")}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    `,
  );

  const entries = [
    {
      name: `${archiveRoot}/report/README.txt`,
      data: asText(reportReadme),
    },
    {
      name: `${archiveRoot}/report/uebersicht.html`,
      data: asText(overviewHtml),
    },
    {
      name: `${archiveRoot}/report/baumliste.html`,
      data: asText(treeListHtml),
    },
    {
      name: `${archiveRoot}/report/notizen.html`,
      data: asText(notesHtml),
    },
    {
      name: `${archiveRoot}/report/tagesprotokoll.html`,
      data: asText(logsHtml),
    },
    {
      name: `${archiveRoot}/report/bewegungen.html`,
      data: asText(movementsHtml),
    },
    {
      name: `${archiveRoot}/map/tree-markers.kml`,
      data: asText(
        buildTreeKml({
          name: baustelle.name,
          address: baustelle.address,
          coordinates: baustelle.coordinates,
          treeItems: baustelle.treeItems,
        }, text),
      ),
    },
  ];

  const archiveName = `${archiveRoot}-export.zip`;
  return {
    archiveName,
    buffer: createStoredZip(entries),
  };
}
