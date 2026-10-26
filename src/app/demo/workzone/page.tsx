import { prisma } from "@/lib/db/prisma";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { equipmentQuantity, readLatLng } from "@/lib/workzone/site-json";
import { WorkzoneMissionControl } from "@/app/(workzone)/workzone/workzone-mission-control";
import { DemoReadonlyBadge } from "@/components/demo/demo-readonly-badge";

function materialIndicators(
  input: { signQty: number; plateQty: number; fenceQty: number; coneQty: number },
  currentLang: string,
) {
  return [
    input.signQty > 0 ? { key: "sign", label: t("workzone.haltingBan", currentLang), icon: "⊗", qty: input.signQty } : null,
    input.plateQty > 0 ? { key: "plate", label: t("workzone.coverPlates", currentLang), icon: "▤", qty: input.plateQty } : null,
    input.fenceQty > 0 ? { key: "fence", label: t("workzone.barriers", currentLang), icon: "▦", qty: input.fenceQty } : null,
    input.coneQty > 0 ? { key: "cones", label: t("workzone.cones", currentLang), icon: "▲", qty: input.coneQty } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; icon: string; qty: number }>;
}

export default async function DemoWorkzonePage() {
  const company = await getOrCreateDefaultCompany();
  const currentLang = await resolveRequestLanguage();
  const [baustellen, coneMoves] = await Promise.all([
    prisma.baustelle.findMany({
      where: { companyProfileId: company.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        address: true,
        description: true,
        status: true,
        activeEquipmentStatus: true,
        coordinates: true,
        canvasX: true,
        canvasY: true,
        canvasMobileX: true,
        canvasMobileY: true,
        treeItems: { select: { id: true, status: true, notes: true, siteEquipmentStatus: true } },
        manualTasks: {
          where: { isFlagged: true },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { id: true, description: true },
        },
        workSessions: {
          where: { isLive: true, endTime: null },
          select: { startTime: true, worker: { select: { firstName: true, lastName: true } } },
        },
      },
      take: 50,
    }),
    prisma.machineConeMovement.findMany({
      where: { companyProfileId: company.id, baustelleId: { not: null } },
      select: { type: true, quantity: true, baustelleId: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const coneQtyByBaustelle = new Map<string, number>();
  for (const movement of coneMoves) {
    if (!movement.baustelleId) continue;
    const qty = Math.max(0, Number(movement.quantity ?? 0) || 0);
    const current = coneQtyByBaustelle.get(movement.baustelleId) ?? 0;
    if (movement.type === "DEPLOY") coneQtyByBaustelle.set(movement.baustelleId, current + qty);
    if (movement.type === "COLLECT") coneQtyByBaustelle.set(movement.baustelleId, Math.max(0, current - qty));
  }

  const defaultAddress = [company.street, [company.zip, company.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const missionItems = baustellen.map((b) => {
    const total = b.treeItems.length;
    const done = b.treeItems.filter((tree) => tree.status === "done").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const haltCount = b.treeItems.filter((item) => {
      if (!item.notes) return false;
      try {
        const parsed = JSON.parse(item.notes) as { haltverbot?: unknown };
        return Boolean(parsed?.haltverbot);
      } catch {
        return false;
      }
    }).length;
    const workers = b.workSessions.map((session) => `${session.worker.firstName} ${session.worker.lastName}`.trim()).filter(Boolean);
    const liveSince =
      b.workSessions.reduce<Date | null>((latest, session) => {
        if (!latest || session.startTime > latest) return session.startTime;
        return latest;
      }, null)?.toISOString() ?? null;
    const signQty =
      equipmentQuantity(b.activeEquipmentStatus, "SIGN") +
      b.treeItems.reduce((sum, item) => sum + equipmentQuantity(item.siteEquipmentStatus, "SIGN"), 0);
    const plateQty =
      equipmentQuantity(b.activeEquipmentStatus, "PLATE") +
      b.treeItems.reduce((sum, item) => sum + equipmentQuantity(item.siteEquipmentStatus, "PLATE"), 0);
    const fenceQty =
      equipmentQuantity(b.activeEquipmentStatus, "FENCE") +
      b.treeItems.reduce((sum, item) => sum + equipmentQuantity(item.siteEquipmentStatus, "FENCE"), 0);
    const coneQty = coneQtyByBaustelle.get(b.id) ?? 0;
    const equipmentIndicators = materialIndicators({ signQty, plateQty, fenceQty, coneQty }, currentLang);
    const pendingCollection = equipmentIndicators.length > 0;
    const pendingSiteTask = b.manualTasks[0]?.description ?? null;
    const coordinates = readLatLng(b.coordinates);
    return {
      id: b.id,
      name: b.name,
      status: b.status,
      type: b.type,
      pct,
      done,
      total,
      workers,
      haltCount,
      activeLiveCount: workers.length,
      coordinates,
      canvasX: b.canvasX,
      canvasY: b.canvasY,
      canvasMobileX: b.canvasMobileX,
      canvasMobileY: b.canvasMobileY,
      liveSince,
      standortAddress: (b.address ?? "").trim(),
      pendingCollection,
      pendingSiteTask,
      equipmentIndicators,
    };
  });
  const liveMission = missionItems.filter((item) => item.pct < 100 || item.pendingCollection || item.pendingSiteTask);
  const archivedMission = missionItems.filter((item) => item.pct >= 100 && !item.pendingCollection && !item.pendingSiteTask);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300">Public Demo</div>
          <DemoReadonlyBadge />
        </div>
        <h1 className="mt-1 text-xl font-semibold">Workzone</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only live view of sites, crews, fleet and current field status.
        </p>
      </div>
      <WorkzoneMissionControl
        items={liveMission}
        archive={archivedMission}
        defaultAddress={defaultAddress}
        detailHrefBase="/demo/baustellen"
        readOnly
        allowCanvasDrag
      />
    </div>
  );
}
