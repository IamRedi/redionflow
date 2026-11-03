-- AlterTable
ALTER TABLE "SiteElement" ADD COLUMN "factoryDoneAt" TIMESTAMP(3),
ADD COLUMN "factoryDoneBy" TEXT,
ADD COLUMN "fieldDoneAt" TIMESTAMP(3),
ADD COLUMN "fieldDoneBy" TEXT;
