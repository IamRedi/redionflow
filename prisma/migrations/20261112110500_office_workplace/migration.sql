-- Additive only: historical sessions and hour calculations stay unchanged.
ALTER TABLE "WorkSession" ADD COLUMN "workplace" TEXT;
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_workplace_check"
  CHECK ("workplace" IS NULL OR ("workplace" = 'OFFICE' AND "baustelleId" IS NULL));
