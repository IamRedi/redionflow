-- AlterEnum
ALTER TYPE "TreeItemStatus" ADD VALUE 'blocked';

-- AlterTable
ALTER TABLE "TreeItem" ADD COLUMN     "notes" TEXT;
