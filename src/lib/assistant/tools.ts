import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  baustelleStandort,
  coneActivity,
  dateKey,
  formatReportTime,
  getAdminDailyReport,
  getWorkerDailyReport,
  getWorkerMonthlyReport,
  groupDailyWorkByBaustelle,
  inventoryActivity,
  monthlySessionRows,
  parseReportMessages,
  treeAction,
  treeExtra,
  treeHaltverbot,
  treeWorkerNote,
} from "@/lib/workzone/reporting";
import { effectiveSessionHours } from "@/lib/workzone/session-rules";
import type { RequesterContext } from "./requester";
import { normalizeAssistantLanguage, type AssistantLanguageCode } from "./language";

function assistantToolText(requesterOrLang: RequesterContext | AssistantLanguageCode) {
  const lang = typeof requesterOrLang === "string" ? requesterOrLang : requesterOrLang.preferredLanguage;
  const messages = {
    DE: {
      adminOnly: "Nur fuer Administratoren.",
      workerOnly: "Nur fuer Mitarbeiter.",
      notSignedIn: "Kein Zugriff (nicht eingeloggt).",
      hrAdminOnly: "Kein Zugriff: Personalprofil nur fuer Administratoren.",
      sensitiveAdminOnly: "Kein Zugriff auf sensible Mitarbeiterdaten.",
      workerNotFound: "Mitarbeiter nicht gefunden.",
      adminNotFound: "Admin nicht gefunden.",
      invalidDate: "Datum ist ungueltig (YYYY-MM-DD).",
      invalidMonth: "Monat ist ungueltig (YYYY-MM).",
      workerDailyAdminHint: "Nur fuer Mitarbeiter. Admins nutzen adminGetWorkerDailyReport.",
      workerMonthlyAdminHint: "Nur fuer Mitarbeiter. Admins nutzen adminGetWorkerMonthlyTimesheet.",
      vacationAdminHint: "Nur fuer Mitarbeiter. Admins nutzen adminListVacationRequests/adminGetAvailabilityForDate.",
      privateSummaryAdminHint: "Nur fuer Mitarbeiter. Admins nutzen getWorkerPrivateSummary.",
      noLicenses: "Im Profil ist kein Fuehrerschein / keine Lizenzen als Text hinterlegt (Feld licenses leer).",
      profileLicenses: (licenses: string) => `Profil: Lizenzen/Fuehrerschein: ${licenses}`,
      approvedVacation: "Genehmigter Urlaub",
      vacationProfileStatus: "Urlaub-Status im Profil",
      sick: "Krank",
      unavailable: "Nicht verfuegbar",
      licenseMissing: (token: string, machines: string) => `Keine passende Fahrerlaubnis ${token} fuer ${machines}.`,
      licenseShortage: (machineCount: number, token: string, workerCount: number) =>
        `${machineCount} Maschinen brauchen ${token}, aber nur ${workerCount} Worker hat/haben ${token}.`,
      vacationSummary: (allowance: number, approved: number, pending: number, remaining: number) =>
        `Urlaub: Gesamt ${allowance}, genehmigt ${approved}, offen ${pending}, Rest ${remaining}.`,
      noVacationRequests: "Keine passenden Urlaubsanfragen gefunden.",
      vacationRequestsFound: (count: number, status: string) => `${count} Urlaubsanfrage(n) gefunden${status !== "ALL" ? ` (${status})` : ""}.`,
      availabilitySummary: (available: number, unavailable: number, date: string, pending: number) =>
        `${available} verfuegbar, ${unavailable} nicht verfuegbar am ${date}. Offene Urlaubsanfragen fuer diesen Tag: ${pending}.`,
      noDailyPlan: (date: string) => `Fuer ${date} ist kein Tagesplan angelegt.`,
      dailyPlanLicensesOk: (date: string) => `Tagesplan ${date}: Patente passen soweit.`,
      dailyPlanLicenseWarnings: (date: string, count: number) => `Tagesplan ${date}: ${count} Warnung(en) bei Patenten/Maschinen.`,
      noMatchingPlanGroup: (date: string) => `Im Tagesplan ${date} wurde dazu keine passende Gruppe gefunden.`,
      matchingPlanGroups: (count: number, date: string) => `${count} passende Gruppe(n) im Tagesplan ${date}.`,
      hoursOverview: (days: number, name: string) => `Stundenuebersicht (${days} Tage) fuer ${name}`,
      myDailyReport: (date: string, hours: number, sites: number) => `Eigener Tagesbericht ${date}: ${hours.toFixed(2)} h, ${sites} Baustelle(n).`,
      myMonthlyTimesheet: (month: string, hours: number) => `Eigener Stundenzettel ${month}: ${hours.toFixed(2)} h.`,
      workerDailyReport: (date: string, worker: string | null, hours: number, sites: number) =>
        `Tagesbericht ${date} fuer ${worker ?? "-"}: ${hours.toFixed(2)} h, ${sites} Baustelle(n).`,
      teamNoCompletedTrees: (date: string) => `Am ${date} sind keine abgeschlossenen Baeume mit Mitarbeiter-Zuordnung erfasst.`,
      teamCompletedTrees: (date: string, count: number) => `Am ${date} haben ${count} Mitarbeiter abgeschlossene Baeume erfasst.`,
      workerMonthlyTimesheet: (month: string, worker: string | null, hours: number) =>
        `Stundenzettel ${month} fuer ${worker ?? "-"}: ${hours.toFixed(2)} h.`,
      adminDailyReport: (date: string, sites: number) => `Admin-Tagesbericht ${date}: ${sites} Baustelle(n).`,
      operationalWorkerOnly:
        "Snapshot nur fuer eingeloggte Mitarbeiter. Nutze getLiveLocation/getAssignedMachine mit Mitarbeitername.",
      notLive: "Gerade nicht live auf einer Baustelle.",
      liveOnSite: (site: string, since: string) => `Live auf Baustelle: ${site}, seit ${since}.`,
      noDailyPlanFound: "Kein Tagesplan gefunden.",
      assignedWithMachine: (machine: string) => `Eingeplant mit Maschine: ${machine}`,
      assignedNoMachine: "Eingeplant, aber keine Maschine zugewiesen.",
      notInDailyPlan: "Nicht im Tagesplan gefunden.",
      noEquipmentOnSite: "Aktuell kein Material als 'vor Ort' erkennbar (basierend auf Bewegungen).",
      knowledgeQueryRequired: "Bitte eine Frage oder ein Stichwort angeben.",
      knowledgeNotFound: "Kein passender Knowledge-Eintrag gefunden.",
      myHoursSummary: (days: number, hours: number) => `Eigene Stunden (letzte ${days} Tage): ${hours.toFixed(2)} h.`,
      activeSitesDirectory: (count: number) => `${count} aktive Baustelle(n) in der Workzone-Uebersicht.`,
      sessionSource: "Stundenzettel / WorkSession",
      deployed: "gesetzt",
      collected: "eingesammelt",
      moved: "bewegt",
      tree: "Baum",
      cones: "Konen",
    },
    EN: {
      adminOnly: "Administrators only.",
      workerOnly: "Workers only.",
      notSignedIn: "No access (not signed in).",
      hrAdminOnly: "No access: personnel profile is for administrators only.",
      sensitiveAdminOnly: "No access to sensitive worker data.",
      workerNotFound: "Worker was not found.",
      adminNotFound: "Admin was not found.",
      invalidDate: "Invalid date (YYYY-MM-DD).",
      invalidMonth: "Invalid month (YYYY-MM).",
      workerDailyAdminHint: "Workers only. Admins use adminGetWorkerDailyReport.",
      workerMonthlyAdminHint: "Workers only. Admins use adminGetWorkerMonthlyTimesheet.",
      vacationAdminHint: "Workers only. Admins use adminListVacationRequests/adminGetAvailabilityForDate.",
      privateSummaryAdminHint: "Workers only. Admins use getWorkerPrivateSummary.",
      noLicenses: "No driver's license / license text is stored in the profile (licenses field is empty).",
      profileLicenses: (licenses: string) => `Profile: licenses / driver's license: ${licenses}`,
      approvedVacation: "Approved vacation",
      vacationProfileStatus: "Vacation status in profile",
      sick: "Sick",
      unavailable: "Unavailable",
      licenseMissing: (token: string, machines: string) => `No matching license ${token} for ${machines}.`,
      licenseShortage: (machineCount: number, token: string, workerCount: number) =>
        `${machineCount} machines need ${token}, but only ${workerCount} worker(s) have ${token}.`,
      vacationSummary: (allowance: number, approved: number, pending: number, remaining: number) =>
        `Vacation: total ${allowance}, approved ${approved}, pending ${pending}, remaining ${remaining}.`,
      noVacationRequests: "No matching vacation requests found.",
      vacationRequestsFound: (count: number, status: string) => `${count} vacation request(s) found${status !== "ALL" ? ` (${status})` : ""}.`,
      availabilitySummary: (available: number, unavailable: number, date: string, pending: number) =>
        `${available} available, ${unavailable} unavailable on ${date}. Pending vacation requests for this day: ${pending}.`,
      noDailyPlan: (date: string) => `No daily plan exists for ${date}.`,
      dailyPlanLicensesOk: (date: string) => `Daily plan ${date}: licenses look okay.`,
      dailyPlanLicenseWarnings: (date: string, count: number) => `Daily plan ${date}: ${count} warning(s) for licenses/machines.`,
      noMatchingPlanGroup: (date: string) => `No matching group was found in the daily plan ${date}.`,
      matchingPlanGroups: (count: number, date: string) => `${count} matching group(s) in daily plan ${date}.`,
      hoursOverview: (days: number, name: string) => `Hours overview (${days} days) for ${name}`,
      myDailyReport: (date: string, hours: number, sites: number) => `My daily report ${date}: ${hours.toFixed(2)} h, ${sites} site(s).`,
      myMonthlyTimesheet: (month: string, hours: number) => `My timesheet ${month}: ${hours.toFixed(2)} h.`,
      workerDailyReport: (date: string, worker: string | null, hours: number, sites: number) =>
        `Daily report ${date} for ${worker ?? "-"}: ${hours.toFixed(2)} h, ${sites} site(s).`,
      teamNoCompletedTrees: (date: string) => `No completed trees with worker assignment were recorded on ${date}.`,
      teamCompletedTrees: (date: string, count: number) => `On ${date}, ${count} worker(s) recorded completed trees.`,
      workerMonthlyTimesheet: (month: string, worker: string | null, hours: number) =>
        `Timesheet ${month} for ${worker ?? "-"}: ${hours.toFixed(2)} h.`,
      adminDailyReport: (date: string, sites: number) => `Admin daily report ${date}: ${sites} site(s).`,
      operationalWorkerOnly: "Snapshot is only for signed-in workers. Use getLiveLocation/getAssignedMachine with a worker name.",
      notLive: "Not currently live on a site.",
      liveOnSite: (site: string, since: string) => `Live on site: ${site}, since ${since}.`,
      noDailyPlanFound: "No daily plan found.",
      assignedWithMachine: (machine: string) => `Assigned with machine: ${machine}`,
      assignedNoMachine: "Assigned, but no machine is assigned.",
      notInDailyPlan: "Not found in the daily plan.",
      noEquipmentOnSite: "No material currently appears to be on site (based on movements).",
      knowledgeQueryRequired: "Please enter a question or keyword.",
      knowledgeNotFound: "No matching knowledge entry found.",
      myHoursSummary: (days: number, hours: number) => `My hours (last ${days} days): ${hours.toFixed(2)} h.`,
      activeSitesDirectory: (count: number) => `${count} active site(s) in the Workzone overview.`,
      sessionSource: "Timesheet / WorkSession",
      deployed: "deployed",
      collected: "collected",
      moved: "moved",
      tree: "tree",
      cones: "cones",
    },
    IT: {
      adminOnly: "Solo per amministratori.",
      workerOnly: "Solo per worker.",
      notSignedIn: "Nessun accesso (non sei collegato).",
      hrAdminOnly: "Nessun accesso: il profilo personale e solo per amministratori.",
      sensitiveAdminOnly: "Nessun accesso ai dati sensibili del worker.",
      workerNotFound: "Worker non trovato.",
      adminNotFound: "Admin non trovato.",
      invalidDate: "Data non valida (YYYY-MM-DD).",
      invalidMonth: "Mese non valido (YYYY-MM).",
      workerDailyAdminHint: "Solo per worker. Gli admin usano adminGetWorkerDailyReport.",
      workerMonthlyAdminHint: "Solo per worker. Gli admin usano adminGetWorkerMonthlyTimesheet.",
      vacationAdminHint: "Solo per worker. Gli admin usano adminListVacationRequests/adminGetAvailabilityForDate.",
      privateSummaryAdminHint: "Solo per worker. Gli admin usano getWorkerPrivateSummary.",
      noLicenses: "Nel profilo non e salvato testo per patente/licenze (campo licenses vuoto).",
      profileLicenses: (licenses: string) => `Profilo: licenze/patente: ${licenses}`,
      approvedVacation: "Ferie approvate",
      vacationProfileStatus: "Stato ferie nel profilo",
      sick: "Malato",
      unavailable: "Non disponibile",
      licenseMissing: (token: string, machines: string) => `Nessuna patente/licenza ${token} adatta per ${machines}.`,
      licenseShortage: (machineCount: number, token: string, workerCount: number) =>
        `${machineCount} macchine richiedono ${token}, ma solo ${workerCount} worker hanno ${token}.`,
      vacationSummary: (allowance: number, approved: number, pending: number, remaining: number) =>
        `Ferie: totale ${allowance}, approvate ${approved}, aperte ${pending}, residue ${remaining}.`,
      noVacationRequests: "Nessuna richiesta ferie corrispondente trovata.",
      vacationRequestsFound: (count: number, status: string) => `${count} richiesta/e ferie trovata/e${status !== "ALL" ? ` (${status})` : ""}.`,
      availabilitySummary: (available: number, unavailable: number, date: string, pending: number) =>
        `${available} disponibili, ${unavailable} non disponibili il ${date}. Richieste ferie aperte per questo giorno: ${pending}.`,
      noDailyPlan: (date: string) => `Per ${date} non esiste un piano giornaliero.`,
      dailyPlanLicensesOk: (date: string) => `Piano giornaliero ${date}: le licenze sembrano corrette.`,
      dailyPlanLicenseWarnings: (date: string, count: number) => `Piano giornaliero ${date}: ${count} avviso/i per licenze/macchine.`,
      noMatchingPlanGroup: (date: string) => `Nel piano giornaliero ${date} non e stato trovato un gruppo adatto.`,
      matchingPlanGroups: (count: number, date: string) => `${count} gruppo/i adatti nel piano giornaliero ${date}.`,
      hoursOverview: (days: number, name: string) => `Panoramica ore (${days} giorni) per ${name}`,
      myDailyReport: (date: string, hours: number, sites: number) => `Il mio report giornaliero ${date}: ${hours.toFixed(2)} h, ${sites} cantiere/i.`,
      myMonthlyTimesheet: (month: string, hours: number) => `Il mio timesheet ${month}: ${hours.toFixed(2)} h.`,
      workerDailyReport: (date: string, worker: string | null, hours: number, sites: number) =>
        `Report giornaliero ${date} per ${worker ?? "-"}: ${hours.toFixed(2)} h, ${sites} cantiere/i.`,
      teamNoCompletedTrees: (date: string) => `Il ${date} non sono stati registrati alberi completati con assegnazione worker.`,
      teamCompletedTrees: (date: string, count: number) => `Il ${date}, ${count} worker hanno registrato alberi completati.`,
      workerMonthlyTimesheet: (month: string, worker: string | null, hours: number) =>
        `Timesheet ${month} per ${worker ?? "-"}: ${hours.toFixed(2)} h.`,
      adminDailyReport: (date: string, sites: number) => `Report giornaliero admin ${date}: ${sites} cantiere/i.`,
      operationalWorkerOnly: "Snapshot solo per worker collegati. Usa getLiveLocation/getAssignedMachine con nome worker.",
      notLive: "Al momento non e live su un cantiere.",
      liveOnSite: (site: string, since: string) => `Live sul cantiere: ${site}, dalle ${since}.`,
      noDailyPlanFound: "Nessun piano giornaliero trovato.",
      assignedWithMachine: (machine: string) => `Pianificato con macchina: ${machine}`,
      assignedNoMachine: "Pianificato, ma senza macchina assegnata.",
      notInDailyPlan: "Non trovato nel piano giornaliero.",
      noEquipmentOnSite: "Al momento non risulta materiale in cantiere (in base ai movimenti).",
      knowledgeQueryRequired: "Inserisci una domanda o una parola chiave.",
      knowledgeNotFound: "Nessuna voce knowledge corrispondente trovata.",
      myHoursSummary: (days: number, hours: number) => `Le mie ore (ultimi ${days} giorni): ${hours.toFixed(2)} h.`,
      activeSitesDirectory: (count: number) => `${count} cantiere/i attivi nella panoramica Workzone.`,
      sessionSource: "Timesheet / WorkSession",
      deployed: "posato",
      collected: "raccolto",
      moved: "spostato",
      tree: "albero",
      cones: "coni",
    },
    SQ: {
      adminOnly: "Vetem per administratore.",
      workerOnly: "Vetem per worker.",
      notSignedIn: "Nuk ka akses (nuk je i loguar).",
      hrAdminOnly: "Nuk ka akses: profili i personelit eshte vetem per administratore.",
      sensitiveAdminOnly: "Nuk ka akses ne te dhena sensitive te workerit.",
      workerNotFound: "Workeri nuk u gjet.",
      adminNotFound: "Admini nuk u gjet.",
      invalidDate: "Data eshte e pavlefshme (YYYY-MM-DD).",
      invalidMonth: "Muaji eshte i pavlefshem (YYYY-MM).",
      workerDailyAdminHint: "Vetem per worker. Adminet perdorin adminGetWorkerDailyReport.",
      workerMonthlyAdminHint: "Vetem per worker. Adminet perdorin adminGetWorkerMonthlyTimesheet.",
      vacationAdminHint: "Vetem per worker. Adminet perdorin adminListVacationRequests/adminGetAvailabilityForDate.",
      privateSummaryAdminHint: "Vetem per worker. Adminet perdorin getWorkerPrivateSummary.",
      noLicenses: "Ne profil nuk ka tekst per patente/licenca (fusha licenses eshte bosh).",
      profileLicenses: (licenses: string) => `Profili: licenca/patenta: ${licenses}`,
      approvedVacation: "Pushim i aprovuar",
      vacationProfileStatus: "Status pushimi ne profil",
      sick: "Semure",
      unavailable: "Jo i disponueshem",
      licenseMissing: (token: string, machines: string) => `Nuk ka patente/licence ${token} te pershtatshme per ${machines}.`,
      licenseShortage: (machineCount: number, token: string, workerCount: number) =>
        `${machineCount} makina kerkojne ${token}, por vetem ${workerCount} worker e kane ${token}.`,
      vacationSummary: (allowance: number, approved: number, pending: number, remaining: number) =>
        `Pushime: total ${allowance}, aprovuar ${approved}, hapur ${pending}, mbetur ${remaining}.`,
      noVacationRequests: "Nuk u gjeten kerkesa pushimi qe perputhen.",
      vacationRequestsFound: (count: number, status: string) => `${count} kerkesa pushimi u gjeten${status !== "ALL" ? ` (${status})` : ""}.`,
      availabilitySummary: (available: number, unavailable: number, date: string, pending: number) =>
        `${available} te disponueshem, ${unavailable} jo te disponueshem me ${date}. Kerkesa pushimi te hapura per kete dite: ${pending}.`,
      noDailyPlan: (date: string) => `Per ${date} nuk ka plan ditor.`,
      dailyPlanLicensesOk: (date: string) => `Plani ditor ${date}: patentat duken ne rregull.`,
      dailyPlanLicenseWarnings: (date: string, count: number) => `Plani ditor ${date}: ${count} paralajmerim(e) per patenta/makina.`,
      noMatchingPlanGroup: (date: string) => `Ne planin ditor ${date} nuk u gjet grup i pershtatshem.`,
      matchingPlanGroups: (count: number, date: string) => `${count} grup(e) te pershtatshme ne planin ditor ${date}.`,
      hoursOverview: (days: number, name: string) => `Permbledhje oresh (${days} dite) per ${name}`,
      myDailyReport: (date: string, hours: number, sites: number) => `Raporti im ditor ${date}: ${hours.toFixed(2)} h, ${sites} kantier(e).`,
      myMonthlyTimesheet: (month: string, hours: number) => `Fleta ime e oreve ${month}: ${hours.toFixed(2)} h.`,
      workerDailyReport: (date: string, worker: string | null, hours: number, sites: number) =>
        `Raporti ditor ${date} per ${worker ?? "-"}: ${hours.toFixed(2)} h, ${sites} kantier(e).`,
      teamNoCompletedTrees: (date: string) => `Me ${date} nuk jane regjistruar dru te perfunduara me worker te caktuar.`,
      teamCompletedTrees: (date: string, count: number) => `Me ${date}, ${count} worker kane regjistruar dru te perfunduara.`,
      workerMonthlyTimesheet: (month: string, worker: string | null, hours: number) =>
        `Fleta e oreve ${month} per ${worker ?? "-"}: ${hours.toFixed(2)} h.`,
      adminDailyReport: (date: string, sites: number) => `Raporti ditor i adminit ${date}: ${sites} kantier(e).`,
      operationalWorkerOnly: "Snapshot eshte vetem per worker te loguar. Perdore getLiveLocation/getAssignedMachine me emer workeri.",
      notLive: "Aktualisht nuk eshte live ne kantier.",
      liveOnSite: (site: string, since: string) => `Live ne kantier: ${site}, qe nga ${since}.`,
      noDailyPlanFound: "Nuk u gjet plan ditor.",
      assignedWithMachine: (machine: string) => `I planifikuar me makine: ${machine}`,
      assignedNoMachine: "I planifikuar, por pa makine te caktuar.",
      notInDailyPlan: "Nuk u gjet ne planin ditor.",
      noEquipmentOnSite: "Aktualisht nuk duket material ne kantier (bazuar ne levizje).",
      knowledgeQueryRequired: "Jep nje pyetje ose fjale kyce.",
      knowledgeNotFound: "Nuk u gjet knowledge-entry qe perputhet.",
      myHoursSummary: (days: number, hours: number) => `Oret e mia (${days} ditet e fundit): ${hours.toFixed(2)} h.`,
      activeSitesDirectory: (count: number) => `${count} kantier(e) aktive ne Workzone.`,
      sessionSource: "Fleta e oreve / WorkSession",
      deployed: "vendosur",
      collected: "mbledhur",
      moved: "levizur",
      tree: "dru",
      cones: "kone",
    },
    RO: {
      adminOnly: "Doar pentru administratori.",
      workerOnly: "Doar pentru lucratori.",
      notSignedIn: "Fara acces (nu esti autentificat).",
      hrAdminOnly: "Fara acces: profilul de personal este doar pentru administratori.",
      sensitiveAdminOnly: "Fara acces la date sensibile ale lucratorului.",
      workerNotFound: "Lucratorul nu a fost gasit.",
      adminNotFound: "Adminul nu a fost gasit.",
      invalidDate: "Data invalida (YYYY-MM-DD).",
      invalidMonth: "Luna invalida (YYYY-MM).",
      workerDailyAdminHint: "Doar pentru lucratori. Adminii folosesc adminGetWorkerDailyReport.",
      workerMonthlyAdminHint: "Doar pentru lucratori. Adminii folosesc adminGetWorkerMonthlyTimesheet.",
      vacationAdminHint: "Doar pentru lucratori. Adminii folosesc adminListVacationRequests/adminGetAvailabilityForDate.",
      privateSummaryAdminHint: "Doar pentru lucratori. Adminii folosesc getWorkerPrivateSummary.",
      noLicenses: "In profil nu este salvat text pentru permis/licente (campul licenses este gol).",
      profileLicenses: (licenses: string) => `Profil: licente/permis: ${licenses}`,
      approvedVacation: "Concediu aprobat",
      vacationProfileStatus: "Status concediu in profil",
      sick: "Bolnav",
      unavailable: "Indisponibil",
      licenseMissing: (token: string, machines: string) => `Nu exista permis/licenta ${token} potrivita pentru ${machines}.`,
      licenseShortage: (machineCount: number, token: string, workerCount: number) =>
        `${machineCount} utilaje necesita ${token}, dar doar ${workerCount} lucrator(i) au ${token}.`,
      vacationSummary: (allowance: number, approved: number, pending: number, remaining: number) =>
        `Concediu: total ${allowance}, aprobat ${approved}, in asteptare ${pending}, ramas ${remaining}.`,
      noVacationRequests: "Nu au fost gasite cereri de concediu potrivite.",
      vacationRequestsFound: (count: number, status: string) => `${count} cerere/cereri de concediu gasite${status !== "ALL" ? ` (${status})` : ""}.`,
      availabilitySummary: (available: number, unavailable: number, date: string, pending: number) =>
        `${available} disponibili, ${unavailable} indisponibili la ${date}. Cereri de concediu in asteptare pentru aceasta zi: ${pending}.`,
      noDailyPlan: (date: string) => `Pentru ${date} nu exista plan zilnic.`,
      dailyPlanLicensesOk: (date: string) => `Plan zilnic ${date}: licentele par in regula.`,
      dailyPlanLicenseWarnings: (date: string, count: number) => `Plan zilnic ${date}: ${count} avertisment(e) pentru licente/utilaje.`,
      noMatchingPlanGroup: (date: string) => `In planul zilnic ${date} nu a fost gasit niciun grup potrivit.`,
      matchingPlanGroups: (count: number, date: string) => `${count} grup(uri) potrivite in planul zilnic ${date}.`,
      hoursOverview: (days: number, name: string) => `Prezentare ore (${days} zile) pentru ${name}`,
      myDailyReport: (date: string, hours: number, sites: number) => `Raportul meu zilnic ${date}: ${hours.toFixed(2)} h, ${sites} santier(e).`,
      myMonthlyTimesheet: (month: string, hours: number) => `Foaia mea de ore ${month}: ${hours.toFixed(2)} h.`,
      workerDailyReport: (date: string, worker: string | null, hours: number, sites: number) =>
        `Raport zilnic ${date} pentru ${worker ?? "-"}: ${hours.toFixed(2)} h, ${sites} santier(e).`,
      teamNoCompletedTrees: (date: string) => `La ${date} nu au fost inregistrati arbori finalizati cu lucrator asignat.`,
      teamCompletedTrees: (date: string, count: number) => `La ${date}, ${count} lucrator(i) au inregistrat arbori finalizati.`,
      workerMonthlyTimesheet: (month: string, worker: string | null, hours: number) =>
        `Foaie de ore ${month} pentru ${worker ?? "-"}: ${hours.toFixed(2)} h.`,
      adminDailyReport: (date: string, sites: number) => `Raport zilnic admin ${date}: ${sites} santier(e).`,
      operationalWorkerOnly: "Snapshotul este doar pentru lucratori autentificati. Foloseste getLiveLocation/getAssignedMachine cu numele lucratorului.",
      notLive: "Momentan nu este live pe un santier.",
      liveOnSite: (site: string, since: string) => `Live pe santier: ${site}, de la ${since}.`,
      noDailyPlanFound: "Nu a fost gasit plan zilnic.",
      assignedWithMachine: (machine: string) => `Planificat cu utilaj: ${machine}`,
      assignedNoMachine: "Planificat, dar fara utilaj asignat.",
      notInDailyPlan: "Nu a fost gasit in planul zilnic.",
      noEquipmentOnSite: "Momentan nu apare material pe santier (pe baza miscarilor).",
      knowledgeQueryRequired: "Introdu o intrebare sau un cuvant cheie.",
      knowledgeNotFound: "Nu a fost gasita nicio intrare knowledge potrivita.",
      myHoursSummary: (days: number, hours: number) => `Orele mele (ultimele ${days} zile): ${hours.toFixed(2)} h.`,
      activeSitesDirectory: (count: number) => `${count} santier(e) active in prezentarea Workzone.`,
      sessionSource: "Foaie de ore / WorkSession",
      deployed: "pus",
      collected: "strans",
      moved: "mutat",
      tree: "arbore",
      cones: "conuri",
    },
    PL: {
      adminOnly: "Tylko dla administratorow.",
      workerOnly: "Tylko dla pracownikow.",
      notSignedIn: "Brak dostepu (nie zalogowano).",
      hrAdminOnly: "Brak dostepu: profil personalny jest tylko dla administratorow.",
      sensitiveAdminOnly: "Brak dostepu do wrazliwych danych pracownika.",
      workerNotFound: "Nie znaleziono pracownika.",
      adminNotFound: "Nie znaleziono administratora.",
      invalidDate: "Nieprawidlowa data (YYYY-MM-DD).",
      invalidMonth: "Nieprawidlowy miesiac (YYYY-MM).",
      workerDailyAdminHint: "Tylko dla pracownikow. Admini uzywaja adminGetWorkerDailyReport.",
      workerMonthlyAdminHint: "Tylko dla pracownikow. Admini uzywaja adminGetWorkerMonthlyTimesheet.",
      vacationAdminHint: "Tylko dla pracownikow. Admini uzywaja adminListVacationRequests/adminGetAvailabilityForDate.",
      privateSummaryAdminHint: "Tylko dla pracownikow. Admini uzywaja getWorkerPrivateSummary.",
      noLicenses: "W profilu nie zapisano tekstu prawa jazdy/licencji (pole licenses jest puste).",
      profileLicenses: (licenses: string) => `Profil: licencje/prawo jazdy: ${licenses}`,
      approvedVacation: "Urlop zatwierdzony",
      vacationProfileStatus: "Status urlopu w profilu",
      sick: "Chory",
      unavailable: "Niedostepny",
      licenseMissing: (token: string, machines: string) => `Brak odpowiedniej licencji ${token} dla ${machines}.`,
      licenseShortage: (machineCount: number, token: string, workerCount: number) =>
        `${machineCount} maszyn wymaga ${token}, ale tylko ${workerCount} pracownik(ow) ma ${token}.`,
      vacationSummary: (allowance: number, approved: number, pending: number, remaining: number) =>
        `Urlop: razem ${allowance}, zatwierdzone ${approved}, oczekujace ${pending}, pozostalo ${remaining}.`,
      noVacationRequests: "Nie znaleziono pasujacych wnioskow urlopowych.",
      vacationRequestsFound: (count: number, status: string) => `Znaleziono ${count} wniosek/wnioskow urlopowych${status !== "ALL" ? ` (${status})` : ""}.`,
      availabilitySummary: (available: number, unavailable: number, date: string, pending: number) =>
        `${available} dostepnych, ${unavailable} niedostepnych dnia ${date}. Oczekujace wnioski urlopowe na ten dzien: ${pending}.`,
      noDailyPlan: (date: string) => `Dla ${date} nie ma planu dziennego.`,
      dailyPlanLicensesOk: (date: string) => `Plan dzienny ${date}: licencje wygladaja poprawnie.`,
      dailyPlanLicenseWarnings: (date: string, count: number) => `Plan dzienny ${date}: ${count} ostrzezenie/ostrzezen dla licencji/maszyn.`,
      noMatchingPlanGroup: (date: string) => `W planie dziennym ${date} nie znaleziono pasujacej grupy.`,
      matchingPlanGroups: (count: number, date: string) => `${count} pasujaca/e grupa/y w planie dziennym ${date}.`,
      hoursOverview: (days: number, name: string) => `Przeglad godzin (${days} dni) dla ${name}`,
      myDailyReport: (date: string, hours: number, sites: number) => `Moj raport dzienny ${date}: ${hours.toFixed(2)} h, ${sites} budowa/y.`,
      myMonthlyTimesheet: (month: string, hours: number) => `Moja karta godzin ${month}: ${hours.toFixed(2)} h.`,
      workerDailyReport: (date: string, worker: string | null, hours: number, sites: number) =>
        `Raport dzienny ${date} dla ${worker ?? "-"}: ${hours.toFixed(2)} h, ${sites} budowa/y.`,
      teamNoCompletedTrees: (date: string) => `Dnia ${date} nie zarejestrowano zakonczonych drzew z przypisanym pracownikiem.`,
      teamCompletedTrees: (date: string, count: number) => `Dnia ${date}, ${count} pracownik(ow) zarejestrowalo zakonczone drzewa.`,
      workerMonthlyTimesheet: (month: string, worker: string | null, hours: number) =>
        `Karta godzin ${month} dla ${worker ?? "-"}: ${hours.toFixed(2)} h.`,
      adminDailyReport: (date: string, sites: number) => `Raport dzienny admina ${date}: ${sites} budowa/y.`,
      operationalWorkerOnly: "Snapshot jest tylko dla zalogowanych pracownikow. Uzyj getLiveLocation/getAssignedMachine z nazwa pracownika.",
      notLive: "Obecnie nie jest live na budowie.",
      liveOnSite: (site: string, since: string) => `Live na budowie: ${site}, od ${since}.`,
      noDailyPlanFound: "Nie znaleziono planu dziennego.",
      assignedWithMachine: (machine: string) => `Zaplanowany z maszyna: ${machine}`,
      assignedNoMachine: "Zaplanowany, ale bez przypisanej maszyny.",
      notInDailyPlan: "Nie znaleziono w planie dziennym.",
      noEquipmentOnSite: "Obecnie nie widac materialu na budowie (na podstawie ruchow).",
      knowledgeQueryRequired: "Podaj pytanie lub slowo kluczowe.",
      knowledgeNotFound: "Nie znaleziono pasujacego wpisu knowledge.",
      myHoursSummary: (days: number, hours: number) => `Moje godziny (ostatnie ${days} dni): ${hours.toFixed(2)} h.`,
      activeSitesDirectory: (count: number) => `${count} aktywna/e budowa/y w przegladzie Workzone.`,
      sessionSource: "Karta godzin / WorkSession",
      deployed: "ustawione",
      collected: "zebrane",
      moved: "przeniesione",
      tree: "drzewo",
      cones: "pacholki",
    },
  } as const;
  const selected = lang === "EN" || lang === "IT" || lang === "SQ" || lang === "RO" || lang === "PL" ? lang : "DE";
  return messages[selected];
}

