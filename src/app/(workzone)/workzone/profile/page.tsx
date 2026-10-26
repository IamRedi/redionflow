import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { ensureNotificationSettings } from "@/lib/notifications/notification-store";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { WorkerProfileView } from "./worker-profile-view";

export default async function WorkerProfilePage() {
  const worker = await getCurrentWorker();
  if (!worker || worker.status !== "active") redirect("/workzone/login");

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
  const vacationRequests = await prisma.vacationRequest.findMany({
    where: { workerId: worker.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const notificationSettings = await ensureNotificationSettings(worker.id);

  return (
    <WorkerProfileView
      worker={{ ...worker, vacationRequests, notificationSettings }}
      mode="worker"
      catalogItems={catalogItems}
      inventoryMovements={inventoryMovements}
    />
  );
}
