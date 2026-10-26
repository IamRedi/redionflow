-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('active', 'inactive');

-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "auDate" TIMESTAMP(3),
ADD COLUMN     "funksioni" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "patentaEnevojshme" TEXT,
ADD COLUMN     "targe" TEXT,
ADD COLUMN     "tuvDate" TIMESTAMP(3),
ADD COLUMN     "vitiBlerjes" INTEGER,
ADD COLUMN     "vitiProdhimit" INTEGER;

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "position" TEXT,
    "licenses" TEXT,
    "status" "WorkerStatus" NOT NULL DEFAULT 'active',
    "loginCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSession" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "breakMinutes" INTEGER NOT NULL DEFAULT 30,
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Worker_loginCode_key" ON "Worker"("loginCode");

-- CreateIndex
CREATE INDEX "Worker_companyProfileId_idx" ON "Worker"("companyProfileId");

-- CreateIndex
CREATE INDEX "Worker_status_idx" ON "Worker"("status");

-- CreateIndex
CREATE INDEX "WorkSession_workerId_startTime_idx" ON "WorkSession"("workerId", "startTime");

-- CreateIndex
CREATE INDEX "WorkSession_isLive_idx" ON "WorkSession"("isLive");

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
