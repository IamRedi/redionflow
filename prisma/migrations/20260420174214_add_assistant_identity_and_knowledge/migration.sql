-- CreateEnum
CREATE TYPE "AssistantLanguage" AS ENUM ('DE', 'SQ');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiPersonalityNote" TEXT,
ADD COLUMN     "preferredLanguage" "AssistantLanguage" NOT NULL DEFAULT 'DE';

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "aiPersonalityNote" TEXT,
ADD COLUMN     "preferredLanguage" "AssistantLanguage" NOT NULL DEFAULT 'DE';

-- CreateTable
CREATE TABLE "CompanyKnowledge" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "language" "AssistantLanguage" NOT NULL DEFAULT 'DE',
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyKnowledge_companyProfileId_isActive_idx" ON "CompanyKnowledge"("companyProfileId", "isActive");

-- CreateIndex
CREATE INDEX "CompanyKnowledge_companyProfileId_language_idx" ON "CompanyKnowledge"("companyProfileId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyKnowledge_companyProfileId_key_key" ON "CompanyKnowledge"("companyProfileId", "key");

-- AddForeignKey
ALTER TABLE "CompanyKnowledge" ADD CONSTRAINT "CompanyKnowledge_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
