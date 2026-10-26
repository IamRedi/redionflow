-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "treeItemId" TEXT;

-- AlterTable
ALTER TABLE "TreeItem" ADD COLUMN     "siteEquipmentStatus" JSONB;

-- CreateIndex
CREATE INDEX "InventoryMovement_treeItemId_timestamp_idx" ON "InventoryMovement"("treeItemId", "timestamp");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_treeItemId_fkey" FOREIGN KEY ("treeItemId") REFERENCES "TreeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
