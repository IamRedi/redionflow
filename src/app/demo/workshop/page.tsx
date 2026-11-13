import { notFound } from "next/navigation";
import { requireWorkshopDemo, SharedWorkshopError, ensureWorkshopDemo } from "@/lib/workshop/shared-store";
import { WorkshopDemo } from "@/components/demo/workshop/workshop-demo";
import { workshopSchema, workshopTabs, type WorkshopTab } from "@/lib/workshop/demo-model";
import { BaumdienstDemoFooter } from "@/components/demo/workshop/demo-footer";
import { resolveRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "Werkstatt Demo · BaumdienstFlow", robots: { index: false, follow: false } };

export default async function DemoWorkshopPage({ searchParams }: { searchParams: Promise<{ tab?: string; asset?: string; site?: string; worker?: string; detail?: string }> }) {
  try { await requireWorkshopDemo(); } catch (error) { if (error instanceof SharedWorkshopError && error.status === 404) notFound(); throw error; }
  const params = await searchParams;
  const tab = workshopTabs.includes(params.tab as WorkshopTab) ? params.tab as WorkshopTab : "orders";
  const known = params.asset ? workshopSchema.parse((await ensureWorkshopDemo()).data).assets.some(a=>a.id===params.asset) : false;
  const asset = known ? params.asset : undefined;
  const site = /^site-[a-f0-9]{24}$/.test(params.site ?? "") ? params.site : undefined;
  const worker = /^worker-[a-f0-9]{24}$/.test(params.worker ?? "") ? params.worker : undefined;
  return <div data-baum-environment={tab === "tools" ? "inventory" : tab === "fleet" ? "fleet" : "repair"}><WorkshopDemo key={`${tab}:${asset ?? ''}:${site ?? ''}:${worker ?? ''}`} tab={tab} initialAsset={asset} initialSite={site} initialWorker={worker} showDetail={params.detail === "1"} now={new Date().toISOString()} footer={<BaumdienstDemoFooter lang={await resolveRequestLanguage()} />} /></div>;
}
