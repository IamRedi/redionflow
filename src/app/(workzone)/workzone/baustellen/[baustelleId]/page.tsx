import { withPilotDbContext } from "@/lib/db/tenant-runtime";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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
import { isRecord, readLatLng } from "@/lib/workzone/site-json";
import { WorkzoneTreeList } from "./tree-list";
import { ManualTaskForm } from "./manual-task-form";
import { BaustelleMap } from "./baustelle-map";
import { WorkingControls } from "./working-controls";
import { WorkingBadge } from "../../working-badge";
import { ExternalWorkerForm } from "./external-worker-form";
import { BaustelleDocumentationModal } from "./baustelle-documentation-modal";
import { SafetyEquipmentPanel } from "./safety-equipment-panel";
import { SteelPhaseBoard } from "./steel-phase-board";
import { SteelSiteArt } from "@/components/steel/steel-art";
import { AssetPhoto } from "@/components/asset-photo";
import { assetPhotoUrl } from "@/lib/asset-photos/shared";
import { ensureSteelPhases } from "@/lib/workzone/steel-phases-db";
import { withTenantContext } from "@/lib/db/tenant-context";
import { readFactorySteps } from "@/lib/factory/production";
import { crewPermissions } from "@/lib/workzone/crew-roles";
import { isSteelSiteType, readSteelPhaseMeta, steelPhaseKeyFromTreeId, steelPhasesFor, steelSiteShape } from "@/lib/workzone/steel-phases";
import { SiteProductionPanel } from "../../production/site-production-panel";
import { SiteFactoryView } from "../../production/factory-output-view";
import { factoryOutput } from "@/lib/elements/factory-output";
import type { FactoryBatchView } from "../../production/production-ui";
import { SiteFilesButton, type SiteFileView } from "./site-files-sheet";
import { PhaseDocumentsButton } from '@/components/steel/phase-documents';
import { siteDocumentAccess } from '@/lib/site-phase-documents/site-access';
import { ElementListButtons, type ElementView, type ElementWorkerOption } from "./element-lists";
import { compareMarks } from "@/lib/elements/tekla-list";
import { getSteelWorkCatalogAction } from "../../steel-catalog-actions";
import { canManageSteelCatalog } from "@/lib/steel-work/types";
import { projectSteelTasks, steelTaskTotals } from "@/lib/steel-work/progress";
import { AccessKeyButton } from '@/components/access/access-key-button';
import { NoAccessHere } from '@/components/access/no-access';
import { currentCompanyActor } from '@/lib/site-files/actor';

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
  const siteHead = await prisma.baustelle.findFirst({
    where: { id: baustelleId, companyProfileId: currentCompanyId },
    select: { id: true, type: true },
  });
  // The factory has its own production panel on the field board.
  if (siteHead?.type === "STEEL_WORKSHOP") redirect("/workzone#fabrika");
  if (siteHead && isSteelSiteType(siteHead.type)) await ensureSteelPhases(siteHead);
  const baustelle = await withPilotDbContext(currentCompanyId, async tx => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${currentCompanyId}, true)`;
    return tx.baustelle.findFirst({
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
    });
  });
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

  const points = baustelle.treeItems.flatMap((t) => {
    const coords = readLatLng(t.coordinates);
    return coords ? [{ id: t.id, treeId: t.treeId, status: t.status, ...coords }] : [];
  });
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
    { category: "SIGN" as const, label: t("workzone.haltingBan", currentLang, mode) },
    { category: "PLATE" as const, label: t("workzone.coverPlates", currentLang, mode) },
    { category: "FENCE" as const, label: t("workzone.barriers", currentLang, mode) },
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

  const isSteel = isSteelSiteType(baustelle.type);
  if (isSteel) {
    const actor = await currentCompanyActor(currentCompanyId);
    // Bazë workers see the site on the board but cannot open it, unless the boss gave access here.
    if (currentWorker && !actor?.allows("site.view", baustelle.id)) return <NoAccessHere backHref="/workzone" />;
    const can = actor ? actor.at(baustelle.id) : crewPermissions(null);
    const isAdmin = can.office;
    const canSeeCosts = isAdmin || Boolean(actor?.allows("costs.view"));
    const canAdvance = can.factorySteps;
    const documentAccess=await withTenantContext(currentCompanyId,tx=>siteDocumentAccess(tx,{companyId:currentCompanyId,userId:currentAdmin&&!currentWorker?currentAdmin.id:null,workerId:currentWorker?.id??null},baustelle.id));
    const [batchRows, fileRows, elementRows, workerRows] = await withTenantContext(currentCompanyId, (tx) =>
      Promise.all([
        tx.productionBatch.findMany({
          where: { companyProfileId: currentCompanyId, baustelleId: baustelle.id },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            title: true,
            quantity: true,
            unit: true,
            steps: true,
            orderRef: true,
            events: { orderBy: { createdAt: "desc" }, take: 30, select: { id: true, action: true, stepKey: true, note: true, actorName: true, createdAt: true } },
          },
        }),
        tx.siteFile.findMany({
          // Prices and invoices never leave the server for non-office users.
          where: { companyProfileId: currentCompanyId, baustelleId: baustelle.id, ...(canSeeCosts ? {} : { officeOnly: false }) },
          orderBy: { createdAt: "desc" },
          select: { id: true, kind: true, fileName: true, mime: true, size: true, amount: true, currency: true, supplier: true, reference: true, uploadedByName: true, createdAt: true },
        }),
        tx.siteElement.findMany({
          where: { companyProfileId: currentCompanyId, baustelleId: baustelle.id },
          select: {
            id: true,
            list: true,
            mark: true,
            kind: true,
            profile: true,
            material: true,
            quantity: true,
            lengthMm: true,
            weightKg: true,
            areaM2: true,
            factoryDoneAt: true,
            factoryDoneBy: true,
            fieldDoneAt: true,
            fieldDoneBy: true,
            processRoutes: true,
            processRevision: true,
            work: { orderBy: { checkedAt: "asc" }, select: { id: true, stage: true, pieces: true, workerIds: true, workerNames: true, checkedByName: true, checkedAt: true } },
          },
        }),
        tx.worker.findMany({
          where: { companyProfileId: currentCompanyId, status: "active" },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          select: { id: true, firstName: true, lastName: true, crewRole: true },
        }),
      ]),
    );
    const batches: FactoryBatchView[] = batchRows.map((batch) => ({
      id: batch.id,
      title: batch.title,
      quantity: batch.quantity,
      unit: batch.unit,
      siteId: baustelle.id,
      siteName: baustelle.name,
      orderRef: batch.orderRef,
      steps: readFactorySteps(batch.steps),
      events: batch.events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
    }));
    const files: SiteFileView[] = fileRows.map((file) => ({ ...file, createdAt: file.createdAt.toISOString() }));
    const catalog = await getSteelWorkCatalogAction({ siteId: baustelle.id });
    const definitions = catalog.ok ? catalog.definitions ?? [] : [];
    const steelItems = await withTenantContext(currentCompanyId, tx => tx.treeItem.findMany({ where: { baustelleId: baustelle.id, baustelle: { companyProfileId: currentCompanyId } }, include: { steelTask: { include: { definition: true } } } }));
    const projected = projectSteelTasks(steelItems, elementRows.map(element => ({ ...element, list: element.list === 'part' ? 'part' as const : 'assembly' as const })));
    const phaseOrder = steelPhasesFor(baustelle.type).map(phase => phase.treeId);
    const steelPhases = projected.flatMap(item => {
      const key = steelPhaseKeyFromTreeId(item.treeId);
      if (!key) return [];
      const meta = readSteelPhaseMeta(item.notes), definition = item.steelTask?.definition;
      if (definition?.label) meta.label = definition.label;
      return [{ id: item.id, key, status: item.status as 'todo' | 'done' | 'blocked', meta,
        definitionId: definition?.id, automatic: item.automatic, percent: item.percent,
        completedPieces: item.completedPieces, requiredPieces: item.requiredPieces,
        order: definition?.sortOrder ?? phaseOrder.indexOf(item.treeId) }];
    }).sort((a, b) => (a.order < 0 ? 99 : a.order) - (b.order < 0 ? 99 : b.order)).map(({ order: _order, ...phase }) => phase);
    const steelPct = steelTaskTotals(steelPhases).pct;
    const elements: ElementView[] = elementRows
      .map((element) => ({
        ...element,
        list: element.list === "part" ? ("part" as const) : ("assembly" as const),
        factoryDoneAt: element.factoryDoneAt?.toISOString() ?? null,
        fieldDoneAt: element.fieldDoneAt?.toISOString() ?? null,
        work: element.work.map((work) => ({ ...work, checkedAt: work.checkedAt.toISOString() })),
      }))
      .sort((a, b) => (a.list === b.list ? compareMarks(a.mark, b.mark) : a.list === "assembly" ? -1 : 1));
    const elementWorkers: ElementWorkerOption[] = workerRows.map((worker) => ({
      id: worker.id,
      name: `${worker.firstName} ${worker.lastName}`.trim(),
      crewRole: worker.crewRole,
    }));
    const factoryView =
      factoryOutput(
        elementRows.filter((element) => element.list === "assembly").map((element) => ({ ...element, baustelleId: baustelle.id })),
        [{ id: baustelle.id, name: baustelle.name }],
      )[0] ?? null;
    const shape = steelSiteShape(baustelle.name, baustelle.description);

    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4 overflow-hidden">
        <div className="relative overflow-hidden rounded-3xl border bg-card">
          <div className="absolute inset-0"><AssetPhoto key={`${baustelle.id}:${baustelle.coverPhotoAt}`} kind="site" id={baustelle.id} src={assetPhotoUrl('site',baustelle.id,baustelle.coverPhotoAt)} alt={baustelle.name} canEdit={documentAccess.upload}><SteelSiteArt type={baustelle.type} shape={shape} pct={steelPct} live={activeWorkerIds.length > 0} fit="meet" className="absolute inset-0 h-full w-full" /></AssetPhoto></div>
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent sm:via-background/60" />
          <div className="relative flex min-h-[160px] flex-col justify-end gap-2 p-4 sm:min-h-[190px] sm:p-6">
            <Link className="w-fit text-xs text-muted-foreground hover:underline" href="/workzone">
              ← {t("workzone.siteListBack", currentLang, mode)}
            </Link>
            <h1 className="max-w-xl break-words text-2xl font-bold tracking-tight sm:text-3xl">{baustelle.name}</h1>
            {baustelle.address ? <p className="max-w-xl text-sm text-muted-foreground">{baustelle.address}</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              <SiteFilesButton
                site={{ id: baustelle.id, name: baustelle.name, address: baustelle.address ?? "", description: baustelle.description ?? "" }}
                files={files}
                isAdmin={isAdmin}
                canSeeCosts={canSeeCosts}
                canUpload={documentAccess.upload}
              />
              <PhaseDocumentsButton siteId={baustelle.id}/>
              <AccessKeyButton place="site" scopeId={baustelle.id} />
              <WorkingBadge workers={activeWorkerNames} />
            </div>
            {baustelle.type !== "STEEL_WORKSHOP" ? (
              <ElementListButtons
                site={{ id: baustelle.id, name: baustelle.name }}
                elements={elements}
                workers={elementWorkers}
                can={{ factory: can.factorySteps, field: can.siteSteps, office: isAdmin,upload:documentAccess.upload, seeFactory: isAdmin || Boolean(actor?.allows("factory.view", baustelle.id)), seeField: isAdmin || Boolean(actor?.allows("field.view", baustelle.id)) }}
                definitions={definitions}
              />
            ) : null}
          </div>
        </div>

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

        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <SteelPhaseBoard phases={steelPhases} definitions={definitions} canEdit={can.siteSteps} canReport={can.reportMissing} canManage={canManageSteelCatalog(can)} baustelleId={baustelle.id} />
          <div className="lg:sticky lg:top-4">
            {/* The factory here is only to look at: what it produced for this site, per process. */}
            {factoryView ? (
              <SiteFactoryView output={factoryView} processDefinitions={definitions.filter(definition => definition.kind === 'factory')} />
            ) : batches.length > 0 ? (
              <SiteProductionPanel site={{ id: baustelle.id, name: baustelle.name }} batches={batches} canAdvance={canAdvance} canManage={isAdmin} />
            ) : null}
          </div>
        </div>
      </div>
    );
  }

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
                    items={baustelle.treeItems}
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
                  items={baustelle.treeItems}
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
          {/* Rarely used forms stay folded so the work list stays the focus. */}
          <Card className="min-w-0 overflow-hidden">
            <CardContent className="space-y-2 pt-4">
              <details className="rounded-md border">
                <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium">{t("workzone.manualTaskTitle", currentLang, mode)}</summary>
                <div className="border-t p-3">
                  <ManualTaskForm baustelleId={baustelle.id} currentWorker={currentActorView} />
                </div>
              </details>
              <details className="rounded-md border">
                <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium">{t("workzone.externalWorkerTitle", currentLang, mode)}</summary>
                <div className="border-t p-3">
                  <p className="mb-3 text-sm text-muted-foreground">{t("workzone.externalWorkerDescription", currentLang, mode)}</p>
                  <ExternalWorkerForm baustelleId={baustelle.id} currentWorker={currentActorView} />
                </div>
              </details>
            </CardContent>
          </Card>

          {features.inventory ? <SafetyEquipmentPanel baustelleId={baustelle.id} rows={safetyRows} currentWorker={currentActorView} /> : null}

          {baustelle.manualTasks.length > 0 ? (
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>{t("workzone.recentTasksTitle", currentLang, mode)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
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
            </CardContent>
          </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
