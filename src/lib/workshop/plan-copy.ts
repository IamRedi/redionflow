export function demoPlanCopy(lang: string) {
  const i = ({ de: 0, sq: 1, en: 2, it: 3, pl: 4, ro: 5 } as Record<string, number>)[lang] ?? 2;
  const l = (s: string) => s.split("|")[i];
  return {
    prepare: l("Plan erstellen|Bëj planin|Create plan|Crea piano|Utwórz plan|Creează planul"),
    hint: l("Planen ändert keine Übergabe. Geräte bleiben mit Inventar und Werkstatt verbunden.|Plani nuk ndryshon dorëzimin. Pajisjet mbeten të lidhura me inventarin dhe Werkstatt-in.|Planning does not change custody. Equipment stays linked to inventory and workshop.|La pianificazione non cambia la consegna. Attrezzi collegati a inventario e officina.|Planowanie nie zmienia przekazania. Sprzęt pozostaje połączony z magazynem i warsztatem.|Planificarea nu schimbă predarea. Echipamentele rămân legate de inventar și atelier."),
    calendar: l("Kalender und Versionen|Kalendari dhe versionet|Calendar and versions|Calendario e versioni|Kalendarz i wersje|Calendar și versiuni"),
    readOnly: l("Mitarbeiter sehen den Plan. Die Leitung plant und speichert.|Punonjësit shohin planin. Shefi planifikon dhe ruan.|Workers view the plan. Management prepares and saves it.|I lavoratori consultano il piano. La direzione pianifica e salva.|Pracownicy widzą plan. Kierownictwo planuje i zapisuje.|Lucrătorii văd planul. Conducerea planifică și salvează."),
    choose: l("Hier zuordnen|Cakto këtu|Assign here|Assegna qui|Przypisz tutaj|Atribuie aici"),
    remove: l("Entfernen|Hiqe|Remove|Rimuovi|Usuń|Elimină"),
    saved: l("Gespeichert|U ruajt|Saved|Salvato|Zapisano|Salvat"),
    prepared: l("Plan bereit. Auswahl antippen, dann die Baustelle wählen.|Plani gati. Prek punonjësin ose pajisjen, pastaj kantierin.|Plan ready. Select a worker or device, then choose the site.|Piano pronto. Seleziona persona o attrezzo, poi il cantiere.|Plan gotowy. Wybierz osobę lub sprzęt, potem budowę.|Plan pregătit. Selectează persoana sau echipamentul, apoi șantierul."),
    confirm: l("Diese Person ist nicht verfügbar oder im Urlaub. Trotzdem planen?|Ky punonjës nuk është në dispozicion ose është me pushim. Ta caktosh gjithsesi?|This worker is unavailable or on leave. Assign anyway?|Questo lavoratore non è disponibile o è in ferie. Assegnare comunque?|Pracownik jest niedostępny lub na urlopie. Przypisać mimo to?|Lucrătorul nu este disponibil sau este în concediu. Atribui oricum?"),
    blocked: l("Gerät in der Werkstatt oder Prüfung abgelaufen. Bitte zuerst im Inventar klären.|Pajisja është në Werkstatt ose ka kontroll të skaduar. Zgjidhe fillimisht në inventar.|Equipment is in the workshop or its inspection expired. Resolve it in inventory first.|Attrezzo in officina o controllo scaduto. Verifica prima nell’inventario.|Sprzęt w warsztacie lub przegląd wygasł. Najpierw sprawdź magazyn.|Echipament în atelier sau verificare expirată. Rezolvă mai întâi în inventar."),
    historyHint: l("Gespeicherte Versionen bleiben erhalten. Ein leerer Entwurf löscht keine frühere Version.|Versionet e ruajtura mbeten. Pastrimi i draftit nuk fshin versionet e mëparshme.|Saved versions remain available. Clearing a draft does not delete previous versions.|Le versioni salvate restano disponibili. Svuotare la bozza non elimina quelle precedenti.|Zapisane wersje pozostają. Wyczyszczenie szkicu nie usuwa poprzednich wersji.|Versiunile salvate rămân. Golirea ciornei nu șterge versiunile anterioare."),
  };
}
