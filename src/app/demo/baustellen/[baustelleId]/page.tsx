import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCompanyMode } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { isRecord, readLatLng } from "@/lib/workzone/site-json";
import { WorkingBadge } from "@/app/(workzone)/workzone/working-badge";
import { BaustelleMap } from "@/app/(workzone)/workzone/baustellen/[baustelleId]/baustelle-map";
import { DemoReadonlyBadge } from "@/components/demo/demo-readonly-badge";
import { DemoTreeList } from "@/components/demo/demo-tree-list";

function formatDateTime(date: Date) {
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

export default async function DemoBaustelleDetailPage({ params }: { params: Promise<{ baustelleId: string }> }) {
  const { baustelleId } = await params;
  const [currentLang, mode] = await Promise.all([resolveRequestLanguage(), getCompanyMode()]);
  const tr = (key: string) => t(key, currentLang, mode);
  const baustelle = await prisma.baustelle.findUnique({
    where: { id: baustelleId },
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
      workSessions: {
        where: { isLive: true, endTime: null },
        orderBy: { startTime: "asc" },
        select: {
          workerId: true,
          startTime: true,
          worker: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!baustelle) notFound();

  const points = baustelle.treeItems.flatMap((tree) => {
    const coords = readLatLng(tree.coordinates);
    return coords ? [{ id: tree.id, treeId: tree.treeId, status: tree.status, ...coords }] : [];
  });

  const activeWorkerNames = baustelle.workSessions.map((session) => `${session.worker.firstName} ${session.worker.lastName}`.trim()).filter(Boolean);
  const haltCount = baustelle.treeItems.filter((item) => {
    if (!item.notes) return false;
    try {
      const parsed = JSON.parse(item.notes) as { haltverbot?: unknown };
      return Boolean(parsed?.haltverbot);
    } catch {
      return false;
    }
  }).length;
  const rawSafetyStatus = isRecord(baustelle.activeEquipmentStatus) ? baustelle.activeEquipmentStatus : {};
  const safetyRows = [
    { category: "SIGN" as const, label: tr("workzone.haltingBan") },
    { category: "PLATE" as const, label: tr("workzone.coverPlates") },
    { category: "FENCE" as const, label: tr("workzone.barriers") },
  ].map((item) => {
    const entry = rawSafetyStatus[item.category];
    const row = isRecord(entry) ? entry : null;
    return {
      category: item.category,
      label: item.label,
      requested: Boolean(row?.requested),
      quantity: Math.max(0, Number(row?.quantity ?? 0) || 0),
      workerName: String(row?.workerName ?? ""),
      dateSet: String(row?.dateSet ?? ""),
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            <Link className="hover:underline" href="/demo/workzone">
              ← {tr("workzone.siteListBack")}
            </Link>
          </div>
          <h1 className="mt-1 text-xl font-semibold text-foreground">{baustelle.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{baustelle.description ?? ""}</p>
          {haltCount > 0 ? <p className="mt-1 text-sm font-semibold text-red-500">{tr("workzone.haltActive")} ({haltCount})</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DemoReadonlyBadge />
          <WorkingBadge workers={activeWorkerNames} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{tr("workzone.treesTitle")}</CardTitle>
            <CardDescription>{tr("demo.itemsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="liste">
              <TabsList>
                <TabsTrigger value="liste">{tr("workzone.list")}</TabsTrigger>
                <TabsTrigger value="harta">{tr("workzone.map")}</TabsTrigger>
              </TabsList>
              <TabsContent value="liste">
                <DemoTreeList items={baustelle.treeItems} mode={mode} />
              </TabsContent>
              <TabsContent value="harta">
                <BaustelleMap points={points} userId="demo-viewer" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tr("demo.liveCrewTitle")}</CardTitle>
              <CardDescription>{tr("demo.liveCrewDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {baustelle.workSessions.length === 0 ? (
                <p className="text-muted-foreground">{tr("workzone.noLiveWorkers")}</p>
              ) : (
                baustelle.workSessions.map((session) => (
                  <div key={session.workerId} className="rounded-md border px-3 py-2">
                    <div className="font-medium">
                      <Link className="hover:underline" href={`/demo/workers/${session.workerId}`}>
                        {session.worker.firstName} {session.worker.lastName}
                      </Link>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(session.startTime)}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tr("workzone.safetyEquipment")}</CardTitle>
              <CardDescription>{tr("demo.safetyDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {safetyRows.map((row) => (
                <div key={row.category} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{row.label}</span>
                    <span>{row.quantity}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.requested ? `${row.workerName || "-"} · ${row.dateSet || "-"}` : tr("common.none")}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tr("workzone.recentTasksTitle")}</CardTitle>
              <CardDescription>{tr("demo.tasksDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {baustelle.manualTasks.length === 0 ? (
                <p className="text-muted-foreground">{tr("workzone.noTasksYet")}</p>
              ) : (
                <ul className="space-y-2">
                  {baustelle.manualTasks.slice(0, 10).map((task) => (
                    <li key={task.id} className="rounded-md border px-3 py-2">
                      <div className="text-xs text-muted-foreground">
                        {`${task.user?.name ?? task.user?.email ?? tr("common.unknown")} · ${formatDateTime(new Date(task.createdAt))}`}
                      </div>
                      <div className="font-medium">{task.description}</div>
                      {!task.isFlagged ? (
                        <div className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
                          {tr("workzone.siteTaskDone")}
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
