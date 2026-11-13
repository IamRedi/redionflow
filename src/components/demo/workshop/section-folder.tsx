"use client";

import * as Select from "@radix-ui/react-select";
import { Boxes, Check, ChevronDown, FileText, FolderOpen, History, Package, Truck, Wrench } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { workshopCopy } from "@/lib/workshop/copy";
import { sectionCopy } from "@/lib/workshop/section-copy";
import type { WorkshopTab } from "@/lib/workshop/demo-model";
import type { WorkshopSection } from "@/lib/workshop/section-navigation";
import styles from "./workshop.module.css";

export function SectionFolder({ section, tab, lang }: { section: WorkshopSection; tab: WorkshopTab; lang: string }) {
  const c = workshopCopy(lang), s = sectionCopy(lang), router = useRouter(), params = useSearchParams();
  const sectionName = section === "orders" ? c.title : c[section];
  function open(view: string) {
    const q = new URLSearchParams(params.toString()); q.set("tab", view); q.delete("detail");
    if (view === section) q.delete("section"); else q.set("section", section);
    router.push(`/demo/workshop?${q}`, { scroll: false });
  }
  const entries = [
    { value: section, label: section === "orders" ? c.orders : c[section], icon: section === "orders" ? Wrench : section === "fleet" ? Truck : Package },
    { value: "documents", label: c.documents, icon: FileText },
    { value: "history", label: s.reports, icon: History },
    { value: "parts", label: c.parts, icon: Boxes },
  ];
  return <Select.Root value={tab} onValueChange={open}>
    <Select.Trigger data-ui-control="button" data-ui-variant="outline" data-testid="section-folder" aria-label={`${sectionName} · ${s.folder}`} title={`${sectionName} · ${s.folder}`} className={`${styles.filterTrigger} ${styles.sectionTrigger}`}><FolderOpen className="size-4 shrink-0" /><span data-section-label>{s.folder}</span><Select.Icon><ChevronDown className="size-4" /></Select.Icon></Select.Trigger>
    <Select.Portal><Select.Content position="popper" sideOffset={6} collisionPadding={12} className={styles.filterMenu} data-baum-menu><Select.Viewport>{entries.map(({ value, label, icon: Icon }) => <Select.Item key={value} value={value} className={styles.filterOption}><Icon className="size-4 shrink-0" /><Select.ItemText>{label}</Select.ItemText><Select.ItemIndicator><Check className="size-4" /></Select.ItemIndicator></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal>
  </Select.Root>;
}
