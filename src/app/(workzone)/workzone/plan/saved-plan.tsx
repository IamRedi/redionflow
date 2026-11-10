import { HardHat, MapPin, StickyNote, Truck } from "lucide-react";

import type { PlanCopy } from "./plan-copy";
import { Initials, shortName } from "./initials";

export type SavedPlanRow = { id: string; workerNames: string; machineNames: string; baustelleName: string; note: string | null };

const names = (value: string) => value.split(",").map((name) => name.trim()).filter(Boolean);

/** The saved plan of a day: one card per site. `me` highlights the viewer's site. */
export function SavedPlanList({ rows, c, title, hint, me }: { rows: SavedPlanRow[]; c: PlanCopy; title?: string; hint?: string; me?: string }) {
  const shown = rows.filter((row) => row.workerNames.trim() || row.machineNames.trim() || row.note?.trim());
  const mine = me ? shown.find((row) => names(row.workerNames).includes(me)) : undefined;
  return (
    <section className="space-y-3" data-testid="saved-plan">
      {title ? (
        <div className="flex flex-wrap items-baseline gap-x-2 px-1">
          <h2 className="text-base font-semibold">{title}</h2>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      ) : null}
      {me && shown.length ? (
        <p className={`rounded-2xl border px-4 py-3 text-sm ${mine ? "border-orange-500/50 bg-orange-500/10" : "bg-card"}`} data-testid="plan-me">
          {mine ? <>{c.youAre} <strong>{mine.baustelleName}</strong></> : c.notIn}
        </p>
      ) : null}
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">{c.noPlan}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {shown.map((row) => (
            <li key={row.id} className={`relative min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm ${row === mine ? "ring-2 ring-orange-500" : ""}`}>
              <span className="absolute inset-y-0 left-0 w-1 bg-orange-500" aria-hidden />
              <div className="flex items-center gap-2.5 py-3 pl-4 pr-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-700 dark:text-orange-300"><MapPin className="size-5" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-base font-semibold leading-tight">{row.baustelleName}</h3>
                  <p className="mt-0.5 flex items-center gap-3 text-xs tabular-nums text-muted-foreground"><span className="inline-flex items-center gap-1"><HardHat className="size-3.5" aria-label={c.workers} />{names(row.workerNames).length}</span><span className="inline-flex items-center gap-1"><Truck className="size-3.5" aria-label={c.machines} />{names(row.machineNames).length}</span></p>
                </div>
              </div>
              {row.note?.trim() ? (
                <p className="mx-3 mb-2 ml-4 flex gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs"><StickyNote className="mt-px size-3.5 shrink-0" aria-label={c.note} /><span className="min-w-0 break-words">{row.note}</span></p>
              ) : null}
              {names(row.workerNames).length + names(row.machineNames).length ? (
                <ul className="grid grid-cols-2 gap-1.5 px-3 pb-3 pl-4">
                  {names(row.workerNames).map((name) => (
                    <li key={`w:${name}`} className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl border py-1 pl-1 pr-2 text-sm ${name === me ? "border-orange-500 bg-orange-500/10 font-semibold" : "bg-background"}`}>
                      <Initials name={name} /><span className="min-w-0 truncate" title={name}>{shortName(name)}</span>
                    </li>
                  ))}
                  {names(row.machineNames).map((name) => (
                    <li key={`m:${name}`} className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border bg-background py-1 pl-1 pr-2 text-sm">
                      <Initials name={name} machine /><span className="min-w-0 truncate">{name}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
