import { withPilotDbContext } from "@/lib/db/tenant-runtime";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCompanyMode } from "@/lib/db/company";
import { getFeatures } from "@/lib/mode-config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { prisma } from "@/lib/db/prisma";
import { getPilotCompanyId as getCurrentCompanyId } from "@/lib/auth/pilot-session";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { autoLockPastWorkLogs } from "@/lib/workzone/auto-lock";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { WorkzoneTreeList } from "./tree-list";
import { ManualTaskForm } from "./manual-task-form";
import { BaustelleMap } from "./baustelle-map";
import { WorkingControls } from "./working-controls";
import { WorkingBadge } from "../../working-badge";
import { ExternalWorkerForm } from "./external-worker-form";
import { BaustelleDocumentationModal } from "./baustelle-documentation-modal";
import { SafetyEquipmentPanel } from "./safety-equipment-panel";

export default async function BaustelleDetailPage({
  params,
}: {
  params: Promise<{ baustelleId: string }>;
}) {
  await autoLockPastWorkLogs();
  const { baustelleId } = await params;
  const currentLang = await resolveRequestLanguage();
  const [currentWorker, currentAdmin, mode, currentCompanyId] = await Promise.all([
    getCurrentWorker(),
    getCurrentAdmin(),
    getCompanyMode(),
    getCurrentCompanyId(),
  ]);
  if (!currentCompanyId) notFound();
  const baustelle = await withPilotDbContext(currentCompanyId, tx => tx.baustelle.findFirst({
    where: { id: baustelleId, companyProfileId: currentCompanyId },
    include: {
      treeItems: { orderBy: [{ status: "asc" }, { treeId: "asc" }] },
      manualTasks: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          description: true,
          createdAt: true,
          isFlagged: true,
          user: { select: { name: true, email: true } },
          worker: { select: { firstName: true, lastName: true } },
        },
      },
    },
  }));
  if (!baustelle) notFound();
  const features = getFeatures(mode);
  const currentActorView = currentWorker
    ? {
        id: currentWorker.id,
        firstName: currentWorker.firstName,
        lastName: currentWorker.lastName,
        isTemporary: currentWorker.isTemporary,
        level: currentWorker.level,
        isAdmin: false,
        companyProfileId: currentWorker.companyProfileId,
      }
    : currentAdmin
      ? {
          id: currentAdmin.id,
        firstName: (currentAdmin.name ?? "Admin").split(" ")[0] ?? "Admin",
        lastName: (currentAdmin.name ?? "").split(" ").slice(1).join(" "),
        isTemporary: false,
        level: "ADMIN",
        isAdmin: true,
        companyProfileId: currentCompanyId,
      }
      : null;

  const activeSessions = await prisma.workSession.findMany({
    where: { baustelleId: baustelle.id, isLive: true, endTime: null },
    select: { workerId: true, startTime: true, worker: { select: { firstName: true, lastName: true, isTemporary: true, level: true } } },
    orderBy: { startTime: "asc" },
  });
  const currentWorkerLiveSession = currentWorker
    ? await prisma.workSession.findFirst({
        where: { workerId: currentWorker.id, isLive: true, endTime: null },
        select: { startTime: true, baustelleId: true },
        orderBy: { startTime: "desc" },
      })
    : null;
  const activeWorkerIds = activeSessions.map((w) => w.workerId);
  const activeWorkerNames = activeSessions.map((w) => `${w.worker.firstName} ${w.worker.lastName}`.trim()).filter(Boolean);

  const points = baustelle.treeItems
    .map((t) => {
      const c = t.coordinates as any;
      const lat = typeof c?.lat === "number" ? c.lat : typeof c?.latitude === "number" ? c.latitude : null;
      const lng = typeof c?.lng === "number" ? c.lng : typeof c?.longitude === "number" ? c.longitude : null;
      if (lat == null || lng == null) return null;
      return { id: t.id, treeId: t.treeId, status: t.status as any, lat, lng };
    })
    .filter(Boolean) as { id: string; treeId: string; status: "todo" | "done" | "blocked"; lat: number; lng: number }[];
  const haltCount = baustelle.treeItems.filter((item) => {
    if (!item.notes) return false;
    try {
      const parsed = JSON.parse(item.notes) as { haltverbot?: unknown };
      return Boolean(parsed?.haltverbot);
    } catch {
      return false;
    }
  }).length;
  const rawSafetyStatus = (baustelle.activeEquipmentStatus as Record<string, any> | null) ?? {};
  const safetyRows = [
    { category: "SIGN" as const, label: t("workzone.haltingBan", currentLang, mode) },
    { category: "PLATE" as const, label: t("workzone.coverPlates", currentLang, mode) },
    { category: "FENCE" as const, label: t("workzone.barriers", currentLang, mode) },
  ].map((item) => {
    const row = rawSafetyStatus[item.category] as any;
    return {
      category: item.category,
      label: item.label,
      requested: Boolean(row?.requested),
      quantity: Math.max(0, Number(row?.quantity ?? 0) || 0),
      workerName: String(row?.workerName ?? ""),
      dateSet: String(row?.dateSet ?? ""),
    };
  });
  const [machinesForCones, coneMovesCompany, coneMovesBaustelle] = await Promise.all([
    prisma.machine.findMany({
      where: { companyProfileId: baustelle.companyProfileId, isActive: true },
      select: { id: true, name: true, nickname: true, coneTotal: true },
      orderBy: { name: "asc" },
      take: 120,
    }),
    prisma.machineConeMovement.findMany({
      where: { companyProfileId: baustelle.companyProfileId },
      select: { type: true, quantity: true, fromMachineId: true, toMachineId: true },
      orderBy: { createdAt: "desc" },
      take: 6000,
    }),
    prisma.machineConeMovement.findMany({
      where: { companyProfileId: baustelle.companyProfileId, baustelleId: baustelle.id },
      select: { type: true, quantity: true, fromMachineId: true, toMachineId: true, treeItemId: true },
      orderBy: { createdAt: "asc" },
      take: 4000,
    }),
  ]);

  const coneDeltaByMachine = new Map<string, number>();
  for (const m of coneMovesCompany) {
    const qty = Math.max(0, Number(m.quantity ?? 0) || 0);
    if (m.type === "DEPLOY" && m.fromMachineId) {
      coneDeltaByMachine.set(m.fromMachineId, (coneDeltaByMachine.get(m.fromMachineId) ?? 0) - qty);
    } else if (m.type === "COLLECT" && m.toMachineId) {
      coneDeltaByMachine.set(m.toMachineId, (coneDeltaByMachine.get(m.toMachineId) ?? 0) + qty);
    } else if (m.type === "TRANSFER") {
      if (m.fromMachineId) coneDeltaByMachine.set(m.fromMachineId, (coneDeltaByMachine.get(m.fromMachineId) ?? 0) - qty);
      if (m.toMachineId) coneDeltaByMachine.set(m.toMachineId, (coneDeltaByMachine.get(m.toMachineId) ?? 0) + qty);
    }
  }

  const coneOnTree = new Map<string, { qty: number; machines: Record<string, number> }>();
  for (const m of coneMovesBaustelle) {
    const qty = Math.max(0, Number(m.quantity ?? 0) || 0);
    if (m.type === "DEPLOY" && m.fromMachineId && m.treeItemId) {
      const cur = coneOnTree.get(m.treeItemId) ?? { qty: 0, machines: {} };
      cur.qty += qty;
      cur.machines[m.fromMachineId] = (cur.machines[m.fromMachineId] ?? 0) + qty;
      coneOnTree.set(m.treeItemId, cur);
    } else if (m.type === "COLLECT" && m.toMachineId && m.treeItemId) {
      const cur = coneOnTree.get(m.treeItemId) ?? { qty: 0, machines: {} };
      cur.qty = Math.max(0, cur.qty - qty);
      if (m.fromMachineId) {
        cur.machines[m.fromMachineId] = Math.max(0, (cur.machines[m.fromMachineId] ?? 0) - qty);
        if (cur.machines[m.fromMachineId] <= 0) delete cur.machines[m.fromMachineId];
      }
      coneOnTree.set(m.treeItemId, cur);
    }
  }

  const coneMachines = machinesForCones.map((machine) => {
    const base = Math.max(0, Number(machine.coneTotal ?? 0) || 0);
    const available = Math.max(0, base + (coneDeltaByMachine.get(machine.id) ?? 0));
    return {
      id: machine.id,
      label: (machine.nickname ?? machine.name).trim(),
      available,
    };
  });

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4 overflow-hidden">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            <Link className="hover:underline" href="/workzone">
              {t("common.back")} {t("workzone.siteListBack")}
            </Link>
          </div>
          <h1 className="break-words text-xl font-semibold">{baustelle.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{baustelle.description ?? ""}</p>
          {haltCount > 0 ? <p className="mt-1 text-sm font-semibold text-red-500">{t("workzone.haltActive", currentLang, mode)} ({haltCount})</p> : null}
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <div className="min-w-0 max-w-full">
            <WorkingBadge workers={activeWorkerNames} />
          </div>
          <div className="shrink-0">
            {currentActorView ? (
              <BaustelleDocumentationModal
                baustelleId={baustelle.id}
                baustelleName={baustelle.name}
                documents={baustelle.documents}
                actorId={currentActorView.id}
                actorKind={currentActorView.isAdmin ? "ADMIN" : "WORKER"}
                companyProfileId={currentActorView.companyProfileId}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>{t("workzone.treesTitle", currentLang, mode)}</CardTitle>
            <CardDescription>{t("workzone.treesDescription", currentLang, mode)}</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <WorkingControls
              baustelleId={baustelle.id}
              currentWorker={currentWorker ? currentActorView : null}
              activeWorkerIds={activeWorkerIds}
              activeSession={
                currentWorkerLiveSession
                  ? { startTime: currentWorkerLiveSession.startTime.toISOString(), baustelleId: currentWorkerLiveSession.baustelleId }
                  : null
              }
            />
            {features.trees ? (
              <Tabs defaultValue="liste" className="mt-4">
                <TabsList>
                  <TabsTrigger value="liste">{t("workzone.list", currentLang, mode)}</TabsTrigger>
                  <TabsTrigger value="harta">{t("workzone.map", currentLang, mode)}</TabsTrigger>
                </TabsList>
                <TabsContent value="liste">
                  <WorkzoneTreeList
                    baustelleId={baustelle.id}
                    items={baustelle.treeItems as any}
                    currentWorker={currentActorView}
                    baustelleTasks={baustelle.manualTasks.map((task) => ({
                      id: task.id,
                      description: task.description,
                      isFlagged: task.isFlagged,
                      createdAt: task.createdAt,
                      user: task.user ? { name: task.user.name, email: task.user.email } : null,
                      worker: task.worker ? { firstName: task.worker.firstName, lastName: task.worker.lastName } : null,
                    }))}
                    coneMachines={coneMachines}
                    coneOnTree={Object.fromEntries([...coneOnTree.entries()])}
                    companyMode={mode}
                  />
                </TabsContent>
                <TabsContent value="harta">
                  <BaustelleMap points={points} userId={currentActorView?.id ?? ""} />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="mt-4">
                <WorkzoneTreeList
                  baustelleId={baustelle.id}
                  items={baustelle.treeItems as any}
                  currentWorker={currentActorView}
                  baustelleTasks={baustelle.manualTasks.map((task) => ({
                    id: task.id,
                    description: task.description,
                    isFlagged: task.isFlagged,
                    createdAt: task.createdAt,
                    user: task.user ? { name: task.user.name, email: task.user.email } : null,
                    worker: task.worker ? { firstName: task.worker.firstName, lastName: task.worker.lastName } : null,
                  }))}
                  coneMachines={coneMachines}
                  coneOnTree={Object.fromEntries([...coneOnTree.entries()])}
                  companyMode={mode}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>{t("workzone.manualTaskTitle", currentLang, mode)}</CardTitle>
              <CardDescription>{t("workzone.manualTaskDescription", currentLang, mode)}</CardDescription>
            </CardHeader>
            <CardContent>
              <ManualTaskForm baustelleId={baustelle.id} currentWorker={currentActorView} />
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>{t("workzone.externalWorkerTitle", currentLang, mode)}</CardTitle>
              <CardDescription>{t("workzone.externalWorkerDescription", currentLang, mode)}</CardDescription>
            </CardHeader>
            <CardContent>
              <ExternalWorkerForm baustelleId={baustelle.id} currentWorker={currentActorView} />
            </CardContent>
          </Card>

          {features.inventory ? <SafetyEquipmentPanel baustelleId={baustelle.id} rows={safetyRows} currentWorker={currentActorView} /> : null}

          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>{t("workzone.recentTasksTitle", currentLang, mode)}</CardTitle>
              <CardDescription>{t("workzone.recentTasksDescription", currentLang, mode)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {baustelle.manualTasks.length === 0 ? (
                <p className="text-muted-foreground">{t("workzone.noTasksYet", currentLang, mode)}</p>
              ) : (
                <ul className="space-y-2">
                  {baustelle.manualTasks.slice(0, 10).map((task) => (
                    <li key={task.id} className="rounded-md border px-3 py-2">
                      <div className="text-xs text-muted-foreground">
                        {`${task.user?.name ?? task.user?.email ?? t("common.unknown", currentLang)} · ${new Date(task.createdAt).toLocaleString()}`}
                      </div>
                      <div className="font-medium">{task.description}</div>
                      {!task.isFlagged ? (
                        <div className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
                          {t("workzone.siteTaskDone", currentLang, mode)}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
