import { Clock3, CalendarCheck2, Gauge, MapPin, Radio } from "lucide-react";

import { prisma } from "@/lib/db/prisma";
import { dateKey, formatReportTime, reportLocale, REPORT_TIME_ZONE } from "@/lib/workzone/date-utils";
import type { monthlySessionRows } from "@/lib/workzone/reporting";

type Row = ReturnType<typeof monthlySessionRows>[number];
type Worker = { firstName: string; lastName: string; position: string | null; companyProfileId: string };

const LANGS = ["sq", "en", "de", "it", "pl", "ro"] as const;
const words = {
  minutes: ['min', 'min', 'Min.', 'min', 'min', 'min'],
  title: ["Fletë orësh mujore", "Monthly timesheet", "Monatlicher Stundenzettel", "Foglio ore mensile", "Miesięczna karta czasu pracy", "Foaie de pontaj lunară"],
  total: ["Orë gjithsej", "Hours", "Stunden", "Ore", "Godziny", "Ore"],
  days: ["Ditë pune", "Work days", "Arbeitstage", "Giorni lavorati", "Dni pracy", "Zile lucrate"],
  average: ["Mesatarja / ditë", "Average / day", "Ø pro Tag", "Media / giorno", "Średnio / dzień", "Medie / zi"],
  noWork: ["—", "—", "—", "—", "—", "—"],
  live: ["Në punë", "Working", "Im Einsatz", "Al lavoro", "W pracy", "La lucru"],
  breakShort: ["pushim", "break", "Pause", "pausa", "przerwa", "pauză"],
  worker: ["Punëmarrësi", "Employee", "Mitarbeiter", "Dipendente", "Pracownik", "Angajat"],
  position: ["Pozicioni", "Position", "Position", "Mansione", "Stanowisko", "Funcție"],
  period: ["Periudha", "Period", "Zeitraum", "Periodo", "Okres", "Perioada"],
  printed: ["Printuar më", "Printed on", "Gedruckt am", "Stampato il", "Wydrukowano", "Tipărit la"],
  no: ["Nr.", "No.", "Nr.", "N.", "Nr", "Nr."],
  date: ["Data", "Date", "Datum", "Data", "Data", "Data"],
  day: ["Dita", "Day", "Tag", "Giorno", "Dzień", "Ziua"],
  start: ["Fillimi", "Start", "Beginn", "Inizio", "Początek", "Început"],
  end: ["Mbarimi", "End", "Ende", "Fine", "Koniec", "Sfârșit"],
  pause: ["Pushimi", "Break", "Pause", "Pausa", "Przerwa", "Pauză"],
  site: ["Kantieri", "Site", "Baustelle", "Cantiere", "Budowa", "Șantier"],
  hours: ["Orë", "Hours", "Std.", "Ore", "Godz.", "Ore"],
  sum: ["Totali", "Total", "Summe", "Totale", "Suma", "Total"],
  employer: ["Punëdhënësi (emri, nënshkrimi, vula)", "Employer (name, signature, stamp)", "Arbeitgeber (Name, Unterschrift, Stempel)", "Datore di lavoro (nome, firma, timbro)", "Pracodawca (imię, podpis, pieczęć)", "Angajator (nume, semnătură, ștampilă)"],
  employee: ["Punëmarrësi (emri, nënshkrimi)", "Employee (name, signature)", "Arbeitnehmer (Name, Unterschrift)", "Dipendente (nome, firma)", "Pracownik (imię, podpis)", "Angajat (nume, semnătură)"],
  vat: ["NIPT", "VAT ID", "USt-IdNr.", "P.IVA", "NIP", "CUI"],
} as const;

type Copy = { [K in keyof typeof words]: string };
function copy(lang: string): Copy {
  const index = Math.max(0, LANGS.indexOf(lang as (typeof LANGS)[number]));
  return Object.fromEntries(Object.entries(words).map(([key, values]) => [key, values[index] ?? values[1]])) as Copy;
}

/** 11.2 → "11:12" */
const hm = (hours: number) => {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
};

function monthLabel(month: string, lang: string) {
  const [year, value] = month.split("-").map(Number);
  if (!year || !value) return month;
  return new Intl.DateTimeFormat(reportLocale(lang), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, value - 1, 15)));
}

const isSunday = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay() === 0;
const shortDate = (key: string) => `${key.slice(8, 10)}.${key.slice(5, 7)}.`;

/**
 * Monthly timesheet: a clear card on screen and an official A4 sheet on paper.
 * Both read the same rows (one per calendar day of the month in the business timezone).
 */
