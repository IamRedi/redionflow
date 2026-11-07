import { withPilotDbContext } from "@/lib/db/tenant-runtime";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HubsteigerIcon } from "@/components/icons";
import { prisma } from "@/lib/db/prisma";
import { getOrCreateDefaultCompany, getCompanyMode } from "@/lib/db/company";
import { autoLockPastWorkLogs } from "@/lib/workzone/auto-lock";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { dateKey, dayRange } from "@/lib/workzone/date-utils";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { equipmentQuantity, hasEquipmentOnSite, readLatLng } from "@/lib/workzone/site-json";
import { WorkingBadge } from "./working-badge";
import { WorkzoneCalendarModal } from "./workzone-calendar-modal";
import { WorkzoneCreateBaustelleModal } from "./workzone-create-baustelle-modal";
import { WorkzoneMissionControl } from "./workzone-mission-control";
import { SteelProgressRing, SteelSiteArt } from "@/components/steel/steel-art";
import { ensureSteelPhases } from "@/lib/workzone/steel-phases-db";
import { isSteelSiteType, steelSiteShape } from "@/lib/workzone/steel-phases";
import { crewPermissions } from "@/lib/workzone/crew-roles";
import { withTenantContext } from "@/lib/db/tenant-context";
import { batchState, readFactorySteps } from "@/lib/factory/production";
import { FactoryPanel, type FactoryBatchView } from "./factory-panel";
import { AssetPhoto } from "@/components/asset-photo";
import { assetPhotoUrl } from "@/lib/asset-photos/shared";
import { factoryOutput, type SiteFactoryOutput } from "@/lib/elements/factory-output";
import { loadSteelTaskProgress } from "@/lib/steel-work/read-progress";
import { getSteelWorkCatalogAction } from "./steel-catalog-actions";
import { readFleetLocations } from "@/lib/fleet/location";
import { wanwayEnabled } from "@/lib/fleet/wanway/service";

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