function startOfLocalDay(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((v) => Number(v));
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentMonthKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function validDateKey(value: string) {
  return Boolean(startOfLocalDay(value));
}

function validMonthKey(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function endOfLocalDay(date: Date) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function dateKeyFromDate(date: Date) {
  return dateKey(date);
}

function normalizeName(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

function workerByNameFilter(companyId: string, workerName: string): Prisma.WorkerWhereInput {
  const name = normalizeName(workerName);
  const [first, ...rest] = name.split(" ");
  const last = rest.join(" ").trim();
  return {
    companyProfileId: companyId,
    OR: [
      { firstName: { equals: first, mode: "insensitive" }, lastName: last ? { equals: last, mode: "insensitive" } : undefined },
      { firstName: { equals: name, mode: "insensitive" } },
      { lastName: { equals: name, mode: "insensitive" } },
    ],
  };
}

async function findWorkerByName(companyId: string, workerName: string) {
  return prisma.worker.findFirst({
    where: workerByNameFilter(companyId, workerName),
    select: { id: true, firstName: true, lastName: true, phone: true, emailAccount: true },
  });
}

function workerLinks(workerId: string, date?: string, month?: string) {
  return {
    profileUrl: `/app/admin/workers/${workerId}`,
    dailyReportUrl: date ? `/app/admin/workers/${workerId}/day/${date}` : null,
    monthlyTimesheetUrl: month ? `/app/admin/workers/${workerId}/month/${month}` : null,
  };
}

function sessionPayload(
  session: { startTime: Date; endTime: Date | null; breakMinutes: number; totalHours: number; baustelle?: { name: string } | null },
  now = new Date(),
  text = assistantToolText("DE"),
  lang?: string,
) {
  const isLive = !session.endTime;
  return {
    startTime: formatReportTime(session.startTime, lang),
    endTime: session.endTime ? formatReportTime(session.endTime, lang) : null,
    isLive,
    breakMinutes: session.breakMinutes,
    hours: effectiveSessionHours(session, now),
    baustelle: session.baustelle?.name ?? null,
    source: text.sessionSource,
  };
}

/**
 * Admin-only: profile fields stored on Worker (licenses, position, …).
 */
export async function getWorkerHrProfile(
  requester: RequesterContext,
  input: { workerName: string },
): Promise<
  | {
      ok: true;
      worker: string;
      licenses: string | null;
      position: string | null;
      level: string;
      availability: string;
      phone: string | null;
      emailAccount: string | null;
      birthDate: string | null;
      startedAtCompany: string | null;
      assetItems: Array<{ kind: string; itemName: string; itemCode: string | null }>;
      message: string;
    }
  | { ok: false; message: string }
> {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") {
    return { ok: false, message: text.hrAdminOnly };
  }

  const worker = await prisma.worker.findFirst({
    where: workerByNameFilter(requester.companyId, input.workerName),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      licenses: true,
      position: true,
      level: true,
      availability: true,
      phone: true,
      emailAccount: true,
      birthDate: true,
      startedAtCompany: true,
    },
  });
  if (!worker) return { ok: false, message: text.workerNotFound };

  const assets = await prisma.workerAssetItem.findMany({
    where: { workerId: worker.id, status: "ACTIVE" },
    select: { kind: true, itemName: true, itemCode: true },
    orderBy: { handedOverAt: "desc" },
    take: 40,
  });

  const label = `${worker.firstName} ${worker.lastName}`.trim();
  const lic = worker.licenses?.trim() ?? null;
  const message = lic
    ? text.profileLicenses(lic)
    : text.noLicenses;

  return {
    ok: true,
    worker: label,
    licenses: lic,
    position: worker.position,
    level: worker.level,
    availability: worker.availability,
    phone: worker.phone,
    emailAccount: worker.emailAccount,
    birthDate: worker.birthDate ? worker.birthDate.toISOString().slice(0, 10) : null,
    startedAtCompany: worker.startedAtCompany ? worker.startedAtCompany.toISOString().slice(0, 10) : null,
    assetItems: assets.map((a) => ({ kind: a.kind, itemName: a.itemName, itemCode: a.itemCode })),
    message,
  };
}

function availabilityReason(availability: string, hasApprovedVacation: boolean, text = assistantToolText("DE")) {
  if (hasApprovedVacation) return text.approvedVacation;
  if (availability === "VACATION") return text.vacationProfileStatus;
  if (availability === "SICK") return text.sick;
  if (availability === "UNAVAILABLE") return text.unavailable;
  return null;
}

function licenseTokenSet(value: string | null | undefined) {
  return new Set(
    (value ?? "")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function analyzePlanLicenseWarnings(
  workers: Array<{ name: string; licenses: string | null }>,
  machines: Array<{ name: string; requiredLicense: string | null }>,
  text = assistantToolText("DE"),
) {
  const requirements = new Map<string, string[]>();
  for (const machine of machines) {
    for (const token of licenseTokenSet(machine.requiredLicense)) {
      requirements.set(token, [...(requirements.get(token) ?? []), machine.name]);
    }
  }

  const warnings: string[] = [];
  for (const [token, machineNames] of requirements) {
    const capable = workers.filter((worker) => licenseTokenSet(worker.licenses).has(token));
    if (capable.length === 0) {
      warnings.push(text.licenseMissing(token, machineNames.join(", ")));
    } else if (machineNames.length > capable.length) {
      warnings.push(text.licenseShortage(machineNames.length, token, capable.length));
    }
  }
  return warnings;
}

export async function getMyVacationSummary(requester: RequesterContext) {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false as const, message: text.notSignedIn };
  if (requester.kind !== "worker") return { ok: false as const, message: text.vacationAdminHint };

  const worker = await prisma.worker.findUnique({
    where: { id: requester.workerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      vacationAllowanceDays: true,
      vacationRequests: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          startDate: true,
          endDate: true,
          requestedDays: true,
          status: true,
          workerNote: true,
          adminMessage: true,
          reviewedAt: true,
          createdAt: true,
        },
      },
    },
  });
  if (!worker) return { ok: false as const, message: text.workerNotFound };

  const approvedDays = worker.vacationRequests.filter((request) => request.status === "APPROVED").reduce((sum, request) => sum + request.requestedDays, 0);
  const pendingDays = worker.vacationRequests.filter((request) => request.status === "PENDING").reduce((sum, request) => sum + request.requestedDays, 0);
  const remainingDays = Math.max(0, worker.vacationAllowanceDays - approvedDays);

  return {
    ok: true as const,
    worker: `${worker.firstName} ${worker.lastName}`.trim(),
    allowanceDays: worker.vacationAllowanceDays,
    approvedDays,
    pendingDays,
    remainingDays,
    requests: worker.vacationRequests.map((request) => ({
      id: request.id,
      startDate: dateKeyFromDate(request.startDate),
      endDate: dateKeyFromDate(request.endDate),
      requestedDays: request.requestedDays,
      status: request.status,
      workerNote: request.workerNote,
      adminMessage: request.adminMessage,
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      createdAt: request.createdAt.toISOString(),
    })),
    message: text.vacationSummary(worker.vacationAllowanceDays, approvedDays, pendingDays, remainingDays),
  };
}

