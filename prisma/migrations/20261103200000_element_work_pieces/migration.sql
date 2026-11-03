-- Pieces are counted per step: several entries per step, each with its pieces.
ALTER TABLE "SiteElementWork" ADD COLUMN "pieces" INTEGER NOT NULL DEFAULT 0;
DROP INDEX IF EXISTS "SiteElementWork_elementId_stage_key";
CREATE INDEX "SiteElementWork_elementId_stage_idx" ON "SiteElementWork"("elementId", "stage");
ALTER TABLE "SiteElement" DROP COLUMN "factoryDoneQty";
ALTER TABLE "SiteElement" DROP COLUMN "fieldDoneQty";
