-- CreateEnum
CREATE TYPE "WorkerLevel" AS ENUM ('JUNIOR', 'WORKER', 'SENIOR', 'VORARBEITER', 'MEISTER');

-- AlterTable
ALTER TABLE "ManualTask" ADD COLUMN     "workerId" TEXT;

-- AlterTable
ALTER TABLE "TreeItem" ADD COLUMN     "completedByWorkerId" TEXT;

-- AlterTable
ALTER TABLE "WorkSession" ADD COLUMN     "baustelleId" TEXT;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "addedByWorkerId" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "isTemporary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "level" "WorkerLevel" NOT NULL DEFAULT 'JUNIOR',
ADD COLUMN     "startedAtCompany" TIMESTAMP(3),
ALTER COLUMN "loginCode" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ManualTask_workerId_idx" ON "ManualTask"("workerId");

-- CreateIndex
CREATE INDEX "WorkSession_baustelleId_idx" ON "WorkSession"("baustelleId");

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_addedByWorkerId_fkey" FOREIGN KEY ("addedByWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_baustelleId_fkey" FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeItem" ADD CONSTRAINT "TreeItem_completedByWorkerId_fkey" FOREIGN KEY ("completedByWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTask" ADD CONSTRAINT "ManualTask_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
