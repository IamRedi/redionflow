-- CreateTable
CREATE TABLE "SiteElement" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "baustelleId" TEXT NOT NULL,
    "list" TEXT NOT NULL,
    "mark" TEXT NOT NULL,
    "kind" TEXT,
    "profile" TEXT,
    "material" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lengthMm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "areaM2" DOUBLE PRECISION,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "sourceFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteElementWork" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "workerIds" TEXT[],
    "workerNames" TEXT NOT NULL DEFAULT '',
    "checkedByName" TEXT NOT NULL,
    "checkedByUserId" TEXT,
    "checkedByWorkerId" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteElementWork_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteElement_companyProfileId_idx" ON "SiteElement"("companyProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteElement_baustelleId_list_mark_key" ON "SiteElement"("baustelleId", "list", "mark");

-- CreateIndex
CREATE INDEX "SiteElementWork_companyProfileId_idx" ON "SiteElementWork"("companyProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteElementWork_elementId_stage_key" ON "SiteElementWork"("elementId", "stage");

-- AddForeignKey
ALTER TABLE "SiteElement" ADD CONSTRAINT "SiteElement_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteElement" ADD CONSTRAINT "SiteElement_baustelleId_fkey" FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteElementWork" ADD CONSTRAINT "SiteElementWork_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteElementWork" ADD CONSTRAINT "SiteElementWork_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "SiteElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tenant isolation (same pattern as the other tenant tables).
ALTER TABLE "SiteElement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_element_tenant ON "SiteElement" FOR ALL
  USING ("companyProfileId" = app_current_tenant_id())
  WITH CHECK ("companyProfileId" = app_current_tenant_id());
ALTER TABLE "SiteElementWork" ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_element_work_tenant ON "SiteElementWork" FOR ALL
  USING ("companyProfileId" = app_current_tenant_id())
  WITH CHECK ("companyProfileId" = app_current_tenant_id());
