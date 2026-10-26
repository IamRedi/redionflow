-- Add clothing sizes to inventory items and worker profiles
ALTER TABLE "CompanyInventoryItem"
ADD COLUMN "sizeLabel" TEXT;

ALTER TABLE "WorkerAssetItem"
ADD COLUMN "sizeLabel" TEXT;

ALTER TABLE "Worker"
ADD COLUMN "clothingTopSize" TEXT,
ADD COLUMN "clothingBottomSize" TEXT,
ADD COLUMN "shoeSize" TEXT;
