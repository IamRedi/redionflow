import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { kidrahtBriefingUrl, kidrahtDemoUrl } from "@/lib/kidraht-demo";
import { isRecord, readLatLng } from "@/lib/workzone/site-json";
import { demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";
import { demoSiteKey, requireWorkshopDemo } from "@/lib/workshop/shared-store";
import type { MusterSiteData } from "@/lib/workshop/site-detail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const company = await requireWorkshopDemo();
    const { siteId } = await params;
    z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/).parse(siteId);
    const lang = await resolveRequestLanguage();
    const site = await prisma.baustelle.findFirst({
      where: { id: siteId, companyProfileId: company.id },
      select: {
        id: true, name: true, address: true, description: true, activeEquipmentStatus: true,
        treeItems: { orderBy: [{ status: "asc" }, { treeId: "asc" }], select: { id: true, treeId: true, species: true, diameter: true, status: true, notes: true, siteEquipmentStatus: true, coordinates: true } },
        manualTasks: { orderBy: { createdAt: "desc" }, take: 10, select: { description: true } },
        workSessions: { where: { isLive: true, endTime: null }, orderBy: { startTime: "asc" }, select: { workerId: true, worker: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!site) return Response.json({ error: "missing" }, { status: 404, headers: demoHeaders });
    const equipment = isRecord(site.activeEquipmentStatus) ? site.activeEquipmentStatus : {};
    const kidraht = kidrahtDemoUrl("baumdienst");
    const detail: MusterSiteData = {
      id: site.id, siteKey: demoSiteKey(site), name: site.name, address: site.address, description: site.description,
      trees: site.treeItems.map(({ coordinates: _coordinates, ...tree }) => tree),
      points: site.treeItems.flatMap(tree => { const coords = readLatLng(tree.coordinates); return coords ? [{ id: tree.id, treeId: tree.treeId, status: tree.status, ...coords }] : []; }),
      crew: site.workSessions.map(session => ({ id: session.workerId, name: `${session.worker.firstName} ${session.worker.lastName}`.trim() })),
      safety: [["SIGN", "workzone.haltingBan"], ["PLATE", "workzone.coverPlates"], ["FENCE", "workzone.barriers"]].map(([category, label]) => {
        const row = isRecord(equipment[category]) ? equipment[category] : null;
        return { label: t(label, lang, "baumdienst"), quantity: Math.max(0, Number(row?.quantity ?? 0) || 0) };
      }),
      tasks: site.manualTasks.map(task => task.description), briefing: kidraht ? kidrahtBriefingUrl(kidraht) : undefined, now: new Date().toISOString(),
    };
    return Response.json(detail, { headers: demoHeaders });
  } catch (error) { return workshopResponseError(error); }
}
