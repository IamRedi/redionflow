ALTER TABLE "SiteElementWork" ADD COLUMN "productionSnapshot" JSONB;
CREATE INDEX "SiteElementWork_companyProfileId_checkedAt_id_idx" ON "SiteElementWork"("companyProfileId", "checkedAt", "id");
