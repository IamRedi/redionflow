import type { Language } from '@/lib/i18n';

const en = {
  appid: 'APPID',
  integrations: 'Integrations',
  title: 'WanWay GPS',
  subtitle: 'Read-only connection · link GPS devices to your existing vehicles',
  save: 'Save / Update',
  disconnect: 'Disconnect',
  test: 'Test Connection',
  sync: 'Manual Sync / Refresh',
  saved: 'Saved',
  done: 'Completed',
  failed: 'Request failed',
  pending: 'Working…',
  key: 'API KEY',
  keyHint:
    'Leave blank to keep the saved key. A replacement clears device links.',
  keyMissing:
    'Server encryption is not configured. Contact your administrator.',
  privacy:
    'I confirm permission to access these devices and that employee notice, lawful purpose, retention and provider terms have been reviewed.',
  status: 'Connection status',
  lastSync: 'Last successful sync',
  devices: 'Discovered devices',
  empty: 'Save credentials, then test the connection to discover devices.',
  link: 'Confirm link',
  unlink: 'No vehicle / Unlink',
  unavailable: 'No longer returned by provider',
  vehicle: 'Existing vehicle',
  suggested: 'Matching vehicle selected. Check it and confirm the link.',
  suffix: 'Device ending',
  fleet: 'Open Fleet GPS',
  back: 'Settings',
  online: 'Online at last sync',
  offline: 'Offline / status unknown',
  stale: 'Outdated data',
  lastPosition: 'Last reported position',
  speed: 'Speed',
  voltage: 'External voltage',
  mileage: 'Distance in last 24h (provider statistics)',
  history: 'Load route · last 24h',
  historyAt: 'Route fetched',
  noHistory: 'No route loaded',
  map: 'Show map',
  noPosition: 'No reported GPS position',
  reporting: 'GPS report',
  snapshot: 'Snapshot synced',
  noValue: 'Not provided',
  configured: 'Configured',
  disconnected: 'Disconnected',
  connected: 'Connected',
  error: 'Error',
  lastError: 'Last error',
  mapPrivacy: 'Map tiles are loaded from OpenStreetMap when you open the map.',
  readonly:
    'Commands and device configuration are disabled. Sync is manual; requests are limited to once per minute.',
  disconnectConfirm: 'Disconnect and remove cached device data and links?',
  confirm: 'Confirm disconnect',
  cancel: 'Cancel',
};
const sq: typeof en = {
  appid: 'APPID',
  integrations: 'Integrimet',
  title: 'WanWay GPS',
  subtitle: 'Lidhje vetëm për lexim · lidh GPS-të me mjetet ekzistuese',
  save: 'Ruaj / Përditëso',
  disconnect: 'Shkëput',
  test: 'Provo lidhjen',
  sync: 'Sinkronizo / Rifresko',
  saved: 'U ruajt',
  done: 'U përfundua',
  failed: 'Kërkesa dështoi',
  pending: 'Duke punuar…',
  key: 'API KEY',
  keyHint:
    'Lëre bosh për të mbajtur KEY të ruajtur. Zëvendësimi heq lidhjet GPS/mjete.',
  keyMissing:
    'Enkriptimi në server nuk është konfiguruar. Kontakto administratorin.',
  privacy:
    'Konfirmoj autorizimin për këto pajisje dhe shqyrtimin e njoftimit të punonjësve, qëllimit ligjor, ruajtjes së të dhënave dhe kushteve të ofruesit.',
  status: 'Gjendja e lidhjes',
  lastSync: 'Sinkronizimi i fundit i suksesshëm',
  devices: 'Pajisjet e gjetura',
  empty: 'Ruaj kredencialet dhe provo lidhjen për të gjetur pajisjet.',
  link: 'Konfirmo lidhjen',
  unlink: 'Pa mjet / Hiq lidhjen',
  unavailable: 'Nuk kthehet më nga ofruesi',
  vehicle: 'Mjeti ekzistues',
  suggested: 'Mjeti përkatës u zgjodh. Kontrolloje dhe konfirmo lidhjen.',
  suffix: 'Pajisja me fund',
  fleet: 'Hap flotën GPS',
  back: 'Cilësimet',
  online: 'Online në sinkronizimin e fundit',
  offline: 'Offline / gjendje e panjohur',
  stale: 'Të dhëna të vjetruara',
  lastPosition: 'Pozicioni i fundit i raportuar',
  speed: 'Shpejtësia',
  voltage: 'Tensioni i jashtëm',
  mileage: 'Distanca në 24 orët e fundit (statistika e ofruesit)',
  history: 'Lexo rrugën · 24 orët e fundit',
  historyAt: 'Rruga u lexua',
  noHistory: 'Rruga nuk është lexuar',
  map: 'Shfaq hartën',
  noPosition: 'Pa pozicion GPS të raportuar',
  reporting: 'Raportimi GPS',
  snapshot: 'Pamja u sinkronizua',
  noValue: 'Nuk ofrohet',
  configured: 'E konfiguruar',
  disconnected: 'E shkëputur',
  connected: 'E lidhur',
  error: 'Gabim',
  lastError: 'Gabimi i fundit',
  mapPrivacy: 'Pllakat e hartës ngarkohen nga OpenStreetMap kur hap hartën.',
  readonly:
    'Komandat dhe konfigurimi i pajisjeve janë të çaktivizuara. Sinkronizimi është manual, maksimumi një herë në minutë.',
  disconnectConfirm:
    'Të shkëputet dhe të hiqen të dhënat e ruajtura dhe lidhjet GPS/mjete?',
  confirm: 'Konfirmo shkëputjen',
  cancel: 'Anulo',
};
const de: typeof en = {
  ...en,
  integrations: 'Integrationen',
  subtitle: 'Nur lesender Zugriff · GPS mit vorhandenen Fahrzeugen verknüpfen',
  save: 'Speichern / Aktualisieren',
  disconnect: 'Trennen',
  test: 'Verbindung testen',
  sync: 'Manuell synchronisieren',
  saved: 'Gespeichert',
  done: 'Abgeschlossen',
  failed: 'Anfrage fehlgeschlagen',
  pending: 'Wird bearbeitet…',
  keyHint:
    'Leer lassen, um den gespeicherten Schlüssel zu behalten. Ein neuer Schlüssel entfernt Geräteverknüpfungen.',
  keyMissing:
    'Serververschlüsselung fehlt. Bitte den Administrator kontaktieren.',
  privacy:
    'Gerätezugriff, Mitarbeiterinformation, Rechtsgrundlage, Aufbewahrung und Anbieterbedingungen wurden geprüft.',
  status: 'Verbindungsstatus',
  lastSync: 'Letzte erfolgreiche Synchronisierung',
  devices: 'Gefundene Geräte',
  empty: 'Zugangsdaten speichern und Verbindung testen.',
  link: 'Verknüpfung bestätigen',
  unlink: 'Kein Fahrzeug / Trennen',
  unavailable: 'Vom Anbieter nicht mehr geliefert',
  vehicle: 'Vorhandenes Fahrzeug',
  suggested:
    'Passendes Fahrzeug ausgewählt. Bitte prüfen und die Verknüpfung bestätigen.',
  suffix: 'Geräte-Endziffern',
  fleet: 'GPS-Flotte öffnen',
  back: 'Einstellungen',
  online: 'Bei letzter Synchronisierung online',
  offline: 'Offline / Status unbekannt',
  stale: 'Veraltete Daten',
  lastPosition: 'Zuletzt gemeldete Position',
  speed: 'Geschwindigkeit',
  voltage: 'Externe Spannung',
  mileage: 'Strecke der letzten 24h (Anbieterstatistik)',
  history: 'Route laden · letzte 24h',
  historyAt: 'Route abgerufen',
  noHistory: 'Keine Route geladen',
  map: 'Karte anzeigen',
  noPosition: 'Keine gemeldete GPS-Position',
  reporting: 'GPS-Meldung',
  snapshot: 'Daten synchronisiert',
  noValue: 'Nicht geliefert',
  configured: 'Konfiguriert',
  disconnected: 'Getrennt',
  connected: 'Verbunden',
  error: 'Fehler',
  lastError: 'Letzter Fehler',
  mapPrivacy: 'Beim Öffnen lädt die Karte Kacheln von OpenStreetMap.',
  readonly:
    'Befehle und Gerätekonfiguration sind deaktiviert. Nur manuelle Synchronisierung, höchstens einmal pro Minute.',
  disconnectConfirm:
    'Verbindung trennen und gespeicherte Gerätedaten samt Verknüpfungen entfernen?',
  confirm: 'Trennen bestätigen',
  cancel: 'Abbrechen',
};
export function wanwayCopy(lang: Language) {
  return lang === 'sq' ? sq : lang === 'de' ? de : en;
}

