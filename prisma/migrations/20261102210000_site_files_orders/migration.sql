-- AlterTable
ALTER TABLE "ProductionBatch" ADD COLUMN "orderRef" TEXT;

-- CreateTable
CREATE TABLE "SiteFile" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "baustelleId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "officeOnly" BOOLEAN NOT NULL DEFAULT false,
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "supplier" TEXT,
    "reference" TEXT,
    "uploadedByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteFile_companyProfileId_idx" ON "SiteFile"("companyProfileId");

-- CreateIndex
CREATE INDEX "SiteFile_baustelleId_kind_idx" ON "SiteFile"("baustelleId", "kind");

-- AddForeignKey
ALTER TABLE "SiteFile" ADD CONSTRAINT "SiteFile_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteFile" ADD CONSTRAINT "SiteFile_baustelleId_fkey" FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation (same pattern as the other tenant tables).
ALTER TABLE "SiteFile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_file_tenant ON "SiteFile" FOR ALL
  USING ("companyProfileId" = app_current_tenant_id())
  WITH CHECK ("companyProfileId" = app_current_tenant_id());
