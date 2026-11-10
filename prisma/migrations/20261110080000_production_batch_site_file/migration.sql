-- Link factory batches to the order document they were imported from.
ALTER TABLE "ProductionBatch" ADD COLUMN "siteFileId" TEXT;
CREATE INDEX "ProductionBatch_siteFileId_idx" ON "ProductionBatch"("siteFileId");
