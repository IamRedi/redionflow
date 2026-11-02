-- CreateTable
CREATE TABLE "ProductionBatch" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "baustelleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT 't',
    "steps" JSONB NOT NULL,
    "readyAt" TIMESTAMP(3),
    "createdByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionEvent" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "stepKey" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "actorName" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorWorkerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionBatch_companyProfileId_idx" ON "ProductionBatch"("companyProfileId");

-- CreateIndex
CREATE INDEX "ProductionBatch_baustelleId_idx" ON "ProductionBatch"("baustelleId");

-- CreateIndex
CREATE INDEX "ProductionEvent_batchId_idx" ON "ProductionEvent"("batchId");

-- CreateIndex
CREATE INDEX "ProductionEvent_companyProfileId_idx" ON "ProductionEvent"("companyProfileId");

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_baustelleId_fkey" FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tenant isolation as a second line of defence (same pattern as the other
-- tenant tables): rows are visible only inside the matching tenant context.
ALTER TABLE "ProductionBatch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY production_batch_tenant ON "ProductionBatch" FOR ALL
  USING ("companyProfileId" = app_current_tenant_id())
  WITH CHECK ("companyProfileId" = app_current_tenant_id());
ALTER TABLE "ProductionEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY production_event_tenant ON "ProductionEvent" FOR ALL
  USING ("companyProfileId" = app_current_tenant_id())
  WITH CHECK ("companyProfileId" = app_current_tenant_id());
