import { HardHat, MapPin, StickyNote, Truck } from "lucide-react";

import type { PlanCopy } from "./plan-copy";

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
            <li key={row.id} className={`min-w-0 rounded-2xl border bg-card p-3 shadow-sm ${row === mine ? "ring-2 ring-orange-500" : ""}`}>
              <h3 className="flex items-start gap-1.5 text-base font-semibold leading-tight"><MapPin className="mt-0.5 size-4 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden /><span className="min-w-0 break-words">{row.baustelleName}</span></h3>
              {names(row.workerNames).length ? (
                <p className="mt-2 flex gap-1.5 text-sm"><HardHat className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label={c.workers} /><span className="min-w-0">{names(row.workerNames).map((name, index) => <span key={name}>{index ? ", " : ""}<span className={name === me ? "font-semibold text-orange-700 dark:text-orange-300" : ""}>{name}</span></span>)}</span></p>
              ) : null}
              {names(row.machineNames).length ? (
                <p className="mt-1.5 flex gap-1.5 text-sm"><Truck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label={c.machines} /><span className="min-w-0">{row.machineNames}</span></p>
              ) : null}
              {row.note?.trim() ? (
                <p className="mt-2 flex gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs"><StickyNote className="mt-px size-3.5 shrink-0" aria-label={c.note} /><span className="min-w-0 break-words">{row.note}</span></p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
