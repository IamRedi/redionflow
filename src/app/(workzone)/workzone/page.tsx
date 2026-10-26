import { withPilotDbContext } from "@/lib/db/tenant-runtime";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HubsteigerIcon } from "@/components/icons";
import { prisma } from "@/lib/db/prisma";
import { getOrCreateDefaultCompany, getCompanyMode } from "@/lib/db/company";
import { getFeatures, productBranding } from "@/lib/mode-config";
import { autoLockPastWorkLogs } from "@/lib/workzone/auto-lock";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { PersonalFlowCanvas } from "./personal-flow-canvas";
import { dateKey, dayRange } from "@/lib/workzone/date-utils";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { WorkingBadge } from "./working-badge";
import { WorkzoneCalendarModal } from "./workzone-calendar-modal";
import { WorkzoneCreateBaustelleModal } from "./workzone-create-baustelle-modal";
import { WorkzoneMissionControl } from "./workzone-mission-control";

type EquipmentCategory = "SIGN" | "PLATE" | "FENCE";

function equipmentQuantity(value: unknown, category: EquipmentCategory) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const row = (value as Record<string, any>)[category];
  const qty = Number(row?.quantity ?? 0);
  return Number.isFinite(qty) ? Math.max(0, qty) : 0;
}

function baustelleStatusLabel(status: string, currentLang: string): string {
  if (status === "active") return t("workzone.baustelleStatusActive", currentLang);
  if (status === "completed") return t("workzone.baustelleStatusCompleted", currentLang);
  if (status === "blocked") return t("workzone.baustelleStatusBlocked", currentLang);
  if (status === "archived") return t("workzone.baustelleStatusArchived", currentLang);
  return status;
}

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

