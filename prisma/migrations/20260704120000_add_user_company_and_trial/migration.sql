-- T-026: link admin/staff users to their tenant + SaaS trial expiry.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "companyProfileId" TEXT;

-- AlterTable
ALTER TABLE "CompanyProfile" ADD COLUMN "trialEndsAt" TIMESTAMP(3);

-- Backfill: link all existing users to the (single) existing company on
-- dedicated deployments. Safe when there is exactly one CompanyProfile;
-- no-op when there are none. SaaS deployments run this migration on a
-- fresh DB, so backfill has no rows to touch.
UPDATE "User"
SET "companyProfileId" = (SELECT "id" FROM "CompanyProfile" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "companyProfileId" IS NULL
  AND (SELECT COUNT(*) FROM "CompanyProfile") = 1;

-- CreateIndex
CREATE INDEX "User_companyProfileId_idx" ON "User"("companyProfileId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyProfileId_fkey"
  FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