export async function MonthlyTimesheet({ rows, worker, month, lang }: { rows: Row[]; worker: Worker; month: string; lang: string }) {
  const c = copy(lang);
  const company = await prisma.companyProfile.findUnique({
    where: { id: worker.companyProfileId },
    select: { legalName: true, displayName: true, vatId: true, logoDataUrl: true },
  });
  const worked = rows.filter((row) => row.hasWork);
  const total = worked.reduce((sum, row) => sum + row.totalHours, 0);
  const average = worked.length ? total / worked.length : 0;
  const today = dateKey(new Date());
  const name = `${worker.firstName} ${worker.lastName}`.trim();
  const label = monthLabel(month, lang);
  const first = rows[0]?.date;
  const last = rows.at(-1)?.date;
  const printedOn = new Date().toLocaleDateString(reportLocale(lang), { timeZone: REPORT_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <>
      {/* Screen */}
      <section className="space-y-3 print:hidden" data-testid="timesheet-card">
        <div data-notebook-summary className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">{c.title}</p>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{name}</h1>
            <p className="text-sm font-medium capitalize text-muted-foreground">{label}</p>
          </div>
          {worker.position ? <p className="text-sm text-muted-foreground">{worker.position}</p> : null}
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: Clock3, label: c.total, value: hm(total) },
              { icon: CalendarCheck2, label: c.days, value: String(worked.length) },
              { icon: Gauge, label: c.average, value: hm(average) },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border bg-background px-3 py-2.5">
                <dt className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground"><item.icon className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{item.label}</span></dt>
                <dd className="mt-0.5 text-xl font-bold tabular-nums" data-testid={item.label === c.total ? "timesheet-total" : undefined}>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <ol data-studio-surface className="overflow-hidden rounded-3xl border bg-card shadow-sm" data-testid="timesheet-days">
          {rows.map((row) => {
            const sunday = isSunday(row.date);
            const isToday = row.date === today;
            return (
              <li key={row.date} className={`flex items-center gap-3 border-b px-3 last:border-b-0 sm:px-4 ${row.hasWork ? "py-2.5" : "py-1.5"} ${sunday && !row.hasWork ? "bg-muted/40" : ""} ${isToday ? "bg-orange-500/[0.07]" : ""}`} data-testid="timesheet-day">
                <div className={`grid w-11 shrink-0 text-center leading-tight ${row.hasWork ? "" : "text-muted-foreground"}`}>
                  <span className={`text-base font-bold tabular-nums ${isToday ? "text-orange-700 dark:text-orange-300" : ""}`}>{row.dayOfMonth}</span>
                  <span className="text-[11px] capitalize">{row.dayName}</span>
                </div>
                {row.hasWork ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatReportTime(row.startTime, lang)} – {row.hasLive && !row.endTime ? <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400"><Radio className="size-3.5" aria-hidden />{c.live}</span> : formatReportTime(row.endTime, lang)}
                        {row.breakMinutes ? <span className="ml-2 text-xs font-normal text-muted-foreground">{row.breakMinutes} {c.minutes} {c.breakShort}</span> : null}
                      </p>
                      {row.locations !== "-" ? (
                        <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3.5 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden /><span className="truncate">{row.locations}</span></p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-xl bg-orange-500/10 px-2.5 py-1 text-sm font-bold tabular-nums text-orange-800 dark:text-orange-200">{hm(row.totalHours)}</span>
                  </>
                ) : (
                  <span className="flex-1 text-xs text-muted-foreground/70">{c.noWork}</span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Paper: official A4 sheet */}
      <section className="hidden text-[9pt] leading-snug text-black print:block" data-testid="timesheet-print">
        <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-2">
          <div className="flex items-center gap-3">
            {company?.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoDataUrl} alt="" className="h-12 w-auto object-contain" />
            ) : null}
            <div>
              <p className="text-[11pt] font-bold">{company?.legalName || company?.displayName}</p>
              {company?.vatId ? <p>{c.vat}: {company.vatId}</p> : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[13pt] font-bold uppercase tracking-wide">{c.title}</p>
            <p className="capitalize">{label}</p>
          </div>
        </header>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5">
          <div className="flex gap-1"><dt className="font-semibold">{c.worker}:</dt><dd>{name}</dd></div>
          <div className="flex gap-1"><dt className="font-semibold">{c.period}:</dt><dd>{first && last ? `${shortDate(first)}${first.slice(0, 4)} – ${shortDate(last)}${last.slice(0, 4)}` : month}</dd></div>
          <div className="flex gap-1"><dt className="font-semibold">{c.position}:</dt><dd>{worker.position || "—"}</dd></div>
          <div className="flex gap-1"><dt className="font-semibold">{c.printed}:</dt><dd>{printedOn}</dd></div>
        </dl>
        <table className="stundenzettel-table mt-2 w-full border-collapse border text-left">
          <thead>
            <tr>
              {[c.date, c.day, c.start, c.end, c.pause, c.site, c.hours].map((head, index) => (
                <th key={head} className={`border px-1 ${index === 6 ? "text-right" : ""}`}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className={isSunday(row.date) ? "print-fill" : ""}>
                <td className="border px-1 tabular-nums">{shortDate(row.date)}</td>
                <td className="border px-1 capitalize">{row.dayName}</td>
                <td className="border px-1 tabular-nums">{row.hasWork ? formatReportTime(row.startTime, lang) : ""}</td>
                <td className="border px-1 tabular-nums">{row.hasWork ? formatReportTime(row.endTime, lang) : ""}</td>
                <td className="border px-1 tabular-nums">{row.hasWork && row.breakMinutes ? `${row.breakMinutes} min` : ""}</td>
                <td className="border px-1">{row.hasWork && row.locations !== "-" ? row.locations : ""}</td>
                <td className="border px-1 text-right tabular-nums">{row.hasWork ? hm(row.totalHours) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="border px-1 font-bold" colSpan={4}>{c.sum}</td>
              <td className="border px-1 font-bold" colSpan={2}>{c.days}: {worked.length}</td>
              <td className="border px-1 text-right font-bold tabular-nums">{hm(total)}</td>
            </tr>
          </tfoot>
        </table>
        <div className="mt-10 grid grid-cols-2 gap-10">
          <p className="border-t border-black pt-1">{c.employer}</p>
          <p className="border-t border-black pt-1">{c.employee}</p>
        </div>
      </section>
    </>
  );
}
