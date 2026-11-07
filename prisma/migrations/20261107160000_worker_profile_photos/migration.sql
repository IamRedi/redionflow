-- Extend the existing bounded, tenant-private photo store. Existing photos stay intact.
ALTER TABLE "AssetPhoto" ADD COLUMN "workerId" TEXT;
ALTER TABLE "AssetPhoto" DROP CONSTRAINT "AssetPhoto_target_check";
ALTER TABLE "AssetPhoto" ADD CONSTRAINT "AssetPhoto_target_check"
  CHECK (num_nonnulls("machineId", "baustelleId", "workerId") = 1);
ALTER TABLE "AssetPhoto" ADD CONSTRAINT "AssetPhoto_worker_tenant_fkey"
  FOREIGN KEY ("companyProfileId", "workerId") REFERENCES "Worker"("companyProfileId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "AssetPhoto_companyProfileId_workerId_key" ON "AssetPhoto"("companyProfileId", "workerId");
