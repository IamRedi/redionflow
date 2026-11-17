/** UI grouping only: the established factory/field workflow remains unchanged. */
export type MaterialGroup = "assembly" | "part" | "manual";
export function materialGroup(element: { list: string; isManual?: boolean }): MaterialGroup {
  return element.list === "part" ? "part" : element.isManual ? "manual" : "assembly";
}

export type AssemblyParts = { v: 1; parts: Array<{ mark: string; quantity: number }>; sourceFile?: string; importedAt?: string };
export function readAssemblyParts(value: unknown): AssemblyParts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.v !== 1 || !Array.isArray(row.parts)) return null;
  const parts: AssemblyParts["parts"] = [];
  for (const part of row.parts) {
    if (!part || typeof part !== "object" || typeof part.mark !== "string" || !part.mark.trim()
      || !Number.isSafeInteger(part.quantity) || part.quantity <= 0) return null;
    parts.push({ mark: part.mark, quantity: part.quantity });
  }
  return { v: 1, parts,
    ...(typeof row.sourceFile === 'string' && row.sourceFile.length <= 260 ? { sourceFile: row.sourceFile } : {}),
    ...(typeof row.importedAt === 'string' && Number.isFinite(Date.parse(row.importedAt)) ? { importedAt: row.importedAt } : {}),
  };
}

const en = {
  assembly: "Assemblies", part: "Single Parts", manual: "Elements", add: "Add element", mark: "Code", name: "Name", quantity: "Quantity", save: "Add", manualHint: "Choose this element’s processes manually. No process is selected automatically.",
  components: "Single Parts · composition", exported: "Quantities as listed in the export. Links do not record work or allocate stock.", missing: "Not in Single Parts yet", open: "Open Single Part", collision: "This code belongs to a manual element. Change its code before importing an assembly with that code.", duplicate: "This code already exists in this site’s assemblies or elements.",
};
const copies: Record<string, typeof en> = {
  en,
  sq: { assembly: "Asamblime", part: "Single Parts", manual: "Elementet", add: "Shto element", mark: "Kodi", name: "Emri", quantity: "Sasia", save: "Shto", manualHint: "Proceset e këtij elementi zgjidhen manualisht. Asnjë proces nuk caktohet automatikisht.", components: "Single Parts · përbërja", exported: "Sasitë si në eksport. Lidhjet nuk regjistrojnë punë dhe nuk rezervojnë stok.", missing: "Ende mungon te Single Parts", open: "Hap Single Part", collision: "Ky kod i përket një elementi manual. Ndrysho kodin e tij para importimit të një asambli me të njëjtin kod.", duplicate: "Ky kod ekziston te asamblimet ose elementet e këtij kantieri." },
  de: { assembly: "Baugruppen", part: "Single Parts", manual: "Elemente", add: "Element hinzufügen", mark: "Code", name: "Name", quantity: "Menge", save: "Hinzufügen", manualHint: "Prozesse dieses Elements manuell wählen. Es werden keine Prozesse automatisch zugeordnet.", components: "Single Parts · Bestandteile", exported: "Mengen laut Export. Verknüpfungen erfassen keine Arbeit und reservieren keinen Bestand.", missing: "Noch nicht in Single Parts", open: "Single Part öffnen", collision: "Dieser Code gehört zu einem manuellen Element. Vor dem Baugruppenimport dessen Code ändern.", duplicate: "Dieser Code existiert bereits bei Baugruppen oder Elementen dieser Baustelle." },
  it: { assembly: "Assemblaggi", part: "Single Parts", manual: "Elementi", add: "Aggiungi elemento", mark: "Codice", name: "Nome", quantity: "Quantità", save: "Aggiungi", manualHint: "Scegli manualmente i processi dell’elemento. Nessun processo viene assegnato automaticamente.", components: "Single Parts · componenti", exported: "Quantità riportate nell’esportazione. I collegamenti non registrano lavoro né riservano scorte.", missing: "Non ancora in Single Parts", open: "Apri Single Part", collision: "Questo codice appartiene a un elemento manuale. Modificarne il codice prima di importare l’assemblaggio.", duplicate: "Questo codice esiste già negli assemblaggi o elementi del cantiere." },
  ro: { assembly: "Ansambluri", part: "Single Parts", manual: "Elemente", add: "Adaugă element", mark: "Cod", name: "Nume", quantity: "Cantitate", save: "Adaugă", manualHint: "Alege manual procesele elementului. Niciun proces nu este atribuit automat.", components: "Single Parts · componente", exported: "Cantitățile din export. Legăturile nu înregistrează muncă și nu rezervă stoc.", missing: "Lipsește încă din Single Parts", open: "Deschide Single Part", collision: "Codul aparține unui element manual. Schimbă codul înainte de importul ansamblului.", duplicate: "Codul există deja în ansamblurile sau elementele șantierului." },
  pl: { assembly: "Zespoły", part: "Single Parts", manual: "Elementy", add: "Dodaj element", mark: "Kod", name: "Nazwa", quantity: "Ilość", save: "Dodaj", manualHint: "Wybierz procesy elementu ręcznie. Żaden proces nie jest przypisywany automatycznie.", components: "Single Parts · skład", exported: "Ilości z eksportu. Powiązania nie rejestrują pracy ani nie rezerwują zapasów.", missing: "Jeszcze brak w Single Parts", open: "Otwórz Single Part", collision: "Ten kod należy do elementu ręcznego. Zmień jego kod przed importem zespołu.", duplicate: "Ten kod już istnieje w zespołach lub elementach budowy." },
};
export const materialGroupCopy = (lang: string) => copies[lang] ?? en;
