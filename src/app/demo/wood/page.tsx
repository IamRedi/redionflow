import { notFound } from "next/navigation";
import { requireWorkshopDemo } from "@/lib/workshop/shared-store";
import { WoodWorkspace } from "@/components/demo/workshop/wood-workspace";
import { BaumdienstDemoFooter } from "@/components/demo/workshop/demo-footer";
import { resolveRequestLanguage } from "@/lib/i18n/server";
export default async function WoodPage(){try{await requireWorkshopDemo();}catch{notFound();}return <div data-baum-environment="wood"><WoodWorkspace footer={<BaumdienstDemoFooter lang={await resolveRequestLanguage()} />}/></div>;}
