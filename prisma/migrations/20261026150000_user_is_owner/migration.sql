-- Replace the hard-coded "primary admin" e-mail with an explicit owner flag.
ALTER TABLE "User" ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: the earliest active admin of each company becomes its owner.
UPDATE "User"
SET "isOwner" = true
WHERE "id" IN (
  SELECT DISTINCT ON ("companyProfileId") "id"
  FROM "User"
  WHERE "role" = 'ADMIN' AND "isActive" = true AND "companyProfileId" IS NOT NULL
  ORDER BY "companyProfileId", "createdAt" ASC, "id" ASC
);
