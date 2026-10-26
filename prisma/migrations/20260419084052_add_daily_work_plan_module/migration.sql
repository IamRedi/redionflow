-- CreateEnum
CREATE TYPE "DailyPlanAssignmentKind" AS ENUM ('WORKER', 'MACHINE');

-- CreateTable
CREATE TABLE "DailyWorkPlan" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "planDate" TIMESTAMP(3) NOT NULL,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWorkPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWorkPlanColumn" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "baustelleId" TEXT,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWorkPlanColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWorkPlanAssignment" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "kind" "DailyPlanAssignmentKind" NOT NULL,
    "workerId" TEXT,
    "machineId" TEXT,
    "labelSnapshot" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWorkPlanAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyWorkPlan_planDate_idx" ON "DailyWorkPlan"("planDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWorkPlan_companyProfileId_planDate_key" ON "DailyWorkPlan"("companyProfileId", "planDate");

-- CreateIndex
CREATE INDEX "DailyWorkPlanColumn_planId_sortOrder_idx" ON "DailyWorkPlanColumn"("planId", "sortOrder");

-- CreateIndex
CREATE INDEX "DailyWorkPlanColumn_baustelleId_idx" ON "DailyWorkPlanColumn"("baustelleId");

-- CreateIndex
CREATE INDEX "DailyWorkPlanAssignment_columnId_sortOrder_idx" ON "DailyWorkPlanAssignment"("columnId", "sortOrder");

-- CreateIndex
CREATE INDEX "DailyWorkPlanAssignment_workerId_idx" ON "DailyWorkPlanAssignment"("workerId");

-- CreateIndex
CREATE INDEX "DailyWorkPlanAssignment_machineId_idx" ON "DailyWorkPlanAssignment"("machineId");

-- AddForeignKey
ALTER TABLE "DailyWorkPlan" ADD CONSTRAINT "DailyWorkPlan_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkPlan" ADD CONSTRAINT "DailyWorkPlan_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkPlanColumn" ADD CONSTRAINT "DailyWorkPlanColumn_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DailyWorkPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkPlanColumn" ADD CONSTRAINT "DailyWorkPlanColumn_baustelleId_fkey" FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkPlanAssignment" ADD CONSTRAINT "DailyWorkPlanAssignment_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "DailyWorkPlanColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkPlanAssignment" ADD CONSTRAINT "DailyWorkPlanAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkPlanAssignment" ADD CONSTRAINT "DailyWorkPlanAssignment_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
