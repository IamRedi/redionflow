"use client";
import styles from "./workshop.module.css";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, MapPin, Trees, UsersRound, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { workshopCopy } from "@/lib/workshop/copy";
import { useWorkshopDemo } from "./use-workshop-demo";
import { InventoryScope } from "./inventory-scope";
import { DemoPhoto } from "./demo-photo";
import { BaumdienstSiteArt } from "./workshop-art";
export type MusterMission = {id:string; key:string; name:string; address:string|null; workers:string[]; trees:{treeId:string;status:string}[]; note:string|null};
export function MusterWorkzone({sites,now}:{sites:MusterMission[];now:string}) {
  const {state}=useWorkshopDemo(),{currentLang}=useLanguage(),c=workshopCopy(currentLang);
  return <div className={`${styles.arrive} grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3`}>{sites.map(site=>{
    const rows=site.trees.map(t=>state.custody.trees[`${site.key}:${t.treeId}`]?.status || t.status), done=rows.filter(s=>s==="done").length, reports=rows.filter(s=>s==="blocked").length;
    return <article key={site.id} data-testid="muster-site-card" className="min-w-0 overflow-hidden rounded-3xl border bg-card shadow-sm"><DemoPhoto kind="site" target={site.id} photoKey={site.key} alt={site.name} className="h-32 border-b bg-muted/20"><BaumdienstSiteArt className="h-full w-full" /></DemoPhoto><div className="space-y-4 p-4 sm:p-5"><div><h2 className="break-words text-lg font-semibold tracking-tight">{site.name}</h2>{site.address&&<p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><MapPin className="size-4 shrink-0" />{site.address}</p>}</div><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2 text-primary"><CheckCircle2 className="size-4" />{done} / {rows.length} {c.trees}</span>{reports>0&&<span className="flex items-center gap-1 text-amber-700 dark:text-amber-300"><AlertTriangle className="size-4" />{reports}</span>}</div><progress aria-label={c.trees} value={done} max={Math.max(1,rows.length)} className="block h-1.5 w-full accent-green-700" /><p className="flex min-h-5 items-start gap-2 text-xs leading-relaxed text-muted-foreground"><UsersRound className="size-4 shrink-0" /><span>{site.workers.join(", ") || c.empty}</span></p><InventoryScope compact scope="site" identity={site.key} now={now} />{site.note&&<details><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground"><Trees className="size-4" />{c.instructions}</summary><p className="pb-2 text-sm text-muted-foreground">{site.note}</p></details>}<div className="flex items-center gap-2 border-t pt-3"><Link href={`/demo/baustellen/${site.id}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground dark:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><ArrowUpRight className="size-4" />{c.details}</Link>{site.address&&<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address)}`} target="_blank" rel="noopener noreferrer" aria-label={c.map} className="inline-flex size-11 items-center justify-center rounded-xl border text-primary focus-visible:outline focus-visible:outline-2"><MapPin className="size-4" /></a>}</div></div></article>;
  })}</div>;
}
