ALTER TABLE "CompanyInventoryItem"
  ADD COLUMN "barcode" TEXT;

ALTER TABLE "WorkerAssetItem"
  ADD COLUMN "barcode" TEXT,
  ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "CompanyInventoryItem_barcode_key" ON "CompanyInventoryItem"("barcode");
CREATE INDEX "WorkerAssetItem_barcode_idx" ON "WorkerAssetItem"("barcode");

CREATE TABLE "InventoryAssetMovement" (
  "id" TEXT NOT NULL,
  "companyProfileId" TEXT NOT NULL,
  "itemId" TEXT,
  "workerId" TEXT,
  "actorAdminId" TEXT,
  "action" TEXT NOT NULL,
  "actorRole" TEXT,
  "actorName" TEXT,
  "barcode" TEXT,
  "isPrivate" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryAssetMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryAssetMovement_companyProfileId_createdAt_idx" ON "InventoryAssetMovement"("companyProfileId", "createdAt");
CREATE INDEX "InventoryAssetMovement_itemId_createdAt_idx" ON "InventoryAssetMovement"("itemId", "createdAt");
CREATE INDEX "InventoryAssetMovement_workerId_createdAt_idx" ON "InventoryAssetMovement"("workerId", "createdAt");
CREATE INDEX "InventoryAssetMovement_actorAdminId_createdAt_idx" ON "InventoryAssetMovement"("actorAdminId", "createdAt");
CREATE INDEX "InventoryAssetMovement_barcode_createdAt_idx" ON "InventoryAssetMovement"("barcode", "createdAt");

ALTER TABLE "InventoryAssetMovement"
  ADD CONSTRAINT "InventoryAssetMovement_companyProfileId_fkey"
  FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryAssetMovement"
  ADD CONSTRAINT "InventoryAssetMovement_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "CompanyInventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryAssetMovement"
  ADD CONSTRAINT "InventoryAssetMovement_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryAssetMovement"
  ADD CONSTRAINT "InventoryAssetMovement_actorAdminId_fkey"
  FOREIGN KEY ("actorAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
