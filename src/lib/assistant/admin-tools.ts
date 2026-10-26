import { prisma } from "@/lib/db/prisma";
import { getDashboardSnapshot } from "@/lib/dashboard/dashboard-snapshot";
import { ProjectStatus } from "@/generated/prisma/enums";
import { dateKey } from "@/lib/workzone/reporting";
import { effectiveSessionHours } from "@/lib/workzone/session-rules";
import type { RequesterContext } from "./requester";

const PROJECT_STATUS_SET = new Set<string>(Object.values(ProjectStatus));

function adminToolText(requester: RequesterContext) {
  const lang = requester.preferredLanguage;
  const messages = {
    DE: {
      adminOnly: "Nur fuer Administratoren.",
      noSite: "(keine Baustelle)",
      noLiveWorkers: "Niemand ist aktuell live eingestempelt.",
      liveWorkers: (count: number) => `${count} Person(en) live auf Baustellen.`,
      dayLabel: (day: string) => `Tag ${day}`,
      monthLabel: (month: string) => `Monat ${month}`,
      rangeRequired: "rangeFrom/rangeTo als YYYY-MM-DD angeben.",
      rangeOrder: "rangeFrom muss vor rangeTo liegen.",
      hoursSummary: (label: string, hours: number, rows: number) => `Summe Stunden (${label}): ${hours.toFixed(2)} h (${rows} Session-Zeilen).`,
      searchMin: "Mindestens 2 Zeichen fuer die Suche.",
      noLicenseMatch: (query: string) => `Kein Mitarbeiter mit "${query}" im Lizenzen-Feld.`,
      licenseMatches: (count: number) => `${count} Treffer (Profilfeld licenses).`,
      monthRequired: "yearMonth als YYYY-MM angeben.",
      invalidMonth: "Ungueltiger Monat.",
      noMonthSessions: (month: string) => `Keine Sessions im Monat ${month}.`,
      topHours: (count: number, month: string) => `Top ${count} nach Stunden (${month}).`,
      dashboardSnapshot:
        "Dashboard-Snapshot aus der read-only Admin-Uebersicht. Alle Zahlen stammen direkt aus den realen Snapshot-Daten und sollen fuer Dashboard-/KPI-Fragen bevorzugt verwendet werden.",
      sitesOverview:
        "Baustellen mit Baum-Status (todo/done) und Dokumentliste. Keine festen Deadline-Felder im Schema; Fristen stehen ggf. in Beschreibung/Dokumenten.",
      projects: (count: number) => `${count} Projekt(e) (Kalkulation).`,
      openTasks: (count: number) => `${count} offene/flagged Aufgaben.`,
      noOpenTasks: "Keine flagged ManualTasks.",
      locale: "de-DE",
    },
    EN: {
      adminOnly: "Administrators only.",
      noSite: "(no site)",
      noLiveWorkers: "No one is currently clocked in live.",
      liveWorkers: (count: number) => `${count} person(s) live on sites.`,
      dayLabel: (day: string) => `Day ${day}`,
      monthLabel: (month: string) => `Month ${month}`,
      rangeRequired: "Provide rangeFrom/rangeTo as YYYY-MM-DD.",
      rangeOrder: "rangeFrom must be before rangeTo.",
      hoursSummary: (label: string, hours: number, rows: number) => `Total hours (${label}): ${hours.toFixed(2)} h (${rows} session rows).`,
      searchMin: "Use at least 2 characters for search.",
      noLicenseMatch: (query: string) => `No worker has "${query}" in the licenses field.`,
      licenseMatches: (count: number) => `${count} match(es) (profile field licenses).`,
      monthRequired: "Provide yearMonth as YYYY-MM.",
      invalidMonth: "Invalid month.",
      noMonthSessions: (month: string) => `No sessions in month ${month}.`,
      topHours: (count: number, month: string) => `Top ${count} by hours (${month}).`,
      dashboardSnapshot:
        "Dashboard snapshot from the read-only admin overview. All numbers come directly from real snapshot data and should be preferred for dashboard/KPI questions.",
      sitesOverview:
        "Sites with tree status (todo/done) and document list. There are no fixed deadline fields in the schema; deadlines may be in descriptions/documents.",
      projects: (count: number) => `${count} project(s) (calculation).`,
      openTasks: (count: number) => `${count} open/flagged tasks.`,
      noOpenTasks: "No flagged manual tasks.",
      locale: "en-US",
    },
    IT: {
      adminOnly: "Solo per amministratori.",
      noSite: "(nessun cantiere)",
      noLiveWorkers: "Nessuno e attualmente timbrato live.",
      liveWorkers: (count: number) => `${count} persona/e live sui cantieri.`,
      dayLabel: (day: string) => `Giorno ${day}`,
      monthLabel: (month: string) => `Mese ${month}`,
      rangeRequired: "Inserisci rangeFrom/rangeTo come YYYY-MM-DD.",
      rangeOrder: "rangeFrom deve essere prima di rangeTo.",
      hoursSummary: (label: string, hours: number, rows: number) => `Totale ore (${label}): ${hours.toFixed(2)} h (${rows} righe sessione).`,
      searchMin: "Usa almeno 2 caratteri per la ricerca.",
      noLicenseMatch: (query: string) => `Nessun worker ha "${query}" nel campo licenze.`,
      licenseMatches: (count: number) => `${count} risultato/i (campo profilo licenses).`,
      monthRequired: "Inserisci yearMonth come YYYY-MM.",
      invalidMonth: "Mese non valido.",
      noMonthSessions: (month: string) => `Nessuna sessione nel mese ${month}.`,
      topHours: (count: number, month: string) => `Top ${count} per ore (${month}).`,
      dashboardSnapshot:
        "Snapshot dashboard dalla panoramica admin in sola lettura. Tutti i numeri arrivano dai dati reali dello snapshot e vanno preferiti per domande dashboard/KPI.",
      sitesOverview:
        "Cantieri con stato alberi (todo/done) e lista documenti. Non ci sono campi deadline fissi nello schema; le scadenze possono essere in descrizioni/documenti.",
      projects: (count: number) => `${count} progetto/i (calcolo).`,
      openTasks: (count: number) => `${count} attivita aperte/flagged.`,
      noOpenTasks: "Nessuna attivita manuale flagged.",
      locale: "it-IT",
    },
    SQ: {
      adminOnly: "Vetem per administratore.",
      noSite: "(pa kantier)",
      noLiveWorkers: "Askush nuk eshte aktualisht live ne pune.",
      liveWorkers: (count: number) => `${count} persona live ne kantiere.`,
      dayLabel: (day: string) => `Dita ${day}`,
      monthLabel: (month: string) => `Muaji ${month}`,
      rangeRequired: "Jep rangeFrom/rangeTo si YYYY-MM-DD.",
      rangeOrder: "rangeFrom duhet te jete para rangeTo.",
      hoursSummary: (label: string, hours: number, rows: number) => `Totali i oreve (${label}): ${hours.toFixed(2)} h (${rows} rreshta sesioni).`,
      searchMin: "Per kerkim duhen te pakten 2 karaktere.",
      noLicenseMatch: (query: string) => `Asnje worker nuk ka "${query}" te fusha e licencave.`,
      licenseMatches: (count: number) => `${count} rezultat(e) (fusha e profilit licenses).`,
      monthRequired: "Jep yearMonth si YYYY-MM.",
      invalidMonth: "Muaj i pavlefshem.",
      noMonthSessions: (month: string) => `Nuk ka sesione ne muajin ${month}.`,
      topHours: (count: number, month: string) => `Top ${count} sipas oreve (${month}).`,
      dashboardSnapshot:
        "Snapshot i dashboard-it nga pamja admin read-only. Te gjitha shifrat vijne direkt nga te dhenat reale dhe duhen perdorur per pyetje dashboard/KPI.",
      sitesOverview:
        "Kantiere me status druri (todo/done) dhe liste dokumentesh. Nuk ka fusha fikse deadline ne skeme; afatet mund te jene ne pershkrime/dokumente.",
      projects: (count: number) => `${count} projekt(e) (kalkulim).`,
      openTasks: (count: number) => `${count} detyra te hapura/flagged.`,
      noOpenTasks: "Nuk ka detyra manuale flagged.",
      locale: "sq-AL",
    },
    RO: {
      adminOnly: "Doar pentru administratori.",
      noSite: "(fara santier)",
      noLiveWorkers: "Nimeni nu este pontat live acum.",
      liveWorkers: (count: number) => `${count} persoana/e live pe santiere.`,
      dayLabel: (day: string) => `Ziua ${day}`,
      monthLabel: (month: string) => `Luna ${month}`,
      rangeRequired: "Trimite rangeFrom/rangeTo ca YYYY-MM-DD.",
      rangeOrder: "rangeFrom trebuie sa fie inainte de rangeTo.",
      hoursSummary: (label: string, hours: number, rows: number) => `Total ore (${label}): ${hours.toFixed(2)} h (${rows} randuri sesiune).`,
      searchMin: "Foloseste cel putin 2 caractere pentru cautare.",
      noLicenseMatch: (query: string) => `Niciun lucrator nu are "${query}" in campul licente.`,
      licenseMatches: (count: number) => `${count} rezultat(e) (camp profil licenses).`,
      monthRequired: "Trimite yearMonth ca YYYY-MM.",
      invalidMonth: "Luna invalida.",
      noMonthSessions: (month: string) => `Nu exista sesiuni in luna ${month}.`,
      topHours: (count: number, month: string) => `Top ${count} dupa ore (${month}).`,
      dashboardSnapshot:
        "Snapshot dashboard din prezentarea admin read-only. Toate cifrele vin direct din datele reale de snapshot si trebuie preferate pentru intrebari dashboard/KPI.",
      sitesOverview:
        "Santiere cu status arbori (todo/done) si lista de documente. Nu exista campuri deadline fixe in schema; termenele pot fi in descrieri/documente.",
      projects: (count: number) => `${count} proiect(e) (calculatie).`,
      openTasks: (count: number) => `${count} sarcini deschise/flagged.`,
      noOpenTasks: "Nu exista sarcini manuale flagged.",
      locale: "ro-RO",
    },
    PL: {
      adminOnly: "Tylko dla administratorow.",
      noSite: "(brak budowy)",
      noLiveWorkers: "Nikt nie jest teraz aktywnie zalogowany do pracy.",
      liveWorkers: (count: number) => `${count} osoba/osoby live na budowach.`,
      dayLabel: (day: string) => `Dzien ${day}`,
      monthLabel: (month: string) => `Miesiac ${month}`,
      rangeRequired: "Podaj rangeFrom/rangeTo jako YYYY-MM-DD.",
      rangeOrder: "rangeFrom musi byc przed rangeTo.",
      hoursSummary: (label: string, hours: number, rows: number) => `Suma godzin (${label}): ${hours.toFixed(2)} h (${rows} wierszy sesji).`,
      searchMin: "Do wyszukiwania uzyj co najmniej 2 znakow.",
      noLicenseMatch: (query: string) => `Zaden pracownik nie ma "${query}" w polu licencji.`,
      licenseMatches: (count: number) => `${count} wynik(i) (pole profilu licenses).`,
      monthRequired: "Podaj yearMonth jako YYYY-MM.",
      invalidMonth: "Nieprawidlowy miesiac.",
      noMonthSessions: (month: string) => `Brak sesji w miesiacu ${month}.`,
      topHours: (count: number, month: string) => `Top ${count} wedlug godzin (${month}).`,
      dashboardSnapshot:
        "Snapshot dashboardu z widoku admin read-only. Wszystkie liczby pochodza bezposrednio z rzeczywistych danych snapshotu i powinny byc uzywane do pytan dashboard/KPI.",
      sitesOverview:
        "Budowy ze statusem drzew (todo/done) i lista dokumentow. W schemacie nie ma stalych pol deadline; terminy moga byc w opisach/dokumentach.",
      projects: (count: number) => `${count} projekt(y) (kalkulacja).`,
      openTasks: (count: number) => `${count} otwarte/flagged zadania.`,
      noOpenTasks: "Brak flagged zadan manualnych.",
      locale: "pl-PL",
    },
  } as const;
  return messages[lang] ?? messages.DE;
}