export async function adminListVacationRequests(
  requester: RequesterContext,
  input: { status?: "PENDING" | "APPROVED" | "REJECTED" | "ALL"; date?: string; limit?: number },
) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const status = input.status ?? "PENDING";
  const take = Math.min(100, Math.max(1, Math.floor(Number(input.limit ?? 50) || 50)));
  const day = input.date ? startOfLocalDay(input.date) : null;
  if (input.date && !day) return { ok: false as const, message: text.invalidDate };

  const rows = await prisma.vacationRequest.findMany({
    where: {
      companyProfileId: requester.companyId,
      ...(status === "ALL" ? {} : { status }),
      ...(day ? { startDate: { lte: endOfLocalDay(day) }, endDate: { gte: day } } : {}),
    },
    orderBy: [{ status: "asc" }, { startDate: "asc" }, { createdAt: "desc" }],
    take,
    include: {
      worker: { select: { id: true, firstName: true, lastName: true } },
      reviewedByAdmin: { select: { name: true, email: true } },
    },
  });

  return {
    ok: true as const,
    status,
    date: input.date ?? null,
    count: rows.length,
    requests: rows.map((request) => ({
      id: request.id,
      worker: `${request.worker.firstName} ${request.worker.lastName}`.trim(),
      startDate: dateKeyFromDate(request.startDate),
      endDate: dateKeyFromDate(request.endDate),
      requestedDays: request.requestedDays,
      status: request.status,
      workerNote: request.workerNote,
      adminMessage: request.adminMessage,
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      reviewedBy: request.reviewedByAdmin?.name ?? request.reviewedByAdmin?.email ?? null,
      createdAt: request.createdAt.toISOString(),
    })),
    message:
      rows.length === 0
        ? text.noVacationRequests
        : text.vacationRequestsFound(rows.length, status),
  };
}

