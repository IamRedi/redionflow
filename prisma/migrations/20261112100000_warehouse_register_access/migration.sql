-- Add one bounded choice to the existing access system. No grants/data are changed.
BEGIN;
ALTER TABLE "AccessGrant" DROP CONSTRAINT "AccessGrant_level_check";
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_level_check"
  CHECK ("level" IN ('view','act','none') OR ("place" = 'warehouse' AND "level" = 'register' AND "scopeId" = ''));
COMMIT;
