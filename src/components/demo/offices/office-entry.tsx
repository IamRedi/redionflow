"use client";
import { Building2 } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { officeCopy } from "@/lib/workshop/offices/copy";
import { useWorkshopDemo } from "../workshop/use-workshop-demo";
import { DemoNavigationLink } from "../workshop/demo-navigation-link";
export function DemoOfficeEntry({ className }: { className: string }) {
  const { currentLang } = useLanguage(), demo = useWorkshopDemo();
  return demo.status === "ready" && demo.actor.role === "admin" ? <DemoNavigationLink href="/demo/offices" label={officeCopy(currentLang).title} className={className}><Building2 className="size-4" /></DemoNavigationLink> : null;
}
