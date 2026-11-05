-- Additive only. No operational records, GPS ingest settings or tenant flags changed.
CREATE UNIQUE INDEX "Machine_companyProfileId_id_key" ON "Machine"("companyProfileId", "id");
CREATE TABLE "WanwayIntegration" (
  "companyProfileId" TEXT PRIMARY KEY REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "appid" TEXT, "encryptedKey" TEXT, "encryptedToken" TEXT, "tokenExpiresAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'disconnected', "lastSuccessfulSync" TIMESTAMP(3), "lastError" TEXT,
  "nextRequestAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "busyUntil" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "operationId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "WanwayDevice" (
  "id" TEXT PRIMARY KEY, "companyProfileId" TEXT NOT NULL REFERENCES "WanwayIntegration"("companyProfileId") ON DELETE CASCADE ON UPDATE CASCADE,
  "imei" TEXT NOT NULL, "name" TEXT NOT NULL, "model" TEXT, "machineId" TEXT,
  "available" BOOLEAN NOT NULL DEFAULT true, "plate" TEXT,
  "lat" DOUBLE PRECISION, "lng" DOUBLE PRECISION, "reportedAt" TIMESTAMP(3), "signalAt" TIMESTAMP(3),
  "providerStatus" TEXT, "speedKmh" DOUBLE PRECISION, "voltage" DOUBLE PRECISION,
  "mileage24hKm" DOUBLE PRECISION, "mileageAt" TIMESTAMP(3), "mileageError" TEXT, "syncedAt" TIMESTAMP(3),
  CONSTRAINT "WanwayDevice_machine_tenant_fkey" FOREIGN KEY ("companyProfileId", "machineId") REFERENCES "Machine"("companyProfileId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WanwayDevice_companyProfileId_imei_key" ON "WanwayDevice"("companyProfileId", "imei");
CREATE UNIQUE INDEX "WanwayDevice_companyProfileId_machineId_key" ON "WanwayDevice"("companyProfileId", "machineId");
-- Same tenant context contract as existing tenant-owned tables; no policy widening.
ALTER TABLE "WanwayIntegration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WanwayIntegration" FORCE ROW LEVEL SECURITY;
CREATE POLICY wanway_integration_tenant ON "WanwayIntegration" USING ("companyProfileId" = app_current_tenant_id()) WITH CHECK ("companyProfileId" = app_current_tenant_id());
ALTER TABLE "WanwayDevice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WanwayDevice" FORCE ROW LEVEL SECURITY;
CREATE POLICY wanway_device_tenant ON "WanwayDevice" USING ("companyProfileId" = app_current_tenant_id()) WITH CHECK ("companyProfileId" = app_current_tenant_id());