export async function adminGetAvailabilityForDate(requester: RequesterContext, input: { date?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const key = (input.date ?? todayKey()).trim();
  const day = startOfLocalDay(key);
  if (!day) return { ok: false as const, message: text.invalidDate };
  const dayEnd = endOfLocalDay(day);

  const workers = await prisma.worker.findMany({
    where: { companyProfileId: requester.companyId, status: "active" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      availability: true,
      vacationRequests: {
        where: {
          status: { in: ["APPROVED", "PENDING"] },
          startDate: { lte: dayEnd },
          endDate: { gte: day },
        },
        select: { id: true, status: true, startDate: true, endDate: true, requestedDays: true },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const available: Array<{ worker: string }> = [];
  const unavailable: Array<{ worker: string; reason: string; vacation?: { startDate: string; endDate: string; requestedDays: number } }> = [];
  const pendingVacation: Array<{ worker: string; startDate: string; endDate: string; requestedDays: number }> = [];

  for (const worker of workers) {
    const label = `${worker.firstName} ${worker.lastName}`.trim();
    const approved = worker.vacationRequests.find((request) => request.status === "APPROVED");
    const pending = worker.vacationRequests.filter((request) => request.status === "PENDING");
    for (const request of pending) {
      pendingVacation.push({
        worker: label,
        startDate: dateKeyFromDate(request.startDate),
        endDate: dateKeyFromDate(request.endDate),
        requestedDays: request.requestedDays,
      });
    }

    const reason = availabilityReason(worker.availability, Boolean(approved), text);
    if (reason) {
      unavailable.push({
        worker: label,
        reason,
        vacation: approved
          ? {
              startDate: dateKeyFromDate(approved.startDate),
              endDate: dateKeyFromDate(approved.endDate),
              requestedDays: approved.requestedDays,
            }
          : undefined,
      });
    } else {
      available.push({ worker: label });
    }
  }

  return {
    ok: true as const,
    date: key,
    availableCount: available.length,
    unavailableCount: unavailable.length,
    pendingVacationCount: pendingVacation.length,
    available,
    unavailable,
    pendingVacation,
    message: text.availabilitySummary(available.length, unavailable.length, key, pendingVacation.length),
  };
}

export async function adminAnalyzeDailyPlanLicenses(requester: RequesterContext, input: { date?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const key = (input.date ?? todayKey()).trim();
  const day = startOfLocalDay(key);
  if (!day) return { ok: false as const, message: text.invalidDate };

  const plan = await prisma.dailyWorkPlan.findUnique({
    where: { companyProfileId_planDate: { companyProfileId: requester.companyId, planDate: day } },
    include: {
      columns: {
        orderBy: { sortOrder: "asc" },
        include: {
          baustelle: { select: { name: true } },
          assignments: {
            orderBy: { sortOrder: "asc" },
            include: {
              worker: { select: { firstName: true, lastName: true, licenses: true } },
              machine: { select: { name: true, nickname: true, patentaEnevojshme: true, isActive: true, targe: true, model: true } },
            },
          },
        },
      },
    },
  });

  if (!plan) return { ok: true as const, date: key, groups: [], warnings: [], message: text.noDailyPlan(key) };

  const groups = plan.columns.map((column) => {
    const workers = column.assignments
      .filter((assignment) => assignment.kind === "WORKER" && assignment.worker)
      .map((assignment) => ({
        name: `${assignment.worker!.firstName} ${assignment.worker!.lastName}`.trim(),
        licenses: assignment.worker!.licenses,
      }));
    const machines = column.assignments
      .filter((assignment) => assignment.kind === "MACHINE" && assignment.machine)
      .map((assignment) => ({
        name: assignment.machine!.nickname ?? assignment.machine!.name,
        requiredLicense: assignment.machine!.patentaEnevojshme,
        plate: assignment.machine!.targe,
        model: assignment.machine!.model,
        active: assignment.machine!.isActive,
      }));
    return {
      baustelle: column.baustelle?.name ?? column.title,
      workers,
      machines,
      warnings: analyzePlanLicenseWarnings(workers, machines, text),
    };
  });

  const warnings = groups.flatMap((group) => group.warnings.map((warning) => `${group.baustelle}: ${warning}`));

  return {
    ok: true as const,
    date: key,
    groups,
    warnings,
    message: warnings.length === 0 ? text.dailyPlanLicensesOk(key) : text.dailyPlanLicenseWarnings(key, warnings.length),
  };
}

export async function adminQueryDailyPlan(
  requester: RequesterContext,
  input: { date?: string; workerName?: string; baustelleName?: string },
) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const key = (input.date ?? todayKey()).trim();
  const day = startOfLocalDay(key);
  if (!day) return { ok: false as const, message: text.invalidDate };
  const workerNeedle = normalizeName(input.workerName ?? "").toLowerCase();
  const baustelleNeedle = normalizeName(input.baustelleName ?? "").toLowerCase();

  const plan = await prisma.dailyWorkPlan.findUnique({
    where: { companyProfileId_planDate: { companyProfileId: requester.companyId, planDate: day } },
    include: {
      columns: {
        orderBy: { sortOrder: "asc" },
        include: {
          baustelle: { select: { name: true } },
          assignments: {
            orderBy: { sortOrder: "asc" },
            include: {
              worker: { select: { firstName: true, lastName: true, licenses: true } },
              machine: { select: { name: true, nickname: true, patentaEnevojshme: true, targe: true, model: true, isActive: true } },
            },
          },
        },
      },
      savedRows: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!plan) return { ok: true as const, date: key, groups: [], message: text.noDailyPlan(key) };

  const liveGroups = plan.columns.map((column) => {
    const workers = column.assignments
      .filter((assignment) => assignment.kind === "WORKER")
      .map((assignment) => {
        const label = assignment.worker ? `${assignment.worker.firstName} ${assignment.worker.lastName}`.trim() : assignment.labelSnapshot;
        return { name: label, licenses: assignment.worker?.licenses ?? null };
      });
    const machines = column.assignments
      .filter((assignment) => assignment.kind === "MACHINE")
      .map((assignment) => ({
        name: assignment.machine?.nickname ?? assignment.machine?.name ?? assignment.labelSnapshot,
        requiredLicense: assignment.machine?.patentaEnevojshme ?? null,
        plate: assignment.machine?.targe ?? null,
        model: assignment.machine?.model ?? null,
        active: assignment.machine?.isActive ?? null,
      }));
    return {
      source: "live-plan" as const,
      baustelle: column.baustelle?.name ?? column.title,
      note: column.note,
      workers,
      machines,
      warnings: analyzePlanLicenseWarnings(workers, machines, text),
    };
  });

  const savedGroups = plan.savedRows.map((row) => ({
    source: "saved-row" as const,
    baustelle: row.baustelleName,
    note: row.note,
    workers: row.workerNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name, licenses: null })),
    machines: row.machineNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name, requiredLicense: null, plate: null, model: null, active: null })),
    warnings: [] as string[],
  }));

  const groups = liveGroups.length > 0 ? liveGroups : savedGroups;
  const filtered = groups.filter((group) => {
    const workerMatch = !workerNeedle || group.workers.some((worker) => worker.name.toLowerCase().includes(workerNeedle));
    const baustelleMatch = !baustelleNeedle || group.baustelle.toLowerCase().includes(baustelleNeedle);
    return workerMatch && baustelleMatch;
  });

  return {
    ok: true as const,
    date: key,
    groups: filtered,
    message:
      filtered.length === 0
        ? text.noMatchingPlanGroup(key)
        : text.matchingPlanGroups(filtered.length, key),
  };
}

export async function getWorkerPrivateSummary(
  requester: RequesterContext,
  input: { workerName: string; days?: number },
): Promise<
  | {
      ok: true;
      worker: string;
      days: number;
      totalHours: number;
      sessions: Array<{
        date: string;
        startTime: string;
        endTime: string | null;
        isLive: boolean;
        hours: number;
        baustelle: string | null;
        source: string;
      }>;
      message: string;
    }
  | { ok: false; message: string }
> {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false, message: text.sensitiveAdminOnly };

  const worker = await findWorkerByName(requester.companyId, input.workerName);
  if (!worker) return { ok: false, message: text.workerNotFound };

  const days = Math.min(31, Math.max(1, Math.floor(Number(input.days ?? 7) || 7)));
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const sessions = await prisma.workSession.findMany({
    where: { workerId: worker.id, startTime: { gte: since } },
    orderBy: { startTime: "desc" },
    select: {
      startTime: true,
      endTime: true,
      breakMinutes: true,
      totalHours: true,
      baustelle: { select: { name: true } },
    },
    take: 250,
  });

  const rows = sessions.map((s) => ({
    date: dateKey(s.startTime),
    ...sessionPayload(s, new Date(), text, requester.preferredLanguage),
  }));
  const totalHours = rows.reduce((sum, r) => sum + (Number.isFinite(r.hours) ? r.hours : 0), 0);

  return {
    ok: true,
    worker: `${worker.firstName} ${worker.lastName}`.trim(),
    days,
    totalHours,
    sessions: rows,
    message: text.hoursOverview(days, `${worker.firstName} ${worker.lastName}`.trim()),
  };
}

