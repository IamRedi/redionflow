-- Finished pieces per element: a factory engineer may finish 2 of 4.
ALTER TABLE "SiteElement" ADD COLUMN "factoryDoneQty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SiteElement" ADD COLUMN "fieldDoneQty" INTEGER NOT NULL DEFAULT 0;
UPDATE "SiteElement" SET "factoryDoneQty" = "quantity" WHERE "factoryDoneAt" IS NOT NULL;
UPDATE "SiteElement" SET "fieldDoneQty" = "factoryDoneQty" WHERE "fieldDoneAt" IS NOT NULL;
