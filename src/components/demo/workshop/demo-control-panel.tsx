"use client";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ClipboardList, FileText, History, Home, MapPin, Monitor, Package, Settings2, TreePine, Truck, Users, Wrench } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { navigationCopy } from "@/lib/workshop/navigation-copy";
import { workshopCopy } from "@/lib/workshop/copy";
import { woodCopy } from "@/lib/workshop/wood-copy";
import { workshopDay } from "@/lib/workshop/demo-model";
import { DemoPhoto } from "./demo-photo";
import { AppBrand } from "@/components/branding/AppBrand";
import { DEMO_BRAND_TARGET } from "@/lib/workshop/media";
import { mediaCopy } from "@/lib/workshop/media-copy";
import { useWorkshopDemo } from "./use-workshop-demo";

const productLabel = "BaumdienstFlow · Musterfirma";

/** Navigation to existing records/actions, never another inventory or administration store. */
export function DemoControlPanel() {
  const { currentLang } = useLanguage(), n = navigationCopy(currentLang), c = workshopCopy(currentLang), w = woodCopy(currentLang),m=mediaCopy(currentLang);
  const { directory, actor } = useWorkshopDemo();
  const today = workshopDay(new Date().toISOString());
  const groups = [
    { title:n.operations, items:[{href:"/demo/workzone",label:"Workzone",icon:Home},{href:"/demo/plan",label:n.plan,icon:ClipboardList},{href:`/demo/plan?date=${today}&view=calendar`,label:n.calendar,icon:CalendarDays},{href:"/demo/wood",label:w.title,icon:TreePine},{href:"/demo/workshop",label:c.title,icon:Wrench},{href:"/demo/tv?view=dashboard",label:n.tv,icon:Monitor}] },
    { title:n.resources, items:[{href:"/demo/workshop?tab=fleet",label:c.fleet,icon:Truck},{href:"/demo/workshop?tab=tools",label:c.tools,icon:Package},{href:"/demo/workshop?tab=parts",label:c.parts,icon:Wrench}] },
    { title:n.records, items:[{href:"/demo/workshop?tab=documents",label:c.documents,icon:FileText},{href:"/demo/workshop?tab=history",label:c.history,icon:History}] },
  ];
  return <div className="min-w-0 space-y-6" data-testid="demo-control-panel">
    <header><p className="text-xs font-semibold uppercase tracking-wider text-primary">{productLabel}</p><h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold"><Settings2 className="size-6 text-primary" />{n.panel}</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{n.panelHint}</p></header>
    {actor.role==="admin"&&<section className="flex items-center gap-4 rounded-2xl border bg-card p-4"><DemoPhoto kind="asset" target={DEMO_BRAND_TARGET} alt={m.logo} className="size-24 shrink-0 overflow-hidden rounded-2xl"><AppBrand mode="baumdienst" logoAlt={m.logo}/></DemoPhoto><div><h2 className="font-semibold">{m.logo}</h2><p className="mt-1 text-sm text-muted-foreground">{m.logoHint}</p></div></section>}
    {groups.map(group=><section key={group.title}><h2 className="mb-3 text-sm font-semibold">{group.title}</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{group.items.map(({href,label,icon:Icon})=><Link key={href} href={href} {...(href.startsWith("/demo/tv")?{target:"_blank",rel:"noopener noreferrer"}:{})} className="group flex min-h-16 min-w-0 items-center gap-3 rounded-2xl border bg-card p-4 text-sm font-medium shadow-sm transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon className="size-5 shrink-0 text-primary" /><span className="min-w-0 flex-1 break-words">{label}</span><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}</div></section>)}
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <section className="min-w-0 rounded-2xl border bg-card p-4"><h2 className="flex items-center gap-2 font-semibold"><Users className="size-5 text-primary" />{n.team}</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{directory.workers.map(worker=><Link key={worker.key} href={`/demo/workers/${worker.id}`} className="flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"><span className={`size-2 shrink-0 rounded-full ${worker.available ? "bg-primary" : "bg-muted-foreground"}`} /><span className="break-words">{worker.name}</span></Link>)}</div></section>
      <section className="min-w-0 rounded-2xl border bg-card p-4"><h2 className="flex items-center gap-2 font-semibold"><MapPin className="size-5 text-primary" />{n.sites}</h2><div className="mt-3 grid gap-2">{directory.sites.map(site=><Link key={site.key} href={`/demo/baustellen/${site.id}`} className="flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"><span className="break-words">{site.name}</span><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}</div></section>
    </div>
    {actor.role === "admin" && <details className="rounded-2xl border bg-card px-4"><summary className="flex min-h-12 cursor-pointer items-center gap-2 text-sm font-semibold"><Settings2 className="size-4 text-primary" />{n.settings}</summary><div className="pb-4"><Link href="/demo/workshop?tab=tools#custody-policy" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary">{c.policy}<ArrowUpRight className="size-4" /></Link></div></details>}
    <p className="text-xs leading-relaxed text-muted-foreground">{n.roleHint}</p>
  </div>;
}
