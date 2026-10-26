-- Allow Baustellen material movements (Zaun/Schilder) to be performed by either
-- workers or admins. Existing worker movements keep their worker relation.

ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_workerId_fkey";

ALTER TABLE "InventoryMovement"
  ALTER COLUMN "workerId" DROP NOT NULL,
  ADD COLUMN "actorAdminId" TEXT,
  ADD COLUMN "actorRole" TEXT NOT NULL DEFAULT 'WORKER',
  ADD COLUMN "actorName" TEXT;

UPDATE "InventoryMovement" im
SET "actorName" = TRIM(CONCAT(w."firstName", ' ', w."lastName"))
FROM "Worker" w
WHERE im."workerId" = w."id"
  AND (im."actorName" IS NULL OR im."actorName" = '');

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_actorAdminId_fkey"
  FOREIGN KEY ("actorAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "InventoryMovement_actorAdminId_timestamp_idx" ON "InventoryMovement"("actorAdminId", "timestamp");