function mustAdmin(requester: RequesterContext): string | null {
  if (requester.kind !== "admin") return adminToolText(requester).adminOnly;
  return null;
}

function localDayBounds(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function monthBoundsFromDate(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function parseYmd(s: string | undefined): Date | null {
  if (!s?.trim()) return null;
  const [y, m, day] = s.split("-").map((v) => Number(v));
  if (!y || !m || !day) return null;
  const d = new Date(y, m - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) return null;
  return d;
}

/** Wer gerade live eingestempelt ist (alle Worker der Firma). */
export async function adminGetLiveWorkforce(requester: RequesterContext) {
  const text = adminToolText(requester);
  const deny = mustAdmin(requester);
  if (deny) return { ok: false as const, message: deny };

  const rows = await prisma.workSession.findMany({
    where: {
      isLive: true,
      endTime: null,
      worker: { companyProfileId: requester.companyId },
    },
    select: {
      id: true,
      startTime: true,
      worker: { select: { id: true, firstName: true, lastName: true } },
      baustelle: { select: { id: true, name: true } },
    },
    orderBy: { startTime: "desc" },
    take: 200,
  });

  const list = rows.map((r) => ({
    worker: `${r.worker.firstName} ${r.worker.lastName}`.trim(),
    baustelle: r.baustelle?.name ?? text.noSite,
    since: r.startTime.toLocaleTimeString(text.locale, { hour: "2-digit", minute: "2-digit" }),
  }));

  return {
    ok: true as const,
    count: list.length,
    workers: list,
    message:
      list.length === 0
        ? text.noLiveWorkers
        : text.liveWorkers(list.length),
  };
}

export type AdminHoursPeriod = "today" | "month" | "range";

/** Summe Arbeitsstunden über WorkSession-Zeilen (Firma), optional nach Mitarbeiter gruppiert. */
export async function adminGetHoursAggregate(
  requester: RequesterContext,
  input: {
    period: AdminHoursPeriod;
    /** YYYY-MM-DD für month/range/today-Referenz */
    referenceDate?: string;
    rangeFrom?: string;
    rangeTo?: string;
    groupByWorker?: boolean;
  },
) {
  const text = adminToolText(requester);
  const deny = mustAdmin(requester);
  if (deny) return { ok: false as const, message: deny };

  const ref = parseYmd(input.referenceDate) ?? new Date();
  let start: Date;
  let end: Date;
  let label: string;

  if (input.period === "today") {
    const b = localDayBounds(ref);
    start = b.start;
    end = b.end;
    label = text.dayLabel(dateKey(start));
  } else if (input.period === "month") {
    const b = monthBoundsFromDate(ref);
    start = b.start;
    end = b.end;
    label = text.monthLabel(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`);
  } else {
    const a = parseYmd(input.rangeFrom);
    const b = parseYmd(input.rangeTo);
    if (!a || !b) return { ok: false as const, message: text.rangeRequired };
    start = localDayBounds(a).start;
    end = localDayBounds(b).end;
    if (start > end) return { ok: false as const, message: text.rangeOrder };
    label = `${input.rangeFrom}–${input.rangeTo}`;
  }

  const sessions = await prisma.workSession.findMany({
    where: {
      startTime: { gte: start, lte: end },
      worker: { companyProfileId: requester.companyId },
    },
    select: {
      totalHours: true,
      breakMinutes: true,
      startTime: true,
      endTime: true,
      workerId: true,
      worker: { select: { firstName: true, lastName: true } },
    },
    take: 5000,
  });

  let totalHours = 0;
  const byWorker = new Map<string, { name: string; hours: number }>();

  for (const s of sessions) {
    const h = effectiveSessionHours(s);
    totalHours += h;
    if (input.groupByWorker) {
      const id = s.workerId;
      const name = `${s.worker.firstName} ${s.worker.lastName}`.trim();
      const cur = byWorker.get(id) ?? { name, hours: 0 };
      cur.hours += h;
      byWorker.set(id, cur);
    }
  }

  const breakdown = input.groupByWorker
    ? [...byWorker.values()].sort((a, b) => b.hours - a.hours)
    : undefined;

  return {
    ok: true as const,
    periodLabel: label,
    sessionRows: sessions.length,
    totalHours,
    byWorker: breakdown,
    message: text.hoursSummary(label, totalHours, sessions.length),
  };
}

/** Führerschein-/Lizenstext enthält Substring (z. B. CE). */
export async function adminSearchWorkersByLicense(requester: RequesterContext, input: { contains: string }) {
  const text = adminToolText(requester);
  const deny = mustAdmin(requester);
  if (deny) return { ok: false as const, message: deny };

  const q = input.contains.trim();
  if (q.length < 2) return { ok: false as const, message: text.searchMin };

  const rows = await prisma.worker.findMany({
    where: {
      companyProfileId: requester.companyId,
      licenses: { contains: q, mode: "insensitive" },
    },
    select: { firstName: true, lastName: true, licenses: true },
    take: 80,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return {
    ok: true as const,
    matches: rows.map((w) => ({
      worker: `${w.firstName} ${w.lastName}`.trim(),
      licenses: w.licenses ?? "",
    })),
    message:
      rows.length === 0
        ? text.noLicenseMatch(q)
        : text.licenseMatches(rows.length),
  };
}

/** Ranking nach Summe totalHours im Kalendermonat (YYYY-MM). */
export async function adminGetHoursRanking(requester: RequesterContext, input: { yearMonth: string; limit?: number }) {
  const text = adminToolText(requester);
  const deny = mustAdmin(requester);
  if (deny) return { ok: false as const, message: deny };

  const m = input.yearMonth.trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return { ok: false as const, message: text.monthRequired };
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return { ok: false as const, message: text.invalidMonth };

  const ref = new Date(year, month - 1, 15);
  const { start, end } = monthBoundsFromDate(ref);
  const limit = Math.min(50, Math.max(5, Math.floor(Number(input.limit ?? 15) || 15)));

  const sessions = await prisma.workSession.findMany({
    where: {
      startTime: { gte: start, lte: end },
      worker: { companyProfileId: requester.companyId },
    },
    select: {
      totalHours: true,
      breakMinutes: true,
      startTime: true,
      endTime: true,
      workerId: true,
      worker: { select: { firstName: true, lastName: true } },
    },
    take: 8000,
  });

  const map = new Map<string, { name: string; hours: number }>();
  for (const s of sessions) {
    const h = effectiveSessionHours(s);
    const id = s.workerId;
    const name = `${s.worker.firstName} ${s.worker.lastName}`.trim();
    const cur = map.get(id) ?? { name, hours: 0 };
    cur.hours += h;
    map.set(id, cur);
  }

  const ranking = [...map.values()]
    .sort((a, b) => b.hours - a.hours)
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, worker: r.name, hours: r.hours }));

  return {
    ok: true as const,
    yearMonth: input.yearMonth,
    ranking,
    message:
      ranking.length === 0
        ? text.noMonthSessions(input.yearMonth)
        : text.topHours(ranking.length, input.yearMonth),
  };
}

export async function adminGetDashboardSnapshot(
  requester: RequesterContext,
  input?: {
    includeWeeklyBaustellen?: boolean;
    includeProgress?: boolean;
    includeWorkerRanking?: boolean;
  },
) {
  const text = adminToolText(requester);
  const deny = mustAdmin(requester);
  if (deny) return { ok: false as const, message: deny };

  const snapshot = await getDashboardSnapshot(requester.companyId, requester.preferredLanguage?.toLowerCase());

  return {
    ok: true as const,
    generatedAt: snapshot.generatedAt,
    todayKey: snapshot.todayKey,
    stats: snapshot.stats,
    charts: {
      weekHoursColumns: input?.includeWeeklyBaustellen ? snapshot.charts.weekHoursColumns : undefined,
      weekHoursByBaustelle: input?.includeWeeklyBaustellen ? snapshot.charts.weekHoursByBaustelle : undefined,
      baustellenProgress: input?.includeProgress ? snapshot.charts.baustellenProgress : undefined,
      workerHours: input?.includeWorkerRanking ? snapshot.charts.workerHours : undefined,
    },
    message: text.dashboardSnapshot,
  };
}

export async function adminListBaustellenOverview(requester: RequesterContext, input: { status?: "active" | "inactive" }) {
  const text = adminToolText(requester);
  const deny = mustAdmin(requester);
  if (deny) return { ok: false as const, message: deny };

  const statusFilter = input.status
    ? { status: input.status === "active" ? ("active" as const) : ("inactive" as const) }
    : {};

  const sites = await prisma.baustelle.findMany({
    where: { companyProfileId: requester.companyId, ...statusFilter },
    select: {
      id: true,
      name: true,
      status: true,
      type: true,
      address: true,
      description: true,
      documents: true,
      activeEquipmentStatus: true,
    },
    orderBy: { name: "asc" },
    take: 120,
  });

  const ids = sites.map((s) => s.id);
  const [todoGroups, doneGroups] = await Promise.all([
    prisma.treeItem.groupBy({
      by: ["baustelleId"],
      where: { baustelleId: { in: ids }, status: "todo" },
      _count: true,
    }),
    prisma.treeItem.groupBy({
      by: ["baustelleId"],
      where: { baustelleId: { in: ids }, status: "done" },
      _count: true,
    }),
  ]);
  const todoMap = new Map(todoGroups.map((g) => [g.baustelleId, g._count]));
  const doneMap = new Map(doneGroups.map((g) => [g.baustelleId, g._count]));

  const rows = sites.map((s) => ({
    name: s.name,
    status: s.status,
    type: s.type,
    address: s.address,
    descriptionSnippet: s.description ? s.description.slice(0, 280) : null,
    documentCount: s.documents?.length ?? 0,
    documentNames: (s.documents ?? []).slice(0, 8),
    treesTodo: todoMap.get(s.id) ?? 0,
    treesDone: doneMap.get(s.id) ?? 0,
    hasEquipmentJson: s.activeEquipmentStatus != null,
  }));

  return {
    ok: true as const,
    count: rows.length,
    baustellen: rows,
    message: text.sitesOverview,
  };
}

export async function adminListProjects(requester: RequesterContext, input: { limit?: number; status?: string }) {
  const text = adminToolText(requester);
  const deny = mustAdmin(requester);
  if (deny) return { ok: false as const, message: deny };

  const take = Math.min(60, Math.max(5, Math.floor(Number(input.limit ?? 25) || 25)));
  const status = input.status?.trim();

  const rows = await prisma.project.findMany({
    where: {
      companyProfileId: requester.companyId,
      ...(status && PROJECT_STATUS_SET.has(status) ? { status: status as keyof typeof ProjectStatus & string } : {}),
    },
    select: {
      id: true,
      title: true,
      customerName: true,
      status: true,
      date: true,
      internalNotes: true,
    },
    orderBy: { updatedAt: "desc" },
    take,
  });

  return {
    ok: true as const,
    projects: rows.map((p) => ({
      title: p.title,
      customer: p.customerName,
      status: p.status,
      date: dateKey(p.date),
      internalNotes: p.internalNotes ? p.internalNotes.slice(0, 500) : null,
    })),
    message: text.projects(rows.length),
  };
}

export async function adminListOpenManualTasks(requester: RequesterContext, input: { limit?: number }) {
  const text = adminToolText(requester);
  const deny = mustAdmin(requester);
  if (deny) return { ok: false as const, message: deny };

  const take = Math.min(80, Math.max(10, Math.floor(Number(input.limit ?? 40) || 40)));

  const tasks = await prisma.manualTask.findMany({
    where: {
      baustelle: { companyProfileId: requester.companyId },
    },
    select: {
      id: true,
      description: true,
      createdAt: true,
      baustelle: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return {
    ok: true as const,
    tasks: tasks.map((t) => ({
      baustelle: t.baustelle.name,
      description: t.description.slice(0, 400),
      createdAt: t.createdAt.toISOString(),
    })),
    message: tasks.length ? text.openTasks(tasks.length) : text.noOpenTasks,
  };
}
