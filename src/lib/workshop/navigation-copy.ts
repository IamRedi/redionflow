const de = {
  panel: "Kontrollpanel", panelHint: "Bestehende Abläufe direkt öffnen. Alle Einträge bleiben mit demselben Datenbestand verbunden.",
  dashboard: "Dashboard", tv: "Auf TV öffnen", tvTitle: "TV-Ansicht", tvHint: "Nur Ansicht · automatisch alle 60 Sekunden aktualisiert", fullScreen: "Vollbild", refresh: "Aktualisieren", back: "Zur Workzone", operations: "Arbeit & Planung", resources: "Team & Betriebsmittel", records: "Dokumente & Historie", team: "Team", sites: "Baustellen", plan: "Tagesplan", calendar: "Kalender", settings: "Einstellungen & Übergaben", roleHint: "Demo-Rollen · Aktionen behalten ihre vorhandenen Berechtigungen und Bestätigungen.",
  plate: "Kennzeichen", optionalBarcode: "Barcode · optional", plateHint: "Das Kennzeichen identifiziert das Fahrzeug. Ein Barcode wird nur bei Bedarf zusätzlich vergeben.", addBarcode: "Optionalen Barcode hinzufügen", generateBarcode: "Code erzeugen", barcodeHint: "Ein eigener zusätzlicher Tag; das Kennzeichen wird nicht als Barcode gedruckt.",
};
const sq: typeof de = {
  panel: "Paneli i kontrollit", panelHint: "Hap drejtpërdrejt rrjedhat ekzistuese. Çdo hyrje lidhet me të njëjtat të dhëna.",
  dashboard: "Dashboard", tv: "Hap në TV", tvTitle: "Pamja TV", tvHint: "Vetëm shikim · rifreskohet automatikisht çdo 60 sekonda", fullScreen: "Ekran i plotë", refresh: "Rifresko", back: "Kthehu te Workzone", operations: "Puna & planifikimi", resources: "Ekipi & pajisjet", records: "Dokumentet & historiku", team: "Ekipi", sites: "Kantieret", plan: "Plani ditor", calendar: "Kalendari", settings: "Cilësimet & dorëzimet", roleHint: "Rolet demo · veprimet ruajnë lejet dhe konfirmimet ekzistuese.",
  plate: "Targa", optionalBarcode: "Barkod · opsional", plateHint: "Mjeti identifikohet me targën. Barkodi shtohet veçmas vetëm kur nevojitet.", addBarcode: "Shto barkod opsional", generateBarcode: "Gjenero kod", barcodeHint: "Etiketë shtesë më vete; targa nuk printohet si barkod.",
};
const en: typeof de = {
  panel: "Control panel", panelHint: "Open the existing workflows directly. Every entry uses the same underlying records.",
  dashboard: "Dashboard", tv: "Open on TV", tvTitle: "TV view", tvHint: "View only · refreshes automatically every 60 seconds", fullScreen: "Full screen", refresh: "Refresh", back: "Back to Workzone", operations: "Work & planning", resources: "Team & equipment", records: "Documents & history", team: "Team", sites: "Worksites", plan: "Daily plan", calendar: "Calendar", settings: "Settings & handovers", roleHint: "Demo roles · actions retain their existing permissions and confirmations.",
  plate: "Registration plate", optionalBarcode: "Barcode · optional", plateHint: "The registration plate identifies the vehicle. A separate barcode is added only when needed.", addBarcode: "Add optional barcode", generateBarcode: "Generate code", barcodeHint: "A separate additional tag; the registration plate is not printed as a barcode.",
};
export const navigationCopy = (lang: string) => lang === "sq" ? sq : lang === "en" ? en : de;
