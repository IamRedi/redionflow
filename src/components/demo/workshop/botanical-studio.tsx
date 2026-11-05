"use client";

import { useState } from "react";
import { ArrowLeft, Fence, Leaf, Trees } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";
import { botanicalIdentity, botanicalPalette, botanicalReferences, type BotanicalSeason } from "@/lib/workshop/botanical";
import { studioCopy } from "@/lib/workshop/studio-copy";
import { workshopCopy } from "@/lib/workshop/copy";
import { action, WorkshopDialog } from "./workshop-ui";
import { LeafArt, TreeArt } from "./tree-art";

export function BotanicalReference({ species, latin }: { species: string; latin?: string }) {
  const { currentLang } = useLanguage(), s = studioCopy(currentLang);
  const [season, setSeason] = useState<BotanicalSeason>("summer");
  const identity = botanicalIdentity(species), summer=botanicalPalette(species,"summer"), autumn=botanicalPalette(species,"autumn");
  return <div className="space-y-4" data-testid="botanical-reference">
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,.7fr)] items-center gap-3 rounded-xl border bg-muted/15 p-3 sm:p-5">
      <figure className="min-w-0"><TreeArt species={species} season={season} className="mx-auto h-40 max-w-full sm:h-52" /><figcaption className="text-center text-xs text-muted-foreground">{identity.hedge ? s.hedge : s.tree}</figcaption></figure>
      <figure className="min-w-0"><LeafArt species={species} season={season} className="mx-auto h-28 w-24 max-w-full sm:h-36" /><figcaption className="mt-3 text-center"><span className="block text-xs text-muted-foreground">{s.leaf}</span><strong className="mt-1 block text-sm font-medium">{identity.known ? s[identity.kind] : s.leafUnknown}</strong></figcaption></figure>
    </div>
    {latin && <p className="text-sm italic text-muted-foreground">{latin}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={s.seasonal}>{(["summer","autumn"] as const).map(value=><Button key={value} type="button" className={action} variant={season === value ? "default" : "outline"} aria-pressed={season === value} onClick={()=>setSeason(value)}>{s[value]}</Button>)}</div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><span aria-hidden="true" className="size-3 rounded-full" style={{background:summer.leaf}} /><span aria-hidden="true" className="size-3 rounded-full" style={{background:autumn.leaf}} />{identity.copper ? s.copper : identity.evergreen ? s.evergreen : s.seasonal}</div>
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">{s.guide}</p>
  </div>;
}

/** Read-only learning references. No invented plant is added to a site inventory. */
export function BotanicalStudio({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {currentLang}=useLanguage(),s=studioCopy(currentLang),c=workshopCopy(currentLang);
  const [filter,setFilter]=useState("all"),[selected,setSelected]=useState<typeof botanicalReferences[number] | null>(null);
  return <WorkshopDialog open={open} onClose={onClose} closeLabel={c.close} title={selected?.name || s.collection} description={s.collectionHint}>
    {selected ? <div className="space-y-3"><Button type="button" variant="ghost" className={action} onClick={()=>setSelected(null)}><ArrowLeft />{s.collection}</Button><BotanicalReference key={selected.name} species={selected.name} latin={selected.latin} /></div> : <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label={s.collection}>{([ ["all",s.all,Leaf], ["trees",s.trees,Trees], ["hedges",s.hedges,Fence] ] as const).map(([value,label,Icon])=><Button key={value} type="button" variant={filter===value ? "default":"outline"} className={action} aria-pressed={filter===value} onClick={()=>setFilter(value)}><Icon />{label}</Button>)}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{botanicalReferences.filter(ref=>filter==="all" || botanicalIdentity(ref.name).hedge===(filter==="hedges")).map(ref=><button key={ref.name} type="button" className="flex min-h-44 min-w-0 flex-col items-center rounded-xl border bg-muted/10 p-3 text-center transition-colors hover:bg-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={()=>setSelected(ref)}><TreeArt species={ref.name} className="h-24 w-28 max-w-full" /><strong className="mt-2 break-words text-sm">{ref.name}</strong><span className="mt-1 break-words text-xs italic text-muted-foreground">{ref.latin}</span></button>)}</div>
    </div>}
  </WorkshopDialog>;
}
