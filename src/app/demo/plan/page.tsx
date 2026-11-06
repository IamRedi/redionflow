import { notFound } from "next/navigation";
import { z } from "zod";
import { DemoPlanPage } from "@/components/demo/workshop/demo-plan";
import { isBaumdienstWorkshopDemoEnabled } from "@/lib/public-demo";
import { requireWorkshopDemo, SharedWorkshopError } from "@/lib/workshop/shared-store";
import { workshopDay } from "@/lib/workshop/demo-model";
export const dynamic = "force-dynamic";
export default async function DemoPlanRoute({ searchParams }: { searchParams: Promise<{ date?: string; view?: string }> }) {
  if (!isBaumdienstWorkshopDemoEnabled("baumdienst")) notFound();
  try { await requireWorkshopDemo(); } catch (error) { if (error instanceof SharedWorkshopError && error.status === 404) notFound(); throw error; }
  const params = await searchParams;
  const date = params.date ?? workshopDay(new Date().toISOString());
  if (!z.iso.date().safeParse(date).success) notFound();
  return <DemoPlanPage key={date} date={date} calendar={params.view === "calendar"} />;
}