function dailyReportPayload(report: Awaited<ReturnType<typeof getWorkerDailyReport>>, date: string, text = assistantToolText("DE"), lang?: string) {
  const groups = groupDailyWorkByBaustelle(report, lang);
  const notes = parseReportMessages(report.note?.note, lang).map((m) => ({
    authorName: m.authorName,
    authorRole: m.authorRole,
    text: m.text,
    createdAt: m.createdAt,
  }));
  const sessions = report.sessions.map((s) => sessionPayload(s, new Date(), text, lang));
  const totalHours = sessions.reduce((sum, s) => sum + s.hours, 0);

  return {
    date,
    worker: report.worker ? `${report.worker.firstName} ${report.worker.lastName}`.trim() : null,
    totalHours,
    sessions,
    baustellen: groups.map((group) => ({
      name: group.baustelle.name,
      standort: baustelleStandort(group.baustelle),
      arbeitszeiten: group.sessions.map((session) => ({
        startTime: formatReportTime(session.startTime, lang),
        endTime: formatReportTime(session.endTime, lang),
        isLive: !session.endTime,
      })),
      kollegen: group.colleagues,
      aktivitaeten: group.activities.map((activity) => ({
        time: formatReportTime(activity.time, lang),
        title: activity.title,
        detail: activity.detail,
        treeId: activity.treeId,
      })),
      tasks: group.tasks.map((task) => ({ description: task.description, createdAt: task.createdAt.toISOString() })),
      trees: group.trees.map((tree) => ({
        treeId: tree.treeId,
        species: tree.species || null,
        diameter: tree.diameter,
        crownWidth: treeExtra(tree, ["crownWidth", "kronenbreite", "kronenBreite"]),
        height: treeExtra(tree, ["height", "hoehe", "lartesi"]),
        note: treeWorkerNote(tree),
        haltverbot: treeHaltverbot(tree),
        action: treeAction(tree, lang),
        completedAt: tree.completedAt ? tree.completedAt.toISOString() : null,
      })),
    })),
    notes,
  };
}

