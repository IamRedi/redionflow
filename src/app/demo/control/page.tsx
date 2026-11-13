import { notFound } from "next/navigation";
import { requireWorkshopDemo, SharedWorkshopError } from "@/lib/workshop/shared-store";
import { DemoControlPanel } from "@/components/demo/workshop/demo-control-panel";

export default async function DemoControlPage() {
  try { await requireWorkshopDemo(); } catch (e) { if (e instanceof SharedWorkshopError && e.status === 404) notFound(); throw e; }
  return <div data-baum-environment="control"><DemoControlPanel /></div>;
}
