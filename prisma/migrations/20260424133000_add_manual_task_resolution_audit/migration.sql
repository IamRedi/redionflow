-- AlterTable
ALTER TABLE "ManualTask"
ADD COLUMN "resolvedByUserId" TEXT,
ADD COLUMN "resolvedByWorkerId" TEXT,
ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ManualTask_resolvedByUserId_idx" ON "ManualTask"("resolvedByUserId");

-- CreateIndex
CREATE INDEX "ManualTask_resolvedByWorkerId_idx" ON "ManualTask"("resolvedByWorkerId");

-- CreateIndex
CREATE INDEX "ManualTask_resolvedAt_idx" ON "ManualTask"("resolvedAt");

-- AddForeignKey
ALTER TABLE "ManualTask"
ADD CONSTRAINT "ManualTask_resolvedByUserId_fkey"
FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTask"
ADD CONSTRAINT "ManualTask_resolvedByWorkerId_fkey"
FOREIGN KEY ("resolvedByWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
