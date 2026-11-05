CREATE TABLE "FuelReceipt" (
  "id" TEXT PRIMARY KEY,
  "companyProfileId" TEXT NOT NULL REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "machineId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "uploadedByUserId" TEXT, "uploadedByWorkerId" TEXT, "uploadedByName" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3), "fueledAt" TIMESTAMP(3), "timeZone" TEXT NOT NULL,
  "fueledByWorkerId" TEXT, "fueledByUserId" TEXT, "fueledByName" TEXT,
  "receiptTime" TEXT, "timeSource" TEXT, "stationAddress" TEXT,
  "liters" DOUBLE PRECISION, "amount" DOUBLE PRECISION, "currency" TEXT NOT NULL,
  "fileName" TEXT NOT NULL, "mime" TEXT NOT NULL, "size" INTEGER NOT NULL, "data" BYTEA NOT NULL, "sha256" TEXT NOT NULL,
  "gpsStatus" TEXT NOT NULL DEFAULT 'pending', "gpsDeviceId" TEXT, "gpsLat" DOUBLE PRECISION, "gpsLng" DOUBLE PRECISION,
  "gpsRecordedAt" TIMESTAMP(3), "gpsDeltaSeconds" INTEGER, "gpsSource" TEXT, "gpsEvidence" JSONB, "gpsResolvedAt" TIMESTAMP(3),
  CONSTRAINT "FuelReceipt_machine_tenant_fkey" FOREIGN KEY ("companyProfileId", "machineId") REFERENCES "Machine"("companyProfileId", "id") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "FuelReceipt_actor_check" CHECK (("uploadedByUserId" IS NOT NULL)::int + ("uploadedByWorkerId" IS NOT NULL)::int = 1),
  CONSTRAINT "FuelReceipt_time_check" CHECK (("confirmedAt" IS NULL AND "fueledAt" IS NULL) OR ("confirmedAt" IS NOT NULL AND "fueledAt" IS NOT NULL AND "fueledByName" IS NOT NULL AND ("fueledByUserId" IS NOT NULL)::int + ("fueledByWorkerId" IS NOT NULL)::int = 1)),
  CONSTRAINT "FuelReceipt_size_check" CHECK ("size" > 0 AND "size" <= 8000000)
);
CREATE UNIQUE INDEX "FuelReceipt_companyProfileId_requestId_key" ON "FuelReceipt"("companyProfileId", "requestId");
CREATE INDEX "FuelReceipt_companyProfileId_machineId_uploadedAt_idx" ON "FuelReceipt"("companyProfileId", "machineId", "uploadedAt");
ALTER TABLE "FuelReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FuelReceipt" FORCE ROW LEVEL SECURITY;
CREATE POLICY fuel_receipt_tenant ON "FuelReceipt" USING ("companyProfileId" = app_current_tenant_id()) WITH CHECK ("companyProfileId" = app_current_tenant_id());
