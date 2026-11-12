-- A service workshop is an explicit workplace, separate from the steel factory site.
-- No attendance history is rewritten. Keep the existing location exclusivity check.
BEGIN;
ALTER TABLE "WorkSession" DROP CONSTRAINT "WorkSession_workplace_check";
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_workplace_check"
  CHECK ("workplace" IS NULL OR ("workplace" IN ('OFFICE', 'WORKSHOP') AND "baustelleId" IS NULL));
COMMIT;
