import { notFound } from "next/navigation";
import { requireWorkshopDemo, SharedWorkshopError } from "@/lib/workshop/shared-store";
import { WorkshopDemo } from "@/components/demo/workshop/workshop-demo";
import { workshopTabs, type WorkshopTab } from "@/lib/workshop/demo-model";
import { createWorkshopDemo } from "@/lib/workshop/demo-data";

export const metadata = { title: "Werkstatt Demo · BaumdienstFlow", robots: { index: false, follow: false } };

export default async function DemoWorkshopPage({ searchParams }: { searchParams: Promise<{ tab?: string; asset?: string }> }) {
  try { await requireWorkshopDemo(); } catch (error) { if (error instanceof SharedWorkshopError && error.status === 404) notFound(); throw error; }
  const params = await searchParams;
  const tab = workshopTabs.includes(params.tab as WorkshopTab) ? params.tab as WorkshopTab : "orders";
  const asset = createWorkshopDemo().assets.some(a => a.id === params.asset) ? params.asset : undefined;
  return <WorkshopDemo key={`${tab}:${asset ?? ''}`} tab={tab} initialAsset={asset} now={new Date().toISOString()} />;
}
