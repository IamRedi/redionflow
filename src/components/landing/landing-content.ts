import { CalendarDays, ClipboardList, HardDriveDownload, HardHat, MapPinned, MonitorSmartphone, ScanLine, Truck, Users2, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/language";

export type LandingLanguage = SupportedLanguage;

export type LandingContent = {
  meta: {
    title: string;
    description: string;
  };
  language: {
    label: string;
    auto: string;
    options: Record<LandingLanguage, string>;
  };
  hero: {
    eyebrow: string;
    title: string;
    text: string;
    note: string;
    previewBadge: string;
    previewTitle: string;
    previewSubtitle: string;
    previewFooter: string;
    values: Array<{ icon: LucideIcon; label: string }>;
  };
  problemSolution: {
    problemsEyebrow: string;
    problemsTitle: string;
    problems: string[];
    solutionsEyebrow: string;
    solutionsTitle: string;
    solutions: string[];
    footnote: string;
  };
  features: {
    eyebrow: string;
    title: string;
    text: string;
    cards: Array<{ title: string; icon: LucideIcon; points: string[] }>;
    flowEyebrow: string;
    flowTitle: string;
    flowText: string;
    flowSteps: string[];
    flowPoints: string[];
    urgentEyebrow: string;
    urgentTitle: string;
    urgentText: string;
    urgentSteps: string[];
    urgentPoints: string[];
    treeEyebrow: string;
    treeTitle: string;
    treeText: string;
    treePoints: string[];
    footnote: string;
  };
  calculator: {
    eyebrow: string;
    title: string;
    text: string;
    points: string[];
    note: string;
  };
  positioning: {
    eyebrow: string;
    title: string;
    text: string;
    lines: string[];
  };
  security: {
    eyebrow: string;
    title: string;
    text: string;
    points: string[];
    notes: string[];
  };
  sections: {
    signal: Array<{ title: string; text: string }>;
    productIntro: { eyebrow: string; title: string; text: string };
    capabilities: Array<{ icon: LucideIcon; title: string; text: string }>;
    audienceIntro: { eyebrow: string; title: string; text: string };
    audience: Array<{ title: string; text: string; bullets: string[] }>;
    dayLogic: {
      eyebrow: string;
      title: string;
      text: string;
      points: Array<{ label: string; text: string }>;
      timeline: Array<{ number: string; title: string; text: string }>;
    };
    previewsIntro: { eyebrow: string; title: string; text: string };
    previews: Array<{ title: string; text: string }>;
    market: {
      eyebrow: string;
      title: string;
      text: string;
      points: Array<{ label: string; text: string }>;
    };
  };
  footer: {
    text: string;
    access: string;
  };
};

export function normalizeLandingLanguage(lang: SupportedLanguage): LandingLanguage {
  return lang;
}

const baseLandingContent = {
  de: {
    meta: {
      title: "BaumdienstFlow - Das operative Betriebssystem fuer Baumdienste",
      description: "BaumdienstFlow verbindet Workzone, Tagesplanung, Team, Flotte, Inventar, Berichte und Assistenz in einer Plattform fuer moderne Baumdienstbetriebe.",
    },
    language: {
      label: "Sprache",
      auto: "Automatisch nach Browser",
      options: { de: "Deutsch", en: "English", sq: "Shqip", it: "Italiano", pl: "Polski", ro: "Romana" },
    },
    hero: {
      eyebrow: "Software fuer Baumdienste",
      title: "BaumdienstFlow",
      text: "Workzone, Tagesplanung und Berichte in einem klaren Betriebssystem.",
      note: "Direkt im Browser. Ohne Installation.",
      previewBadge: "Live Preview",
      previewTitle: "Live System Vorschau",
      previewSubtitle: "Workzone / Planung / Dashboard",
      previewFooter: "Echte Ansicht aus der Anwendung",
      values: [
        { icon: CalendarDays, label: "Tagesplan fuer Team und Maschinen" },
        { icon: MapPinned, label: "Live Workzone fuer Baustellen" },
        { icon: HardDriveDownload, label: "Berichte und Exporte sofort bereit" },
        { icon: MonitorSmartphone, label: "Im Buero und mobil nutzbar" },
      ],
    },
    problemSolution: {
      problemsEyebrow: "Probleme",
      problemsTitle: "Der Alltag ist oft zu verteilt",
      problems: ["Planung in WhatsApp, Zetteln und Excel", "Unklar, wer wo arbeitet", "Dokumente fehlen genau dann, wenn man sie braucht", "Maschinen, Termine und Kontrollen werden vergessen"],
      solutionsEyebrow: "Loesung",
      solutionsTitle: "Ein ruhiger Ablauf vom Plan bis zum Bericht",
      solutions: ["Tagesplan und Workzone an einem Ort", "Live Uebersicht ueber Teams und Baustellen", "Dokumentation direkt im Arbeitsprozess", "Admin Assistant und Worker Helper mit getrenntem Zugriff"],
      footnote: "",
    },
    features: {
      eyebrow: "Kernbereiche",
      title: "Der Arbeitstag in einem System",
      text: "",
      cards: [
        { title: "Tagesplanung", icon: CalendarDays, points: ["Teams und Maschinen zuweisen", "Aenderungen sofort sichtbar"] },
        { title: "Workzone", icon: HardHat, points: ["Baustellenstatus live", "Aufgaben und Fortschritt vor Ort"] },
        { title: "Rapport & Export", icon: ClipboardList, points: ["Berichte aus dem Arbeitsfluss", "Nachweis ohne Nacharbeit"] },
        { title: "Team & Profile", icon: Users2, points: ["Zeiten, Urlaub, Dokumente", "Ausruestung je Mitarbeiter"] },
        { title: "Flotte & Inventar", icon: Truck, points: ["Maschinen, GPS und TUEV im Blick", "Tagesbericht mit Einsatzkontext"] },
        { title: "Scan & Benachrichtigung", icon: ScanLine, points: ["Barcode per Handykamera", "Push bei wichtigen Meldungen"] },
      ],
      flowEyebrow: "Ablauf",
      flowTitle: "Vom Auftrag zum Bericht",
      flowText: "Ein gemeinsamer Weg fuer Leitung, Team und Dokumentation.",
      flowSteps: ["Auftrag", "Plan", "Workzone", "Bericht", "Export"],
      flowPoints: ["Baustellen und Baumlisten strukturiert uebernehmen", "Fertige Dokumentation fuer Abrechnung und Nachweis"],
      urgentEyebrow: "Sonderbaustelle in Minuten",
      urgentTitle: "Spontane Einsaetze sofort sauber erfassen",
      urgentText: "Foto, Hinweis, Baustelle anlegen. Das Team sieht sie direkt.",
      urgentSteps: ["Meldung", "Foto", "Baustelle", "Team", "Bericht"],
      urgentPoints: ["Gut fuer Sturmschaeden, umgestuerzte Baeume und spontane Einsaetze."],
      treeEyebrow: "Baumdaten sauber integriert",
      treeTitle: "Baumdaten, Kamera und NFC-ready Logik",
      treeText: "Baumlisten, Tree-ID und Kartenpunkte bleiben direkt mit der Arbeit im Feld verbunden.",
      treePoints: ["Tree-ID und Barcode-Logik fuehren zum richtigen Objekt.", "NFC-ready Referenzen sind fuer Baeume und Inventar vorbereitet.", "Re-Importe behalten dieselbe fachliche Referenz.", "Dokumentation, Exporte und Rapporte bleiben nachvollziehbar."],
      footnote: "Ein Tag. Ein Plan. Ein Bericht.",
    },
    calculator: {
      eyebrow: "Kalkulation",
      title: "Deutsche Kalkulation mit klarer Kostenlogik",
      text: "Positionen werden nach EK, BGK, HK, AGK, SK, Wagnis/Gewinn, Netto und MwSt/Brutto aufgebaut.",
      points: ["EK aus Lohn, Maschinen, Material und Fremdleistung", "BGK-Basis auf EK gesamt oder Lohn", "Wagnis/Gewinn separat oder kombiniert"],
      note: "Die Engine ist die einzige Rechenquelle.",
    },
    positioning: {
      eyebrow: "Mehr als nur Software",
      title: "Ein Betriebssystem fuer den gesamten Baumdienst",
      text: "BaumdienstFlow verbindet Planung, Feldarbeit, Mitarbeiter, Maschinen, Dokumentation und Assistenz in einem durchgehenden System - nicht als einzelne Tools, sondern als ein klarer Arbeitsfluss.",
      lines: ["Alle Bereiche arbeiten miteinander, nicht nebeneinander", "Informationen sind dort, wo sie gebraucht werden", "Der Betrieb bleibt jederzeit uebersichtlich und steuerbar"],
    },
    security: {
      eyebrow: "Sicherheit",
      title: "Klare Rollen, klare Daten",
      text: "Zugriff, produktive Nutzung und Assistenz bleiben sauber getrennt.",
      points: ["Rollen fuer Admin, Worker und Display", "Gleiche Logo-Optik, getrennte Assistant-Scope", "Worker Helper nur fuer sichtbare Workzone-Funktionen"],
      notes: ["Wichtiges bleibt nachvollziehbar und geschuetzt."],
    },
    sections: {
      signal: [
        { title: "Keine zweite Wahrheit mehr zwischen Buero und Feld.", text: "Die Leitung plant, das Team arbeitet im Einsatz und der Betrieb dokumentiert auf derselben operativen Basis." },
        { title: "Kein generisches Tool, sondern Baumdienst-spezifische Logik.", text: "Baustellen, Baeume, Maschinen, Safety, Tagesplan und Rapport sind im Produktkern verankert." },
        { title: "Weniger Improvisation, mehr professionelle Betriebsruhe.", text: "Transparenz, Verlauf und strukturiertes Reporting reduzieren Suchaufwand und operative Reibung." },
      ],
      productIntro: { eyebrow: "Produktarchitektur", title: "Gebaut fuer die operative Wirklichkeit eines Baumdienstbetriebs.", text: "Die Staerke von BaumdienstFlow liegt nicht in einem Einzelmodul, sondern darin, dass Disposition, Feldarbeit, Mitarbeiterkontext, Flotte, Inventar, Assistenz und Auswertung zusammenhaengen." },
      capabilities: [
        { icon: Workflow, title: "Workzone fuer den realen Einsatz", text: "Baustellen, Baeume, manuelle Aufgaben, Materialstatus und Fortschritt laufen in einer mobilen Feldansicht zusammen." },
        { icon: CalendarDays, title: "Tagesplanung mit operativer Klarheit", text: "Mitarbeiter und Maschinen werden auf reale Baustellen verteilt. Der Plan bleibt sichtbar, bearbeitbar und nachvollziehbar." },
        { icon: ClipboardList, title: "Rapport, Reports und Dokumentation", text: "Tagesberichte, Monatsstunden, Baustellenunterlagen und Notizen werden nicht nachgetragen, sondern im Ablauf mitgefuehrt." },
        { icon: Users2, title: "Personal und Mitarbeiterprofile", text: "Status, Urlaub, Dokumente, Ausruestung, Profile und Berichtskontext bleiben eng mit dem Betrieb verbunden." },
        { icon: HardHat, title: "Flotte und Einsatzkontext", text: "Maschinen, Hinweise, technische Daten und operative Sichtbarkeit bleiben Teil des Tagesgeschehens statt Nebenverwaltung." },
        { icon: ScanLine, title: "Barcode & NFC Inventar mit Historie", text: "Werkzeuge, Kleidung und Ausgabeprozesse werden als einzelne Artikel mit Handykamera fuer Barcode und NFC direkt am Telefon, klarer Zuordnung und Verlauf gefuehrt." },
      ],
      audienceIntro: { eyebrow: "Zielgruppen", title: "Stark fuer Leitung, stark fuer Feldteams, stark fuer den gesamten Betrieb.", text: "" },
      audience: [
        { title: "Fuer die Einsatzleitung", text: "Leitung braucht nicht mehr Tools, sondern einen klaren Tagesblick ueber den Betrieb.", bullets: ["Tagesplanung nach Baustellen statt nach Notizzetteln", "Dashboard fuer Stunden, Fortschritt und Safety", "Sichtbarkeit ueber Team, Maschinen und offene Punkte"] },
        { title: "Fuer das Team im Feld", text: "Im Einsatz zaehlen Einfachheit, Orientierung und sofortige Sichtbarkeit.", bullets: ["Workzone mit Baustellenstatus und Aufgaben", "Material, Dokumente und Rapport direkt im Flow", "Mobile Nutzung statt spaeterem Papier-Nachtrag"] },
        { title: "Fuer den ganzen Betrieb", text: "Ein moderner Baumdienst wirkt staerker, wenn Prozesse verbunden statt improvisiert sind.", bullets: ["Personal, Flotte und Inventar im selben System", "Saubere Datengrundlage fuer Reports und Praesentation", "Mehr Professionalitaet gegenueber Team, Partnern und Kunden"] },
      ],
      dayLogic: {
        eyebrow: "Tageslogik",
        title: "Ein Arbeitstag, der digital nicht zerfaellt.",
        text: "BaumdienstFlow bildet nicht nur Daten ab. Es strukturiert die Reihenfolge, in der ein Betriebstag tatsaechlich ablaeuft, damit Orientierung, Verantwortung und Dokumentation gemeinsam entstehen.",
        points: [{ label: "Mehr Uebersicht:", text: "Tageslage, Teamstatus, Fortschritt und offene Punkte bleiben sichtbar." }, { label: "Weniger Suchaufwand:", text: "Dokumente, Profile, Maschinen, Material und Reports liegen nicht mehr in getrennten Welten." }, { label: "Mehr Professionalitaet:", text: "Die Plattform macht den Betrieb nach innen ruhiger und nach aussen glaubwuerdiger." }],
        timeline: [{ number: "01", title: "Disposition am Morgen", text: "Der Tag startet mit einer klaren Verteilung von Team und Maschinen auf echte Baustellen." }, { number: "02", title: "Orientierung im Feld", text: "Die Workzone zeigt Aufgaben, Status, Dokumente, Material und laufenden Fortschritt direkt dort, wo gearbeitet wird." }, { number: "03", title: "Laufende Dokumentation", text: "Zeiten, Trees, Tasks, Safety und Bewegungen entstehen im Prozess statt spaeter aus Erinnerung." }, { number: "04", title: "Kontrolle am Tagesende", text: "Dashboard, Profile, Reports und Inventar verdichten den Tag zu einer professionellen Betriebsuebersicht." }],
      },
      previewsIntro: { eyebrow: "Ablauf", title: "Was im Produkt passiert", text: "Kurz und klar: die wichtigsten Aufgaben, die BaumdienstFlow im Alltag verbindet." },
      previews: [{ title: "Arbeit live steuern", text: "Baustellen, Baeume, Material und Fortschritt bleiben im laufenden Einsatz sichtbar." }, { title: "Den Tag planen", text: "Teams und Maschinen werden klar auf reale Baustellen verteilt." }, { title: "Kontrolle behalten", text: "Stunden, Fortschritt, Sicherheit und offene Punkte bleiben fuer die Leitung sichtbar." }, { title: "Flotte und Tagesbericht verbinden", text: "Maschinen, Baustellen und Mitarbeiter bleiben im Einsatzkontext nachvollziehbar." }],
      market: {
        eyebrow: "Marktposition",
        title: "BaumdienstFlow ist kein weiteres Verwaltungsfrontend. Es ist eine spezialisierte Betriebsplattform.",
        text: "Die Marke tritt ruhig, kompetent und praxisnah auf: keine theoretische SaaS-Erzaehlung, sondern digitale Struktur fuer reale Baumdienstarbeit.",
        points: [{ label: "Ideal fuer:", text: "Baumdienst, Einsatzfuehrung, mobile Baustellensteuerung und professionelle Tagesorganisation." }, { label: "Markenwirkung:", text: "digital, strukturiert, glaubwuerdig, einsatznah." }, { label: "Naechster Hebel:", text: "Demo-Modus und Testzugang direkt aus derselben Produktstory heraus." }],
      },
    },
    footer: { text: "Operative Plattform fuer moderne Baumdienstbetriebe.", access: "Interner Zugang" },
  },
  en: {
    meta: {
      title: "BaumdienstFlow - The operating system for tree service companies",
      description: "BaumdienstFlow connects Workzone, daily planning, crews, fleet, inventory, reports and assistance in one platform for modern tree service companies.",
    },
    language: { label: "Language", auto: "Automatic from browser", options: { de: "Deutsch", en: "English", sq: "Shqip", it: "Italiano", pl: "Polski", ro: "Romana" } },
    hero: {
      eyebrow: "Software for tree service companies",
      title: "BaumdienstFlow",
      text: "Workzone, daily planning and reports in one clear operating system.",
      note: "Directly in the browser. No installation.",
      previewBadge: "Live Preview",
      previewTitle: "Live system preview",
      previewSubtitle: "Workzone / Planning / Dashboard",
      previewFooter: "Real view from the application",
      values: [
        { icon: CalendarDays, label: "Daily plan for crew and machines" },
        { icon: MapPinned, label: "Live Workzone for job sites" },
        { icon: HardDriveDownload, label: "Reports and exports ready fast" },
        { icon: MonitorSmartphone, label: "Works in the office and on mobile" },
      ],
    },
    problemSolution: {
      problemsEyebrow: "Problems",
      problemsTitle: "Daily work is often too scattered",
      problems: ["Planning through WhatsApp, paper or Excel", "No clear overview of who works where", "Documents are missing when needed", "Machines, dates and checks get missed"],
      solutionsEyebrow: "Solution",
      solutionsTitle: "A calm flow from plan to report",
      solutions: ["Daily planning and Workzone in one place", "Live overview of crews and job sites", "Documentation inside the work process", "Admin Assistant and Worker Helper with separate access"],
      footnote: "",
    },
    features: {
      eyebrow: "Core areas",
      title: "The working day in one system",
      text: "",
      cards: [
        { title: "Daily planning", icon: CalendarDays, points: ["Assign crews and machines", "Changes visible immediately"] },
        { title: "Workzone", icon: HardHat, points: ["Live job site status", "Tasks and progress on site"] },
        { title: "Reports & export", icon: ClipboardList, points: ["Reports from the work flow", "Proof without rework"] },
        { title: "Crew & profiles", icon: Users2, points: ["Time, vacation, documents", "Equipment per worker"] },
        { title: "Fleet & inventory", icon: Truck, points: ["Machines, GPS and inspections visible", "Daily report with work context"] },
        { title: "Scan & alerts", icon: ScanLine, points: ["Phone-camera barcode", "Push for important updates"] },
      ],
      flowEyebrow: "Flow",
      flowTitle: "From job to report",
      flowText: "One shared path for management, crew and documentation.",
      flowSteps: ["Job", "Plan", "Workzone", "Report", "Export"],
      flowPoints: ["Import job sites and tree lists cleanly", "Finished documentation for billing and proof"],
      urgentEyebrow: "Urgent job site in minutes",
      urgentTitle: "Capture spontaneous work cleanly",
      urgentText: "Photo, note, new job site. The team sees it directly.",
      urgentSteps: ["Message", "Photo", "Job site", "Crew", "Report"],
      urgentPoints: ["Useful for storm damage, fallen trees and spontaneous work."],
      treeEyebrow: "Tree data integrated cleanly",
      treeTitle: "Tree data, camera and NFC-ready logic",
      treeText: "Tree lists, tree ID and map points stay connected to the work happening in the field.",
      treePoints: ["Tree ID and barcode logic lead to the right object.", "NFC-ready references are prepared for trees and inventory.", "Re-imports keep the same operational reference.", "Documentation, exports and reports stay traceable."],
      footnote: "One day. One plan. One report.",
    },
    calculator: {
      eyebrow: "Calculation",
      title: "German calculation with clear cost logic",
      text: "Positions follow EK, BGK, HK, AGK, SK, risk/profit, net and VAT/gross.",
      points: ["Direct costs from labor, machines, material and subcontracting", "BGK base on total EK or labor only", "Risk/profit separate or combined"],
      note: "The engine is the single calculation source.",
    },
    positioning: {
      eyebrow: "More than software",
      title: "An operating system for the whole tree service company",
      text: "BaumdienstFlow connects planning, field work, people, machines, documentation and assistance in one continuous system - not as separate tools, but as a clear workflow.",
      lines: ["All areas work together, not next to each other", "Information is available where it is needed", "The operation stays visible and controllable at all times"],
    },
    security: {
      eyebrow: "Security",
      title: "Clear roles, clear data",
      text: "Access, production use and assistance stay cleanly separated.",
      points: ["Roles for admin, worker and display", "Same logo look, separate assistant scope", "Worker Helper only for visible Workzone features"],
      notes: ["Important data stays traceable and protected."],
    },
    sections: {
      signal: [
        { title: "No second truth between office and field.", text: "Management plans, the team works on site and the company documents on the same operational base." },
        { title: "Not a generic tool, but tree-service-specific logic.", text: "Job sites, trees, machines, safety, daily plans and reports are part of the product core." },
        { title: "Less improvisation, more professional calm.", text: "Transparency, history and structured reporting reduce searching and operational friction." },
      ],
      productIntro: { eyebrow: "Product architecture", title: "Built for the operational reality of a tree service company.", text: "The strength of BaumdienstFlow is not one single module, but the way dispatch, field work, crew context, fleet, inventory, assistance and reporting work together." },
      capabilities: [
        { icon: Workflow, title: "Workzone for real field work", text: "Job sites, trees, manual tasks, material status and progress come together in a mobile field view." },
        { icon: CalendarDays, title: "Daily planning with operational clarity", text: "Workers and machines are assigned to real job sites. The plan stays visible, editable and traceable." },
        { icon: ClipboardList, title: "Reports and documentation", text: "Daily reports, monthly hours, job site files and notes are created inside the workflow instead of being added later." },
        { icon: Users2, title: "People and worker profiles", text: "Status, vacation, documents, equipment, profiles and report context stay connected to the operation." },
        { icon: HardHat, title: "Fleet and job context", text: "Machines, notices, technical data and operational visibility remain part of the day instead of separate administration." },
        { icon: ScanLine, title: "Barcode & NFC inventory history", text: "Tools, clothing and handover processes are tracked as individual items by phone camera barcode and NFC, with clear ownership and history." },
      ],
      audienceIntro: { eyebrow: "Target groups", title: "Strong for management, strong for field teams, strong for the whole company.", text: "" },
      audience: [
        { title: "For dispatch and management", text: "Management does not need more tools, but a clear daily view of the operation.", bullets: ["Daily planning by job site instead of paper notes", "Dashboard for hours, progress and safety", "Visibility across teams, machines and open points"] },
        { title: "For the field team", text: "On site, simplicity, orientation and immediate visibility matter.", bullets: ["Workzone with job status and tasks", "Material, documents and reports directly in the flow", "Mobile use instead of later paper catch-up"] },
        { title: "For the whole company", text: "A modern tree service company looks stronger when processes are connected instead of improvised.", bullets: ["People, fleet and inventory in the same system", "Clean data basis for reports and presentations", "More professionalism toward team, partners and customers"] },
      ],
      dayLogic: {
        eyebrow: "Daily logic",
        title: "A working day that does not fall apart digitally.",
        text: "BaumdienstFlow does more than display data. It structures the order in which an operational day really happens, so orientation, responsibility and documentation grow together.",
        points: [{ label: "More overview:", text: "daily situation, team status, progress and open points stay visible." }, { label: "Less searching:", text: "documents, profiles, machines, material and reports no longer live in separate worlds." }, { label: "More professionalism:", text: "the platform makes the company calmer inside and more credible outside." }],
        timeline: [{ number: "01", title: "Morning dispatch", text: "The day starts with a clear assignment of crew and machines to real job sites." }, { number: "02", title: "Orientation in the field", text: "Workzone shows tasks, status, documents, material and live progress exactly where work happens." }, { number: "03", title: "Ongoing documentation", text: "Time, trees, tasks, safety and movements are captured in the process instead of from memory later." }, { number: "04", title: "End-of-day control", text: "Dashboard, profiles, reports and inventory turn the day into a professional operational overview." }],
      },
      previewsIntro: { eyebrow: "Workflow", title: "What the product handles", text: "Short and clear: the core tasks BaumdienstFlow connects during the working day." },
      previews: [{ title: "Run live work", text: "Job sites, trees, material and progress stay visible while the team is working." }, { title: "Plan the day", text: "Crews and machines are assigned clearly to real job sites." }, { title: "Keep control", text: "Hours, progress, safety and open points stay visible for management." }, { title: "Connect fleet and reports", text: "Machines, job sites and workers stay traceable in the work context." }],
      market: {
        eyebrow: "Market position",
        title: "BaumdienstFlow is not another admin frontend. It is a specialized operational platform.",
        text: "The brand should feel calm, competent and close to practice: not a theoretical SaaS promise, but digital structure for real tree service work.",
        points: [{ label: "Ideal for:", text: "tree services, dispatch, mobile job site control and professional daily organization." }, { label: "Brand effect:", text: "digital, structured, credible, close to the field." }, { label: "Next lever:", text: "demo mode and test access directly from the same product story." }],
      },
    },
    footer: { text: "Operational platform for modern tree service companies.", access: "Internal access" },
  },
  sq: {
    meta: {
      title: "BaumdienstFlow - sistemi operativ per kompani te sherbimit te pemeve",
      description: "BaumdienstFlow lidh Workzone, planin ditor, ekipin, flotilen, inventarin, raportet dhe asistencen ne nje platforme per kompani moderne te pemeve.",
    },
    language: { label: "Gjuha", auto: "Automatikisht sipas browser-it", options: { de: "Deutsch", en: "English", sq: "Shqip", it: "Italiano", pl: "Polski", ro: "Romana" } },
    hero: {
      eyebrow: "Software per sherbime peme",
      title: "BaumdienstFlow",
      text: "Workzone, plan ditor dhe raporte ne nje sistem operativ te qarte.",
      note: "Direkt ne browser. Pa instalim.",
      previewBadge: "Pamje live",
      previewTitle: "Pamje e sistemit live",
      previewSubtitle: "Workzone / Planifikim / Dashboard",
      previewFooter: "Pamje reale nga aplikacioni",
      values: [
        { icon: CalendarDays, label: "Plan ditor per ekip dhe makineri" },
        { icon: MapPinned, label: "Workzone live per kantiere" },
        { icon: HardDriveDownload, label: "Raporte dhe eksporte shpejt gati" },
        { icon: MonitorSmartphone, label: "Ne zyre dhe ne telefon" },
      ],
    },
    problemSolution: {
      problemsEyebrow: "Problemet",
      problemsTitle: "Dita shpesh ndahet ne shume vende",
      problems: ["Planifikim me WhatsApp, letra ose Excel", "Nuk shihet qarte kush ku po punon", "Dokumentet mungojne kur duhen", "Makineri, afate dhe kontrolle harrohen"],
      solutionsEyebrow: "Zgjidhja",
      solutionsTitle: "Nje rrjedhe e qete nga plani te raporti",
      solutions: ["Plan ditor dhe Workzone ne nje vend", "Pamje live per ekipet dhe kantieret", "Dokumentim direkt gjate punes", "Admin Assistant dhe Worker Helper me akses te ndare"],
      footnote: "",
    },
    features: {
      eyebrow: "Pjeset kryesore",
      title: "Dita e punes ne nje sistem",
      text: "",
      cards: [
        { title: "Plan ditor", icon: CalendarDays, points: ["Ndaj ekipin dhe makinerite", "Ndryshimet shihen menjehere"] },
        { title: "Workzone", icon: HardHat, points: ["Status live i kantiereve", "Detyra dhe progres ne vend"] },
        { title: "Raport & eksport", icon: ClipboardList, points: ["Raporte nga rrjedha e punes", "Dokumentim pa pune dyfish"] },
        { title: "Ekip & profile", icon: Users2, points: ["Ore, pushime, dokumente", "Pajisje per cdo punetor"] },
        { title: "Flotile & inventar", icon: Truck, points: ["Makineri, GPS dhe TUEV ne pamje", "Raport ditor me kontekst pune"] },
        { title: "Scan & njoftime", icon: ScanLine, points: ["Barcode me kameren e telefonit", "Push per lajme te rendesishme"] },
      ],
      flowEyebrow: "Rrjedha",
      flowTitle: "Nga puna te raporti",
      flowText: "Nje rruge e perbashket per drejtimin, ekipin dhe dokumentimin.",
      flowSteps: ["Pune", "Plan", "Workzone", "Raport", "Eksport"],
      flowPoints: ["Kantieret dhe listat e pemeve hyjne te strukturuara", "Dokumentacioni eshte gati per faturim dhe prove"],
      urgentEyebrow: "Kantier urgjent ne pak minuta",
      urgentTitle: "Pune spontane pa rremuje",
      urgentText: "Foto, shenim, kantier i ri. Ekipi e sheh direkt.",
      urgentSteps: ["Mesazh", "Foto", "Kantier", "Ekip", "Raport"],
      urgentPoints: ["E dobishme per stuhi, peme te rrezuara dhe pune spontane."],
      treeEyebrow: "Te dhenat e pemeve te integruara",
      treeTitle: "Te dhena pemesh, kamera dhe logjike NFC-ready",
      treeText: "Listat e pemeve, Tree-ID dhe pikat ne harte lidhen direkt me punen qe behet ne terren.",
      treePoints: ["Tree-ID dhe logjika barcode te cojne te objekti i duhur.", "Referencat NFC-ready jane te pergatitura per peme dhe inventar.", "Re-importet ruajne te njejten reference pune.", "Dokumentimi, eksportet dhe raportet mbeten te gjurmueshme."],
      footnote: "Nje dite. Nje plan. Nje raport.",
    },
    calculator: {
      eyebrow: "Kalkulim",
      title: "Kalkulim gjerman me logjike te qarte kostosh",
      text: "Pozicionet llogariten me EK, BGK, HK, AGK, SK, risk/fitim, neto dhe MwSt/bruto.",
      points: ["EK nga punetore, makineri, material dhe pune e jashtme", "BGK mbi EK total ose vetem mbi punen", "Risk/fitim vec ose te kombinuara"],
      note: "Engine eshte burimi i vetem i llogaritjes.",
    },
    positioning: {
      eyebrow: "Me shume se software",
      title: "Nje sistem operativ per gjithe biznesin e pemeve",
      text: "BaumdienstFlow lidh planifikimin, terrenin, punetoret, makinerite, dokumentacionin dhe asistencen ne nje sistem te vazhdueshem - jo si mjete te ndara, por si rrjedhe e qarte pune.",
      lines: ["Te gjitha fushat punojne bashke, jo vec e vec", "Informacioni eshte aty ku duhet", "Biznesi mbetet i dukshem dhe i kontrollueshem ne cdo moment"],
    },
    security: {
      eyebrow: "Siguri",
      title: "Role te qarta, te dhena te qarta",
      text: "Aksesi, perdorimi real dhe asistenca qendrojne te ndara.",
      points: ["Role per admin, worker dhe display", "E njejta pamje logoje, scope i ndare assistant-i", "Worker Helper vetem per funksionet e dukshme te Workzone"],
      notes: ["Gjerat e rendesishme mbeten te gjurmueshme dhe te mbrojtura."],
    },
    sections: {
      signal: [
        { title: "Jo me dy te verteta mes zyres dhe terrenit.", text: "Drejtimi planifikon, ekipi punon ne terren dhe biznesi dokumenton mbi te njejten baze operative." },
        { title: "Jo mjet gjenerik, por logjike per sherbime peme.", text: "Kantiere, peme, makineri, siguri, plan ditor dhe raporte jane ne thelbin e produktit." },
        { title: "Me pak improvizim, me shume qetesi profesionale.", text: "Transparenca, historia dhe raportimi i strukturuar ulin kerkimin dhe ferkimin ne operim." },
      ],
      productIntro: { eyebrow: "Arkitektura e produktit", title: "Ndertuar per realitetin operativ te nje biznesi pemesh.", text: "Fuqia e BaumdienstFlow nuk eshte nje modul i vetem, por menyra si planifikimi, terreni, ekipi, flotila, inventari, asistenca dhe raportimi punojne bashke." },
      capabilities: [
        { icon: Workflow, title: "Workzone per punen reale", text: "Kantiere, peme, detyra manuale, status materiali dhe progresi bashkohen ne nje pamje mobile per terren." },
        { icon: CalendarDays, title: "Plan ditor me qartesi operative", text: "Punetoret dhe makinerite ndahen ne kantiere reale. Plani mbetet i dukshem, i ndryshueshem dhe i gjurmueshem." },
        { icon: ClipboardList, title: "Raporte dhe dokumentacion", text: "Raportet ditore, oret mujore, dokumentet e kantierit dhe shenimet krijohen brenda rrjedhes se punes." },
        { icon: Users2, title: "Punetore dhe profile", text: "Statusi, pushimet, dokumentet, pajisjet, profilet dhe konteksti i raporteve mbeten te lidhura me biznesin." },
        { icon: HardHat, title: "Flotile dhe kontekst pune", text: "Makinerite, shenimet, te dhenat teknike dhe dukshmeria operative jane pjese e dites, jo administrim i ndare." },
        { icon: ScanLine, title: "Inventar Barcode & NFC me histori", text: "Vegla, rroba dhe dorezime ndiqen si artikuj te vecante me kameren e telefonit dhe NFC, me pergjegjesi dhe histori te qarte." },
      ],
      audienceIntro: { eyebrow: "Per ke eshte", title: "I forte per drejtimin, i forte per ekipin, i forte per gjithe biznesin.", text: "" },
      audience: [
        { title: "Per drejtimin e punes", text: "Drejtimi nuk ka nevoje per me shume tools, por per nje pamje te qarte te dites.", bullets: ["Plan ditor sipas kantiereve, jo sipas letrave", "Dashboard per ore, progres dhe siguri", "Dukshmeri per ekipin, makinerite dhe pikat e hapura"] },
        { title: "Per ekipin ne terren", text: "Ne terren vlejne thjeshtesia, orientimi dhe dukshmeria e menjehershme.", bullets: ["Workzone me status kantieri dhe detyra", "Material, dokumente dhe raport direkt ne flow", "Perdorim mobil ne vend te letrave me vone"] },
        { title: "Per gjithe biznesin", text: "Nje kompani moderne duket me e forte kur proceset jane te lidhura, jo te improvizuara.", bullets: ["Punetore, flotile dhe inventar ne te njejtin sistem", "Baze e paster te dhenash per raporte dhe prezantim", "Me shume profesionalizem ndaj ekipit, partnereve dhe klienteve"] },
      ],
      dayLogic: {
        eyebrow: "Logjika ditore",
        title: "Nje dite pune qe nuk shperbehet digjitalisht.",
        text: "BaumdienstFlow nuk tregon vetem te dhena. Ai strukturon rendin si ndodh realisht dita operative, qe orientimi, pergjegjesia dhe dokumentimi te lindin bashke.",
        points: [{ label: "Me shume pamje:", text: "situata ditore, statusi i ekipit, progresi dhe pikat e hapura mbeten te dukshme." }, { label: "Me pak kerkim:", text: "dokumente, profile, makineri, material dhe raporte nuk jane me ne bote te ndara." }, { label: "Me shume profesionalizem:", text: "platforma e ben biznesin me te qete brenda dhe me te besueshem jashte." }],
        timeline: [{ number: "01", title: "Planifikimi ne mengjes", text: "Dita nis me ndarje te qarte te ekipit dhe makinerive ne kantiere reale." }, { number: "02", title: "Orientim ne terren", text: "Workzone tregon detyrat, statusin, dokumentet, materialin dhe progresin aty ku punohet." }, { number: "03", title: "Dokumentim gjate punes", text: "Oret, pemet, detyrat, siguria dhe levizjet regjistrohen ne proces, jo me kujtesa me vone." }, { number: "04", title: "Kontroll ne fund te dites", text: "Dashboard, profile, raporte dhe inventar e kthejne diten ne nje pamje profesionale operative." }],
      },
      previewsIntro: { eyebrow: "Rrjedha", title: "Cfare ben produkti", text: "Shkurt dhe qarte: detyrat kryesore qe BaumdienstFlow lidh gjate dites se punes." },
      previews: [{ title: "Drejto punen live", text: "Kantieret, pemet, materiali dhe progresi mbeten te dukshem gjate punes." }, { title: "Planifiko diten", text: "Ekipet dhe makinerite ndahen qarte ne kantiere reale." }, { title: "Mbaj kontroll", text: "Oret, progresi, siguria dhe pikat e hapura mbeten te dukshme per drejtimin." }, { title: "Lidh floten me raportin", text: "Makinerite, kantieret dhe punetoret mbeten te gjurmueshem ne kontekstin e punes." }],
      market: {
        eyebrow: "Pozicionim ne treg",
        title: "BaumdienstFlow nuk eshte nje frontend tjeter administrimi. Eshte platforme operative e specializuar.",
        text: "Marka duhet te ndihet e qete, kompetente dhe afer praktikes: jo premtim teorik SaaS, por strukture digjitale per pune reale me peme.",
        points: [{ label: "Ideale per:", text: "sherbime peme, drejtim pune, kontroll mobil kantieri dhe organizim profesional ditor." }, { label: "Efekti i markes:", text: "digjitale, e strukturuar, e besueshme, afer terrenit." }, { label: "Hapi tjeter:", text: "demo mode dhe test access direkt nga e njejta histori produkti." }],
      },
    },
    footer: { text: "Platforme operative per kompani moderne te sherbimit te pemeve.", access: "Hyrje e brendshme" },
  },
} satisfies Record<"de" | "en" | "sq", LandingContent>;

export const landingContent: Record<LandingLanguage, LandingContent> = {
  ...baseLandingContent,
  it: {
    meta: {
      title: "BaumdienstFlow - Il sistema operativo per aziende di tree service",
      description: "BaumdienstFlow collega Workzone, piano giornaliero, squadra, flotta, inventario, report e assistenza in una piattaforma per aziende moderne di tree service.",
    },
    language: { label: "Lingua", auto: "Automatico dal browser", options: { de: "Deutsch", en: "English", sq: "Shqip", it: "Italiano", pl: "Polski", ro: "Romana" } },
    hero: {
      eyebrow: "Software per aziende di tree service",
      title: "BaumdienstFlow",
      text: "Workzone, piano giornaliero e report in un sistema operativo chiaro.",
      note: "Direttamente nel browser. Senza installazione.",
      previewBadge: "Anteprima live",
      previewTitle: "Anteprima sistema live",
      previewSubtitle: "Workzone / Pianificazione / Dashboard",
      previewFooter: "Vista reale dall'applicazione",
      values: [
        { icon: CalendarDays, label: "Piano giornaliero per squadra e macchine" },
        { icon: MapPinned, label: "Workzone live per cantieri" },
        { icon: HardDriveDownload, label: "Report ed export subito pronti" },
        { icon: MonitorSmartphone, label: "Utilizzabile in ufficio e su mobile" },
      ],
    },
    problemSolution: {
      problemsEyebrow: "Problemi",
      problemsTitle: "Il lavoro quotidiano e spesso troppo disperso",
      problems: ["Pianificazione su WhatsApp, carta o Excel", "Poca chiarezza su chi lavora dove", "I documenti mancano proprio quando servono", "Macchine, scadenze e controlli vengono dimenticati"],
      solutionsEyebrow: "Soluzione",
      solutionsTitle: "Un flusso tranquillo dal piano al report",
      solutions: ["Piano giornaliero e Workzone in un solo posto", "Panoramica live di squadre e cantieri", "Documentazione dentro il processo di lavoro", "Admin Assistant e Worker Helper con accesso separato"],
      footnote: "",
    },
    features: {
      eyebrow: "Aree principali",
      title: "La giornata di lavoro in un sistema",
      text: "",
      cards: [
        { title: "Piano giornaliero", icon: CalendarDays, points: ["Assegnare squadre e macchine", "Modifiche visibili subito"] },
        { title: "Workzone", icon: HardHat, points: ["Stato cantiere live", "Attivita e avanzamento sul posto"] },
        { title: "Report & export", icon: ClipboardList, points: ["Report dal flusso di lavoro", "Prova senza lavoro doppio"] },
        { title: "Squadra & profili", icon: Users2, points: ["Ore, ferie, documenti", "Attrezzatura per ogni operatore"] },
        { title: "Flotta & inventario", icon: Truck, points: ["Macchine, GPS e controlli visibili", "Rapporto giornaliero con contesto"] },
        { title: "Scan & notifiche", icon: ScanLine, points: ["Barcode con camera del telefono", "Push per aggiornamenti importanti"] },
      ],
      flowEyebrow: "Flusso",
      flowTitle: "Dal lavoro al report",
      flowText: "Un percorso comune per direzione, squadra e documentazione.",
      flowSteps: ["Lavoro", "Piano", "Workzone", "Report", "Export"],
      flowPoints: ["Cantieri e liste alberi importati in modo strutturato", "Documentazione pronta per fatturazione e prova"],
      urgentEyebrow: "Cantiere urgente in pochi minuti",
      urgentTitle: "Registrare lavori spontanei in modo pulito",
      urgentText: "Foto, nota, nuovo cantiere. La squadra lo vede subito.",
      urgentSteps: ["Messaggio", "Foto", "Cantiere", "Squadra", "Report"],
      urgentPoints: ["Utile per danni da tempesta, alberi caduti e lavori spontanei."],
      treeEyebrow: "Dati alberi integrati bene",
      treeTitle: "Dati alberi, camera e logica NFC-ready",
      treeText: "Liste alberi, Tree-ID e punti mappa restano collegati al lavoro sul campo.",
      treePoints: ["Tree-ID e logica barcode portano all'oggetto giusto.", "Referenze NFC-ready preparate per alberi e inventario.", "I re-import mantengono la stessa referenza operativa.", "Documentazione, export e report restano tracciabili."],
      footnote: "Un giorno. Un piano. Un report.",
    },
    calculator: {
      eyebrow: "Calcolo",
      title: "Calcolo tedesco con logica costi chiara",
      text: "Le posizioni seguono EK, BGK, HK, AGK, SK, rischio/utile, netto e IVA/lordo.",
      points: ["EK da lavoro, macchine, materiale e subappalto", "Base BGK su EK totale o solo lavoro", "Rischio/utile separati o combinati"],
      note: "Il motore e l'unica fonte di calcolo.",
    },
    positioning: {
      eyebrow: "Piu di un software",
      title: "Un sistema operativo per tutta l'azienda di tree service",
      text: "BaumdienstFlow collega pianificazione, campo, persone, macchine, documentazione e assistenza in un sistema continuo - non come strumenti separati, ma come flusso di lavoro chiaro.",
      lines: ["Tutte le aree lavorano insieme, non una accanto all'altra", "Le informazioni sono dove servono", "L'azienda resta sempre visibile e controllabile"],
    },
    security: {
      eyebrow: "Sicurezza",
      title: "Ruoli chiari, dati chiari",
      text: "Accesso, uso produttivo e assistenza restano separati in modo pulito.",
      points: ["Ruoli per admin, worker e display", "Stesso logo, scope assistant separato", "Worker Helper solo per funzioni Workzone visibili"],
      notes: ["Le informazioni importanti restano tracciabili e protette."],
    },
    sections: {
      signal: [
        { title: "Niente piu doppia verita tra ufficio e campo.", text: "La direzione pianifica, la squadra lavora sul posto e l'azienda documenta sulla stessa base operativa." },
        { title: "Non uno strumento generico, ma logica specifica per tree service.", text: "Cantieri, alberi, macchine, safety, piano giornaliero e report sono nel cuore del prodotto." },
        { title: "Meno improvvisazione, piu calma professionale.", text: "Trasparenza, storico e reporting strutturato riducono ricerca e attrito operativo." },
      ],
      productIntro: { eyebrow: "Architettura prodotto", title: "Costruito per la realta operativa di un'azienda di tree service.", text: "La forza di BaumdienstFlow non e un singolo modulo, ma il modo in cui dispatch, campo, contesto squadra, flotta, inventario, assistenza e analisi lavorano insieme." },
      capabilities: [
        { icon: Workflow, title: "Workzone per lavoro reale sul campo", text: "Cantieri, alberi, attivita manuali, stato materiale e avanzamento si uniscono in una vista mobile." },
        { icon: CalendarDays, title: "Piano giornaliero con chiarezza operativa", text: "Operatori e macchine vengono assegnati a cantieri reali. Il piano resta visibile, modificabile e tracciabile." },
        { icon: ClipboardList, title: "Report e documentazione", text: "Rapporti giornalieri, ore mensili, documenti cantiere e note nascono nel workflow, non dopo." },
        { icon: Users2, title: "Personale e profili operatori", text: "Stato, ferie, documenti, attrezzatura, profili e contesto report restano collegati all'azienda." },
        { icon: HardHat, title: "Flotta e contesto lavoro", text: "Macchine, note, dati tecnici e visibilita operativa restano parte della giornata." },
        { icon: ScanLine, title: "Inventario Barcode & NFC con storico", text: "Utensili, abbigliamento e consegne sono gestiti come articoli singoli con camera telefono e NFC, assegnazione chiara e storico." },
      ],
      audienceIntro: { eyebrow: "Destinatari", title: "Forte per la direzione, forte per il campo, forte per tutta l'azienda.", text: "" },
      audience: [
        { title: "Per dispatch e direzione", text: "La direzione non ha bisogno di piu strumenti, ma di una vista giornaliera chiara.", bullets: ["Piano giornaliero per cantieri invece di fogli", "Dashboard per ore, avanzamento e safety", "Visibilita su squadre, macchine e punti aperti"] },
        { title: "Per la squadra sul campo", text: "Sul posto contano semplicita, orientamento e visibilita immediata.", bullets: ["Workzone con stato cantiere e attivita", "Materiale, documenti e report direttamente nel flow", "Uso mobile invece di carta da recuperare dopo"] },
        { title: "Per tutta l'azienda", text: "Un'azienda moderna e piu forte quando i processi sono collegati.", bullets: ["Personale, flotta e inventario nello stesso sistema", "Base dati pulita per report e presentazioni", "Piu professionalita verso squadra, partner e clienti"] },
      ],
      dayLogic: {
        eyebrow: "Logica giornaliera",
        title: "Una giornata che non si rompe digitalmente.",
        text: "BaumdienstFlow non mostra solo dati. Struttura l'ordine reale della giornata operativa, cosi orientamento, responsabilita e documentazione crescono insieme.",
        points: [{ label: "Piu panoramica:", text: "situazione giornaliera, stato squadra, avanzamento e punti aperti restano visibili." }, { label: "Meno ricerca:", text: "documenti, profili, macchine, materiale e report non vivono piu in mondi separati." }, { label: "Piu professionalita:", text: "la piattaforma rende l'azienda piu calma dentro e piu credibile fuori." }],
        timeline: [{ number: "01", title: "Dispatch al mattino", text: "La giornata inizia con assegnazione chiara di squadra e macchine a cantieri reali." }, { number: "02", title: "Orientamento sul campo", text: "Workzone mostra attivita, stato, documenti, materiale e avanzamento dove si lavora." }, { number: "03", title: "Documentazione continua", text: "Ore, alberi, task, safety e movimenti vengono registrati nel processo." }, { number: "04", title: "Controllo a fine giornata", text: "Dashboard, profili, report e inventario trasformano il giorno in una panoramica professionale." }],
      },
      previewsIntro: { eyebrow: "Workflow", title: "Cosa gestisce il prodotto", text: "Breve e chiaro: i compiti principali che BaumdienstFlow collega durante la giornata." },
      previews: [{ title: "Guidare il lavoro live", text: "Cantieri, alberi, materiale e avanzamento restano visibili durante il lavoro." }, { title: "Pianificare la giornata", text: "Squadre e macchine vengono assegnate chiaramente a cantieri reali." }, { title: "Mantenere controllo", text: "Ore, avanzamento, sicurezza e punti aperti restano visibili alla direzione." }, { title: "Collegare flotta e report", text: "Macchine, cantieri e operatori restano tracciabili nel contesto lavoro." }],
      market: {
        eyebrow: "Posizionamento",
        title: "BaumdienstFlow non e un altro frontend amministrativo. E una piattaforma operativa specializzata.",
        text: "Il brand deve sembrare calmo, competente e vicino alla pratica: non una promessa SaaS teorica, ma struttura digitale per lavoro reale con alberi.",
        points: [{ label: "Ideale per:", text: "tree service, dispatch, controllo mobile cantieri e organizzazione giornaliera professionale." }, { label: "Effetto brand:", text: "digitale, strutturato, credibile, vicino al campo." }, { label: "Prossima leva:", text: "demo mode e accesso test direttamente dalla stessa storia prodotto." }],
      },
    },
    footer: { text: "Piattaforma operativa per aziende moderne di tree service.", access: "Accesso interno" },
  },
  pl: {
    meta: {
      title: "BaumdienstFlow - System operacyjny dla firm arborystycznych",
      description: "BaumdienstFlow laczy Workzone, plan dnia, zespol, flote, magazyn, raporty i asystencje w jednej platformie dla nowoczesnych firm arborystycznych.",
    },
    language: { label: "Jezyk", auto: "Automatycznie z przegladarki", options: { de: "Deutsch", en: "English", sq: "Shqip", it: "Italiano", pl: "Polski", ro: "Romana" } },
    hero: {
      eyebrow: "Software dla firm arborystycznych",
      title: "BaumdienstFlow",
      text: "Workzone, plan dnia i raporty w jednym jasnym systemie operacyjnym.",
      note: "Bezposrednio w przegladarce. Bez instalacji.",
      previewBadge: "Podglad live",
      previewTitle: "Podglad systemu live",
      previewSubtitle: "Workzone / Planowanie / Dashboard",
      previewFooter: "Rzeczywisty widok z aplikacji",
      values: [
        { icon: CalendarDays, label: "Plan dnia dla zespolu i maszyn" },
        { icon: MapPinned, label: "Workzone live dla miejsc pracy" },
        { icon: HardDriveDownload, label: "Raporty i eksporty gotowe od razu" },
        { icon: MonitorSmartphone, label: "Dziala w biurze i mobilnie" },
      ],
    },
    problemSolution: {
      problemsEyebrow: "Problemy",
      problemsTitle: "Codzienna praca jest czesto zbyt rozproszona",
      problems: ["Planowanie przez WhatsApp, papier lub Excel", "Brak jasnosci, kto gdzie pracuje", "Dokumenty znikaja wtedy, gdy sa potrzebne", "Maszyny, terminy i kontrole sa pomijane"],
      solutionsEyebrow: "Rozwiazanie",
      solutionsTitle: "Spokojny przeplyw od planu do raportu",
      solutions: ["Plan dnia i Workzone w jednym miejscu", "Podglad live zespolow i miejsc pracy", "Dokumentacja w samym procesie pracy", "Admin Assistant i Worker Helper z oddzielnym dostepem"],
      footnote: "",
    },
    features: {
      eyebrow: "Glowne obszary",
      title: "Dzien pracy w jednym systemie",
      text: "",
      cards: [
        { title: "Plan dnia", icon: CalendarDays, points: ["Przydziel zespoly i maszyny", "Zmiany widoczne natychmiast"] },
        { title: "Workzone", icon: HardHat, points: ["Status miejsca pracy live", "Zadania i postep na miejscu"] },
        { title: "Raport & eksport", icon: ClipboardList, points: ["Raporty z przeplywu pracy", "Dowod bez dodatkowej pracy"] },
        { title: "Zespol & profile", icon: Users2, points: ["Czas, urlopy, dokumenty", "Wyposazenie na pracownika"] },
        { title: "Flota & magazyn", icon: Truck, points: ["Maszyny, GPS i kontrole widoczne", "Raport dzienny z kontekstem pracy"] },
        { title: "Skan & powiadomienia", icon: ScanLine, points: ["Barcode kamera telefonu", "Push dla waznych informacji"] },
      ],
      flowEyebrow: "Przeplyw",
      flowTitle: "Od zlecenia do raportu",
      flowText: "Wspolna droga dla zarzadzania, zespolu i dokumentacji.",
      flowSteps: ["Zlecenie", "Plan", "Workzone", "Raport", "Eksport"],
      flowPoints: ["Miejsca pracy i listy drzew przejmowane strukturalnie", "Gotowa dokumentacja do rozliczen i dowodow"],
      urgentEyebrow: "Pilne miejsce pracy w kilka minut",
      urgentTitle: "Spontaniczna prace zapisac czysto",
      urgentText: "Zdjecie, notatka, nowe miejsce pracy. Zespol widzi je od razu.",
      urgentSteps: ["Zgloszenie", "Zdjecie", "Miejsce", "Zespol", "Raport"],
      urgentPoints: ["Dobre dla szkod po burzy, przewroconych drzew i spontanicznych zlecen."],
      treeEyebrow: "Dane drzew dobrze zintegrowane",
      treeTitle: "Dane drzew, kamera i logika NFC-ready",
      treeText: "Listy drzew, Tree-ID i punkty mapy pozostaja polaczone z praca w terenie.",
      treePoints: ["Tree-ID i logika barcode prowadza do wlasciwego obiektu.", "Referencje NFC-ready sa przygotowane dla drzew i magazynu.", "Re-importy zachowuja ta sama referencje operacyjna.", "Dokumentacja, eksporty i raporty pozostaja sledzalne."],
      footnote: "Jeden dzien. Jeden plan. Jeden raport.",
    },
    calculator: {
      eyebrow: "Kalkulacja",
      title: "Niemiecka kalkulacja z jasna logika kosztow",
      text: "Pozycje budowane sa wedlug EK, BGK, HK, AGK, SK, ryzyka/zysku, netto i VAT/brutto.",
      points: ["EK z pracy, maszyn, materialu i podwykonawstwa", "Baza BGK na calym EK albo tylko na pracy", "Ryzyko/zysk oddzielnie lub razem"],
      note: "Silnik jest jedynym zrodlem kalkulacji.",
    },
    positioning: {
      eyebrow: "Wiecej niz software",
      title: "System operacyjny dla calej firmy arborystycznej",
      text: "BaumdienstFlow laczy planowanie, teren, ludzi, maszyny, dokumentacje i asystencje w jeden ciagly system - nie jako osobne narzedzia, lecz jako jasny przeplyw pracy.",
      lines: ["Wszystkie obszary pracuja razem, nie obok siebie", "Informacje sa tam, gdzie sa potrzebne", "Firma pozostaje widoczna i sterowalna w kazdej chwili"],
    },
    security: {
      eyebrow: "Bezpieczenstwo",
      title: "Jasne role, jasne dane",
      text: "Dostep, produkcyjne uzycie i asystencja pozostaja czysto rozdzielone.",
      points: ["Role dla admina, workera i display", "Ten sam wyglad logo, oddzielny scope assistant", "Worker Helper tylko dla widocznych funkcji Workzone"],
      notes: ["Wazne informacje pozostaja sledzalne i chronione."],
    },
    sections: {
      signal: [
        { title: "Koniec z dwiema prawdami miedzy biurem i terenem.", text: "Kierownictwo planuje, zespol pracuje na miejscu, a firma dokumentuje na tej samej bazie operacyjnej." },
        { title: "Nie narzedzie ogolne, lecz logika dla firm arborystycznych.", text: "Miejsca pracy, drzewa, maszyny, safety, plan dnia i raport sa w rdzeniu produktu." },
        { title: "Mniej improwizacji, wiecej profesjonalnego spokoju.", text: "Przejrzystosc, historia i strukturalne raportowanie zmniejszaja szukanie i tarcie operacyjne." },
      ],
      productIntro: { eyebrow: "Architektura produktu", title: "Zbudowane dla realnosci operacyjnej firmy arborystycznej.", text: "Sila BaumdienstFlow nie lezy w jednym module, ale w tym, jak dyspozycja, teren, kontekst zespolu, flota, magazyn, asystencja i analiza dzialaja razem." },
      capabilities: [
        { icon: Workflow, title: "Workzone dla realnej pracy w terenie", text: "Miejsca pracy, drzewa, zadania manualne, status materialu i postep lacza sie w mobilnym widoku." },
        { icon: CalendarDays, title: "Plan dnia z jasnoscia operacyjna", text: "Pracownicy i maszyny sa przypisani do realnych miejsc pracy. Plan zostaje widoczny, edytowalny i sledzalny." },
        { icon: ClipboardList, title: "Raporty i dokumentacja", text: "Raporty dzienne, godziny miesieczne, dokumenty miejsca pracy i notatki powstaja w workflow, nie po fakcie." },
        { icon: Users2, title: "Personel i profile pracownikow", text: "Status, urlop, dokumenty, wyposazenie, profile i kontekst raportow pozostaja polaczone z firma." },
        { icon: HardHat, title: "Flota i kontekst pracy", text: "Maszyny, uwagi, dane techniczne i widocznosc operacyjna sa czescia dnia, nie osobna administracja." },
        { icon: ScanLine, title: "Magazyn Barcode & NFC z historia", text: "Narzedzia, odziez i wydania sa prowadzone jako pojedyncze artykuly kamera telefonu i NFC, z jasnym przypisaniem i historia." },
      ],
      audienceIntro: { eyebrow: "Dla kogo", title: "Mocne dla zarzadzania, mocne dla terenu, mocne dla calej firmy.", text: "" },
      audience: [
        { title: "Dla dyspozycji i kierownictwa", text: "Kierownictwo nie potrzebuje wiecej narzedzi, lecz jasnego widoku dnia.", bullets: ["Plan dnia wedlug miejsc pracy zamiast kartek", "Dashboard dla godzin, postepu i safety", "Widocznosc zespolow, maszyn i otwartych punktow"] },
        { title: "Dla zespolu w terenie", text: "Na miejscu liczy sie prostota, orientacja i natychmiastowa widocznosc.", bullets: ["Workzone ze statusem miejsca pracy i zadaniami", "Material, dokumenty i raporty bezposrednio w flow", "Uzycie mobilne zamiast papieru uzupelnianego pozniej"] },
        { title: "Dla calej firmy", text: "Nowoczesna firma wyglada mocniej, gdy procesy sa polaczone.", bullets: ["Personel, flota i magazyn w tym samym systemie", "Czysta baza danych dla raportow i prezentacji", "Wiecej profesjonalizmu wobec zespolu, partnerow i klientow"] },
      ],
      dayLogic: {
        eyebrow: "Logika dnia",
        title: "Dzien pracy, ktory cyfrowo sie nie rozpada.",
        text: "BaumdienstFlow nie tylko pokazuje dane. Strukturyzuje prawdziwa kolejnosc dnia operacyjnego, aby orientacja, odpowiedzialnosc i dokumentacja powstawaly razem.",
        points: [{ label: "Wiecej przegladu:", text: "sytuacja dnia, status zespolu, postep i otwarte punkty pozostaja widoczne." }, { label: "Mniej szukania:", text: "dokumenty, profile, maszyny, material i raporty nie sa juz w oddzielnych swiatach." }, { label: "Wiecej profesjonalizmu:", text: "platforma uspokaja firme wewnatrz i wzmacnia wiarygodnosc na zewnatrz." }],
        timeline: [{ number: "01", title: "Poranna dyspozycja", text: "Dzien zaczyna sie jasnym przydzialem zespolu i maszyn do realnych miejsc pracy." }, { number: "02", title: "Orientacja w terenie", text: "Workzone pokazuje zadania, status, dokumenty, material i postep tam, gdzie odbywa sie praca." }, { number: "03", title: "Biezaca dokumentacja", text: "Czas, drzewa, taski, safety i ruchy sa zapisywane w procesie, nie z pamieci pozniej." }, { number: "04", title: "Kontrola na koniec dnia", text: "Dashboard, profile, raporty i magazyn zamieniaja dzien w profesjonalny przeglad operacyjny." }],
      },
      previewsIntro: { eyebrow: "Workflow", title: "Co obsluguje produkt", text: "Krotko i jasno: najwazniejsze zadania, ktore BaumdienstFlow laczy w dniu pracy." },
      previews: [{ title: "Sterowac praca live", text: "Miejsca pracy, drzewa, material i postep pozostaja widoczne podczas pracy." }, { title: "Planowac dzien", text: "Zespoly i maszyny sa jasno przypisane do realnych miejsc pracy." }, { title: "Zachowac kontrole", text: "Godziny, postep, bezpieczenstwo i otwarte punkty pozostaja widoczne dla kierownictwa." }, { title: "Polaczyc flote i raport", text: "Maszyny, miejsca pracy i pracownicy pozostaja sledzalni w kontekscie pracy." }],
      market: {
        eyebrow: "Pozycjonowanie",
        title: "BaumdienstFlow nie jest kolejnym frontendem administracyjnym. To wyspecjalizowana platforma operacyjna.",
        text: "Marka ma byc spokojna, kompetentna i bliska praktyce: nie teoretyczna obietnica SaaS, lecz cyfrowa struktura dla realnej pracy z drzewami.",
        points: [{ label: "Idealne dla:", text: "firm arborystycznych, dyspozycji, mobilnego sterowania miejscami pracy i profesjonalnej organizacji dnia." }, { label: "Efekt marki:", text: "cyfrowa, uporzadkowana, wiarygodna, bliska terenowi." }, { label: "Nastepny krok:", text: "tryb demo i dostep testowy bezposrednio z tej samej historii produktu." }],
      },
    },
    footer: { text: "Platforma operacyjna dla nowoczesnych firm arborystycznych.", access: "Dostep wewnetrzny" },
  },
  ro: {
    meta: {
      title: "BaumdienstFlow - Sistemul operational pentru firme de servicii arboricole",
      description: "BaumdienstFlow conecteaza Workzone, planificarea zilnica, echipa, flota, inventarul, rapoartele si asistenta intr-o platforma pentru firme moderne de servicii arboricole.",
    },
    language: { label: "Limba", auto: "Automat dupa browser", options: { de: "Deutsch", en: "English", sq: "Shqip", it: "Italiano", pl: "Polski", ro: "Romana" } },
    hero: {
      eyebrow: "Software pentru servicii arboricole",
      title: "BaumdienstFlow",
      text: "Workzone, plan zilnic si rapoarte intr-un sistem operational clar.",
      note: "Direct in browser. Fara instalare.",
      previewBadge: "Previzualizare live",
      previewTitle: "Previzualizare sistem live",
      previewSubtitle: "Workzone / Planificare / Dashboard",
      previewFooter: "Vedere reala din aplicatie",
      values: [
        { icon: CalendarDays, label: "Plan zilnic pentru echipa si masini" },
        { icon: MapPinned, label: "Workzone live pentru santiere" },
        { icon: HardDriveDownload, label: "Rapoarte si exporturi gata rapid" },
        { icon: MonitorSmartphone, label: "Util in birou si pe mobil" },
      ],
    },
    problemSolution: {
      problemsEyebrow: "Probleme",
      problemsTitle: "Munca zilnica este adesea prea imprastiata",
      problems: ["Planificare prin WhatsApp, hartie sau Excel", "Nu este clar cine unde lucreaza", "Documentele lipsesc exact cand sunt necesare", "Masinile, termenele si controalele sunt uitate"],
      solutionsEyebrow: "Solutie",
      solutionsTitle: "Un flux calm de la plan la raport",
      solutions: ["Plan zilnic si Workzone intr-un singur loc", "Imagine live pentru echipe si santiere", "Documentatie direct in procesul de lucru", "Admin Assistant si Worker Helper cu acces separat"],
      footnote: "",
    },
    features: {
      eyebrow: "Zone principale",
      title: "Ziua de lucru intr-un singur sistem",
      text: "",
      cards: [
        { title: "Plan zilnic", icon: CalendarDays, points: ["Aloca echipe si masini", "Modificarile sunt vizibile imediat"] },
        { title: "Workzone", icon: HardHat, points: ["Status santier live", "Sarcini si progres pe teren"] },
        { title: "Raport & export", icon: ClipboardList, points: ["Rapoarte din fluxul de lucru", "Dovada fara munca dubla"] },
        { title: "Echipa & profile", icon: Users2, points: ["Ore, concedii, documente", "Echipament pe fiecare worker"] },
        { title: "Flota & inventar", icon: Truck, points: ["Masini, GPS si controale vizibile", "Raport zilnic cu context de lucru"] },
        { title: "Scan & notificari", icon: ScanLine, points: ["Barcode cu camera telefonului", "Push pentru mesaje importante"] },
      ],
      flowEyebrow: "Flux",
      flowTitle: "De la lucrare la raport",
      flowText: "Un drum comun pentru management, echipa si documentatie.",
      flowSteps: ["Lucrare", "Plan", "Workzone", "Raport", "Export"],
      flowPoints: ["Santierele si listele de arbori sunt preluate structurat", "Documentatie gata pentru facturare si dovada"],
      urgentEyebrow: "Santier urgent in cateva minute",
      urgentTitle: "Inregistreaza curat lucrarile spontane",
      urgentText: "Foto, nota, santier nou. Echipa il vede direct.",
      urgentSteps: ["Mesaj", "Foto", "Santier", "Echipa", "Raport"],
      urgentPoints: ["Util pentru daune de furtuna, arbori cazuti si lucrari spontane."],
      treeEyebrow: "Datele arborilor integrate curat",
      treeTitle: "Date arbori, camera si logica NFC-ready",
      treeText: "Listele de arbori, Tree-ID si punctele pe harta raman conectate cu munca de pe teren.",
      treePoints: ["Tree-ID si logica barcode duc la obiectul corect.", "Referintele NFC-ready sunt pregatite pentru arbori si inventar.", "Re-importurile pastreaza aceeasi referinta operationala.", "Documentatia, exporturile si rapoartele raman trasabile."],
      footnote: "O zi. Un plan. Un raport.",
    },
    calculator: {
      eyebrow: "Calculatie",
      title: "Calculatie germana cu logica clara a costurilor",
      text: "Pozitiile urmeaza EK, BGK, HK, AGK, SK, risc/profit, net si TVA/brut.",
      points: ["EK din munca, masini, material si subcontractare", "Baza BGK pe EK total sau doar pe munca", "Risc/profit separat sau combinat"],
      note: "Motorul este singura sursa de calcul.",
    },
    positioning: {
      eyebrow: "Mai mult decat software",
      title: "Un sistem operational pentru intreaga firma arboricola",
      text: "BaumdienstFlow conecteaza planificarea, terenul, oamenii, masinile, documentatia si asistenta intr-un sistem continuu - nu ca instrumente separate, ci ca flux de lucru clar.",
      lines: ["Toate zonele lucreaza impreuna, nu separat", "Informatiile sunt acolo unde sunt necesare", "Firma ramane vizibila si controlabila in orice moment"],
    },
    security: {
      eyebrow: "Securitate",
      title: "Roluri clare, date clare",
      text: "Accesul, utilizarea productiva si asistenta raman separate curat.",
      points: ["Roluri pentru admin, worker si display", "Acelasi aspect de logo, scope assistant separat", "Worker Helper doar pentru functii Workzone vizibile"],
      notes: ["Informatiile importante raman trasabile si protejate."],
    },
    sections: {
      signal: [
        { title: "Fara doua adevaruri intre birou si teren.", text: "Managementul planifica, echipa lucreaza pe teren si firma documenteaza pe aceeasi baza operationala." },
        { title: "Nu un tool generic, ci logica specifica pentru servicii arboricole.", text: "Santierele, arborii, masinile, safety, planul zilnic si raportul sunt in nucleul produsului." },
        { title: "Mai putina improvizatie, mai mult calm profesional.", text: "Transparenta, istoricul si raportarea structurata reduc cautarea si frecarea operationala." },
      ],
      productIntro: { eyebrow: "Arhitectura produsului", title: "Construit pentru realitatea operationala a unei firme arboricole.", text: "Puterea BaumdienstFlow nu este un singur modul, ci felul in care dispeceratul, terenul, contextul echipei, flota, inventarul, asistenta si analiza lucreaza impreuna." },
      capabilities: [
        { icon: Workflow, title: "Workzone pentru munca reala pe teren", text: "Santiere, arbori, sarcini manuale, status material si progres se unesc intr-o vedere mobila." },
        { icon: CalendarDays, title: "Plan zilnic cu claritate operationala", text: "Workerii si masinile sunt alocati pe santiere reale. Planul ramane vizibil, editabil si trasabil." },
        { icon: ClipboardList, title: "Rapoarte si documentatie", text: "Rapoartele zilnice, orele lunare, documentele de santier si notitele sunt create in workflow, nu adaugate mai tarziu." },
        { icon: Users2, title: "Personal si profile worker", text: "Statusul, concediile, documentele, echipamentul, profilele si contextul rapoartelor raman conectate cu firma." },
        { icon: HardHat, title: "Flota si context de lucru", text: "Masinile, notele, datele tehnice si vizibilitatea operationala raman parte din zi, nu administratie separata." },
        { icon: ScanLine, title: "Inventar Barcode & NFC cu istoric", text: "Uneltele, hainele si predarile sunt urmarite ca articole individuale cu camera telefonului si NFC, cu alocare clara si istoric." },
      ],
      audienceIntro: { eyebrow: "Pentru cine", title: "Puternic pentru management, puternic pentru teren, puternic pentru intreaga firma.", text: "" },
      audience: [
        { title: "Pentru dispecerat si management", text: "Managementul nu are nevoie de mai multe tool-uri, ci de o vedere zilnica clara.", bullets: ["Plan zilnic pe santiere in loc de hartii", "Dashboard pentru ore, progres si safety", "Vizibilitate asupra echipelor, masinilor si punctelor deschise"] },
        { title: "Pentru echipa de pe teren", text: "Pe santier conteaza simplitatea, orientarea si vizibilitatea imediata.", bullets: ["Workzone cu status santier si sarcini", "Material, documente si rapoarte direct in flow", "Utilizare mobila in loc de completare pe hartie mai tarziu"] },
        { title: "Pentru intreaga firma", text: "O firma moderna arata mai puternic cand procesele sunt conectate.", bullets: ["Personal, flota si inventar in acelasi sistem", "Baza de date curata pentru rapoarte si prezentari", "Mai mult profesionalism fata de echipa, parteneri si clienti"] },
      ],
      dayLogic: {
        eyebrow: "Logica zilnica",
        title: "O zi de lucru care nu se rupe digital.",
        text: "BaumdienstFlow nu doar afiseaza date. Structureaza ordinea reala a unei zile operationale, astfel incat orientarea, responsabilitatea si documentatia sa apara impreuna.",
        points: [{ label: "Mai multa imagine:", text: "situatia zilei, statusul echipei, progresul si punctele deschise raman vizibile." }, { label: "Mai putina cautare:", text: "documentele, profilele, masinile, materialul si rapoartele nu mai stau in lumi separate." }, { label: "Mai mult profesionalism:", text: "platforma face firma mai calma in interior si mai credibila in exterior." }],
        timeline: [{ number: "01", title: "Dispecerat dimineata", text: "Ziua incepe cu alocare clara a echipei si masinilor pe santiere reale." }, { number: "02", title: "Orientare pe teren", text: "Workzone arata sarcini, status, documente, material si progres exact unde se lucreaza." }, { number: "03", title: "Documentatie continua", text: "Orele, arborii, taskurile, safety si miscarile sunt capturate in proces, nu din memorie mai tarziu." }, { number: "04", title: "Control la finalul zilei", text: "Dashboard, profile, rapoarte si inventar transforma ziua intr-o imagine operationala profesionala." }],
      },
      previewsIntro: { eyebrow: "Workflow", title: "Ce gestioneaza produsul", text: "Scurt si clar: sarcinile principale pe care BaumdienstFlow le conecteaza in ziua de lucru." },
      previews: [{ title: "Condu munca live", text: "Santierele, arborii, materialul si progresul raman vizibile in timpul lucrului." }, { title: "Planifica ziua", text: "Echipele si masinile sunt alocate clar pe santiere reale." }, { title: "Pastreaza controlul", text: "Orele, progresul, siguranta si punctele deschise raman vizibile pentru management." }, { title: "Conecteaza flota si raportul", text: "Masinile, santierele si workerii raman trasabili in contextul muncii." }],
      market: {
        eyebrow: "Pozitionare",
        title: "BaumdienstFlow nu este inca un frontend administrativ. Este o platforma operationala specializata.",
        text: "Brandul trebuie sa para calm, competent si aproape de practica: nu o poveste SaaS teoretica, ci structura digitala pentru munca reala cu arbori.",
        points: [{ label: "Ideal pentru:", text: "servicii arboricole, dispecerat, control mobil de santier si organizare zilnica profesionala." }, { label: "Efect de brand:", text: "digital, structurat, credibil, aproape de teren." }, { label: "Urmatorul pas:", text: "mod demo si acces de test direct din aceeasi poveste de produs." }],
      },
    },
    footer: { text: "Platforma operationala pentru firme moderne de servicii arboricole.", access: "Acces intern" },
  },
};
