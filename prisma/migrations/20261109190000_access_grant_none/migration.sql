-- "none" = taken away with the key button (Hiq), overriding the level.
ALTER TABLE "AccessGrant" DROP CONSTRAINT "AccessGrant_level_check";
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_level_check" CHECK ("level" IN ('view','act','none'));
