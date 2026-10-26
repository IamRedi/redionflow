-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'SENT', 'ACCEPTED', 'LOST', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WageType" AS ENUM ('HOURLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "MachineCategory" AS ENUM ('CHIPPER', 'TRUCK', 'AWP', 'CHAINSAW', 'OTHER');

-- CreateEnum
CREATE TYPE "OverheadBase" AS ENUM ('EK_TOTAL', 'LABOR_ONLY');

-- CreateEnum
CREATE TYPE "RiskProfitMode" AS ENUM ('SEPARATE', 'COMBINED');

-- CreateEnum
CREATE TYPE "MachineTimeUnit" AS ENUM ('HOURS', 'DAYS');

-- CreateEnum
CREATE TYPE "BaustelleStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "TreeItemStatus" AS ENUM ('todo', 'done');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "vatId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "street" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverheadSettings" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "bgkPct" DECIMAL(7,4) NOT NULL DEFAULT 0.15,
    "agkPct" DECIMAL(7,4) NOT NULL DEFAULT 0.10,
    "riskPct" DECIMAL(7,4) NOT NULL DEFAULT 0.03,
    "profitPct" DECIMAL(7,4) NOT NULL DEFAULT 0.05,
    "vatPct" DECIMAL(7,4) NOT NULL DEFAULT 0.19,
    "bgkBase" "OverheadBase" NOT NULL DEFAULT 'EK_TOTAL',
    "riskProfitMode" "RiskProfitMode" NOT NULL DEFAULT 'SEPARATE',
    "applyVatByDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OverheadSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborRole" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wageType" "WageType" NOT NULL DEFAULT 'HOURLY',
    "grossHourlyCents" INTEGER,
    "grossMonthlyCents" INTEGER,
    "employerOverheadPct" DECIMAL(7,4) NOT NULL DEFAULT 0.25,
    "productivityPct" DECIMAL(7,4) NOT NULL DEFAULT 0.85,
    "absencePct" DECIMAL(7,4) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaborRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "MachineCategory" NOT NULL DEFAULT 'OTHER',
    "hourlyRateCents" INTEGER NOT NULL,
    "dayRateCents" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Baustelle" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BaustelleStatus" NOT NULL DEFAULT 'active',
    "description" TEXT,
    "documents" TEXT[],
    "coordinates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Baustelle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreeItem" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "baustelleId" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "diameter" INTEGER NOT NULL,
    "coordinates" JSONB,
    "status" "TreeItemStatus" NOT NULL DEFAULT 'todo',
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "baustelleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "breakMinutes" INTEGER NOT NULL DEFAULT 30,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualTask" (
    "id" TEXT NOT NULL,
    "baustelleId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isFlagged" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ManualTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculationTemplate" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalculationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplatePositionPreset" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'pauschal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplatePositionPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerStreet" TEXT,
    "customerZip" TEXT,
    "customerCity" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPosition" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'pauschal',
    "notes" TEXT,
    "manualAdjustmentCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionLaborItem" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "laborRoleId" TEXT,
    "laborRoleNameSnapshot" TEXT NOT NULL,
    "workers" INTEGER NOT NULL DEFAULT 1,
    "hours" DECIMAL(12,3) NOT NULL,
    "hourlyRateOverrideCents" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionLaborItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionMachineItem" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "machineId" TEXT,
    "machineNameSnapshot" TEXT NOT NULL,
    "timeUnit" "MachineTimeUnit" NOT NULL DEFAULT 'HOURS',
    "quantity" DECIMAL(12,3) NOT NULL,
    "rateOverrideCents" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionMachineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionMaterialItem" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionMaterialItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionExternalServiceItem" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionExternalServiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OverheadSettings_companyProfileId_key" ON "OverheadSettings"("companyProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "LaborRole_companyProfileId_name_key" ON "LaborRole"("companyProfileId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_companyProfileId_name_key" ON "Machine"("companyProfileId", "name");

-- CreateIndex
CREATE INDEX "Baustelle_companyProfileId_idx" ON "Baustelle"("companyProfileId");

-- CreateIndex
CREATE INDEX "TreeItem_baustelleId_idx" ON "TreeItem"("baustelleId");

-- CreateIndex
CREATE INDEX "TreeItem_treeId_idx" ON "TreeItem"("treeId");

-- CreateIndex
CREATE INDEX "WorkLog_baustelleId_idx" ON "WorkLog"("baustelleId");

-- CreateIndex
CREATE INDEX "WorkLog_userId_date_idx" ON "WorkLog"("userId", "date");

-- CreateIndex
CREATE INDEX "ManualTask_baustelleId_idx" ON "ManualTask"("baustelleId");

-- CreateIndex
CREATE INDEX "ManualTask_userId_idx" ON "ManualTask"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalculationTemplate_companyProfileId_name_key" ON "CalculationTemplate"("companyProfileId", "name");

-- AddForeignKey
ALTER TABLE "OverheadSettings" ADD CONSTRAINT "OverheadSettings_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborRole" ADD CONSTRAINT "LaborRole_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baustelle" ADD CONSTRAINT "Baustelle_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeItem" ADD CONSTRAINT "TreeItem_baustelleId_fkey" FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeItem" ADD CONSTRAINT "TreeItem_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_baustelleId_fkey" FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTask" ADD CONSTRAINT "ManualTask_baustelleId_fkey" FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTask" ADD CONSTRAINT "ManualTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationTemplate" ADD CONSTRAINT "CalculationTemplate_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplatePositionPreset" ADD CONSTRAINT "TemplatePositionPreset_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CalculationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPosition" ADD CONSTRAINT "ProjectPosition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionLaborItem" ADD CONSTRAINT "PositionLaborItem_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "ProjectPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionLaborItem" ADD CONSTRAINT "PositionLaborItem_laborRoleId_fkey" FOREIGN KEY ("laborRoleId") REFERENCES "LaborRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionMachineItem" ADD CONSTRAINT "PositionMachineItem_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "ProjectPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionMachineItem" ADD CONSTRAINT "PositionMachineItem_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionMaterialItem" ADD CONSTRAINT "PositionMaterialItem_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "ProjectPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionExternalServiceItem" ADD CONSTRAINT "PositionExternalServiceItem_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "ProjectPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
