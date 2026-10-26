-- CreateEnum
CREATE TYPE "WorkerAssetKind" AS ENUM ('CLOTHING', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "WorkerAssetStatus" AS ENUM ('PENDING_ADMIN_CONFIRMATION', 'PENDING_WORKER_CONFIRMATION', 'ACTIVE', 'PENDING_ADMIN_DELETE_CONFIRMATION', 'PENDING_WORKER_DELETE_CONFIRMATION', 'DELETED');

-- CreateEnum
CREATE TYPE "WorkerAssetActorRole" AS ENUM ('ADMIN', 'WORKER', 'SYSTEM');

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "emailAccount" TEXT;

-- CreateTable
CREATE TABLE "WorkerAssetItem" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "kind" "WorkerAssetKind" NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemCode" TEXT,
    "note" TEXT,
    "handedOverAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "WorkerAssetStatus" NOT NULL,
    "createdByRole" "WorkerAssetActorRole" NOT NULL,
    "createdByName" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByRole" "WorkerAssetActorRole",
    "confirmedByName" TEXT,
    "deleteRequestedAt" TIMESTAMP(3),
    "deleteRequestedByRole" "WorkerAssetActorRole",
    "deleteRequestedByName" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerAssetItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerAssetItem_workerId_kind_idx" ON "WorkerAssetItem"("workerId", "kind");

-- CreateIndex
CREATE INDEX "WorkerAssetItem_status_idx" ON "WorkerAssetItem"("status");

-- AddForeignKey
ALTER TABLE "WorkerAssetItem" ADD CONSTRAINT "WorkerAssetItem_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
