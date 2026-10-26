import { notFound } from "next/navigation";

import { DemoReadonlyBadge } from "@/components/demo/demo-readonly-badge";
import { DemoWorkerProfileView } from "@/components/demo/demo-worker-profile";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";

export default async function DemoWorkerProfilePage({ params }: { params: Promise<{ workerId: string }> }) {
  const company = await getOrCreateDefaultCompany();
  const { workerId } = await params;
  const worker = await prisma.worker.findFirst({
    where: { id: workerId, companyProfileId: company.id },
    include: {
      sessions: {
        include: { baustelle: { select: { id: true, name: true } } },
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

  const inventoryMovements = await prisma.inventoryAssetMovement.findMany({
    where: { companyProfileId: worker.companyProfileId, workerId: worker.id },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { item: { select: { id: true, name: true, itemCode: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DemoReadonlyBadge />
      </div>
      <DemoWorkerProfileView worker={{ ...worker, inventoryMovements }} />
    </div>
  );
}
