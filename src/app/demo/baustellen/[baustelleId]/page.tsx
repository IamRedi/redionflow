import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { prisma } from "@/lib/db/prisma";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { WorkingBadge } from "@/app/(workzone)/workzone/working-badge";
import { BaustelleMap } from "@/app/(workzone)/workzone/baustellen/[baustelleId]/baustelle-map";
import { DemoReadonlyBadge } from "@/components/demo/demo-readonly-badge";
import { DemoTreeList } from "@/components/demo/demo-tree-list";

function formatDateTime(date: Date) {
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

export default async function DemoBaustelleDetailPage({ params }: { params: Promise<{ baustelleId: string }> }) {
  const { baustelleId } = await params;
  const currentLang = await resolveRequestLanguage();
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

  const points = baustelle.treeItems
    .map((tree) => {
      const c = tree.coordinates as any;
      const lat = typeof c?.lat === "number" ? c.lat : typeof c?.latitude === "number" ? c.latitude : null;
      const lng = typeof c?.lng === "number" ? c.lng : typeof c?.longitude === "number" ? c.longitude : null;
      if (lat == null || lng == null) return null;
      return { id: tree.id, treeId: tree.treeId, status: tree.status as "todo" | "done" | "blocked", lat, lng };
    })
    .filter(Boolean) as { id: string; treeId: string; status: "todo" | "done" | "blocked"; lat: number; lng: number }[];

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
  const rawSafetyStatus = (baustelle.activeEquipmentStatus as Record<string, any> | null) ?? {};
  const safetyRows = [
    { category: "SIGN" as const, label: t("workzone.haltingBan", currentLang) },
    { category: "PLATE" as const, label: t("workzone.coverPlates", currentLang) },
    { category: "FENCE" as const, label: t("workzone.barriers", currentLang) },
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

  return (
    <div className="min-w-[430px] space-y-4 sm:min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">
            <Link className="hover:underline" href="/demo/workzone">
              {t("common.back", currentLang)} {t("workzone.siteListBack", currentLang)}
            </Link>
          </div>
          <h1 className="text-xl font-semibold">{baustelle.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{baustelle.description ?? ""}</p>
          {haltCount > 0 ? <p className="mt-1 text-sm font-semibold text-red-500">{t("workzone.haltActive", currentLang)} ({haltCount})</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DemoReadonlyBadge />
          <WorkingBadge workers={activeWorkerNames} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{t("workzone.treesTitle", currentLang)}</CardTitle>
            <CardDescription>{t("workzone.treesDescription", currentLang)}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="liste">
              <TabsList>
                <TabsTrigger value="liste">{t("workzone.list", currentLang)}</TabsTrigger>
                <TabsTrigger value="harta">{t("workzone.map", currentLang)}</TabsTrigger>
              </TabsList>
              <TabsContent value="liste">
                <DemoTreeList items={baustelle.treeItems as any} />
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
              <CardTitle>{t("workzone.externalWorkerTitle", currentLang)}</CardTitle>
              <CardDescription>Live crew currently active on this site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {baustelle.workSessions.length === 0 ? (
                <p className="text-muted-foreground">{t("workzone.noLiveWorkers", currentLang)}</p>
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
              <CardTitle>{t("workzone.safetyEquipment", currentLang)}</CardTitle>
              <CardDescription>Current safety equipment state on this site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {safetyRows.map((row) => (
                <div key={row.category} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{row.label}</span>
                    <span>{row.quantity}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.requested ? `${row.workerName || "-"} · ${row.dateSet || "-"}` : t("common.none", currentLang)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("workzone.recentTasksTitle", currentLang)}</CardTitle>
              <CardDescription>{t("workzone.recentTasksDescription", currentLang)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {baustelle.manualTasks.length === 0 ? (
                <p className="text-muted-foreground">{t("workzone.noTasksYet", currentLang)}</p>
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
                          {t("workzone.siteTaskDone", currentLang)}
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
