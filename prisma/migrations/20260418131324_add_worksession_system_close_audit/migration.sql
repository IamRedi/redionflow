-- AlterTable
ALTER TABLE "WorkSession" ADD COLUMN     "closedBySystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "systemNote" TEXT;
