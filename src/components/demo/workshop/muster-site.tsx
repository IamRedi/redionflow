"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, Camera, CheckCircle2, FolderOpen, MapPin, Package, ShieldCheck, Signpost, Layers, Fence, UsersRound, Workflow } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { workshopCopy } from "@/lib/workshop/copy";
import { officeCopy } from "@/lib/workshop/offices/copy";
import { woodCopy } from "@/lib/workshop/wood-copy";
import { siteInventory } from "@/lib/workshop/inventory-flow";
import { treeIdentity } from "@/lib/workshop/identity-art";
import type { MusterSiteData } from "@/lib/workshop/site-detail";
import { siteCardCopy, type SitePanel } from "@/lib/workshop/site-card-copy";
import { useWorkshopDemo } from "./use-workshop-demo";
import { MusterTreeGrid } from "./muster-tree-grid";
import { TreeArt } from "./tree-art";
import { DemoPhoto } from "./demo-photo";
import { BaumdienstSiteArt } from "./workshop-art";
import { InventoryScope } from "./inventory-scope";
import { WoodSiteSection } from "./wood-overview";
import { OfficeSiteArchive } from "../offices/site-archive";

const briefingLabel = "KiDraht";

export function MusterSite({ id, siteKey, name, description, trees, points, crew, safety, tasks, briefing, now, panel, onOpenPanel }: MusterSiteData & { panel: SitePanel; onOpenPanel: (panel: SitePanel) => void }) {
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang), copy = siteCardCopy(currentLang), office = officeCopy(currentLang), wood = woodCopy(currentLang), { state } = useWorkshopDemo();
  const assets = siteInventory(state, siteKey);
  const done = trees.filter(tree => (state.custody.trees[treeIdentity(siteKey, tree.treeId)]?.status || tree.status) === "done").length;
  if (panel === "trees" || panel === "map") return <MusterTreeGrid siteKey={siteKey} items={trees} points={points} initialView={panel === "map" ? "map" : "list"} />;
  if (panel === "inventory") return <InventoryScope scope="site" identity={siteKey} now={now} />;
  if (panel === "work") return <WoodSiteSection siteKey={siteKey} />;
  if (panel === "documents") return <OfficeSiteArchive siteId={id} expanded />;
  if (panel === "team") return <div className="baum-site-people">{crew.map(worker => <Link key={worker.id} href={`/demo/workers/${worker.id}`} className="baum-site-person"><span className="baum-site-person-avatar" aria-hidden="true">{worker.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</span><strong>{worker.name}</strong><ArrowUpRight className="size-4" /></Link>)}{!crew.length && <p className="baum-site-empty">{c.empty}</p>}</div>;
  if (panel === "safety") return <div className="baum-site-safety">{safety.map((row, index) => { const Icon = [Signpost, Layers, Fence][index] || ShieldCheck; return <article key={row.label} className="baum-site-safety-card"><Icon className="size-7" aria-hidden="true" /><strong>{row.quantity}</strong><span>{row.label}</span></article>; })}</div>;
  if (panel === "photos") return <DemoPhoto kind="site" target={id} photoKey={siteKey} alt={name} className="baum-site-gallery"><BaumdienstSiteArt className="h-full w-full" /></DemoPhoto>;
  if (panel === "instructions") return <div className="baum-site-notes">{description && <p>{description}</p>}{briefing && <a href={briefing} target="_blank" rel="noopener noreferrer" className="baum-site-person"><BookOpenCheck className="size-5" /><strong>{briefingLabel}</strong><ArrowUpRight className="size-4" /></a>}{tasks.map((task, index) => <p key={index} className="baum-site-note">{task}</p>)}{!description && !tasks.length && !briefing && <p className="baum-site-empty">{c.empty}</p>}</div>;
  const entries: { panel: SitePanel; title: string; hint: string; icon: ReactNode; count?: number }[] = [
    { panel: "inventory", title: c.siteInventory, hint: copy.inventoryHint, icon: <Package />, count: assets.length },
    { panel: "team", title: c.team, hint: copy.teamHint, icon: <UsersRound />, count: crew.length },
    { panel: "safety", title: c.safety, hint: copy.safetyHint, icon: <ShieldCheck /> },
    { panel: "photos", title: c.photos, hint: copy.photosHint, icon: <Camera /> },
    { panel: "map", title: c.map, hint: copy.mapHint, icon: <MapPin /> },
    { panel: "work", title: wood.siteWork, hint: copy.workHint, icon: <Workflow /> },
    { panel: "documents", title: office.archive, hint: copy.documentsHint, icon: <FolderOpen /> },
    { panel: "instructions", title: c.instructions, hint: copy.instructionsHint, icon: <BookOpenCheck /> },
  ];
  return <div className="baum-site-overview" data-testid="muster-site-overview">
    <div className="baum-site-introduction">{description && <p>{description}</p>}<span>{c.shared}</span></div>
    <button type="button" className="baum-site-tree-entry" aria-label={c.trees} data-site-entry="trees" onClick={() => onOpenPanel("trees")}>
      <span className="baum-site-tree-copy"><span className="baum-site-kicker">{copy.treesHint}</span><strong>{c.trees}<ArrowUpRight className="size-5" /></strong><span className="baum-site-tree-count"><CheckCircle2 className="size-4" />{done} / {trees.length} {copy.progress}</span><progress aria-label={`${c.trees} · ${c.status}`} max={Math.max(1, trees.length)} value={done} /></span>
      <span className="baum-site-tree-art" aria-hidden="true"><TreeArt species={trees[0]?.species || "Linde"} className="baum-site-tree-illustration" /><TreeArt species={trees[1]?.species || "Ahorn"} className="baum-site-tree-illustration" /></span>
    </button>
    <div className="baum-site-entries">{entries.map(entry => <button key={entry.panel} type="button" className="baum-site-entry" aria-label={entry.title} data-site-entry={entry.panel} onClick={() => onOpenPanel(entry.panel)}><span className="baum-site-entry-symbol" aria-hidden="true">{entry.icon}</span><span className="baum-site-entry-label"><strong>{entry.title}</strong><small>{entry.hint}</small></span>{entry.count !== undefined && <span className="baum-site-entry-count">{entry.count}</span>}</button>)}</div>
  </div>;
}
