import { notFound, redirect } from "next/navigation";

import { WorkerProfileView } from "@/app/(workzone)/workzone/profile/worker-profile-view";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentCompanyId } from "@/lib/db/tenant";
import { ensureNotificationSettings } from "@/lib/notifications/notification-store";
import { findPauseIntervalsForSessions } from "@/lib/workzone/pause-interval-store";

export default async function WorkzoneAdminWorkerProfilePage({ params }: { params: Promise<{ workerId: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin-login");
  const companyProfileId = await requireCurrentCompanyId();

  const { workerId } = await params;
  const worker = await prisma.worker.findFirst({
    where: { id: workerId, companyProfileId },
    include: {
      sessions: {
        include: {
          baustelle: { select: { name: true } },
        },
        orderBy: { startTime: "desc" },
        take: 80,
      },
      assetItems: {
        where: { status: { not: "DELETED" } },
        orderBy: { createdAt: "desc" },
      },
      vacationRequests: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!worker) notFound();
  const pauseBySessionId = await findPauseIntervalsForSessions(worker.sessions.map((session) => session.id));
  const workerWithPauses = {
    ...worker,
    sessions: worker.sessions.map((session) => ({
      ...session,
      pauseIntervals: pauseBySessionId.get(session.id) ?? [],
    })),
  };

  const [catalogRows, activeAssignments] = await Promise.all([
    prisma.companyInventoryItem.findMany({
      where: { companyProfileId: worker.companyProfileId, isActive: true },
      orderBy: [{ category: "asc" }, { itemCode: "asc" }],
    }),
    prisma.workerAssetItem.findMany({
      where: {
        status: { not: "DELETED" },
        companyInventoryItemId: { not: null },
        worker: { companyProfileId: worker.companyProfileId },
      },
      include: {
        worker: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const assignmentByItemId = new Map<string, (typeof activeAssignments)[number]>();
  for (const assignment of activeAssignments) {
    const itemId = assignment.companyInventoryItemId;
    if (itemId && !assignmentByItemId.has(itemId)) assignmentByItemId.set(itemId, assignment);
  }
  const catalogItems = catalogRows.map((item) => {
    const assignment = assignmentByItemId.get(item.id);
    return {
      ...item,
      assignedWorkerId: assignment?.worker.id ?? null,
      assignedWorkerName: assignment ? `${assignment.worker.firstName} ${assignment.worker.lastName}`.trim() : null,
    };
  });
  const inventoryMovements = await prisma.inventoryAssetMovement.findMany({
    where: { companyProfileId: worker.companyProfileId, workerId: worker.id },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { item: { select: { id: true, name: true, itemCode: true } } },
  });
  const notificationSettings = await ensureNotificationSettings(worker.id);

  return (
    <WorkerProfileView
      worker={{ ...workerWithPauses, notificationSettings }}
      mode="admin"
      backHref="/app/admin"
      catalogItems={catalogItems}
      inventoryMovements={inventoryMovements}
    />
  );
}
