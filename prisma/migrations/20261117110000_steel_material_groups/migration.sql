ALTER TABLE "SiteElement"
  ADD COLUMN "isManual" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "assemblyParts" JSONB;
