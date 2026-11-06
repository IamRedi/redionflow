"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BookOpenCheck, Camera, ChevronDown, MapPin, Package, ShieldCheck, UsersRound } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { workshopCopy } from "@/lib/workshop/copy";
import { siteInventory } from "@/lib/workshop/inventory-flow";
import { treeIdentity } from "@/lib/workshop/identity-art";
const BaustelleMap = dynamic(() => import("@/app/(workzone)/workzone/baustellen/[baustelleId]/baustelle-map").then(m=>m.BaustelleMap), { ssr: false });
import { useWorkshopDemo } from "./use-workshop-demo";
import { MusterTreeGrid, type TreeCardItem } from "./muster-tree-grid";
import { DemoPhoto } from "./demo-photo";
import { BaumdienstSiteArt } from "./workshop-art";
import { InventoryScope } from "./inventory-scope";

const companyLabel="BaumdienstFlow · Musterfirma", briefingLabel="KiDraht ↗";
type Point = { id: string; treeId: string; status: string; lat: number; lng: number };
export function MusterSite({ id, siteKey, name, address, description, trees, points, crew, safety, tasks, briefing, now }: { id: string; siteKey: string; name: string; address: string | null; description: string | null; trees: TreeCardItem[]; points: Point[]; crew: { id: string; name: string }[]; safety: { label: string; quantity: number }[]; tasks: string[]; briefing?: string; now: string }) {
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang), { state } = useWorkshopDemo();
  const [mapOpen, setMapOpen] = useState(false);
  const assets = siteInventory(state, siteKey);
  const mapPoints = points.map(p => ({ ...p, status: state.custody.trees[treeIdentity(siteKey, p.treeId)]?.status || p.status }));
  return <div className="space-y-6">
    <header className="space-y-3"><Link href="/demo/workzone" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline">← {c.back}</Link><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-widest text-primary">{companyLabel}</p><h1 className="mt-2 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>{address && <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" />{address}</p>}</div><span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">{c.shared}</span></div>{description && <details className="max-w-3xl"><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted-foreground"><BookOpenCheck className="size-4" />{c.instructions}<ChevronDown className="size-3" /></summary><p className="pb-3 text-sm leading-relaxed text-muted-foreground">{description}</p></details>}</header>
    <MusterTreeGrid siteKey={siteKey} items={trees} />
    <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
      <details className="group rounded-2xl border bg-card px-4"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium"><span className="flex items-center gap-2"><Package className="size-4 text-primary" />{c.siteInventory}<span className="text-muted-foreground">{assets.length}</span></span><ChevronDown className="size-4 group-open:rotate-180" /></summary><div className="pb-4"><InventoryScope scope="site" identity={siteKey} now={now} /></div></details>
      <details className="group rounded-2xl border bg-card px-4"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium"><span className="flex items-center gap-2"><UsersRound className="size-4 text-primary" />{c.team}<span className="text-muted-foreground">{crew.length}</span></span><ChevronDown className="size-4 group-open:rotate-180" /></summary><div className="space-y-2 pb-4">{crew.map(w => <Link key={w.id} className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm focus-visible:outline focus-visible:outline-2" href={`/demo/workers/${w.id}`}><UsersRound className="size-4 text-primary" />{w.name}</Link>)}{!crew.length && <p className="text-sm text-muted-foreground">{c.empty}</p>}</div></details>
      <details className="group rounded-2xl border bg-card px-4"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium"><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />{c.safety}</span><ChevronDown className="size-4 group-open:rotate-180" /></summary><div className="space-y-2 pb-4">{safety.map(s => <p key={s.label} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 text-sm"><span>{s.label}</span><strong>{s.quantity}</strong></p>)}</div></details>
      <details className="group rounded-2xl border bg-card px-4"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium"><span className="flex items-center gap-2"><Camera className="size-4 text-primary" />{c.photos}</span><ChevronDown className="size-4 group-open:rotate-180" /></summary><DemoPhoto kind="site" target={id} photoKey={siteKey} alt={name} className="mb-4 h-40 overflow-hidden rounded-xl border"><BaumdienstSiteArt className="h-full w-full" /></DemoPhoto></details>
      <details onToggle={e => setMapOpen(e.currentTarget.open)} className="group rounded-2xl border bg-card px-4 md:col-span-2"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium"><span className="flex items-center gap-2"><MapPin className="size-4 text-primary" />{c.map}</span><ChevronDown className="size-4 group-open:rotate-180" /></summary><div className="mb-4 min-w-0 overflow-hidden rounded-xl">{mapOpen && <BaustelleMap points={mapPoints} userId="demo-viewer" />}</div></details>
      <details className="group rounded-2xl border bg-card px-4"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium"><span className="flex items-center gap-2"><BookOpenCheck className="size-4 text-primary" />{c.instructions}</span><ChevronDown className="size-4 group-open:rotate-180" /></summary><div className="space-y-3 pb-4">{briefing && <a href={briefing} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium text-primary">{briefingLabel}</a>}{tasks.map((t,i) => <p className="break-words text-sm text-muted-foreground" key={i}>{t}</p>)}</div></details>
    </div>
  </div>;
}
