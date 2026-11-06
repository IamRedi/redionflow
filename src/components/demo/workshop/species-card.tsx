"use client";

import Image from "next/image";
import { useState } from "react";
import { BookOpen, ExternalLink, Search } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { atlasCopy, atlasFact, resolveAtlas } from "@/lib/workshop/atlas";
import { atlasCrop } from "@/lib/workshop/atlas-crops";
import { atlasNote } from "@/lib/workshop/atlas-notes";
import { botanicalIdentity } from "@/lib/workshop/botanical";
import { studioCopy } from "@/lib/workshop/studio-copy";
import { studioMediaUrl, type StudioMediaId } from "@/lib/workshop/studio-media";
import { workshopCopy } from "@/lib/workshop/copy";
import { action, WorkshopDialog } from "./workshop-ui";
import { StudioIcon } from "./studio-art";
import { LeafArt, TreeArt } from "./tree-art";

type Area = "overview" | "habit" | "leaf" | "bark" | "reproduction";
/** CSS zoom keeps the original plate intact; no separate requests or generated variants. */
function BotanicalPlate({ id, area, alt }: { id: StudioMediaId; area: Area; alt: string }) {
  const [failed, setFailed] = useState(false);
  const crop = atlasCrop(id,area);
  return <div style={{aspectRatio:`${crop.w}/${crop.h}`}} className={`relative isolate overflow-hidden rounded-xl border bg-[#0c2b35] ${area === "habit" ? "mx-auto max-w-lg" : ""}`} data-testid="atlas-plate" data-area={area}>
    {!failed && <Image src={studioMediaUrl(id)} alt={alt} width={1536} height={1024} unoptimized onError={() => setFailed(true)} className="absolute max-w-none" style={{width:`${1536/crop.w*100}%`,height:`${1024/crop.h*100}%`,left:`${-crop.x/crop.w*100}%`,top:`${-crop.y/crop.h*100}%`}} />}
    {failed && <div role="status" className="flex h-full items-center justify-center text-white"><LeafArt species={alt} className="h-40 w-32" /></div>}
  </div>;
}

export function SpeciesReference({ species }: { species: string }) {
  const { currentLang } = useLanguage(), a = atlasCopy(currentLang), s = studioCopy(currentLang);
  const reference = resolveAtlas(species), identity = botanicalIdentity(species);
  const [area, setArea] = useState<Area>("overview");
  if (!reference) return <div className="space-y-3" data-testid="atlas-unknown"><TreeArt species={species} className="mx-auto h-44 w-52 max-w-full" /><p className="text-sm leading-relaxed text-muted-foreground">{a.unknown}</p></div>;
  const { profile, representative } = reference;
  const leaf = profile.leaf ? atlasFact(profile.leaf, currentLang) : s[profile.kind];
  const panels = [ ["habit", "tree", atlasFact(profile.habit,currentLang)], ["leaf", "leaf", leaf], ["bark", "bark", atlasFact(profile.bark,currentLang)], ["reproduction", "flower", atlasFact(profile.reproduction,currentLang)] ] as const;
  return <div className="space-y-4" data-testid="species-reference">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm italic text-primary">{profile.latin}</p><Button variant={area === "overview" ? "default" : "outline"} className={action} aria-pressed={area === "overview"} onClick={()=>setArea("overview")}><Search className="size-4" />{a.overview}</Button></div>
    {representative && <p className="text-xs leading-relaxed text-muted-foreground">{a.representative}</p>}
    <figure><BotanicalPlate id={profile.id} area={area} alt={`${species} · ${profile.latin} · ${a[area === "overview" ? "title" : area]}`} /><figcaption className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{a.illustration}</figcaption></figure>
    <div role="group" aria-label={a.title} className="grid grid-cols-2 gap-2 sm:grid-cols-4">{panels.map(([key,icon,text])=><button key={key} type="button" aria-pressed={area === key} onClick={()=>setArea(key)} className={`flex min-h-20 min-w-0 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${area === key ? "border-primary/50 bg-primary/10" : "bg-muted/10 hover:bg-muted/30"}`}><span className="flex items-center gap-2 text-xs font-semibold"><StudioIcon kind={icon} className="size-5 shrink-0 text-primary" />{a[key]}</span><span className="text-xs leading-relaxed text-muted-foreground">{text}</span></button>)}</div>
    <details className="group rounded-xl border px-4"><summary className="flex min-h-12 cursor-pointer items-center gap-2 text-sm font-semibold"><BookOpen className="size-4 shrink-0 text-primary" />{a.more}</summary><div className="space-y-4 pb-4 text-sm leading-relaxed"><h3 className="font-semibold">{a.attention}</h3><p>{atlasNote(profile.id,currentLang)}</p><p className="text-muted-foreground">{a.compare}</p>{identity.hedge && <div className="flex items-center gap-3"><TreeArt species={species} className="h-28 w-32 shrink-0" /><p className="text-muted-foreground">{a.hedge}</p></div>}<p className="text-muted-foreground">{a.report}</p><a href={profile.source} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{a.sources}<ExternalLink className="size-4" /></a></div></details>
  </div>;
}

export function SpeciesCard({ species, open, onClose }: { species: string; open: boolean; onClose: () => void }) {
  const { currentLang }=useLanguage(), a=atlasCopy(currentLang), c=workshopCopy(currentLang);
  return <WorkshopDialog open={open} onClose={onClose} closeLabel={c.close} wide title={species || a.title} description={a.title}>{open && <SpeciesReference key={species} species={species} />}</WorkshopDialog>;
}