export default async function WorkzoneHomePage({ searchParams }: { searchParams?: Promise<{view?: string}> }) {
  const initialMap = (await searchParams)?.view === 'map';
  await autoLockPastWorkLogs();
  const company = await getOrCreateDefaultCompany();
  const [admin, worker, mode] = await Promise.all([
    getCurrentAdmin(),
    getCurrentWorker(),
    getCompanyMode(),
  ]);
  const currentLang = await resolveRequestLanguage();
  const fleetLocations = admin || worker ? await readFleetLocations() : [];

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
  // Steel assembly sites get their work phases before the counters below read them.
  const steelSites = await prisma.baustelle.findMany({
    where: { companyProfileId: company.id, status: "active", type: "STEEL_ASSEMBLY" },
    select: { id: true, type: true },
    take: 50,
  });
  await Promise.all(steelSites.map((site) => ensureSteelPhases(site)));
  const [allSites, coneMoves] = await Promise.all([
    withPilotDbContext(company.id, tx => tx.baustelle.findMany({
      // Inactive sites (finished projects, archive) stay in the admin list only;
      // the field board shows what people can work on today.
      where: { companyProfileId: company.id, status: "active" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        coverPhotoAt: true,
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

  // The factory (a STEEL_WORKSHOP entry) is not a construction site: it gets its
  // own production panel below the board and never appears as a site card.
  const factorySite = allSites.find((site) => site.type === "STEEL_WORKSHOP") ?? null;
  const baustellen = allSites.filter((site) => site.type !== "STEEL_WORKSHOP");
  const selectedTaskProgress = await loadSteelTaskProgress(company.id, allSites.filter(site => isSteelSiteType(site.type)).map(site => site.id));
  const workCatalog = allSites.some(site => isSteelSiteType(site.type)) ? await getSteelWorkCatalogAction({}) : null;
  const factoryDefinitions = workCatalog?.ok ? (workCatalog.definitions ?? []).filter(definition => definition.kind === 'factory') : [];
  const factoryBatches: FactoryBatchView[] = factorySite
    ? (
        await withTenantContext(company.id, (tx) =>
          tx.productionBatch.findMany({
            // Material of archived sites leaves the factory line.
            where: { companyProfileId: company.id, baustelle: { status: "active" } },
            orderBy: { createdAt: "asc" },
            take: 200,
            select: {
              id: true,
              title: true,
              quantity: true,
              unit: true,
              steps: true,
              orderRef: true,
              baustelle: { select: { id: true, name: true } },
            },
          }),
        )
      ).map((batch) => ({
        id: batch.id,
        title: batch.title,
        quantity: batch.quantity,
        unit: batch.unit,
        siteId: batch.baustelle.id,
        siteName: batch.baustelle.name,
        orderRef: batch.orderRef,
        steps: readFactorySteps(batch.steps),
        events: [],
      }))
    : [];

  // What the factory produced per site and per process, from the element lists.
  const siteOutput: SiteFactoryOutput[] = factorySite
    ? factoryOutput(
        await withTenantContext(company.id, (tx) =>
          tx.siteElement.findMany({
            where: { companyProfileId: company.id, list: "assembly", baustelle: { status: "active" } },
            select: { baustelleId: true, quantity: true, weightKg: true, factoryDoneAt: true, fieldDoneAt: true, processRoutes: true, work: { select: { stage: true, pieces: true } } },
          }),
        ),
        baustellen,
      )
    : [];

  const materialBySite = new Map<string, { ready: number; total: number }>();
  for (const batch of factoryBatches) {
    const entry = materialBySite.get(batch.siteId) ?? { ready: 0, total: 0 };
    entry.total += 1;
    if (batchState(batch.steps) === "ready") entry.ready += 1;
    materialBySite.set(batch.siteId, entry);
  }

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
      case "FIBER_TRENCH":
        return { icon: "〰", label: t("workzone.fiberTrench", currentLang, "bau"), watermark: "TRASSE" };
      case "FIBER_DRILLING":
        return { icon: "⤳", label: t("workzone.fiberDrilling", currentLang, "bau"), watermark: "BOHRUNG" };
      case "FIBER_HOUSE_CONNECTION":
        return { icon: "⌂", label: t("workzone.fiberHouseConnection", currentLang, "bau"), watermark: "HA" };
      case "STEEL_WORKSHOP":
        return { icon: "⚒", label: t("workzone.steelWorkshop", currentLang, "bau"), watermark: "WERKSTATT" };
      case "STEEL_ASSEMBLY":
        return { icon: "🏗️", label: t("workzone.steelAssembly", currentLang, "bau"), watermark: "MONTAGE" };
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

  const defaultAddress = [company.street, [company.zip, company.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const photoPermissions=crewPermissions(worker?{isAdmin:false,crewRole:worker.crewRole,level:worker.level}:admin?{isAdmin:true}:null);
  const missionItems = baustellen.map((b) => {
    const selected = selectedTaskProgress.get(b.id);
    const total = selected?.total ?? b.treeItems.length;
    const done = selected?.done ?? b.treeItems.filter((t) => t.status === "done").length;
    const pct = selected?.pct ?? (total > 0 ? Math.round((done / total) * 100) : 0);
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
    const coordinates = readLatLng(b.coordinates);
    return {
      id: b.id,
      name: b.name,
      photoUrl: assetPhotoUrl('site',b.id,b.coverPhotoAt),
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
      shape: steelSiteShape(b.name, b.description),
      material: materialBySite.get(b.id),
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
        fleetLocations={fleetLocations}
        initialMap={initialMap}
        gpsSyncAvailable={wanwayEnabled() && Boolean(admin || worker)}
        items={liveMission}
        archive={archivedMission}
        defaultAddress={defaultAddress}
        mode={mode}
        canEditPhotos={photoPermissions.office||photoPermissions.siteSteps}
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

      {factorySite ? (
        <FactoryPanel
          factoryName={factorySite.name}
          factoryId={factorySite.id}
          photoUrl={assetPhotoUrl('site',factorySite.id,factorySite.coverPhotoAt)}
          canEditPhoto={photoPermissions.office||photoPermissions.factorySteps}
          factoryAddress={(factorySite.address ?? "").trim()}
          siteOutput={siteOutput}
          processDefinitions={factoryDefinitions}
          canManage={crewPermissions(worker ? { isAdmin: false, crewRole: worker.crewRole, level: worker.level } : admin ? { isAdmin: true } : null).office}
        />
      ) : null}

      {/* With a factory panel the sites live on the board above only; the list would repeat them. */}
      <div className={`grid w-full min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 ${factorySite ? "hidden" : ""}`}>
        {(factorySite ? [] : baustellen).map((b) => {
          const selected = selectedTaskProgress.get(b.id);
          const total = selected?.total ?? b.treeItems.length;
          const done = selected?.done ?? b.treeItems.filter((t) => t.status === "done").length;
          const blocked = selected?.blocked ?? b.treeItems.filter((t) => t.status === "blocked").length;
          const haltCount = b.treeItems.filter((t) => {
            if (!t.notes) return false;
            try {
              const parsed = JSON.parse(t.notes) as { haltverbot?: unknown };
              return Boolean(parsed?.haltverbot);
            } catch {
              return false;
            }
          }).length;
          const pct = selected?.pct ?? (total > 0 ? Math.round((done / total) * 100) : 0);
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
          if (isSteelSiteType(b.type)) {
            const material = materialBySite.get(b.id);
            const finished = total > 0 && done >= total;
            return (
              <Link
                key={b.id}
                href={isLocked ? "#" : `/workzone/baustellen/${b.id}`}
                aria-disabled={isLocked}
                className={`group block min-w-0 ${isLocked ? "pointer-events-none opacity-70" : ""}`}
              >
                <article
                  className={`relative overflow-hidden rounded-3xl border-2 bg-card shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg ${
                    finished ? "border-green-500/50" : "border-border"
                  }`}
                >
                  <div className="relative h-44 overflow-hidden bg-gradient-to-br from-orange-50 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
                    <AssetPhoto key={`${b.id}:${b.coverPhotoAt}`} kind="site" id={b.id} src={assetPhotoUrl('site',b.id,b.coverPhotoAt)} alt={b.name} canEdit={photoPermissions.office||photoPermissions.siteSteps}>
                    <SteelSiteArt
                      type={b.type}
                      shape={steelSiteShape(b.name, b.description)}
                      pct={pct}
                      live={b.workSessions.length > 0}
                      className="absolute inset-0 h-full w-full"
                    />
                    </AssetPhoto>
                    {/* Site name on a plate in the top corner, like a site board. */}
                    <div className="absolute left-3 top-3 max-w-[75%] rounded-xl border border-white/60 bg-white/85 px-3 py-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
                      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-400">{meta.label}</div>
                      <h3 className="line-clamp-2 text-lg font-bold leading-tight tracking-tight">{b.name}</h3>
                    </div>
                    <div className="absolute bottom-2 right-2 rounded-full bg-background/85 text-orange-600 shadow-sm backdrop-blur dark:text-orange-400">
                      <SteelProgressRing pct={pct} size={52} />
                    </div>
                  </div>
                  <div className="space-y-2 p-4">
                    {b.address ? <p className="truncate text-xs text-muted-foreground">📍 {b.address}</p> : null}
                    <WorkingBadge workers={workers} />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{t("steel.phasesTitle", currentLang)}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className={`block h-full rounded-full ${finished ? "bg-green-500" : "bg-orange-500"}`} style={{ width: `${pct}%` }} />
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {done}/{total}
                      </span>
                    </div>
                    {material && material.total > 0 ? (
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          material.ready === material.total
                            ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300"
                            : "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300"
                        }`}
                      >
                        ⚒ {t("factory.cardMaterial", currentLang).replace("{ready}", String(material.ready)).replace("{total}", String(material.total))}
                      </div>
                    ) : null}
                  </div>
                </article>
              </Link>
            );
          }
          return (
            <Link
              key={b.id}
              href={isLocked ? "#" : `/workzone/baustellen/${b.id}`}
              aria-disabled={isLocked}
              className={`group block min-w-0 ${isLocked ? "pointer-events-none opacity-70" : ""}`}
            >
              <Card
                className={`relative min-w-0 transition-transform group-hover:-translate-y-0.5 group-hover:shadow-md ${
                  isSteelSiteType(b.type)
                    ? `overflow-hidden rounded-2xl bg-card ${total > 0 && done >= total ? "border-emerald-500/50" : "border-border"}`
                    : cardTone(b.status, done, total)
                }`}
              >
                {isSteelSiteType(b.type) ? (
                  <div className="relative h-28 overflow-hidden rounded-t-lg border-b">
                    <AssetPhoto key={`${b.id}:${b.coverPhotoAt}`} kind="site" id={b.id} src={assetPhotoUrl('site',b.id,b.coverPhotoAt)} alt={b.name} canEdit={photoPermissions.office||photoPermissions.siteSteps}>
                    <SteelSiteArt type={b.type} pct={pct} live={b.workSessions.length > 0} className="absolute inset-0 h-full w-full" />
                    </AssetPhoto>
                    <div className="absolute bottom-2 right-2 rounded-full bg-background/85 text-orange-600 shadow-sm backdrop-blur dark:text-orange-400">
                      <SteelProgressRing pct={pct} size={48} />
                    </div>
                  </div>
                ) : (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
                    <div className="absolute -right-4 top-10 select-none text-6xl font-black tracking-widest text-foreground/5">
                      {meta.watermark}
                    </div>
                  </div>
                )}
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
                <CardDescription className="line-clamp-2">{b.description ?? "—"}</CardDescription>
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
                  const pendingCollection =
                    hasEquipmentOnSite(b.activeEquipmentStatus) ||
                    b.treeItems.some((t) => hasEquipmentOnSite(t.siteEquipmentStatus));
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
