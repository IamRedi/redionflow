-- PersonalFlow was removed as a product mode. Move any remaining rows to the
-- default product and let the database reject unknown modes from now on.
UPDATE "CompanyProfile" SET "mode" = 'baumdienst' WHERE "mode" NOT IN ('baumdienst', 'bau');

ALTER TABLE "CompanyProfile"
  ADD CONSTRAINT "CompanyProfile_mode_check" CHECK ("mode" IN ('baumdienst', 'bau'));