export function wanwayError(code: string, lang: Language) {
  const sq = lang === 'sq';
  const messages: Record<string, string> = {
    COOLDOWN: sq
      ? 'Prit një minutë mes kërkesave WanWay.'
      : 'Wait one minute between WanWay requests.',
    BUSY: sq
      ? 'Një veprim është ende në proces. Provo përsëri pas pak.'
      : 'An operation is in progress. Try again shortly.',
    KEYRING: sq
      ? 'Çelësi i enkriptimit në server mungon ose nuk mund të lexojë kredencialet.'
      : 'Server encryption is missing or cannot decrypt the saved credentials.',
    NOT_CONFIGURED: sq
      ? 'Ruaj APPID dhe API KEY përpara testimit.'
      : 'Save APPID and API KEY first.',
    KEY_REQUIRED: sq
      ? 'Vendos API KEY për këtë APPID.'
      : 'Enter an API KEY for this APPID.',
    PRIVACY: sq
      ? 'Konfirmo autorizimin dhe shqyrtimin e privatësisë.'
      : 'Confirm authorization and the privacy review.',
    NOT_FOUND: sq
      ? 'Pajisja ose mjeti nuk gjendet në kompaninë tënde.'
      : 'Device or vehicle not found in your company.',
    OTHER_GPS: sq
      ? 'Mjeti ka tashmë një burim tjetër GPS. Lidhja nuk u ndryshua.'
      : 'This vehicle already has another GPS source. The link was not changed.',
    ALREADY_LINKED: sq
      ? 'Mjeti është lidhur tashmë me një GPS tjetër.'
      : 'This vehicle already has a GPS link.',
    INVALID: sq ? 'Kontrollo fushat e formularit.' : 'Check the form fields.',
    VEHICLE_EXISTS: sq
      ? 'Mjeti me këtë emër ose targë ekziston. Zgjidhe nga lista.'
      : 'A vehicle with this name or plate already exists. Choose it from the list.',
    VEHICLE_LIMIT: sq
      ? 'U arrit kufiri i mjeteve të planit të firmës.'
      : 'The company plan vehicle limit has been reached.',
    DISABLED: sq
      ? 'Integrimi nuk është aktiv ose nuk ke autorizim.'
      : 'Integration unavailable or access denied.',
    WANWAY_FORMAT: sq
      ? 'Përgjigjja WanWay nuk përputhet me formatin e dokumentuar. Sinkronizimi nuk u ruajt.'
      : 'WanWay response differs from the documented format. Sync was not saved.',
    WANWAY_TIMEOUT: sq
      ? 'WanWay nuk u përgjigj brenda afatit. Provo përsëri më vonë.'
      : 'WanWay did not respond in time. Try again later.',
    WANWAY_LIMIT: sq
      ? 'Përgjigjja tejkaloi kufirin e sigurt të leximit.'
      : 'Response exceeded the safe read limit.',
  };
  if (messages[code]) return messages[code];
  if (/^WANWAY_(HTTP|PROVIDER)_-?\d+$/.test(code))
    return sq
      ? `WanWay refuzoi kërkesën (${code}). Kontrollo APPID/KEY, lejen API, skadimin dhe IP whitelist në panelin e ofruesit.`
      : `WanWay rejected the request (${code}). Check APPID/key, API permission, expiry and IP whitelist with the provider.`;
  return sq
    ? 'Veprimi nuk u përfundua. Kontakto administratorin.'
    : 'The operation could not be completed. Contact your administrator.';
}
