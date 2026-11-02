-- Country per company: drives currency, public holidays and defaults.
ALTER TABLE "CompanyProfile" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'DE';
ALTER TABLE "CompanyProfile"
  ADD CONSTRAINT "CompanyProfile_country_check" CHECK ("country" IN ('DE', 'AL'));