export default async function WorkzoneHomePage() {
  await autoLockPastWorkLogs();
  const company = await getOrCreateDefaultCompany();
  const [admin, worker, mode] = await Promise.all([
    getCurrentAdmin(),
    getCurrentWorker(),
    getCompanyMode(),
  ]);
  const features = getFeatures(mode);
  const currentLang = await resolveRequestLanguage();

  // T-030: PersonalFlow replaces the mission-control canvas with a simplified
  // task-list surface. The full baustellen workzone (which is what mission
  // control is for) is gated by `features.baustellen`.
  if (!features.baustellen) {
    return (
      <PersonalFlowCanvas
        productName={productBranding(mode).full}
        canEdit={Boolean(admin || worker)}
        currentLang={currentLang}
        mode={mode}
      />
    );
  }
  const today = dateKey(new Date());
  const todayDate = dayRange(today).start;
  if (Number.isNaN(todayDate.getTime())) return null;
  const canOpenCalendar = Boolean(admin || worker);
  const plan = await withPilotDbContext(company.id, tx => tx.dailyWorkPlan.findUnique({
    where: { companyProfileId_planDate: { companyProfileId: company.id, planDate: todayDate } },
    include: {
      columns: {
        include: {
          baustelle: { select: { id: true, name: true } },
          assignments: true,
        },
      },
    },
  }));
  const plansForCalendar = await withPilotDbContext(company.id, tx => tx.dailyWorkPlan.findMany({
    where: { companyProfileId: company.id },
    orderBy: { planDate: "desc" },
    include: {
      savedRows: {
        orderBy: { sortOrder: "asc" },
      },
      snapshots: {
        orderBy: [{ versionNumber: "desc" }],
        include: {
          rows: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
      columns: {
        orderBy: { sortOrder: "asc" },
        include: {
          baustelle: { select: { name: true } },
          assignments: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
    take: 90,
  }));
  const [baustellen, coneMoves] = await Promise.all([
    withPilotDbContext(company.id, tx => tx.baustelle.findMany({
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
        updatedAt: true,
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
    })),
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

  function typeMeta(type: string) {
    switch (type) {
      case "TRUCK_PLATFORM":
        return { icon: "🟦", label: t("workzone.truckPlatformShort", currentLang), watermark: "BÜHNE" };
      case "TRUCK_CRANE":
        return { icon: "🟥", label: t("workzone.truckCraneShort", currentLang), watermark: "KRAN" };
      case "WATERING":
        return { icon: "🟩", label: t("workzone.wateringShort", currentLang), watermark: "WASSER" };
      case "EXCAVATOR":
        return { icon: "🟨", label: t("workzone.excavatorShort", currentLang), watermark: "BAGGER" };
      case "SIGNAGE":
        return { icon: "🚧", label: t("workzone.signage", currentLang, "bau"), watermark: "SIGN" };
      case "DRAINAGE":
        return { icon: "▤", label: t("workzone.drainage", currentLang, "bau"), watermark: "KANAL" };
      case "WALL":
        return { icon: "▧", label: t("workzone.wall", currentLang, "bau"), watermark: "MAUER" };
      case "PAVING":
        return { icon: "▦", label: t("workzone.paving", currentLang, "bau"), watermark: "PFLASTER" };
      case "PAINTING":
        return { icon: "▰", label: t("workzone.painting", currentLang, "bau"), watermark: "FARBE" };
      case "RENOVATION":
        return { icon: "◫", label: t("workzone.renovation", currentLang, "bau"), watermark: "RENOV" };
      case "OTHER":
        return { icon: "⬛", label: t("workzone.otherType", currentLang, "bau"), watermark: "SONST" };
      default:
        return { icon: "⬛", label: t("workzone.climbingShort", currentLang), watermark: "KLETTER" };
    }
  }

  function cardTone(status: string, done: number, total: number) {
    if (status !== "active") return "border-red-200 bg-red-50/80 dark:border-red-900/40 dark:bg-red-950/10";
    if (total > 0 && done >= total) return "border-emerald-200 bg-emerald-50/80 dark:border-green-900/40 dark:bg-green-950/10";
    return "border-amber-200 bg-amber-50/80 dark:border-yellow-900/40 dark:bg-yellow-950/10";
  }

  const fallbackStreet = "Frillendorferstr 176";
  const fallbackZip = "45139";
  const fallbackCity = "Essen";
  const defaultAddress = `${company.street ?? fallbackStreet}, ${company.zip ?? fallbackZip} ${company.city ?? fallbackCity}`.trim();
  const missionItems = baustellen.map((b) => {
    const total = b.treeItems.length;
    const done = b.treeItems.filter((t) => t.status === "done").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const haltCount = b.treeItems.filter((t) => {
      if (!t.notes) return false;
      try {
        const parsed = JSON.parse(t.notes) as { haltverbot?: unknown };
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
    const c = b.coordinates as any;
    const lat = typeof c?.lat === "number" ? c.lat : typeof c?.latitude === "number" ? c.latitude : null;
    const lng = typeof c?.lng === "number" ? c.lng : typeof c?.longitude === "number" ? c.longitude : null;
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
      coordinates: lat != null && lng != null ? { lat, lng } : null,
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
  const canvasToolbarButtonClass = "size-8 border-white/25 bg-black/25 text-white shadow-sm hover:bg-black/35 hover:text-white";

  return (
    <div className="space-y-4">
      <WorkzoneMissionControl
        items={liveMission}
        archive={archivedMission}
        defaultAddress={defaultAddress}
        mode={mode}
        toolbar={
          canOpenCalendar ? (
            <>
              {admin ? (
                <>
                  <WorkzoneCreateBaustelleModal companyId={company.id} iconOnly triggerClassName={canvasToolbarButtonClass} mode={mode} />
                  <Button
                    asChild
                    variant="outline"
                    size="icon"
                    className={canvasToolbarButtonClass}
                    title={t("workzone.dailyPlan", currentLang)}
                    aria-label={t("workzone.dailyPlan", currentLang)}
                  >
                    <Link href={`/workzone/plan?date=${today}`}>
                      <ClipboardList className="size-3.5" />
                    </Link>
                  </Button>
                </>
              ) : null}
              <WorkzoneCalendarModal
                initialDate={today}
                iconOnly
                triggerClassName={canvasToolbarButtonClass}
                plans={plansForCalendar.map((item) => {
                  const savedRows = item.savedRows.map((row) => ({
                    id: row.id,
                    workerNames: row.workerNames,
                    machineNames: row.machineNames,
                    baustelleName: row.baustelleName,
                    note: row.note,
                  }));
                  const draftRows = item.columns.map((column) => ({
                    id: column.id,
                    workerNames: column.assignments.filter((assignment) => assignment.kind === "WORKER").map((assignment) => assignment.labelSnapshot).join(", "),
                    machineNames: column.assignments.filter((assignment) => assignment.kind === "MACHINE").map((assignment) => assignment.labelSnapshot).join(", "),
                    baustelleName: column.baustelle?.name ?? column.title,
                    note: column.note,
                  }));
                  return {
                    date: dateKey(item.planDate),
                    currentRows: savedRows.length > 0 ? savedRows : draftRows,
                    snapshots: item.snapshots.map((snapshot) => ({
                      id: snapshot.id,
                      versionNumber: snapshot.versionNumber,
                      createdAt: snapshot.createdAt.toISOString(),
                      rows: snapshot.rows.map((row) => ({
                        id: row.id,
                        workerNames: row.workerNames,
                        machineNames: row.machineNames,
                        baustelleName: row.baustelleName,
                        note: row.note,
                      })),
                    })),
                  };
                })}
              />
            </>
          ) : null
        }
      />

      <div className="grid w-full min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {baustellen.map((b) => {
          const total = b.treeItems.length;
          const done = b.treeItems.filter((t) => t.status === "done").length;
          const blocked = b.treeItems.filter((t) => t.status === "blocked").length;
          const haltCount = b.treeItems.filter((t) => {
            if (!t.notes) return false;
            try {
              const parsed = JSON.parse(t.notes) as { haltverbot?: unknown };
              return Boolean(parsed?.haltverbot);
            } catch {
              return false;
            }
          }).length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
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
          const pendingSiteTask = b.manualTasks[0]?.description ?? null;
          const meta = typeMeta(b.type);
          const typeIcon = b.type === "TRUCK_PLATFORM" ? <HubsteigerIcon size={18} /> : <span>{meta.icon}</span>;
          const workers = b.workSessions
            .map((session) => `${session.worker.firstName} ${session.worker.lastName}`.trim())
            .filter(Boolean)
            .slice(0, 5);
          const planColumn = plan?.columns.find((column) => column.baustelleId === b.id);
          const plannedWorkers = (planColumn?.assignments ?? [])
            .filter((item) => item.kind === "WORKER")
            .map((item) => item.labelSnapshot);

          const isLocked = b.status !== "active";
          return (
            <Link
              key={b.id}
              href={isLocked ? "#" : `/workzone/baustellen/${b.id}`}
              aria-disabled={isLocked}
              className={`group ${isLocked ? "pointer-events-none opacity-70" : ""}`}
            >
              <Card
                className={`relative transition-transform group-hover:-translate-y-0.5 group-hover:shadow-md ${cardTone(
                  b.status,
                  done,
                  total,
                )}`}
              >
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
                  <div className="absolute -right-4 top-10 select-none text-6xl font-black tracking-widest text-foreground/5">
                    {meta.watermark}
                  </div>
                </div>
              <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="min-w-0 truncate">{b.name}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {typeIcon}
                        {meta.label}
                      </span>
                    </span>
                  </CardTitle>
                <CardDescription>{b.description ?? "—"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <WorkingBadge workers={workers} />
                <div className="flex items-center justify-between gap-2">
                  <span>{t("workzone.status", currentLang)}: {baustelleStatusLabel(b.status, currentLang)}</span>
                  <span className="tabular-nums">
                    {done}/{total} ({pct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded bg-muted">
                  <div className="h-2 bg-foreground/70" style={{ width: `${pct}%` }} />
                </div>
                {plannedWorkers.length > 0 ? (
                  <div className="text-[11px] text-muted-foreground">
                    {t("workzone.plan", currentLang)}: {plannedWorkers.join(", ")}
                  </div>
                ) : null}
                {haltCount > 0 ? <div className="text-[11px] font-semibold text-red-500">🅿️🚫 {t("workzone.haltingBan", currentLang)}: {haltCount}</div> : null}
                {equipmentIndicators.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {equipmentIndicators.map((indicator) => (
                      <span
                        key={indicator.key}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-300"
                        title={`${indicator.label}: ${indicator.qty} ${t("common.location", currentLang)}`}
                      >
                        {indicator.icon} {indicator.qty}
                      </span>
                    ))}
                  </div>
                ) : null}
                {pendingSiteTask ? (
                  <div className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-700 dark:text-sky-200">
                    {t("common.note", currentLang)}: {pendingSiteTask}
                  </div>
                ) : null}
                {(() => {
                  const equipmentStatus = (b.activeEquipmentStatus as Record<string, any> | null) ?? {};
                  const baustelleHasEquipment = Object.values(equipmentStatus).some((row) => {
                    const qty = Number((row as any)?.quantity ?? 0);
                    return Number.isFinite(qty) && qty > 0;
                  });
                  const treeHasEquipment = b.treeItems.some((t) => {
                    const map = (t.siteEquipmentStatus as Record<string, any> | null) ?? null;
                    if (!map) return false;
                    return Object.values(map).some((row) => {
                      const qty = Number((row as any)?.quantity ?? 0);
                      return Number.isFinite(qty) && qty > 0;
                    });
                  });
                  const pendingCollection = baustelleHasEquipment || treeHasEquipment;
                  return pendingCollection ? (
                    <div className="text-[11px] font-semibold text-amber-500">{t("workzone.safetyPending", currentLang)} · {t("workzone.materialOnSite", currentLang)}</div>
                  ) : null;
                })()}
                {blocked > 0 ? <div>{t("workzone.blocked", currentLang)}: {blocked}</div> : null}
                {isLocked ? <div className="text-red-300/80">{t("workzone.siteNotOpen", currentLang)}</div> : null}
              </CardContent>
            </Card>
          </Link>
          );
        })}
        {baustellen.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("workzone.noSitesTitle", currentLang)}</CardTitle>
              <CardDescription>{t("workzone.seedHintTitle", currentLang)}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{t("workzone.seedHint", currentLang)}</CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
