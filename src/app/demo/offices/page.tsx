import { DemoOffices } from "@/components/demo/offices/demo-offices";
import { notFound } from "next/navigation";
import { requireWorkshopDemo, SharedWorkshopError } from "@/lib/workshop/shared-store";
export const dynamic = "force-dynamic";
export default async function OfficesPage() { try { await requireWorkshopDemo(); } catch (e) { if (e instanceof SharedWorkshopError && e.status === 404) notFound(); throw e; } return <div data-office-scene="reception" data-baum-environment="reception"><DemoOffices /></div>; }
