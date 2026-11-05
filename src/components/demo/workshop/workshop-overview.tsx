"use client";

import Link from "next/link";
import { ArrowUpRight, Wrench, Package, Truck, CircleCheck, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { workshopCopy } from "@/lib/workshop/copy";
import { useWorkshopDemo } from "./use-workshop-demo";
import { Status } from "./workshop-ui";

export function WorkshopOverview() {
  const { currentLang } = useLanguage(); const c = workshopCopy(currentLang); const { state } = useWorkshopDemo();
  const open = state.jobs.filter(j => !j.releasedAt);
  return <section aria-labelledby="workshop-overview-title" className="overflow-hidden rounded-3xl border bg-card shadow-sm">
    <div className="relative flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
      <Wrench className="pointer-events-none absolute -right-4 -top-5 size-48 rotate-12 text-primary/[0.06]" aria-hidden="true" />
      <div className="relative"><span className="text-xs font-semibold uppercase tracking-widest text-primary">BaumdienstFlow · {c.demo}</span><h2 id="workshop-overview-title" className="mt-2 text-2xl font-bold tracking-tight">{c.title}</h2><p className="mt-1 max-w-xl text-sm text-muted-foreground">{c.workshopHint}</p></div>
      <Button asChild className="relative h-11 dark:text-black"><Link href="/demo/workshop">{c.open}<ArrowUpRight /></Link></Button>
    </div>
    <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">{([['received', c.received, Package], ['repairing', c.repairing, Wrench], ['repaired', c.pendingRelease, CircleCheck]] as const).map(([key, label, Icon]) => <Link key={key} href="/demo/workshop" className="flex min-h-20 items-center gap-3 p-5 transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><Icon className="size-5 text-primary" /><span className="flex-1 text-sm">{label}</span><strong className="text-2xl tabular-nums">{open.filter(j => j.status === key).length}</strong></Link>)}</div>
    <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3"><Status><Truck className="size-3.5" />{state.assets.filter(a => a.kind === 'fleet').length} {c.fleet}</Status><Status><Wrench className="size-3.5" />{state.assets.filter(a => a.kind === 'tool').length} {c.tools}</Status>{state.parts.some(p => p.stock < p.minimum) && <Status tone="amber"><AlertTriangle className="size-3.5" />{c.low}</Status>}<p className="basis-full text-xs text-muted-foreground">{c.demoHint}</p></div>
  </section>;
}
