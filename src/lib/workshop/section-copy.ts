const en = { folder: "Section folder", reports: "Reports & history", sharedParts: "Shared spare-parts stock", machine: "Vehicle record" };
const de: typeof en = { folder: "Bereichsakte", reports: "Berichte & Historie", sharedParts: "Gemeinsamer Ersatzteilbestand", machine: "Fahrzeugakte" };
const sq: typeof en = { folder: "Dosja e seksionit", reports: "Raporte & historiku", sharedParts: "Stoku i përbashkët i pjesëve", machine: "Dosja e mjetit" };
const it: typeof en = { folder: "Fascicolo del reparto", reports: "Rapporti e storico", sharedParts: "Scorta ricambi condivisa", machine: "Scheda del veicolo" };
const pl: typeof en = { folder: "Dokumentacja działu", reports: "Raporty i historia", sharedParts: "Wspólny magazyn części", machine: "Dokumentacja pojazdu" };
const ro: typeof en = { folder: "Dosarul secțiunii", reports: "Rapoarte și istoric", sharedParts: "Stoc comun de piese", machine: "Dosarul vehiculului" };
export function sectionCopy(lang: string): typeof en { return ({ de, sq, it, pl, ro } as Record<string, typeof en>)[lang] ?? en; }
