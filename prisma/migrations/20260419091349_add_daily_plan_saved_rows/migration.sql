-- CreateTable
CREATE TABLE "DailyWorkPlanSavedRow" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "workerNames" TEXT NOT NULL,
    "machineNames" TEXT NOT NULL,
    "baustelleName" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWorkPlanSavedRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyWorkPlanSavedRow_planId_sortOrder_idx" ON "DailyWorkPlanSavedRow"("planId", "sortOrder");

-- AddForeignKey
ALTER TABLE "DailyWorkPlanSavedRow" ADD CONSTRAINT "DailyWorkPlanSavedRow_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DailyWorkPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
