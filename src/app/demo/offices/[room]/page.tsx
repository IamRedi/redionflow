import { notFound } from "next/navigation";
import { DemoOffices } from "@/components/demo/offices/demo-offices";
import { officeRole } from "@/lib/workshop/offices/model";
import { requireWorkshopDemo, SharedWorkshopError } from "@/lib/workshop/shared-store";
export const dynamic = "force-dynamic";
export default async function OfficeRoomPage({ params }: { params: Promise<{ room: string }> }) { try { await requireWorkshopDemo(); } catch (e) { if (e instanceof SharedWorkshopError && e.status === 404) notFound(); throw e; } const room = officeRole.safeParse((await params).room); if (!room.success) notFound(); return <div data-baum-environment="control"><DemoOffices room={room.data} /></div>; }
