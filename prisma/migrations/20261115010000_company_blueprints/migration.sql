-- Additive only: no existing tenant is enrolled, rewritten or inferred from its name.
ALTER TABLE "CompanyProfile" ADD COLUMN "setupProfile" JSONB;
ALTER TABLE "CompanyProfile" ADD COLUMN "setupDigest" TEXT;
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_setup_pair"
  CHECK (("setupProfile" IS NULL AND "setupDigest" IS NULL) OR
         ("setupProfile" IS NOT NULL AND "setupDigest" IS NOT NULL AND "setupDigest" ~ '^[a-f0-9]{64}$'));
