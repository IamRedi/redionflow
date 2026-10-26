-- CreateEnum
CREATE TYPE "WorkerAvailability" AS ENUM ('AVAILABLE', 'SICK', 'VACATION', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "WorkReportType" AS ENUM ('DAILY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "availability" "WorkerAvailability" NOT NULL DEFAULT 'AVAILABLE';

-- CreateTable
CREATE TABLE "WorkReportNote" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "type" "WorkReportType" NOT NULL,
    "periodKey" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkReportNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkReportNote_workerId_type_idx" ON "WorkReportNote"("workerId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "WorkReportNote_workerId_type_periodKey_key" ON "WorkReportNote"("workerId", "type", "periodKey");

-- CreateIndex
CREATE INDEX "Worker_availability_idx" ON "Worker"("availability");

-- AddForeignKey
ALTER TABLE "WorkReportNote" ADD CONSTRAINT "WorkReportNote_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
