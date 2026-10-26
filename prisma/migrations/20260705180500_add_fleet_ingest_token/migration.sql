-- T-034: per-tenant fleet GPS ingest token.

CREATE TABLE "FleetIngestToken" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetIngestToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FleetIngestToken_token_key" ON "FleetIngestToken"("token");
CREATE INDEX "FleetIngestToken_companyProfileId_isActive_idx"
  ON "FleetIngestToken"("companyProfileId", "isActive");