function monthlyReportPayload(report: Awaited<ReturnType<typeof getWorkerMonthlyReport>>, month: string, text = assistantToolText("DE"), lang?: string) {
  const rows = monthlySessionRows(report, month, lang);
  const notesRaw = parseReportMessages(report.note?.note, lang);
  const notes = notesRaw
    .filter((m) => !m.text.startsWith("KOHE|"))
    .map((m) => ({ authorName: m.authorName, authorRole: m.authorRole, text: m.text, createdAt: m.createdAt }));
  const adminTimeRows = notesRaw
    .filter((message) => message.authorRole === "Admin" && message.text.startsWith("KOHE|"))
    .map((message) => {
      const [, startIso, endIso] = message.text.split("|");
      const start = new Date(startIso ?? "");
      const end = new Date(endIso ?? "");
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
      return {
        date: dateKey(start),
        start: formatReportTime(start, lang),
        end: formatReportTime(end, lang),
      };
    })
    .filter((row): row is { date: string; start: string; end: string } => Boolean(row));
  const totalHours = rows.reduce((sum, row) => sum + row.totalHours, 0);

  return {
    month,
    worker: report.worker ? `${report.worker.firstName} ${report.worker.lastName}`.trim() : null,
    totalHours,
    rows: rows.map((row) => ({
      date: row.date,
      day: row.dayName,
      startTime: formatReportTime(row.startTime, lang),
      endTime: formatReportTime(row.endTime, lang),
      isLive: row.hasLive,
      breakMinutes: row.hasWork ? row.breakMinutes : 0,
      locations: row.locations,
      hours: row.hasWork ? row.totalHours : 0,
      hasWork: row.hasWork,
    })),
    adminTimeRows,
    notes,
  };
}

export async function getMyDailyReport(requester: RequesterContext, input: { date?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false as const, message: text.notSignedIn };
  if (requester.kind !== "worker") return { ok: false as const, message: text.workerDailyAdminHint };

  const date = (input.date ?? todayKey()).trim();
  if (!validDateKey(date)) return { ok: false as const, message: text.invalidDate };

  const report = await getWorkerDailyReport(requester.workerId, date);
  if (!report.worker || report.worker.companyProfileId !== requester.companyId) return { ok: false as const, message: text.workerNotFound };
  const payload = dailyReportPayload(report, date, text, requester.preferredLanguage);

  return {
    ok: true as const,
    ...payload,
    profileUrl: `/workzone/profile`,
    dailyReportUrl: `/workzone/profile/day/${date}`,
    message: text.myDailyReport(date, payload.totalHours, payload.baustellen.length),
  };
}

export async function getMyMonthlyTimesheet(requester: RequesterContext, input: { month?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false as const, message: text.notSignedIn };
  if (requester.kind !== "worker") return { ok: false as const, message: text.workerMonthlyAdminHint };

  const month = (input.month ?? currentMonthKey()).trim();
  if (!validMonthKey(month)) return { ok: false as const, message: text.invalidMonth };

  const report = await getWorkerMonthlyReport(requester.workerId, month);
  if (!report.worker || report.worker.companyProfileId !== requester.companyId) return { ok: false as const, message: text.workerNotFound };
  const payload = monthlyReportPayload(report, month, text, requester.preferredLanguage);

  return {
    ok: true as const,
    ...payload,
    profileUrl: `/workzone/profile`,
    monthlyTimesheetUrl: `/workzone/profile/month/${month}`,
    message: text.myMonthlyTimesheet(month, payload.totalHours),
  };
}

