ALTER TABLE "CompanyProfile" ADD COLUMN "uiIdentity" TEXT;
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_uiIdentity_check"
  CHECK ("uiIdentity" IS NULL OR ("mode" = 'bau' AND "uiIdentity" = 'crane-red-blue-v1'));
