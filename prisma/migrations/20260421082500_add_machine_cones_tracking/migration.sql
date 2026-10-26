-- CreateEnum
CREATE TYPE "MachineConeMovementType" AS ENUM ('DEPLOY', 'COLLECT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "MachineConeActorRole" AS ENUM ('ADMIN', 'WORKER', 'SYSTEM');

-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "coneTotal" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MachineConeMovement" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "type" "MachineConeMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "fromMachineId" TEXT,
    "toMachineId" TEXT,
    "baustelleId" TEXT,
    "treeItemId" TEXT,
    "actorRole" "MachineConeActorRole" NOT NULL,
    "actorWorkerId" TEXT,
    "actorAdminId" TEXT,
    "actorName" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineConeMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MachineConeMovement_companyProfileId_createdAt_idx" ON "MachineConeMovement"("companyProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "MachineConeMovement_fromMachineId_createdAt_idx" ON "MachineConeMovement"("fromMachineId", "createdAt");

-- CreateIndex
CREATE INDEX "MachineConeMovement_toMachineId_createdAt_idx" ON "MachineConeMovement"("toMachineId", "createdAt");

-- CreateIndex
CREATE INDEX "MachineConeMovement_baustelleId_createdAt_idx" ON "MachineConeMovement"("baustelleId", "createdAt");

-- CreateIndex
CREATE INDEX "MachineConeMovement_treeItemId_createdAt_idx" ON "MachineConeMovement"("treeItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "MachineConeMovement" ADD CONSTRAINT "MachineConeMovement_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineConeMovement" ADD CONSTRAINT "MachineConeMovement_fromMachineId_fkey" FOREIGN KEY ("fromMachineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineConeMovement" ADD CONSTRAINT "MachineConeMovement_toMachineId_fkey" FOREIGN KEY ("toMachineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineConeMovement" ADD CONSTRAINT "MachineConeMovement_baustelleId_fkey" FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineConeMovement" ADD CONSTRAINT "MachineConeMovement_treeItemId_fkey" FOREIGN KEY ("treeItemId") REFERENCES "TreeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineConeMovement" ADD CONSTRAINT "MachineConeMovement_actorWorkerId_fkey" FOREIGN KEY ("actorWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineConeMovement" ADD CONSTRAINT "MachineConeMovement_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