export async function adminGetWorkerDailyReport(requester: RequesterContext, input: { workerName: string; date?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const worker = await findWorkerByName(requester.companyId, input.workerName);
  if (!worker) return { ok: false as const, message: text.workerNotFound };
  const date = (input.date ?? todayKey()).trim();
  if (!validDateKey(date)) return { ok: false as const, message: text.invalidDate };

  const report = await getWorkerDailyReport(worker.id, date);
  if (!report.worker || report.worker.companyProfileId !== requester.companyId) return { ok: false as const, message: text.workerNotFound };
  const payload = dailyReportPayload(report, date, text, requester.preferredLanguage);

  return {
    ok: true as const,
    ...payload,
    ...workerLinks(worker.id, date),
    message: text.workerDailyReport(date, payload.worker, payload.totalHours, payload.baustellen.length),
  };
}

export async function adminGetTeamDailyReport(requester: RequesterContext, input: { date?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const date = (input.date ?? todayKey()).trim();
  if (!validDateKey(date)) return { ok: false as const, message: text.invalidDate };
  const start = startOfLocalDay(date);
  if (!start) return { ok: false as const, message: text.invalidDate };
  const end = endOfLocalDay(start);

  const [workers, sessionsRaw, trees, inventoryMovements, coneMovements] = await Promise.all([
    prisma.worker.findMany({
      where: { companyProfileId: requester.companyId },
      select: { id: true, firstName: true, lastName: true, status: true, availability: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    }),
    prisma.workSession.findMany({
      where: { worker: { companyProfileId: requester.companyId }, startTime: { gte: start, lte: end } },
      include: { worker: true, baustelle: { select: { name: true } } },
      orderBy: { startTime: "asc" },
      take: 3000,
    }),
    prisma.treeItem.findMany({
      where: {
        completedAt: { gte: start, lte: end },
        completedByWorker: { companyProfileId: requester.companyId },
      },
      include: { completedByWorker: true, baustelle: { select: { name: true } } },
      orderBy: { completedAt: "asc" },
      take: 5000,
    }),
    prisma.inventoryMovement.findMany({
      where: { timestamp: { gte: start, lte: end }, worker: { companyProfileId: requester.companyId } },
      include: { worker: true, baustelle: { select: { name: true } }, treeItem: { select: { treeId: true } } },
      orderBy: { timestamp: "asc" },
      take: 5000,
    }),
    prisma.machineConeMovement.findMany({
      where: { createdAt: { gte: start, lte: end }, actorWorker: { companyProfileId: requester.companyId } },
      include: { actorWorker: true, baustelle: { select: { name: true } }, treeItem: { select: { treeId: true } } },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
  ]);

  const sessions = sessionsRaw.filter((session) => effectiveSessionHours(session) >= 1 / 60);
  const rows = new Map<
    string,
    {
      worker: string;
      status: string;
      availability: string;
      hours: number;
      baustellen: Set<string>;
      treeCount: number;
      trees: { treeId: string; baustelle: string; completedAt: string | null }[];
      materialActionCount: number;
      materialActions: string[];
    }
  >();

  for (const worker of workers) {
    rows.set(worker.id, {
      worker: `${worker.firstName} ${worker.lastName}`.trim(),
      status: worker.status,
      availability: worker.availability,
      hours: 0,
      baustellen: new Set<string>(),
      treeCount: 0,
      trees: [],
      materialActionCount: 0,
      materialActions: [],
    });
  }

  for (const session of sessions) {
    const row = rows.get(session.workerId);
    if (!row) continue;
    row.hours += effectiveSessionHours(session);
    if (session.baustelle?.name) row.baustellen.add(session.baustelle.name);
  }

  for (const tree of trees) {
    if (!tree.completedByWorkerId) continue;
    const row = rows.get(tree.completedByWorkerId);
    if (!row) continue;
    row.treeCount += 1;
    if (tree.baustelle?.name) row.baustellen.add(tree.baustelle.name);
    row.trees.push({
      treeId: tree.treeId,
      baustelle: tree.baustelle?.name ?? "-",
      completedAt: tree.completedAt ? formatReportTime(tree.completedAt, requester.preferredLanguage) : null,
    });
  }

  for (const movement of inventoryMovements) {
    if (!movement.workerId) continue;
    const row = rows.get(movement.workerId);
    if (!row) continue;
    row.materialActionCount += 1;
    if (movement.baustelle?.name) row.baustellen.add(movement.baustelle.name);
    row.materialActions.push(
      `${formatReportTime(movement.timestamp, requester.preferredLanguage)} ${movement.type === "DEPLOY" ? text.deployed : text.collected}: ${movement.quantity} ${movement.category}${movement.treeItem?.treeId ? ` ${text.tree} ${movement.treeItem.treeId}` : ""}`,
    );
  }

  for (const movement of coneMovements) {
    if (!movement.actorWorkerId) continue;
    const row = rows.get(movement.actorWorkerId);
    if (!row) continue;
    row.materialActionCount += 1;
    if (movement.baustelle?.name) row.baustellen.add(movement.baustelle.name);
    row.materialActions.push(
      `${formatReportTime(movement.createdAt, requester.preferredLanguage)} ${movement.type === "DEPLOY" ? text.deployed : movement.type === "COLLECT" ? text.collected : text.moved}: ${movement.quantity} ${text.cones}${movement.treeItem?.treeId ? ` ${text.tree} ${movement.treeItem.treeId}` : ""}`,
    );
  }

  const activeRows = [...rows.values()]
    .filter((row) => row.hours > 0 || row.treeCount > 0 || row.materialActionCount > 0)
    .map((row) => ({
      worker: row.worker,
      status: row.status,
      availability: row.availability,
      hours: row.hours,
      baustellen: [...row.baustellen],
      treeCount: row.treeCount,
      trees: row.trees,
      materialActionCount: row.materialActionCount,
      materialActions: row.materialActions,
    }))
    .sort((a, b) => b.treeCount - a.treeCount || a.worker.localeCompare(b.worker));
  const workersWithTrees = activeRows.filter((row) => row.treeCount > 0);
  const workersWorkedWithoutTrees = activeRows.filter((row) => row.treeCount === 0);

  return {
    ok: true as const,
    date,
    activeWorkerCount: activeRows.length,
    workersWithTrees,
    workersWorkedWithoutTrees,
    workers: activeRows,
    message:
      workersWithTrees.length === 0
        ? text.teamNoCompletedTrees(date)
        : text.teamCompletedTrees(date, workersWithTrees.length),
  };
}

export async function adminGetWorkerMonthlyTimesheet(requester: RequesterContext, input: { workerName: string; month?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const worker = await findWorkerByName(requester.companyId, input.workerName);
  if (!worker) return { ok: false as const, message: text.workerNotFound };
  const month = (input.month ?? currentMonthKey()).trim();
  if (!validMonthKey(month)) return { ok: false as const, message: text.invalidMonth };

  const report = await getWorkerMonthlyReport(worker.id, month);
  if (!report.worker || report.worker.companyProfileId !== requester.companyId) return { ok: false as const, message: text.workerNotFound };
  const payload = monthlyReportPayload(report, month, text, requester.preferredLanguage);

  return {
    ok: true as const,
    ...payload,
    ...workerLinks(worker.id, undefined, month),
    message: text.workerMonthlyTimesheet(month, payload.worker, payload.totalHours),
  };
}

export async function adminGetOwnDailyReport(requester: RequesterContext, input: { date?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const date = (input.date ?? todayKey()).trim();
  if (!validDateKey(date)) return { ok: false as const, message: text.invalidDate };
  const report = await getAdminDailyReport(requester.adminId, date);
  if (!report.admin) return { ok: false as const, message: text.adminNotFound };

  const groups = new Map<
    string,
    {
      baustelle: { id: string; name: string; description?: string | null; coordinates?: unknown };
      tasks: typeof report.tasks;
      trees: typeof report.trees;
      activities: Array<{ title: string; detail: string; time: Date }>;
    }
  >();

  const ensureGroup = (baustelle: { id: string; name: string; description?: string | null; coordinates?: unknown } | null | undefined) => {
    if (!baustelle) return null;
    if (!groups.has(baustelle.id)) groups.set(baustelle.id, { baustelle, tasks: [], trees: [], activities: [] });
    return groups.get(baustelle.id) ?? null;
  };

  for (const task of report.tasks) {
    ensureGroup(task.baustelle)?.tasks.push(task);
  }
  for (const tree of report.trees) {
    ensureGroup(tree.baustelle)?.trees.push(tree);
  }
  for (const movement of report.inventoryMovements) {
    ensureGroup(movement.baustelle)?.activities.push(inventoryActivity(movement, requester.preferredLanguage));
  }
  for (const movement of report.coneMovements) {
    const activity = coneActivity(movement, requester.preferredLanguage);
    if (!activity) continue;
    ensureGroup(movement.baustelle)?.activities.push(activity);
  }
  const baustellen = [...groups.values()].map((group) => ({
    name: group.baustelle.name,
    standort: baustelleStandort(group.baustelle),
    activities: group.activities
      .sort((a, b) => a.time.getTime() - b.time.getTime())
      .map((activity) => ({ title: activity.title, detail: activity.detail, time: formatReportTime(activity.time, requester.preferredLanguage) })),
    tasks: group.tasks.map((task) => ({ description: task.description, createdAt: task.createdAt.toISOString() })),
    trees: group.trees.map((tree) => ({
      treeId: tree.treeId,
      species: tree.species || null,
      diameter: tree.diameter,
      crownWidth: treeExtra(tree, ["crownWidth", "kronenbreite", "kronenBreite"]),
      height: treeExtra(tree, ["height", "hoehe", "lartesi"]),
      note: treeWorkerNote(tree),
      haltverbot: treeHaltverbot(tree),
      action: treeAction(tree, requester.preferredLanguage),
      completedAt: tree.completedAt ? tree.completedAt.toISOString() : null,
    })),
  }));

  return {
    ok: true as const,
    date,
    admin: report.admin.name ?? report.admin.email,
    dailyReportUrl: `/app/admin/day/${date}`,
    baustellen,
    message: text.adminDailyReport(date, baustellen.length),
  };
}

/**
 * Live location + today's machine assignment for the logged-in worker (no name lookup).
 * Use when the user asks "ku je?", "wo bin ich?", etc. without naming someone.
 */
export async function getMyOperationalSnapshot(
  requester: RequesterContext,
): Promise<
  | {
      ok: true;
      worker: string;
      live:
        | { active: false; message: string }
        | { active: true; baustelleName: string; startedAt: string; message: string };
      assignment: { machine: string | null; baustelle: string | null; message: string };
      message: string;
    }
  | { ok: false; message: string }
> {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false, message: text.notSignedIn };
  if (requester.kind !== "worker") {
    return {
      ok: false,
      message: text.operationalWorkerOnly,
    };
  }

  const worker = await prisma.worker.findUnique({
    where: { id: requester.workerId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!worker) return { ok: false, message: text.workerNotFound };

  const label = `${worker.firstName} ${worker.lastName}`.trim();
  const [live, assigned] = await Promise.all([
    getLiveLocation(requester, { workerName: label }),
    getAssignedMachine(requester, { workerName: label }),
  ]);

  if (!live.ok) return { ok: false, message: live.message };
  if (!assigned.ok) return { ok: false, message: assigned.message };

  const livePart = live.live
    ? {
        active: true as const,
        baustelleName: live.baustelleName,
        startedAt: live.startedAt,
        message: live.message,
      }
    : { active: false as const, message: live.message };

  return {
    ok: true,
    worker: label,
    live: livePart,
    assignment: {
      machine: assigned.machine,
      baustelle: assigned.baustelle,
      message: assigned.message,
    },
    message: [live.message, assigned.message].filter(Boolean).join(" · "),
  };
}

export async function getLiveLocation(
  requester: RequesterContext,
  input: { workerName: string },
): Promise<
  | { ok: true; worker: string; live: false; message: string }
  | { ok: true; worker: string; live: true; baustelleName: string; startedAt: string; message: string }
  | { ok: false; message: string }
> {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false, message: text.notSignedIn };
  const worker = await findWorkerByName(requester.companyId, input.workerName);
  if (!worker) return { ok: false, message: text.workerNotFound };

  const live = await prisma.workSession.findFirst({
    where: { workerId: worker.id, isLive: true, endTime: null },
    orderBy: { startTime: "desc" },
    select: { startTime: true, baustelle: { select: { name: true } } },
  });
  if (!live || !live.baustelle?.name) {
    return { ok: true, worker: `${worker.firstName} ${worker.lastName}`.trim(), live: false, message: text.notLive };
  }
  return {
    ok: true,
    worker: `${worker.firstName} ${worker.lastName}`.trim(),
    live: true,
    baustelleName: live.baustelle.name,
    startedAt: formatReportTime(live.startTime, requester.preferredLanguage),
    message: text.liveOnSite(live.baustelle.name, formatReportTime(live.startTime, requester.preferredLanguage)),
  };
}

export async function getAssignedMachine(
  requester: RequesterContext,
  input: { workerName: string; date?: string },
): Promise<
  | { ok: true; worker: string; machine: string | null; baustelle: string | null; message: string }
  | { ok: false; message: string }
> {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false, message: text.notSignedIn };
  const worker = await findWorkerByName(requester.companyId, input.workerName);
  if (!worker) return { ok: false, message: text.workerNotFound };

  const key = (input.date ?? todayKey()).trim();
  const day = startOfLocalDay(key);
  if (!day) return { ok: false, message: text.invalidDate };

  const plan = await prisma.dailyWorkPlan.findUnique({
    where: { companyProfileId_planDate: { companyProfileId: requester.companyId, planDate: day } },
    include: { columns: { include: { baustelle: { select: { name: true } }, assignments: true } } },
  });
  if (!plan) {
    return {
      ok: true,
      worker: `${worker.firstName} ${worker.lastName}`.trim(),
      machine: null,
      baustelle: null,
      message: text.noDailyPlanFound,
    };
  }

  for (const col of plan.columns) {
    const hasWorker = col.assignments.some((a) => a.kind === "WORKER" && a.workerId === worker.id);
    if (!hasWorker) continue;
    const machine = col.assignments.find((a) => a.kind === "MACHINE");
    return {
      ok: true,
      worker: `${worker.firstName} ${worker.lastName}`.trim(),
      machine: machine?.labelSnapshot ?? null,
      baustelle: col.baustelle?.name ?? col.title ?? null,
      message: machine?.labelSnapshot ? text.assignedWithMachine(machine.labelSnapshot) : text.assignedNoMachine,
    };
  }

  return {
    ok: true,
    worker: `${worker.firstName} ${worker.lastName}`.trim(),
    machine: null,
    baustelle: null,
    message: text.notInDailyPlan,
  };
}

export async function getEquipmentStatus(
  requester: RequesterContext,
  input: { category: "SIGN" | "PLATE" | "FENCE"; limit?: number },
): Promise<{ ok: true; summary: string; rows: Array<{ baustelle: string; treeId: string | null; quantityOnSite: number }> } | { ok: false; message: string }> {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false, message: text.notSignedIn };
  const take = Math.min(500, Math.max(50, Number(input.limit ?? 200) || 200));

  const moves = await prisma.inventoryMovement.findMany({
    where: { companyProfileId: requester.companyId, category: input.category },
    orderBy: { timestamp: "desc" },
    include: {
      baustelle: { select: { name: true } },
      treeItem: { select: { treeId: true } },
    },
    take,
  });

  // Net balance per (baustelle, treeItem)
  const map = new Map<string, { baustelle: string; treeId: string | null; qty: number }>();
  for (const m of moves.reverse()) {
    const key = `${m.baustelleId}::${m.treeItemId ?? "SITE"}`;
    const current = map.get(key) ?? { baustelle: m.baustelle.name, treeId: m.treeItem?.treeId ?? null, qty: 0 };
    const delta = m.type === "DEPLOY" ? m.quantity : -m.quantity;
    current.qty += delta;
    map.set(key, current);
  }

  const rows = Array.from(map.values())
    .filter((r) => r.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 20)
    .map((r) => ({ baustelle: r.baustelle, treeId: r.treeId, quantityOnSite: r.qty }));

  if (rows.length === 0) return { ok: true, summary: text.noEquipmentOnSite, rows: [] };

  const summary = rows
    .map((r) => (r.treeId ? `${r.baustelle} (${text.tree} ${r.treeId}): ${r.quantityOnSite}` : `${r.baustelle}: ${r.quantityOnSite}`))
    .join(" · ");
  return { ok: true, summary, rows };
}

export async function getKnowledge(
  requester: RequesterContext,
  input: { query: string; language?: AssistantLanguageCode },
): Promise<{ ok: true; title: string; content: string } | { ok: false; message: string }> {
  const lang = normalizeAssistantLanguage(input.language ?? requester.preferredLanguage);
  const text = assistantToolText(lang);
  const q = input.query.trim();
  if (!q) return { ok: false, message: text.knowledgeQueryRequired };

  const row = await prisma.companyKnowledge.findFirst({
    where: {
      companyProfileId: requester.companyId,
      isActive: true,
      language: lang,
      OR: [{ key: { equals: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }],
    },
    orderBy: { updatedAt: "desc" },
    select: { title: true, content: true },
  });
  if (!row) return { ok: false, message: text.knowledgeNotFound };
  return { ok: true, title: row.title, content: row.content };
}

/** Eingeloggter Mitarbeiter: eigene Stunden aus WorkSessions (letzte X Tage). */
export async function getMyHoursSummary(requester: RequesterContext, input: { days?: number }) {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false as const, message: text.notSignedIn };
  if (requester.kind !== "worker") {
    return { ok: false as const, message: text.privateSummaryAdminHint };
  }

  const days = Math.min(31, Math.max(1, Math.floor(Number(input.days ?? 14) || 14)));
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const sessions = await prisma.workSession.findMany({
    where: { workerId: requester.workerId, startTime: { gte: since } },
    orderBy: { startTime: "desc" },
    select: {
      startTime: true,
      endTime: true,
      breakMinutes: true,
      totalHours: true,
      baustelle: { select: { name: true } },
    },
    take: 300,
  });

  const rows = sessions.map((s) => ({
    date: dateKey(s.startTime),
    ...sessionPayload(s, new Date(), text, requester.preferredLanguage),
  }));
  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);

  return {
    ok: true as const,
    days,
    totalHours,
    sessions: rows,
    message: text.myHoursSummary(days, totalHours),
  };
}

/** Öffentliche Baustellen-Infos (Workzone): Namen, Typ, Adresse — für alle eingeloggten Nutzer derselben Firma. */
export async function getCompanyBaustellenDirectory(requester: RequesterContext) {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false as const, message: text.notSignedIn };

  const rows = await prisma.baustelle.findMany({
    where: { companyProfileId: requester.companyId, status: "active" },
    select: { name: true, type: true, address: true, description: true },
    orderBy: { name: "asc" },
    take: 120,
  });

  return {
    ok: true as const,
    count: rows.length,
    baustellen: rows.map((b) => ({
      name: b.name,
      type: b.type,
      address: b.address,
      descriptionSnippet: b.description ? b.description.slice(0, 200) : null,
    })),
    message: text.activeSitesDirectory(rows.length),
  };
}

export function redactPrivateWorkerData(requester: RequesterContext, text: string) {
  // placeholder hook for future redaction rules
  if (requester.kind === "admin") return text;
  return text;
}
