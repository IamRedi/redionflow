-- DropIndex
DROP INDEX "Machine_companyProfileId_gpsEnabled_lastGpsAt_idx";

-- CreateTable
CREATE TABLE "WorkzoneSyncAction" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "outcome" TEXT NOT NULL,
    "outcomeMsg" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkzoneSyncAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkzoneSyncAction_companyProfileId_processedAt_idx" ON "WorkzoneSyncAction"("companyProfileId", "processedAt");

-- CreateIndex
CREATE INDEX "WorkzoneSyncAction_actorId_processedAt_idx" ON "WorkzoneSyncAction"("actorId", "processedAt");

-- CreateIndex
CREATE INDEX "WorkzoneSyncAction_actionType_entityId_idx" ON "WorkzoneSyncAction"("actionType", "entityId");

-- AddForeignKey
ALTER TABLE "WorkzoneSyncAction" ADD CONSTRAINT "WorkzoneSyncAction_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
