ALTER TABLE "Machine" ADD COLUMN "coverPhotoAt" TIMESTAMP(3);
ALTER TABLE "Baustelle" ADD COLUMN "coverPhotoAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Baustelle_companyProfileId_id_key" ON "Baustelle"("companyProfileId","id");
CREATE TABLE "AssetPhoto" (
  "id" TEXT PRIMARY KEY,
  "companyProfileId" TEXT NOT NULL REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "machineId" TEXT, "baustelleId" TEXT,
  "data" BYTEA NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetPhoto_target_check" CHECK (("machineId" IS NOT NULL)::int + ("baustelleId" IS NOT NULL)::int = 1),
  CONSTRAINT "AssetPhoto_size_check" CHECK (octet_length("data") > 0 AND octet_length("data") <= 180000),
  CONSTRAINT "AssetPhoto_machine_tenant_fkey" FOREIGN KEY ("companyProfileId","machineId") REFERENCES "Machine"("companyProfileId","id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AssetPhoto_site_tenant_fkey" FOREIGN KEY ("companyProfileId","baustelleId") REFERENCES "Baustelle"("companyProfileId","id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AssetPhoto_companyProfileId_machineId_key" ON "AssetPhoto"("companyProfileId","machineId");
CREATE UNIQUE INDEX "AssetPhoto_companyProfileId_baustelleId_key" ON "AssetPhoto"("companyProfileId","baustelleId");
ALTER TABLE "AssetPhoto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssetPhoto" FORCE ROW LEVEL SECURITY;
CREATE POLICY asset_photo_tenant ON "AssetPhoto" USING ("companyProfileId" = app_current_tenant_id()) WITH CHECK ("companyProfileId" = app_current_tenant_id());
