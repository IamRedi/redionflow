-- CreateEnum
CREATE TYPE "SiteEquipmentCategory" AS ENUM ('SIGN', 'PLATE', 'FENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('DEPLOY', 'COLLECT');

-- AlterTable
ALTER TABLE "Baustelle" ADD COLUMN     "activeEquipmentStatus" JSONB;

-- CreateTable
CREATE TABLE "CompanyInventoryCatalog" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SiteEquipmentCategory" NOT NULL,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyInventoryCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "baustelleId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "category" "SiteEquipmentCategory" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyInventoryCatalog_companyProfileId_isActive_idx" ON "CompanyInventoryCatalog"("companyProfileId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInventoryCatalog_companyProfileId_category_key" ON "CompanyInventoryCatalog"("companyProfileId", "category");

-- CreateIndex
CREATE INDEX "InventoryMovement_companyProfileId_timestamp_idx" ON "InventoryMovement"("companyProfileId", "timestamp");

-- CreateIndex
CREATE INDEX "InventoryMovement_baustelleId_timestamp_idx" ON "InventoryMovement"("baustelleId", "timestamp");

-- CreateIndex
CREATE INDEX "InventoryMovement_workerId_timestamp_idx" ON "InventoryMovement"("workerId", "timestamp");

-- AddForeignKey
ALTER TABLE "CompanyInventoryCatalog" ADD CONSTRAINT "CompanyInventoryCatalog_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_baustelleId_fkey" FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
