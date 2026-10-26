-- CreateEnum
CREATE TYPE "CompanyInventoryCategory" AS ENUM ('WORK_TOOL', 'CLOTHING', 'SITE_EQUIPMENT');

-- AlterTable
ALTER TABLE "WorkerAssetItem" ADD COLUMN     "companyInventoryItemId" TEXT;

-- CreateTable
CREATE TABLE "CompanyInventoryItem" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "category" "CompanyInventoryCategory" NOT NULL,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyInventoryItem_companyProfileId_category_idx" ON "CompanyInventoryItem"("companyProfileId", "category");

-- CreateIndex
CREATE INDEX "CompanyInventoryItem_isActive_idx" ON "CompanyInventoryItem"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInventoryItem_companyProfileId_itemCode_key" ON "CompanyInventoryItem"("companyProfileId", "itemCode");

-- CreateIndex
CREATE INDEX "WorkerAssetItem_companyInventoryItemId_idx" ON "WorkerAssetItem"("companyInventoryItemId");

-- AddForeignKey
ALTER TABLE "CompanyInventoryItem" ADD CONSTRAINT "CompanyInventoryItem_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssetItem" ADD CONSTRAINT "WorkerAssetItem_companyInventoryItemId_fkey" FOREIGN KEY ("companyInventoryItemId") REFERENCES "CompanyInventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
