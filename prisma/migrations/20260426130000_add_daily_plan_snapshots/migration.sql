-- CreateTable
CREATE TABLE "DailyWorkPlanSnapshot" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyWorkPlanSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWorkPlanSnapshotRow" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "workerNames" TEXT NOT NULL,
    "machineNames" TEXT NOT NULL,
    "baustelleName" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWorkPlanSnapshotRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyWorkPlanSnapshot_planId_versionNumber_key" ON "DailyWorkPlanSnapshot"("planId", "versionNumber");

-- CreateIndex
CREATE INDEX "DailyWorkPlanSnapshot_planId_createdAt_idx" ON "DailyWorkPlanSnapshot"("planId", "createdAt");

-- CreateIndex
CREATE INDEX "DailyWorkPlanSnapshotRow_snapshotId_sortOrder_idx" ON "DailyWorkPlanSnapshotRow"("snapshotId", "sortOrder");

-- AddForeignKey
ALTER TABLE "DailyWorkPlanSnapshot" ADD CONSTRAINT "DailyWorkPlanSnapshot_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DailyWorkPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkPlanSnapshot" ADD CONSTRAINT "DailyWorkPlanSnapshot_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkPlanSnapshotRow" ADD CONSTRAINT "DailyWorkPlanSnapshotRow_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "DailyWorkPlanSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
